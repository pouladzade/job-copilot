import { ResumeIndexService } from './resume-index.service';

jest.mock('fs');
import { existsSync, readFileSync, writeFileSync } from 'fs';

const mockedExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;
const mockedReadFileSync = readFileSync as jest.MockedFunction<typeof readFileSync>;
const mockedWriteFileSync = writeFileSync as jest.MockedFunction<typeof writeFileSync>;

const MOCK_INDEX = JSON.stringify({
  'backend.md': { tags: ['typescript', 'nodejs', 'postgresql', 'docker', 'aws'] },
  'frontend.md': { tags: ['react', 'frontend', 'typescript', 'css', 'nextjs'] },
});

describe('ResumeIndexService', () => {
  let service: ResumeIndexService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ResumeIndexService();
  });

  describe('loadIndex', () => {
    it('should return empty object when index file does not exist', () => {
      mockedExistsSync.mockReturnValue(false);

      const result = service.loadIndex();

      expect(result).toEqual({});
    });

    it('should return parsed index when file exists', () => {
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue(MOCK_INDEX);

      const result = service.loadIndex();

      expect(result['backend.md']).toBeDefined();
      expect(result['backend.md']?.tags).toContain('typescript');
    });
  });

  describe('match', () => {
    beforeEach(() => {
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue(MOCK_INDEX);
    });

    it('should score resumes by keyword overlap', () => {
      const description = 'Looking for a backend developer with TypeScript and PostgreSQL experience';

      const scores = service.match(description);

      expect(scores.length).toBeGreaterThanOrEqual(1);
      const backendScore = scores.find((s) => s.filename === 'backend.md');
      expect(backendScore).toBeDefined();
      expect(backendScore?.score).toBeGreaterThanOrEqual(2);
    });

    it('should rank backend over frontend for backend job', () => {
      const description = 'Senior backend engineer needed for PostgreSQL and Docker infrastructure';

      const scores = service.match(description);

      const backendScore = scores.find((s) => s.filename === 'backend.md');
      const frontendScore = scores.find((s) => s.filename === 'frontend.md');
      expect(backendScore?.score).toBeGreaterThan(frontendScore?.score ?? 0);
    });

    it('should return empty array when index is empty', () => {
      mockedReadFileSync.mockReturnValue('{}');

      const scores = service.match('any description');

      expect(scores).toEqual([]);
    });

    it('should filter out stop words from matching', () => {
      const description = 'We are looking for a developer with the experience in TypeScript and Kubernetes';

      const scores = service.match(description);

      const backendScore = scores.find((s) => s.filename === 'backend.md');
      expect(backendScore?.score).toBeGreaterThanOrEqual(1);
    });

    it('should be case-insensitive when matching', () => {
      const description = 'TYPESCRIPT POSTGRESQL DOCKER';

      const scores = service.match(description);

      const backendScore = scores.find((s) => s.filename === 'backend.md');
      expect(backendScore?.score).toBeGreaterThanOrEqual(3);
    });
  });

  describe('getBestMatch', () => {
    beforeEach(() => {
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue(MOCK_INDEX);
    });

    it('should return best match when score exceeds threshold', () => {
      const description = 'Looking for TypeScript backend developer with PostgreSQL experience';

      const match = service.getBestMatch(description);

      expect(match).toBeDefined();
      expect(match?.filename).toBe('backend.md');
    });

    it('should return undefined when no match exceeds threshold', () => {
      const description = 'Looking for a chef with culinary experience';

      const match = service.getBestMatch(description);

      expect(match).toBeUndefined();
    });
  });

  describe('saveIndex', () => {
    it('should write index to file', () => {
      const index = {
        'backend.md': { tags: ['typescript', 'nodejs'] },
      };

      service.saveIndex(index);

      expect(mockedWriteFileSync).toHaveBeenCalledTimes(1);
    });
  });
});