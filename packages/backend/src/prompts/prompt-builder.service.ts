import { Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { PROMPTS_DIR } from '../config/constants';

export interface PromptContext {
  jobDescription: string;
  resumeContent: string;
  profileContent: string;
  screeningQuestionsJson?: string;
}

@Injectable()
export class PromptBuilderService {
  private readonly templatesDir: string = PROMPTS_DIR;

  constructor() {
    // PROMPTS_DIR resolved via config/constants.ts
  }

  buildTailorPrompt(context: PromptContext): string {
    const template = this.loadTemplate('tailor.v1.md');

    return template.replace('{{jobDescription}}', context.jobDescription).replace('{{resumeContent}}', context.resumeContent);
  }

  buildCoverLetterPrompt(context: PromptContext): string {
    const template = this.loadTemplate('cover-letter.v1.md');

    return template
      .replace('{{jobDescription}}', context.jobDescription)
      .replace('{{resumeContent}}', context.resumeContent)
      .replace('{{profileContent}}', context.profileContent);
  }

  buildScreeningPrompt(context: PromptContext): string {
    const template = this.loadTemplate('screening.v1.md');

    return template
      .replace('{{jobDescription}}', context.jobDescription)
      .replace('{{resumeContent}}', context.resumeContent)
      .replace('{{profileContent}}', context.profileContent)
      .replace('{{screeningQuestionsJson}}', context.screeningQuestionsJson ?? '[]');
  }

  private loadTemplate(filename: string): string {
    const filepath = join(this.templatesDir, filename);

    return readFileSync(filepath, 'utf-8');
  }
}