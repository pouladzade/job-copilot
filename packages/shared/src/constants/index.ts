export const APPLICATION_STATUSES = ['draft', 'submitted', 'interview', 'offer', 'rejected', 'withdrawn'] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const CONFIDENCE_TIERS = ['low', 'medium', 'high'] as const;

export type ConfidenceTier = (typeof CONFIDENCE_TIERS)[number];

export const RESUME_SELECTION_REASONS = ['auto-matched', 'user-selected', 'last-used-for-company'] as const;

export type ResumeSelectionReason = (typeof RESUME_SELECTION_REASONS)[number];

export const ADAPTER_IDS = ['greenhouse', 'lever', 'ashby', 'indeed', 'linkedin', 'other'] as const;

export type AdapterId = (typeof ADAPTER_IDS)[number];

export const CONFIDENCE_TIER_RANGES: Record<ConfidenceTier, { min: number; max: number }> = {
  low: { min: 0, max: 0.3 },
  medium: { min: 0.3, max: 0.7 },
  high: { min: 0.7, max: 1 },
};

export const REQUEST_SIZE_LIMIT_BYTES = 50000;

export const MAX_JOB_DESCRIPTION_LENGTH = 50000;

export const MAX_RETRIES = 1;

export const LLM_TIMEOUT_MS = 30000;

export const LLM_DEFAULT_TEMPERATURE = 0.4;

export const LLM_DEFAULT_MAX_TOKENS = 1800;

export const LLM_COST_PER_1K: Record<string, { prompt: number; completion: number }> = {
  'deepseek-chat': { prompt: 0.00014, completion: 0.00028 },
  'deepseek-reasoner': { prompt: 0.00055, completion: 0.00219 },
};

export const KEYWORD_MATCH_THRESHOLD = 2;

export const FUZZY_MATCH_THRESHOLD = 0.6;

export const DB_POOL_DEFAULT_PORT = 5433;

export const DB_POOL_MAX = 5;

export const BACKEND_PORT = 4001;

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
} as const;
