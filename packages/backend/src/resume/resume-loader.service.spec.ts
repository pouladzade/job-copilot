import { ResumeLoaderService } from './resume-loader.service';

jest.mock('fs');
import { readdirSync, readFileSync, existsSync } from 'fs';

const mockedExistsSync = existsSync as unknown as jest.Mock<boolean, [string]>;
const mockedReaddirSync = readdirSync as unknown as jest.Mock<Array<{ isFile: () => boolean; name: string }>, [string, { withFileTypes: true }]>;
const mockedReadFileSync = readFileSync as unknown as jest.Mock<string, [string, string]>;

describe('ResumeLoaderService', () => {
  let service: ResumeLoaderService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ResumeLoaderService();
  });

  describe('listResumes', () => {
    it('should return .md files from the resumes directory', () => {
      mockedExistsSync.mockReturnValue(true);
      mockedReaddirSync.mockReturnValue([
        { isFile: () => true, name: 'backend.md' },
        { isFile: () => true, name: 'ml.md' },
        { isFile: () => true, name: 'notes.txt' },
        { isFile: () => true, name: 'frontend.md' },
      ]);

      const result = service.listResumes();

      expect(result).toEqual(['backend.md', 'ml.md', 'frontend.md']);
    });

    it('should return empty array when directory does not exist', () => {
      mockedExistsSync.mockReturnValue(false);

      const result = service.listResumes();

      expect(result).toEqual([]);
    });

    it('should return empty array when no .md files exist', () => {
      mockedExistsSync.mockReturnValue(true);
      mockedReaddirSync.mockReturnValue([
        { isFile: () => true, name: 'notes.txt' },
        { isFile: () => true, name: 'data.json' },
      ]);

      const result = service.listResumes();

      expect(result).toEqual([]);
    });
  });

  describe('loadResume', () => {
    it('should read and return file contents', () => {
      mockedReadFileSync.mockReturnValue('Resume content here');

      const result = service.loadResume('backend.md');

      expect(result).toBe('Resume content here');
    });

    it('should throw when file does not exist', () => {
      mockedReadFileSync.mockImplementation(() => {
        throw new Error('ENOENT');
      });

      expect(() => service.loadResume('missing.md')).toThrow('ENOENT');
    });
  });
});