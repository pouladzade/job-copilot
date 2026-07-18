import { Controller, Post, HttpCode, HttpStatus, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ResumeLoaderService } from './resume-loader.service';
import { ResumeIndexService } from './resume-index.service';
import { LlmService } from '../llm/llm.service';
import { ResumeIndexResponseDto } from './dto/resume-index.dto';

@ApiTags('resumes')
@Controller('resumes')
export class ResumeController {
  constructor(
    @Inject(ResumeLoaderService) private readonly resumeLoader: ResumeLoaderService,
    @Inject(ResumeIndexService) private readonly resumeIndex: ResumeIndexService,
    @Inject(LlmService) private readonly llm: LlmService,
  ) {}

  @Post('refresh-index')
  @ApiOperation({ summary: 'Regenerate resume index tags via DeepSeek' })
  @ApiResponse({ status: 200, description: 'Index refreshed', type: ResumeIndexResponseDto })
  @HttpCode(HttpStatus.OK)
  async refreshIndex(): Promise<ResumeIndexResponseDto> {
    const filenames = this.resumeLoader.listResumes();
    const tags: Record<string, string[]> = {};
    let totalTokens = 0;
    let totalCost = 0;

    for (const filename of filenames) {
      const content = this.resumeLoader.loadResume(filename);
      const prompt = `Extract 8-12 keyword tags from this resume. Return ONLY a JSON array of strings, no markdown fences.\n\n${content}`;

      const result = await this.llm.generateWithRetry([
        { role: 'user', content: prompt },
      ]);

      totalTokens += result.usage.totalTokens;
      totalCost += result.usage.estimatedCostUsd;

      let parsedTags: string[];
      try {
        parsedTags = JSON.parse(result.content) as string[];
        if (!Array.isArray(parsedTags)) {
          parsedTags = [];
        }
      } catch {
        parsedTags = [];
      }

      tags[filename] = parsedTags;
    }

    this.resumeIndex.saveIndex(
      Object.fromEntries(Object.entries(tags).map(([key, value]) => [key, { tags: value }])),
    );

    return {
      message: `Resume index refreshed for ${filenames.length} resume(s)`,
      tags,
      tokenUsage: {
        totalTokens,
        estimatedCostUsd: totalCost,
      },
    };
  }
}