export declare const APPLICATION_STATUSES: readonly [
  'draft',
  'submitted',
  'interview',
  'offer',
  'rejected',
  'withdrawn',
];
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];
export declare const CONFIDENCE_TIERS: readonly ['low', 'medium', 'high'];
export type ConfidenceTier = (typeof CONFIDENCE_TIERS)[number];
export declare const RESUME_SELECTION_REASONS: readonly ['auto-matched', 'user-selected', 'last-used-for-company'];
export type ResumeSelectionReason = (typeof RESUME_SELECTION_REASONS)[number];
export declare const ADAPTER_IDS: readonly ['greenhouse', 'lever', 'ashby', 'indeed', 'linkedin', 'other'];
export type AdapterId = (typeof ADAPTER_IDS)[number];
export declare const CONFIDENCE_TIER_RANGES: Record<
  ConfidenceTier,
  {
    min: number;
    max: number;
  }
>;
export declare const REQUEST_SIZE_LIMIT_BYTES = 50000;
export declare const MAX_JOB_DESCRIPTION_LENGTH = 50000;
export declare const MAX_RETRIES = 1;
export declare const LLM_TIMEOUT_MS = 30000;
export declare const LLM_DEFAULT_TEMPERATURE = 0.4;
export declare const LLM_DEFAULT_MAX_TOKENS = 1800;
export declare const LLM_COST_PER_1K: Record<
  string,
  {
    prompt: number;
    completion: number;
  }
>;
export declare const KEYWORD_MATCH_THRESHOLD = 2;
export declare const FUZZY_MATCH_THRESHOLD = 0.6;
export declare const DB_POOL_DEFAULT_PORT = 5433;
export declare const DB_POOL_MAX = 5;
export declare const BACKEND_PORT = 4001;
export declare const HTTP_STATUS: {
  readonly OK: 200;
  readonly CREATED: 201;
  readonly BAD_REQUEST: 400;
  readonly UNAUTHORIZED: 401;
  readonly FORBIDDEN: 403;
  readonly NOT_FOUND: 404;
  readonly CONFLICT: 409;
  readonly PAYLOAD_TOO_LARGE: 413;
  readonly TOO_MANY_REQUESTS: 429;
  readonly INTERNAL_SERVER_ERROR: 500;
  readonly BAD_GATEWAY: 502;
  readonly SERVICE_UNAVAILABLE: 503;
};
//# sourceMappingURL=index.d.ts.map
