import { buildLinkedInSearchUrl } from './linkedin-search-builder';
import type { LinkedInSearchConfig } from './linkedin-search-builder';

const BASE_CONFIG: LinkedInSearchConfig = {
  titles: [],
  includedSkills: [],
  excludedSkills: [],
  timeWindowHours: 0,
  sortByRecent: false,
  easyApply: false,
};

describe('buildLinkedInSearchUrl', () => {
  describe('titles', () => {
    it('wraps a single title in quotes', () => {
      const url = buildLinkedInSearchUrl({
        ...BASE_CONFIG,
        titles: ['Software Engineer'],
      });

      expect(url).toContain('keywords=%22Software+Engineer%22');
    });

    it('OR-groups multiple titles wrapped in quotes', () => {
      const url = buildLinkedInSearchUrl({
        ...BASE_CONFIG,
        titles: ['Software Engineer', 'Senior Software Engineer', 'Senior Architect'],
      });

      const decoded = decodeURIComponent(url);
      expect(decoded).toContain(
        '("Software+Engineer"+OR+"Senior+Software+Engineer"+OR+"Senior+Architect")',
      );
    });

    it('produces an empty keywords group when titles is empty', () => {
      const url = buildLinkedInSearchUrl({
        ...BASE_CONFIG,
        titles: [],
      });

      expect(url).toBe('https://www.linkedin.com/jobs/search/?keywords=');
    });

    it('handles a single empty string as no title', () => {
      const url = buildLinkedInSearchUrl({
        ...BASE_CONFIG,
        titles: [''],
      });

      expect(url).toBe('https://www.linkedin.com/jobs/search/?keywords=');
    });
  });

  describe('included skills', () => {
    it('adds AND and an OR group for included skills', () => {
      const url = buildLinkedInSearchUrl({
        ...BASE_CONFIG,
        titles: ['Software Engineer'],
        includedSkills: ['Rust', 'Golang', 'JavaScript'],
      });

      const decoded = decodeURIComponent(url);
      expect(decoded).toContain('AND+(Rust+OR+Golang+OR+JavaScript)');
    });

    it('omits the AND clause when includedSkills is empty', () => {
      const url = buildLinkedInSearchUrl({
        ...BASE_CONFIG,
        titles: ['Software Engineer'],
        includedSkills: [],
      });

      expect(url).not.toContain('AND');
    });
  });

  describe('excluded skills', () => {
    it('adds a NOT clause with an OR group', () => {
      const url = buildLinkedInSearchUrl({
        ...BASE_CONFIG,
        titles: ['Software Engineer'],
        excludedSkills: ['PHP', 'Java', 'Python'],
      });

      const decoded = decodeURIComponent(url);
      expect(decoded).toContain('NOT+(PHP+OR+Java+OR+Python)');
    });

    it('omits the NOT clause when excludedSkills is empty', () => {
      const url = buildLinkedInSearchUrl({
        ...BASE_CONFIG,
        titles: ['Software Engineer'],
        excludedSkills: [],
      });

      expect(url).not.toContain('NOT');
    });
  });

  describe('skills needing quotes', () => {
    it('quotes skills containing # (e.g. C#)', () => {
      const url = buildLinkedInSearchUrl({
        ...BASE_CONFIG,
        includedSkills: ['C#', 'JavaScript'],
      });

      const decoded = decodeURIComponent(url);
      expect(decoded).toContain('("C#"+OR+JavaScript)');
    });

    it('quotes skills containing + (e.g. C++)', () => {
      const url = buildLinkedInSearchUrl({
        ...BASE_CONFIG,
        includedSkills: ['C++', 'Rust'],
      });

      const decoded = decodeURIComponent(url);
      // %2B decodes to +, so "C++" appears literally after decodeURIComponent
      expect(decoded).toContain('("C++"+OR+Rust)');
    });

    it('does not quote regular skills', () => {
      const url = buildLinkedInSearchUrl({
        ...BASE_CONFIG,
        includedSkills: ['Golang'],
      });

      const decoded = decodeURIComponent(url);
      expect(decoded).toContain('(Golang)');
    });
  });

  describe('location', () => {
    it('sets the location param', () => {
      const url = buildLinkedInSearchUrl({
        ...BASE_CONFIG,
        titles: ['Software Engineer'],
        location: 'Germany',
      });

      expect(url).toContain('location=Germany');
    });

    it('omits location when neither geoId nor location is set', () => {
      const url = buildLinkedInSearchUrl({
        ...BASE_CONFIG,
        titles: ['Software Engineer'],
      });

      expect(url).not.toContain('location=');
      expect(url).not.toContain('geoId=');
    });

    it('passes location through to the URL as-is', () => {
      const url = buildLinkedInSearchUrl({
        ...BASE_CONFIG,
        titles: ['Software Engineer'],
        location: 'Berlin',
      });

      expect(url).toContain('location=Berlin');
    });
  });

  describe('cities', () => {
    it('ORs multiple comma-separated cities into keywords', () => {
      const url = buildLinkedInSearchUrl({
        ...BASE_CONFIG,
        titles: ['Software Engineer'],
        cities: 'Berlin, Munich, Hamburg',
      });

      expect(url).toContain('%28%22Berlin%22+OR+%22Munich%22+OR+%22Hamburg%22%29');
      expect(url).not.toContain('location=');
    });

    it('wraps a single city as an exact phrase keyword', () => {
      const url = buildLinkedInSearchUrl({
        ...BASE_CONFIG,
        titles: ['Software Engineer'],
        cities: 'Berlin',
      });

      expect(url).toContain('%22Berlin%22');
      expect(url).not.toContain('location=');
    });

    it('prefers cities over location when both are set', () => {
      const url = buildLinkedInSearchUrl({
        ...BASE_CONFIG,
        titles: ['Software Engineer'],
        cities: 'Berlin, Munich',
        location: 'Germany',
      });

      expect(url).toContain('%28%22Berlin%22+OR+%22Munich%22%29');
      expect(url).not.toContain('location=');
    });

    it('uses location when cities is not set', () => {
      const url = buildLinkedInSearchUrl({
        ...BASE_CONFIG,
        titles: ['Software Engineer'],
        location: 'Germany',
      });

      expect(url).toContain('location=Germany');
      expect(url).not.toContain('%28%22Berlin');
    });
  });

  describe('time window', () => {
    it('converts hours to seconds for the f_TPR param', () => {
      const url = buildLinkedInSearchUrl({
        ...BASE_CONFIG,
        titles: ['Software Engineer'],
        timeWindowHours: 72,
      });

      expect(url).toContain('f_TPR=r259200');
    });

    it('omits f_TPR when timeWindowHours is 0', () => {
      const url = buildLinkedInSearchUrl({
        ...BASE_CONFIG,
        titles: ['Software Engineer'],
        timeWindowHours: 0,
      });

      expect(url).not.toContain('f_TPR=');
    });

    it('calculates 24 hours correctly', () => {
      const url = buildLinkedInSearchUrl({
        ...BASE_CONFIG,
        titles: ['Software Engineer'],
        timeWindowHours: 24,
      });

      expect(url).toContain('f_TPR=r86400');
    });
  });

  describe('sort by', () => {
    it('sets sortBy=DD when sortByRecent is true', () => {
      const url = buildLinkedInSearchUrl({
        ...BASE_CONFIG,
        titles: ['Software Engineer'],
        sortByRecent: true,
      });

      expect(url).toContain('sortBy=DD');
    });

    it('omits sortBy when sortByRecent is false', () => {
      const url = buildLinkedInSearchUrl({
        ...BASE_CONFIG,
        titles: ['Software Engineer'],
        sortByRecent: false,
      });

      expect(url).not.toContain('sortBy=');
    });
  });

  describe('workplace types', () => {
    it('sets f_WT with comma-separated workplace types', () => {
      const url = buildLinkedInSearchUrl({
        ...BASE_CONFIG,
        titles: ['Software Engineer'],
        workplaceTypes: ['1', '2'],
      });

      expect(url).toContain('f_WT=1%2C2');
    });

    it('omits f_WT when workplaceTypes is empty', () => {
      const url = buildLinkedInSearchUrl({
        ...BASE_CONFIG,
        titles: ['Software Engineer'],
        workplaceTypes: [],
      });

      expect(url).not.toContain('f_WT=');
    });
  });

  describe('experience levels', () => {
    it('sets f_E with comma-separated levels', () => {
      const url = buildLinkedInSearchUrl({
        ...BASE_CONFIG,
        titles: ['Software Engineer'],
        experienceLevels: ['2', '3', '4'],
      });

      expect(url).toContain('f_E=2%2C3%2C4');
    });

    it('omits f_E when experienceLevels is empty', () => {
      const url = buildLinkedInSearchUrl({
        ...BASE_CONFIG,
        titles: ['Software Engineer'],
        experienceLevels: [],
      });

      expect(url).not.toContain('f_E=');
    });
  });

  describe('job types', () => {
    it('sets f_JT with comma-separated types', () => {
      const url = buildLinkedInSearchUrl({
        ...BASE_CONFIG,
        titles: ['Software Engineer'],
        jobTypes: ['F', 'C', 'P'],
      });

      expect(url).toContain('f_JT=F%2CC%2CP');
    });

    it('omits f_JT when jobTypes is empty', () => {
      const url = buildLinkedInSearchUrl({
        ...BASE_CONFIG,
        titles: ['Software Engineer'],
        jobTypes: [],
      });

      expect(url).not.toContain('f_JT=');
    });
  });

  describe('easy apply', () => {
    it('sets f_AL=true when easyApply is true', () => {
      const url = buildLinkedInSearchUrl({
        ...BASE_CONFIG,
        titles: ['Software Engineer'],
        easyApply: true,
      });

      expect(url).toContain('f_AL=true');
    });

    it('omits f_AL when easyApply is false', () => {
      const url = buildLinkedInSearchUrl({
        ...BASE_CONFIG,
        titles: ['Software Engineer'],
        easyApply: false,
      });

      expect(url).not.toContain('f_AL=');
    });
  });

  describe('full worked example', () => {
    it('produces the expected URL from the spec', () => {
      const url = buildLinkedInSearchUrl({
        titles: ['Software Engineer', 'Senior Software Engineer', 'Senior Architect'],
        includedSkills: ['Rust', 'Golang', 'JavaScript'],
        excludedSkills: ['PHP', 'Java', 'Python'],
        location: 'Germany',
        timeWindowHours: 72,
        sortByRecent: true,
        easyApply: false,
      });

      // Check keywords on the RAW url
      // URLSearchParams encodes ( → %28, ) → %29, " → %22, space → +
      expect(url).toContain(
        '%28%22Software+Engineer%22+OR+%22Senior+Software+Engineer%22+OR+%22Senior+Architect%22%29',
      );
      expect(url).toContain('AND+%28Rust+OR+Golang+OR+JavaScript%29');
      expect(url).toContain('NOT+%28PHP+OR+Java+OR+Python%29');

      // Check location
      expect(url).toContain('location=Germany');

      // Check time window: 72 * 3600 = 259200
      expect(url).toContain('f_TPR=r259200');

      // Check sort
      expect(url).toContain('sortBy=DD');

      // Check it starts correctly
      expect(url.startsWith('https://www.linkedin.com/jobs/search/?')).toBe(true);
    });
  });

  describe('URL encoding', () => {
    it('correctly URL-encodes quotes in the keywords parameter', () => {
      const url = buildLinkedInSearchUrl({
        ...BASE_CONFIG,
        titles: ['Test'],
      });

      expect(url).toContain('keywords=%22Test%22');
    });

    it('does not double-encode already-encoded characters', () => {
      const url = buildLinkedInSearchUrl({
        ...BASE_CONFIG,
        titles: ['Software Engineer'],
      });

      // Space should be encoded as + (URLSearchParams default) or %20
      expect(url).toMatch(/keywords=%22Software(%20|\+)Engineer%22/);
    });
  });
});