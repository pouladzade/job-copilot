import { join } from 'path';

/**
 * Absolute path to the data/ directory at the monorepo root.
 * Prefers DATA_DIR env var; falls back to resolution from __dirname.
 */
export const DATA_DIR: string =
  process.env['DATA_DIR'] !== undefined
    ? process.env['DATA_DIR']
    : join(__dirname, '..', '..', '..', '..', 'data');

/**
 * Absolute path to the prompts/ directory at the monorepo root.
 * Prefers PROMPTS_DIR env var; falls back to resolution from __dirname.
 */
export const PROMPTS_DIR: string =
  process.env['PROMPTS_DIR'] !== undefined
    ? process.env['PROMPTS_DIR']
    : join(__dirname, '..', '..', '..', '..', 'prompts');
