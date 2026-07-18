'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.HTTP_STATUS =
  exports.BACKEND_PORT =
  exports.DB_POOL_MAX =
  exports.DB_POOL_DEFAULT_PORT =
  exports.FUZZY_MATCH_THRESHOLD =
  exports.KEYWORD_MATCH_THRESHOLD =
  exports.LLM_COST_PER_1K =
  exports.LLM_DEFAULT_MAX_TOKENS =
  exports.LLM_DEFAULT_TEMPERATURE =
  exports.LLM_TIMEOUT_MS =
  exports.MAX_RETRIES =
  exports.MAX_JOB_DESCRIPTION_LENGTH =
  exports.REQUEST_SIZE_LIMIT_BYTES =
  exports.CONFIDENCE_TIER_RANGES =
  exports.ADAPTER_IDS =
  exports.RESUME_SELECTION_REASONS =
  exports.CONFIDENCE_TIERS =
  exports.APPLICATION_STATUSES =
    void 0;
exports.APPLICATION_STATUSES = ['draft', 'submitted', 'interview', 'offer', 'rejected', 'withdrawn'];
exports.CONFIDENCE_TIERS = ['low', 'medium', 'high'];
exports.RESUME_SELECTION_REASONS = ['auto-matched', 'user-selected', 'last-used-for-company'];
exports.ADAPTER_IDS = ['greenhouse', 'lever', 'ashby', 'indeed', 'linkedin', 'other'];
exports.CONFIDENCE_TIER_RANGES = {
  low: { min: 0, max: 0.3 },
  medium: { min: 0.3, max: 0.7 },
  high: { min: 0.7, max: 1 },
};
exports.REQUEST_SIZE_LIMIT_BYTES = 50000;
exports.MAX_JOB_DESCRIPTION_LENGTH = 50000;
exports.MAX_RETRIES = 1;
exports.LLM_TIMEOUT_MS = 30000;
exports.LLM_DEFAULT_TEMPERATURE = 0.4;
exports.LLM_DEFAULT_MAX_TOKENS = 1800;
exports.LLM_COST_PER_1K = {
  'deepseek-chat': { prompt: 0.00014, completion: 0.00028 },
  'deepseek-reasoner': { prompt: 0.00055, completion: 0.00219 },
};
exports.KEYWORD_MATCH_THRESHOLD = 2;
exports.FUZZY_MATCH_THRESHOLD = 0.6;
exports.DB_POOL_DEFAULT_PORT = 5433;
exports.DB_POOL_MAX = 5;
exports.BACKEND_PORT = 4001;
exports.HTTP_STATUS = {
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
};
//# sourceMappingURL=index.js.map
