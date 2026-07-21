import { profileToContext, deterministicMatch, type Profile } from '../utils/profile-match';

const FULL_PROFILE: Profile = {
  fullName: 'Ahmad Pouladzade',
  contactEmail: 'ahmad@example.com',
  contactPhone: '+49 30 12345678',
  city: 'Berlin',
  state: 'Berlin',
  linkedin: 'https://linkedin.com/in/ahmad',
  portfolioUrl: 'https://ahmad.dev',
  githubUrl: 'https://github.com/ahmad',
  workAuthorization: 'EU Blue Card',
  salaryExpectations: '€90,000 – €110,000',
  noticePeriod: '2 weeks',
  willingToRelocate: 'Within EU',
  yearsOfExperience: 7,
  currentTitle: 'Senior Software Engineer',
  currentCompany: 'Acme GmbH',
  highestDegree: 'M.S. Computer Science',
  university: 'TU Berlin',
  fieldOfStudy: 'Computer Science',
  desiredRole: 'Senior Backend Engineer',
  preferredLocation: 'Berlin',
  remotePreference: 'Hybrid',
};

describe('profileToContext', () => {
  it('renders all populated fields with labels', () => {
    const ctx = profileToContext(FULL_PROFILE);
    expect(ctx).toContain('Full Name: Ahmad Pouladzade');
    expect(ctx).toContain('Email: ahmad@example.com');
    expect(ctx).toContain('Years of Experience: 7');
    expect(ctx).toContain('Work Authorization: EU Blue Card');
    expect(ctx).toContain('Remote Preference: Hybrid');
  });

  it('skips empty string and zero-experience fields', () => {
    const ctx = profileToContext({ fullName: 'X', yearsOfExperience: 0 });
    expect(ctx).toContain('Full Name: X');
    expect(ctx).not.toContain('Years of Experience');
    expect(ctx).not.toContain('Email');
  });

  it('skips undefined fields', () => {
    const ctx = profileToContext({ fullName: 'X' });
    expect(ctx).not.toContain('Email');
    expect(ctx).not.toContain('Phone');
    expect(ctx).not.toContain('Years of Experience');
  });

  it('includes yearsOfExperience when positive', () => {
    expect(profileToContext({ yearsOfExperience: 5 })).toContain('Years of Experience: 5');
  });

  it('returns a helpful empty-state string when no fields are populated', () => {
    expect(profileToContext({})).toBe('(no profile data — user has not filled out the profile)');
  });
});

describe('deterministicMatch', () => {
  it('matches common email variants', () => {
    expect(deterministicMatch('Email', FULL_PROFILE)).toEqual({ value: 'ahmad@example.com', confidence: 0.95 });
    expect(deterministicMatch('E-mail address', FULL_PROFILE)?.value).toBe('ahmad@example.com');
    expect(deterministicMatch('Email Address', FULL_PROFILE)?.value).toBe('ahmad@example.com');
  });

  it('matches phone/tel/mobile variants', () => {
    expect(deterministicMatch('Phone', FULL_PROFILE)?.value).toBe('+49 30 12345678');
    expect(deterministicMatch('Mobile number', FULL_PROFILE)?.value).toBe('+49 30 12345678');
    expect(deterministicMatch('Telephone', FULL_PROFILE)?.value).toBe('+49 30 12345678');
  });

  it('matches a bare "Name" label', () => {
    expect(deterministicMatch('Name', FULL_PROFILE)?.value).toBe('Ahmad Pouladzade');
    expect(deterministicMatch('name', FULL_PROFILE)?.value).toBe('Ahmad Pouladzade');
  });

  it('matches name variants', () => {
    expect(deterministicMatch('Full Name', FULL_PROFILE)?.value).toBe('Ahmad Pouladzade');
    expect(deterministicMatch('Your Name', FULL_PROFILE)?.value).toBe('Ahmad Pouladzade');
    expect(deterministicMatch('Applicant Name', FULL_PROFILE)?.value).toBe('Ahmad Pouladzade');
  });

  it('matches LinkedIn / GitHub / Portfolio variants', () => {
    expect(deterministicMatch('LinkedIn URL', FULL_PROFILE)?.value).toBe('https://linkedin.com/in/ahmad');
    expect(deterministicMatch('GitHub Profile', FULL_PROFILE)?.value).toBe('https://github.com/ahmad');
    expect(deterministicMatch('Portfolio website', FULL_PROFILE)?.value).toBe('https://ahmad.dev');
  });

  it('matches location, work auth, and experience variants', () => {
    expect(deterministicMatch('City', FULL_PROFILE)?.value).toBe('Berlin');
    expect(deterministicMatch('State / Region', FULL_PROFILE)?.value).toBe('Berlin');
    expect(deterministicMatch('Are you authorized to work?', FULL_PROFILE)?.value).toBe('EU Blue Card');
    expect(deterministicMatch('Visa Sponsorship Required?', FULL_PROFILE)?.value).toBe('EU Blue Card');
    expect(deterministicMatch('Years of Experience', FULL_PROFILE)?.value).toBe('7');
    expect(deterministicMatch('Years experience with React', FULL_PROFILE)?.value).toBe('7');
    expect(deterministicMatch('Notice Period', FULL_PROFILE)?.value).toBe('2 weeks');
    expect(deterministicMatch('Salary Expectations', FULL_PROFILE)?.value).toBe('€90,000 – €110,000');
    expect(deterministicMatch('Willing to Relocate?', FULL_PROFILE)?.value).toBe('Within EU');
    expect(deterministicMatch('Work preference (remote/hybrid/onsite)', FULL_PROFILE)?.value).toBe('Hybrid');
    expect(deterministicMatch('Current Job Title', FULL_PROFILE)?.value).toBe('Senior Software Engineer');
    expect(deterministicMatch('Current Employer', FULL_PROFILE)?.value).toBe('Acme GmbH');
    expect(deterministicMatch('Highest Degree', FULL_PROFILE)?.value).toBe('M.S. Computer Science');
    expect(deterministicMatch('University', FULL_PROFILE)?.value).toBe('TU Berlin');
    expect(deterministicMatch('Field of Study', FULL_PROFILE)?.value).toBe('Computer Science');
  });

  it('returns null for fields it cannot resolve', () => {
    expect(deterministicMatch('Why do you want to work here?', FULL_PROFILE)).toBeNull();
    expect(deterministicMatch('Tell us about a challenging project', FULL_PROFILE)).toBeNull();
    expect(deterministicMatch('Cover letter', FULL_PROFILE)).toBeNull();
  });

  it('returns null when profile field is empty even if label matches', () => {
    expect(deterministicMatch('Email', { contactEmail: '' })).toBeNull();
    expect(deterministicMatch('Years of Experience', { yearsOfExperience: 0 })).toBeNull();
  });
});