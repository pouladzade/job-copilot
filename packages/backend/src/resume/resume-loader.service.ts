import { Injectable, Logger } from '@nestjs/common';
import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { DATA_DIR } from '../config/constants';

@Injectable()
export class ResumeLoaderService {
  private readonly logger = new Logger(ResumeLoaderService.name);
  private readonly resumesDir: string = join(DATA_DIR, 'resumes');

  constructor() {
    // DATA_DIR resolved via config/constants.ts
  }

  listResumes(): string[] {
    if (!existsSync(this.resumesDir)) {
      this.logger.warn(`Resumes directory not found: ${this.resumesDir}`);

      return [];
    }

    const entries = readdirSync(this.resumesDir, { withFileTypes: true });
    const files = entries.filter((e) => e.isFile()).map((e) => e.name);
    const mdFiles = files.filter((f) => f.endsWith('.md'));

    this.logger.warn(`Found ${mdFiles.length} resume(s) in ${this.resumesDir}`);

    return mdFiles;
  }

  loadResume(filename: string): string {
    const filepath = join(this.resumesDir, filename);

    return readFileSync(filepath, 'utf-8');
  }
}