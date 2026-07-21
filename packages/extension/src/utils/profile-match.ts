export interface Profile {
  fullName?: string;
  contactEmail?: string;
  contactPhone?: string;
  city?: string;
  state?: string;
  linkedin?: string;
  portfolioUrl?: string;
  githubUrl?: string;
  workAuthorization?: string;
  salaryExpectations?: string;
  noticePeriod?: string;
  willingToRelocate?: string;
  yearsOfExperience?: number;
  currentTitle?: string;
  currentCompany?: string;
  highestDegree?: string;
  university?: string;
  fieldOfStudy?: string;
  desiredRole?: string;
  preferredLocation?: string;
  remotePreference?: string;
}

export function profileToContext(p: Profile): string {
  const lines: string[] = [];
  const push = (k: string, v: unknown): void => {
    if (v === undefined || v === null || v === '') return;
    lines.push(`${k}: ${v}`);
  };
  push('Full Name', p.fullName);
  push('Email', p.contactEmail);
  push('Phone', p.contactPhone);
  push('City', p.city);
  push('State / Region', p.state);
  push('LinkedIn', p.linkedin);
  push('Portfolio', p.portfolioUrl);
  push('GitHub', p.githubUrl);
  push('Work Authorization', p.workAuthorization);
  push('Salary Expectations', p.salaryExpectations);
  push('Notice Period', p.noticePeriod);
  push('Willing to Relocate', p.willingToRelocate);
  if (typeof p.yearsOfExperience === 'number' && p.yearsOfExperience > 0) lines.push(`Years of Experience: ${p.yearsOfExperience}`);
  push('Current Title', p.currentTitle);
  push('Current Company', p.currentCompany);
  push('Highest Degree', p.highestDegree);
  push('University', p.university);
  push('Field of Study', p.fieldOfStudy);
  push('Desired Role', p.desiredRole);
  push('Preferred Location', p.preferredLocation);
  push('Remote Preference', p.remotePreference);
  return lines.length > 0 ? lines.join('\n') : '(no profile data — user has not filled out the profile)';
}

export function deterministicMatch(label: string, profile: Profile): { value: string; confidence: number } | null {
  const l = label.toLowerCase();
  if (/\bemail\b|\be[\s-]?mail\b/.test(l) && profile.contactEmail) return { value: profile.contactEmail, confidence: 0.95 };
  if (/\bphone\b|\btel(?:ephone)?\b|\bmobile\b/.test(l) && profile.contactPhone) return { value: profile.contactPhone, confidence: 0.95 };
  if (/full[\s_-]?name|your[\s_-]?name|applicant[\s_-]?name|(?:^|\b)name(?:\b|$)/i.test(l) && profile.fullName) return { value: profile.fullName, confidence: 0.95 };
  if (/linkedin/.test(l) && profile.linkedin) return { value: profile.linkedin, confidence: 0.95 };
  if (/github/.test(l) && profile.githubUrl) return { value: profile.githubUrl, confidence: 0.95 };
  if (/portfolio|website|personal[\s_-]?url/.test(l) && profile.portfolioUrl) return { value: profile.portfolioUrl, confidence: 0.95 };
  if (/city|\blocation\b|currently[\s_-]?(?:located|based)/.test(l) && profile.city) return { value: profile.city, confidence: 0.85 };
  if (/state|region|province/.test(l) && profile.state) return { value: profile.state, confidence: 0.85 };
  if (/\bcountry\b/.test(l) && profile.preferredLocation) return { value: profile.preferredLocation, confidence: 0.7 };
  const workAuth = /(?:authoriz|authoris|sponsor|visa|eligible|eligib|right to work|work permit|immigration)/.test(l);
  const workContext = /(?:work|employ|status|country|require|need|status)/.test(l);
  if (workAuth && workContext && profile.workAuthorization) return { value: profile.workAuthorization, confidence: 0.9 };
  if (/notice[\s_-]?period/.test(l) && profile.noticePeriod) return { value: profile.noticePeriod, confidence: 0.9 };
  if (/salary|compensation|expectation/.test(l) && profile.salaryExpectations) return { value: profile.salaryExpectations, confidence: 0.9 };
  if (/relocate/.test(l) && profile.willingToRelocate) return { value: profile.willingToRelocate, confidence: 0.9 };
  if (/years?(?:[\s_-]?of)?[\s_-]?experience/.test(l) && typeof profile.yearsOfExperience === 'number' && profile.yearsOfExperience > 0) return { value: String(profile.yearsOfExperience), confidence: 0.9 };
  if (/current[\s_-]?(?:job[\s_-]?)?title/.test(l) && profile.currentTitle) return { value: profile.currentTitle, confidence: 0.85 };
  if (/current[\s_-]?(?:employer|company)/.test(l) && profile.currentCompany) return { value: profile.currentCompany, confidence: 0.85 };
  if (/(?:highest|education|degree)/.test(l) && profile.highestDegree) return { value: profile.highestDegree, confidence: 0.85 };
  if (/university|college|school/.test(l) && profile.university) return { value: profile.university, confidence: 0.85 };
  if (/field[\s_-]?(?:of[\s_-]?study|major)/.test(l) && profile.fieldOfStudy) return { value: profile.fieldOfStudy, confidence: 0.85 };
  if (/remote|work[\s_-]?mode|on[\s_-]?site|hybrid/.test(l) && profile.remotePreference) return { value: profile.remotePreference, confidence: 0.85 };
  return null;
}

export async function getProfile(): Promise<Profile> {
  try {
    const r = await chrome.storage.local.get('profile');
    const s = r as Record<string, unknown>;
    const p = s['profile'];
    if (p && typeof p === 'object' && p !== null) return p as Profile;
  } catch { /* fall through */ }
  return {};
}