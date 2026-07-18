import { Injectable, HttpException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { createHash } from 'crypto';
import {
  ApplicationDraftDto,
  ScreeningAnswerDto,
  TokenUsageDto,
  SaveApplicationDto,
  ListApplicationsQueryDto,
  ListApplicationsResponseDto,
  CONFIDENCE_TIER_RANGES,
  HTTP_STATUS,
} from '@job-hunter/shared';
import type { JobPostingDto, ConfidenceTier, ApplicationStatus } from '@job-hunter/shared';
import { Application } from '../database/entities/application.entity';
import { TokenUsageLog } from '../database/entities/token-usage-log.entity';
import { LlmService, LlmError, type TokenUsage } from '../llm/llm.service';
import { PromptBuilderService, type PromptContext } from '../prompts/prompt-builder.service';
import { PiiFilterService } from '../validation/pii-filter.service';
import { ResponseValidatorService } from '../validation/response-validator.service';
import { ResumeLoaderService } from '../resume/resume-loader.service';
import { ProfileMergeService } from '../resume/profile-merge.service';
import { ResumeIndexService } from '../resume/resume-index.service';

@Injectable()
export class ApplicationService {
  constructor(
    @InjectRepository(Application)
    private readonly applicationRepo: Repository<Application>,
    @InjectRepository(TokenUsageLog)
    private readonly tokenLogRepo: Repository<TokenUsageLog>,
    private readonly llm: LlmService,
    private readonly prompts: PromptBuilderService,
    private readonly piiFilter: PiiFilterService,
    private readonly validator: ResponseValidatorService,
    private readonly resumeLoader: ResumeLoaderService,
    private readonly profileMerge: ProfileMergeService,
    private readonly resumeIndex: ResumeIndexService,
  ) {}

  // ── 4.1 Repository methods ────────────────────────────────────────────────

  async findById(id: number): Promise<Application | null> {
    return this.applicationRepo.findOne({ where: { id } });
  }

  async findByUrl(url: string): Promise<Application | null> {
    return this.applicationRepo.findOne({ where: { sourceUrl: url } });
  }

  async update(id: number, dto: SaveApplicationDto): Promise<{ id: number; savedAt: string }> {
    const existing = await this.findById(id);

    if (existing === null) {
      throw new HttpException(
        { error: 'not_found', message: `Application ${id.toString()} not found` },
        HTTP_STATUS.NOT_FOUND,
      );
    }

    const updated = await this.applicationRepo.save({
      id,
      resumeSummary: dto.resumeSummary,
      coverLetter: dto.coverLetter,
      screeningAnswers: dto.screeningAnswers,
      status: dto.status,
      notes: dto.notes ?? existing.notes,
    });

    return { id, savedAt: updated.updatedAt.toISOString() };
  }

  async list(query: ListApplicationsQueryDto): Promise<ListApplicationsResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Record<string, unknown> = {};

    if (query.company !== undefined && query.company !== '') {
      where['company'] = ILike(`%${query.company}%`);
    }

    if (query.status !== undefined) {
      where['status'] = query.status;
    }

    if (query.resumeUsed !== undefined && query.resumeUsed !== '') {
      where['resumeUsed'] = query.resumeUsed;
    }

    const [rows, total] = await this.applicationRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const totalPages = Math.ceil(total / limit);

    return {
      total,
      page,
      totalPages,
      applications: rows as unknown as Array<Record<string, unknown>>,
    };
  }

  async updateStatus(id: number, status: ApplicationStatus): Promise<{ id: number; status: ApplicationStatus }> {
    const existing = await this.findById(id);

    if (existing === null) {
      throw new HttpException(
        { error: 'not_found', message: `Application ${id.toString()} not found` },
        HTTP_STATUS.NOT_FOUND,
      );
    }

    await this.applicationRepo.save({ id, status });

    return { id, status };
  }

  // ── 4.5 URL Deduplication + Generate ──────────────────────────────────────

  async generate(jobPosting: JobPostingDto): Promise<ApplicationDraftDto> {
    // ── 4.5: URL dedup BEFORE any DeepSeek call ──
    const duplicate = await this.findByUrl(jobPosting.sourceUrl);

    if (duplicate !== null) {
      throw new HttpException(
        {
          error: 'duplicate_url',
          message: 'An application already exists for this job URL.',
          existingApplicationId: duplicate.id,
          existingApplication: {
            id: duplicate.id,
            company: duplicate.company,
            role: duplicate.role,
            status: duplicate.status,
            createdAt: duplicate.createdAt.toISOString(),
          },
        },
        HTTP_STATUS.CONFLICT,
      );
    }

    const generatedAt = new Date().toISOString();

    // Step 1: Select resume (hint → auto-match)
    let resumeUsed: string;
    let resumeSelectionReason: string;

    if (jobPosting.resumeHint !== undefined && jobPosting.resumeHint !== null) {
      resumeUsed = jobPosting.resumeHint;
      resumeSelectionReason = 'user-selected';
    } else {
      const bestMatch = this.resumeIndex.getBestMatch(jobPosting.description);
      if (bestMatch !== undefined) {
        resumeUsed = bestMatch.filename;
        resumeSelectionReason = 'auto-matched';
      } else {
        const resumes = this.resumeLoader.listResumes();
        const firstResume = resumes[0];
        if (firstResume !== undefined) {
          resumeUsed = firstResume;
          resumeSelectionReason = 'auto-matched';
        } else {
          throw new HttpException(
            { error: 'no_resume', message: 'No resumes found in data/resumes/' },
            HTTP_STATUS.INTERNAL_SERVER_ERROR,
          );
        }
      }
    }

    // Step 2: Load resume + merge profile
    const resumeContent = this.resumeLoader.loadResume(resumeUsed);
    const merged = this.profileMerge.merge();
    const profileContent = JSON.stringify(merged.profile);

    // Step 3: PII filter
    const resumeResult = this.piiFilter.filter(resumeContent);
    const profileResult = this.piiFilter.filter(profileContent);

    const promptContext: PromptContext = {
      jobDescription: jobPosting.description,
      resumeContent: resumeResult.clean,
      profileContent: profileResult.clean,
    };

    // Step 4: Generate summary
    const tailorPrompt = this.prompts.buildTailorPrompt(promptContext);
    const tailorResult = await this.callLlm(tailorPrompt);

    // Step 5: Generate cover letter
    const coverLetterPrompt = this.prompts.buildCoverLetterPrompt(promptContext);
    const coverLetterResult = await this.callLlm(coverLetterPrompt);

    // Step 6: Generate screening answers
    const screeningPrompt = this.prompts.buildScreeningPrompt(promptContext);
    const screeningResult = await this.callLlm(screeningPrompt);

    const combinedTokenUsage: TokenUsage = {
      promptTokens: tailorResult.usage.promptTokens + coverLetterResult.usage.promptTokens + screeningResult.usage.promptTokens,
      completionTokens: tailorResult.usage.completionTokens + coverLetterResult.usage.completionTokens + screeningResult.usage.completionTokens,
      totalTokens: tailorResult.usage.totalTokens + coverLetterResult.usage.totalTokens + screeningResult.usage.totalTokens,
      model: tailorResult.usage.model,
      estimatedCostUsd: tailorResult.usage.estimatedCostUsd + coverLetterResult.usage.estimatedCostUsd + screeningResult.usage.estimatedCostUsd,
    };

    const resumeSummary = tailorResult.data['resumeSummary'] !== undefined && typeof tailorResult.data['resumeSummary'] === 'string'
      ? tailorResult.data['resumeSummary']
      : '';

    const coverLetter = coverLetterResult.data['coverLetter'] !== undefined && typeof coverLetterResult.data['coverLetter'] === 'string'
      ? coverLetterResult.data['coverLetter']
      : '';

    const screeningAnswers = this.buildScreeningAnswers(screeningResult.data);
    const missingInformation = this.buildMissingInformation(screeningResult.data);

    const overallConfidence = screeningAnswers.length > 0
      ? screeningAnswers.reduce((sum, a) => sum + a.confidence, 0) / screeningAnswers.length
      : 0.5;

    const tokenUsageDto: TokenUsageDto = {
      promptTokens: combinedTokenUsage.promptTokens,
      completionTokens: combinedTokenUsage.completionTokens,
      totalTokens: combinedTokenUsage.totalTokens,
      estimatedCostUsd: combinedTokenUsage.estimatedCostUsd,
    };

    const overallConfidenceTier = this.computeTier(overallConfidence);

    // Final validation: validate combined draft against ApplicationDraftDto schema
    const validationResult = await this.validator.validate(JSON.stringify({
      schemaVersion: 1,
      resumeSummary,
      coverLetter,
      screeningAnswers,
      missingInformation,
      overallConfidence,
      overallConfidenceTier,
      resumeUsed,
      resumeSelectionReason,
      generatedAt,
      tokenUsage: tokenUsageDto,
    }));

    if (!validationResult.valid || validationResult.draft === undefined) {
      throw new HttpException(
        {
          error: 'invalid_combined_draft',
          message: 'Generated draft failed schema validation.',
          validationErrors: validationResult.errors,
        },
        HTTP_STATUS.BAD_GATEWAY,
      );
    }

    const draft = validationResult.draft;

    // Step 8: Persist application
    const saved = await this.applicationRepo.save(
      this.applicationRepo.create({
        schemaVersion: 1,
        company: jobPosting.company,
        role: jobPosting.title,
        location: jobPosting.location ?? null,
        sourceUrl: jobPosting.sourceUrl,
        sourceSite: jobPosting.sourceSite,
        resumeUsed,
        resumeSelectionReason,
        resumeSummary,
        coverLetter,
        screeningAnswers,
        overallConfidence,
        status: 'draft',
        notes: null,
      }),
    );

    // Step 9: Log token usage (linked to application)
    const log = this.tokenLogRepo.create({
      applicationId: saved.id,
      model: combinedTokenUsage.model,
      promptTokens: combinedTokenUsage.promptTokens,
      completionTokens: combinedTokenUsage.completionTokens,
      totalTokens: combinedTokenUsage.totalTokens,
      estimatedCostUsd: combinedTokenUsage.estimatedCostUsd,
    });
    await this.tokenLogRepo.save(log);

    return draft;
  }

  private async callLlm(
    prompt: string,
  ): Promise<{ data: Record<string, unknown>; usage: TokenUsage }> {
    const messages: Array<{ role: 'system' | 'user'; content: string }> = [
      { role: 'user', content: prompt },
    ];

    try {
      const result = await this.llm.generateWithRetry(messages);

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(result.content) as Record<string, unknown>;
      } catch {
        throw new HttpException(
          { error: 'invalid_llm_response', message: 'LLM returned unparseable JSON', rawResponse: result.content },
          HTTP_STATUS.BAD_GATEWAY,
        );
      }

      return { data: parsed, usage: result.usage };
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      if (error instanceof LlmError) {
        throw new HttpException(
          { error: 'llm_unavailable', message: error.message, retryAfterSeconds: 30 },
          HTTP_STATUS.SERVICE_UNAVAILABLE,
        );
      }

      throw new HttpException(
        { error: 'llm_unavailable', message: 'LLM API call failed' },
        HTTP_STATUS.SERVICE_UNAVAILABLE,
      );
    }
  }

  private buildScreeningAnswers(data: Record<string, unknown>): ScreeningAnswerDto[] {
    const raw = data['screeningAnswers'];
    if (!Array.isArray(raw)) {
      return [];
    }

    return raw.map((item: unknown) => {
      const obj = item as Record<string, unknown>;
      const confidence = typeof obj['confidence'] === 'number' ? obj['confidence'] : 0;

      return {
        questionId: typeof obj['questionId'] === 'string' ? obj['questionId'] : createHash('sha256').update(String(obj['question'] ?? '')).digest('hex').slice(0, 8),
        question: typeof obj['question'] === 'string' ? obj['question'] : '',
        answer: typeof obj['answer'] === 'string' ? obj['answer'] : '',
        confidence,
        confidenceTier: this.computeTier(confidence),
      };
    });
  }

  private buildMissingInformation(data: Record<string, unknown>): string[] {
    const raw = data['missingInformation'];
    if (!Array.isArray(raw)) {
      return [];
    }

    return raw.filter((item: unknown): item is string => typeof item === 'string');
  }

  private computeTier(confidence: number): ConfidenceTier {
    if (confidence <= CONFIDENCE_TIER_RANGES.low.max) {
      return 'low';
    }

    if (confidence <= CONFIDENCE_TIER_RANGES.medium.max) {
      return 'medium';
    }

    return 'high';
  }
}