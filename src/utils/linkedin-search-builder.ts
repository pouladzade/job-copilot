export interface LinkedInSearchConfig {
  readonly titles: readonly string[];
  readonly includedSkills: readonly string[];
  readonly excludedSkills: readonly string[];
  readonly location?: string;
  readonly cities?: string;
  readonly timeWindowHours: number;
  readonly sortByRecent: boolean;
  readonly easyApply: boolean;
  readonly workplaceTypes?: readonly ('1' | '2' | '3')[];
  readonly experienceLevels?: readonly string[];
  readonly jobTypes?: readonly string[];
}

function quoteIfNeeded(skill: string): string {
  return /[+#]/.test(skill) ? `"${skill}"` : skill;
}

export function buildLinkedInSearchUrl(config: LinkedInSearchConfig): string {
  const titleCount = config.titles.length;
  const titleGroup =
    titleCount > 1
      ? `(${config.titles.map((t) => `"${t}"`).join(' OR ')})`
      : titleCount === 1 && config.titles[0] !== ''
        ? `"${config.titles[0]}"`
        : '';

  const incStr = config.includedSkills.length > 0 ? `(${config.includedSkills.map(quoteIfNeeded).join(' OR ')})` : '';

  const excStr =
    config.excludedSkills.length > 0 ? `NOT (${config.excludedSkills.map(quoteIfNeeded).join(' OR ')})` : '';

  const incPart = incStr ? `AND ${incStr}` : '';

  const rawKeywords = [titleGroup, incPart, excStr].filter((segment) => segment !== '').join(' ');

  const params = new URLSearchParams();
  params.set('keywords', rawKeywords);

  if (config.cities) {
    const cityList = config.cities
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s !== '');

    if (cityList.length > 0) {
      const cityGroup =
        cityList.length === 1 && cityList[0] !== undefined
          ? `"${cityList[0]}"`
          : `(${cityList.map((c) => `"${c}"`).join(' OR ')})`;
      const existingKeywords = params.get('keywords') ?? '';
      const separator = existingKeywords !== '' ? ' AND ' : '';
      params.set('keywords', `${existingKeywords}${separator}${cityGroup}`);
    }
  } else if (config.location) {
    params.set('location', config.location);
  }

  if (config.timeWindowHours > 0) {
    params.set('f_TPR', `r${config.timeWindowHours * 3600}`);
  }

  if (config.sortByRecent) {
    params.set('sortBy', 'DD');
  }

  if (config.workplaceTypes && config.workplaceTypes.length > 0) {
    params.set('f_WT', config.workplaceTypes.join(','));
  }

  if (config.experienceLevels && config.experienceLevels.length > 0) {
    params.set('f_E', config.experienceLevels.join(','));
  }

  if (config.jobTypes && config.jobTypes.length > 0) {
    params.set('f_JT', config.jobTypes.join(','));
  }

  if (config.easyApply) {
    params.set('f_AL', 'true');
  }

  return `https://www.linkedin.com/jobs/search/?${params.toString()}`;
}
