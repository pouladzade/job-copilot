import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import {
  DEEPSEEK_TIMEOUT_MS,
  DEEPSEEK_DEFAULT_TEMPERATURE,
  DEEPSEEK_DEFAULT_MAX_TOKENS,
  MAX_RETRIES,
  DEEPSEEK_COST_PER_1K,
} from '@job-hunter/shared';

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  model: string;
  estimatedCostUsd: number;
}

export class DeepSeekError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'DeepSeekError';
  }
}

@Injectable()
export class DeepSeekService {
  private readonly client: OpenAI;
  private readonly logger = new Logger(DeepSeekService.name);
  private readonly model: string;

  constructor() {
    const apiKey = process.env['DEEPSEEK_API_KEY'];
    if (apiKey === undefined || apiKey === '') {
      this.logger.error('DEEPSEEK_API_KEY is not set in environment');
      throw new Error('DEEPSEEK_API_KEY is required');
    }

    this.client = new OpenAI({
      apiKey,
      baseURL: 'https://api.deepseek.com/v1',
      timeout: DEEPSEEK_TIMEOUT_MS,
      maxRetries: 0,
      fetch: globalThis.fetch,
    });

    this.model = process.env['DEEPSEEK_MODEL'] ?? 'deepseek-chat';
  }

  async generateJson(
    messages: OpenAI.ChatCompletionMessageParam[],
    options?: { temperature?: number; maxTokens?: number },
  ): Promise<{ content: string; usage: TokenUsage }> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages,
      response_format: { type: 'json_object' },
      temperature: options?.temperature ?? DEEPSEEK_DEFAULT_TEMPERATURE,
      max_tokens: options?.maxTokens ?? DEEPSEEK_DEFAULT_MAX_TOKENS,
    });

    const usage = response.usage;
    const promptTokens = usage?.prompt_tokens ?? 0;
    const completionTokens = usage?.completion_tokens ?? 0;
    const totalTokens = usage?.total_tokens ?? 0;
    const model = this.model;

    const estimatedCostUsd = this.estimateCost({ promptTokens, completionTokens, totalTokens, model });

    return {
      content: response.choices[0]?.message?.content ?? '',
      usage: { promptTokens, completionTokens, totalTokens, model, estimatedCostUsd },
    };
  }

  async generateWithRetry(
    messages: OpenAI.ChatCompletionMessageParam[],
    options?: { temperature?: number; maxTokens?: number },
  ): Promise<{ content: string; usage: TokenUsage }> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await this.generateJson(messages, options);
      } catch (error: unknown) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.logger.warn(`DeepSeek API attempt ${attempt + 1} failed: ${lastError.message}`);

        if (this.isRateLimitOrAuthError(error)) {
          break;
        }

        if (attempt < MAX_RETRIES) {
          await this.delay(1000 * (attempt + 1));
        }
      }
    }

    throw lastError ?? new DeepSeekError('DeepSeek API call failed', 'UNKNOWN');
  }

  private estimateCost(usage: Omit<TokenUsage, 'estimatedCostUsd'>): number {
    const rates = DEEPSEEK_COST_PER_1K['deepseek-chat'];
    if (rates === undefined) {
      return 0;
    }

    return (usage.promptTokens / 1000) * rates.prompt + (usage.completionTokens / 1000) * rates.completion;
  }

  private isRateLimitOrAuthError(error: unknown): boolean {
    if (typeof error === 'object' && error !== null) {
      const err = error as { status?: number; code?: string };
      if (err.status === 401 || err.status === 429) {
        return true;
      }
      if (err.code === 'insufficient_quota') {
        return true;
      }
    }

    return false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}