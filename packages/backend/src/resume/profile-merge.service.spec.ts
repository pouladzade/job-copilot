import { ProfileMergeService } from './profile-merge.service';

jest.mock('fs');
import { existsSync, readFileSync } from 'fs';

const mockedExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;
const mockedReadFileSync = readFileSync as jest.MockedFunction<typeof readFileSync>;

describe('ProfileMergeService', () => {
  let service: ProfileMergeService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProfileMergeService();
  });

  describe('merge', () => {
    it('should return setupRequired when default.json is missing', () => {
      mockedExistsSync.mockReturnValue(false);

      const result = service.merge();

      expect(result.setupRequired).toBe(true);
      expect(result.profile).toEqual({});
    });

    it('should return default profile when no variant specified', () => {
      mockedExistsSync.mockImplementation((path: Parameters<typeof existsSync>[0]): boolean => {
        return String(path).includes('default.json');
      });

      mockedReadFileSync.mockReturnValue(
        JSON.stringify({ workAuthorization: 'US Citizen', salaryExpectations: '$140K-$170K' }),
      );

      const result = service.merge();

      expect(result.setupRequired).toBe(false);
      expect(result.profile['workAuthorization']).toBe('US Citizen');
      expect(result.profile['salaryExpectations']).toBe('$140K-$170K');
    });

    it('should merge variant profile over default', () => {
      mockedExistsSync.mockReturnValue(true);

      mockedReadFileSync.mockImplementation((path: Parameters<typeof readFileSync>[0]): string => {
        if (String(path).includes('backend.json')) {
          return JSON.stringify({ yearsPythonExperience: '7 years' });
        }

        return JSON.stringify({ workAuthorization: 'US Citizen', yearsPythonExperience: '5 years' });
      });

      const result = service.merge('backend');

      expect(result.setupRequired).toBe(false);
      expect(result.profile['yearsPythonExperience']).toBe('7 years');
      expect(result.profile['workAuthorization']).toBe('US Citizen');
    });

    it('should fall back to default only when variant profile is missing', () => {
      mockedExistsSync.mockImplementation((path: Parameters<typeof existsSync>[0]): boolean => {
        return String(path).includes('default.json');
      });

      mockedReadFileSync.mockReturnValue(
        JSON.stringify({ workAuthorization: 'US Citizen' }),
      );

      const result = service.merge('missing-variant');

      expect(result.setupRequired).toBe(false);
      expect(result.profile['workAuthorization']).toBe('US Citizen');
    });
  });
});