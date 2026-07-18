import { Injectable, Logger } from '@nestjs/common';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { KEYWORD_MATCH_THRESHOLD } from '@job-hunter/shared';
import { DATA_DIR } from '../config/constants';

export interface ResumeTags {
  tags: string[];
}

export interface ResumeIndex {
  [filename: string]: ResumeTags;
}

export interface MatchResult {
  filename: string;
  score: number;
}

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'shall', 'can', 'need', 'dare',
  'ought', 'used', 'it', 'its', 'we', 'you', 'they', 'he', 'she',
  'this', 'that', 'these', 'those', 'not', 'no', 'nor', 'so', 'as',
  'if', 'then', 'than', 'too', 'very', 'just', 'about', 'above',
  'after', 'again', 'all', 'also', 'any', 'because', 'before',
  'between', 'both', 'each', 'few', 'more', 'most', 'other', 'some',
  'such', 'only', 'own', 'same', 'into', 'over', 'under', 'up', 'out',
  'off', 'down', 'here', 'there', 'when', 'where', 'why', 'how',
]);

@Injectable()
export class ResumeIndexService {
  private readonly logger = new Logger(ResumeIndexService.name);
  private readonly indexPath: string;

  constructor() {
    this.indexPath = join(DATA_DIR, 'resume_index.json');
  }

  loadIndex(): ResumeIndex {
    if (!existsSync(this.indexPath)) {
      this.logger.warn('resume_index.json not found — auto-matching unavailable');

      return {};
    }

    const raw = readFileSync(this.indexPath, 'utf-8');
    const parsed = JSON.parse(raw) as unknown;

    if (typeof parsed !== 'object' || parsed === null) {
      return {};
    }

    return parsed as ResumeIndex;
  }

  match(description: string): MatchResult[] {
    const index = this.loadIndex();
    const filenames = Object.keys(index);

    if (filenames.length === 0) {
      return [];
    }

    const tokens = this.tokenize(description);
    const scores: MatchResult[] = [];

    for (const filename of filenames) {
      const resumeTags = index[filename];
      if (resumeTags === undefined) {
        continue;
      }

      const tagSet = new Set(resumeTags.tags.map((t) => t.toLowerCase()));
      let score = 0;

      for (const token of tokens) {
        if (tagSet.has(token)) {
          score += 1;
        }
      }

      scores.push({ filename, score });
    }

    scores.sort((a, b) => b.score - a.score);

    return scores;
  }

  getBestMatch(description: string): MatchResult | undefined {
    const scores = this.match(description);
    const best = scores[0];

    if (best === undefined || best.score < KEYWORD_MATCH_THRESHOLD) {
      return undefined;
    }

    return best;
  }

  saveIndex(index: ResumeIndex): void {
    writeFileSync(this.indexPath, JSON.stringify(index, null, 2), 'utf-8');
    this.logger.warn(`Saved resume index with ${Object.keys(index).length} entry/entries`);
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 1 && !STOP_WORDS.has(word));
  }
}