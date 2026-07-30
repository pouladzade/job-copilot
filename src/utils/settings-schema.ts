export interface ProfileData {
  readonly fullName: string;
  readonly contactEmail: string;
  readonly contactPhone: string;
  readonly city: string;
  readonly state: string;
  readonly linkedin: string;
  readonly portfolioUrl: string;
  readonly githubUrl: string;
  readonly workAuthorization: string;
  readonly salaryExpectations: string;
  readonly noticePeriod: string;
  readonly willingToRelocate: string;
  readonly yearsOfExperience: number;
  readonly currentTitle: string;
  readonly currentCompany: string;
  readonly highestDegree: string;
  readonly university: string;
  readonly fieldOfStudy: string;
  readonly desiredRole: string;
  readonly preferredLocation: string;
  readonly remotePreference: string;
}

export interface ResumeEntry {
  readonly id: string;
  readonly name: string;
  readonly content: string;
  readonly profile: ProfileData;
  readonly isDefault: boolean;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface LlmConfig {
  readonly apiUrl: string;
  readonly apiKey: string;
  readonly model: string;
  readonly activeResumeId: string;
  readonly resumes: readonly ResumeEntry[];
  readonly prmExtractAdd: string;
  readonly prmSummaryAdd: string;
  readonly prmCoverAdd: string;
  readonly prmQuickAdd: string;
  readonly prmFormAdd: string;
  readonly prmReplyAdd: string;
}

export const PROFILE_DEFAULTS: ProfileData = {
  fullName: '',
  contactEmail: '',
  contactPhone: '',
  city: '',
  state: '',
  linkedin: '',
  portfolioUrl: '',
  githubUrl: '',
  workAuthorization: '',
  salaryExpectations: '',
  noticePeriod: '',
  willingToRelocate: '',
  yearsOfExperience: 0,
  currentTitle: '',
  currentCompany: '',
  highestDegree: '',
  university: '',
  fieldOfStudy: '',
  desiredRole: '',
  preferredLocation: '',
  remotePreference: '',
};

export function createResumeEntry(name: string, content: string, profile?: Partial<ProfileData>): ResumeEntry {
  const now = Date.now();
  return {
    id: `resume_${now}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    content,
    profile: { ...PROFILE_DEFAULTS, ...(profile ?? {}) },
    isDefault: false,
    createdAt: now,
    updatedAt: now,
  };
}

export const LLM_DEFAULTS: LlmConfig = {
  apiUrl: 'https://api.deepseek.com',
  apiKey: '',
  model: 'deepseek-chat',
  activeResumeId: '',
  resumes: [],
  prmExtractAdd: '',
  prmSummaryAdd: '',
  prmCoverAdd: '',
  prmQuickAdd: '',
  prmFormAdd: '',
  prmReplyAdd: '',
};

export const PROMPT_SLOTS: readonly {
  readonly key: keyof LlmConfig;
  readonly label: string;
  readonly description: string;
}[] = [
  { key: 'prmExtractAdd', label: 'Job Extract', description: 'Pulls structured data from a posting.' },
  {
    key: 'prmSummaryAdd',
    label: 'Resume Summary',
    description: 'Writes the Professional Summary section of your resume.',
  },
  { key: 'prmCoverAdd', label: 'Cover Letter', description: 'Drafts a cover letter from a posting.' },
  { key: 'prmQuickAdd', label: 'Quick Match', description: 'Scores a job against your resume.' },
  { key: 'prmFormAdd', label: 'Form Fill', description: 'Matches form fields to your profile.' },
  { key: 'prmReplyAdd', label: 'Message Reply', description: 'Drafts a reply to a recruiter message.' },
];

export interface ProfileFieldDef {
  readonly key: keyof ProfileData;
  readonly label: string;
  readonly type: 'text' | 'number';
  readonly placeholder?: string;
}

export const PROFILE_FIELDS: readonly ProfileFieldDef[] = [
  { key: 'fullName', label: 'Full Name', type: 'text', placeholder: 'Ahmad Pouladzade' },
  { key: 'contactEmail', label: 'Email', type: 'text', placeholder: 'you@example.com' },
  { key: 'contactPhone', label: 'Phone', type: 'text', placeholder: '+49 123 456789' },
  { key: 'city', label: 'City', type: 'text', placeholder: 'Berlin' },
  { key: 'state', label: 'State / Region', type: 'text', placeholder: 'Berlin' },
  { key: 'linkedin', label: 'LinkedIn', type: 'text', placeholder: 'https://linkedin.com/in/...' },
  { key: 'portfolioUrl', label: 'Portfolio', type: 'text', placeholder: 'https://...' },
  { key: 'githubUrl', label: 'GitHub', type: 'text', placeholder: 'https://github.com/...' },
  { key: 'workAuthorization', label: 'Work Auth', type: 'text', placeholder: 'EU Blue Card / Citizen' },
  { key: 'yearsOfExperience', label: 'Years Exp.', type: 'number', placeholder: '7' },
  { key: 'currentTitle', label: 'Current Title', type: 'text', placeholder: 'Senior Software Engineer' },
  { key: 'currentCompany', label: 'Current Company', type: 'text', placeholder: 'Company GmbH' },
  { key: 'highestDegree', label: 'Highest Degree', type: 'text', placeholder: 'M.S. Computer Science' },
  { key: 'university', label: 'University', type: 'text', placeholder: 'University of ...' },
  { key: 'fieldOfStudy', label: 'Field of Study', type: 'text', placeholder: 'Computer Science' },
  { key: 'desiredRole', label: 'Desired Role', type: 'text', placeholder: 'Senior Backend Engineer' },
  { key: 'preferredLocation', label: 'Preferred Loc.', type: 'text', placeholder: 'Berlin' },
  { key: 'remotePreference', label: 'Remote Pref.', type: 'text', placeholder: 'Remote / Hybrid / On-site' },
  { key: 'salaryExpectations', label: 'Salary', type: 'text', placeholder: '€90,000 – €110,000' },
  { key: 'noticePeriod', label: 'Notice Period', type: 'text', placeholder: '2 weeks / 3 months' },
  { key: 'willingToRelocate', label: 'Willing to Relocate', type: 'text', placeholder: 'Yes / No / Within EU' },
];
