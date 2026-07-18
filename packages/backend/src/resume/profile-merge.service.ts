import { Injectable, Logger } from '@nestjs/common';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { DATA_DIR } from '../config/constants';

export interface MergedProfile {
  setupRequired: boolean;
  profile: Record<string, string>;
}

@Injectable()
export class ProfileMergeService {
  private readonly logger = new Logger(ProfileMergeService.name);
  private readonly profilesDir: string = join(DATA_DIR, 'profiles');

  constructor() {
    // DATA_DIR resolved via config/constants.ts
  }

  merge(variantName?: string): MergedProfile {
    const defaultPath = join(this.profilesDir, 'default.json');

    if (!existsSync(defaultPath)) {
      this.logger.warn('No default.json found — profile setup required');

      return { setupRequired: true, profile: {} };
    }

    const defaultProfile = this.loadJson(defaultPath);

    if (variantName === undefined) {
      return { setupRequired: false, profile: defaultProfile };
    }

    const variantPath = join(this.profilesDir, `${variantName}.json`);

    if (!existsSync(variantPath)) {
      this.logger.warn(`Variant profile not found: ${variantName}.json — using default only`);

      return { setupRequired: false, profile: defaultProfile };
    }

    const variantProfile = this.loadJson(variantPath);

    // Shallow merge: variant overrides default
    const merged = { ...defaultProfile, ...variantProfile };

    return { setupRequired: false, profile: merged };
  }

  private loadJson(filepath: string): Record<string, string> {
    const raw = readFileSync(filepath, 'utf-8');
    const parsed = JSON.parse(raw) as unknown;

    if (typeof parsed !== 'object' || parsed === null) {
      this.logger.warn(`Invalid profile format in ${filepath}`);

      return {};
    }

    const result: Record<string, string> = {};
    const obj = parsed as Record<string, unknown>;

    for (const [key, value] of Object.entries(obj)) {
      result[key] = typeof value === 'string' ? value : JSON.stringify(value);
    }

    return result;
  }
}