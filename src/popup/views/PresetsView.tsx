import { useCallback, useEffect, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { colors, radii, fontFamily, chip, selectStyle } from '../theme';
import type { LinkedInSearchConfig } from '../../utils/linkedin-search-builder';
import { buildLinkedInSearchUrl } from '../../utils/linkedin-search-builder';

// ── Constants ─────────────────────────────────────────────────────────

const TIME_WINDOW_OPTIONS: readonly { readonly label: string; readonly hours: number }[] = [
  { label: 'Any time', hours: 0 },
  { label: 'Past hour', hours: 1 },
  { label: 'Past 6 hours', hours: 6 },
  { label: 'Past 12 hours', hours: 12 },
  { label: 'Past 24 hours', hours: 24 },
  { label: 'Past 3 days', hours: 72 },
  { label: 'Past 1 week', hours: 168 },
  { label: 'Past 2 weeks', hours: 336 },
  { label: 'Past 1 month', hours: 720 },
];

const WORKPLACE_OPTIONS: readonly {
  readonly value: '1' | '2' | '3';
  readonly label: string;
}[] = [
  { value: '1', label: 'On-site' },
  { value: '2', label: 'Remote' },
  { value: '3', label: 'Hybrid' },
];

const EXPERIENCE_OPTIONS: readonly { readonly value: string; readonly label: string }[] = [
  { value: '1', label: 'Internship' },
  { value: '2', label: 'Entry level' },
  { value: '3', label: 'Associate' },
  { value: '4', label: 'Mid-Senior level' },
  { value: '5', label: 'Director' },
  { value: '6', label: 'Executive' },
];

const JOB_TYPE_OPTIONS: readonly { readonly value: string; readonly label: string }[] = [
  { value: 'F', label: 'Full-time' },
  { value: 'P', label: 'Part-time' },
  { value: 'C', label: 'Contract' },
  { value: 'T', label: 'Temporary' },
  { value: 'V', label: 'Volunteer' },
  { value: 'I', label: 'Internship' },
  { value: 'O', label: 'Other' },
];

interface Preset {
  readonly name: string;
  readonly config: LinkedInSearchConfig;
}

function summarize(p: Preset): string {
  const parts: string[] = [];
  parts.push(`${p.config.titles.length} title${p.config.titles.length === 1 ? '' : 's'}`);
  parts.push(`${p.config.includedSkills.length} skill${p.config.includedSkills.length === 1 ? '' : 's'}`);

  if (p.config.location !== undefined && p.config.location !== '') parts.push(p.config.location);
  if (p.config.cities !== undefined && p.config.cities !== '') parts.push(p.config.cities);
  if (p.config.timeWindowHours > 0) {
    const tw = TIME_WINDOW_OPTIONS.find((o) => o.hours === p.config.timeWindowHours);
    parts.push(tw?.label ?? `${p.config.timeWindowHours}h`);
  }
  if (p.config.workplaceTypes !== undefined && p.config.workplaceTypes.length > 0) {
    const labels = p.config.workplaceTypes
      .map((v) => WORKPLACE_OPTIONS.find((o) => o.value === v)?.label)
      .filter((l): l is string => l !== undefined);
    if (labels.length > 0) parts.push(labels.join('/'));
  }
  if (p.config.easyApply) parts.push('Easy Apply');

  return parts.join(' · ');
}

const EMPTY_CONFIG: LinkedInSearchConfig = {
  titles: [],
  includedSkills: [],
  excludedSkills: [],
  location: undefined,
  cities: undefined,
  timeWindowHours: 0,
  sortByRecent: true,
  easyApply: false,
  workplaceTypes: undefined,
  experienceLevels: undefined,
  jobTypes: undefined,
};

// ── List View ────────────────────────────────────────────────────────

function PresetListView(p: {
  readonly presets: readonly Preset[];
  readonly onOpen: (name: string) => void;
  readonly onNew: () => void;
}): JSX.Element {
  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '12px',
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: '11px',
            color: colors.textMuted,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            fontWeight: 600,
          }}
        >
          {p.presets.length} saved
        </p>
        <button
          onClick={p.onNew}
          style={{
            padding: '5px 10px',
            fontSize: '11px',
            fontWeight: 600,
            backgroundColor: colors.accent,
            color: colors.textWhite,
            border: 'none',
            borderRadius: radii.xs,
            cursor: 'pointer',
            transition: 'all 150ms',
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLElement).style.backgroundColor = colors.accentHover;
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLElement).style.backgroundColor = colors.accent;
          }}
        >
          + New Preset
        </button>
      </div>

      {p.presets.length === 0 ? (
        <div
          style={{
            padding: '20px 14px',
            textAlign: 'center',
            backgroundColor: colors.surface,
            border: `1px dashed ${colors.border}`,
            borderRadius: radii.md,
            color: colors.textMuted,
            fontSize: '12px',
            lineHeight: 1.5,
          }}
        >
          No presets yet. Create one to scope your LinkedIn searches.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {p.presets.map((preset) => (
            <button
              key={preset.name}
              onClick={() => {
                p.onOpen(preset.name);
              }}
              style={{
                textAlign: 'left',
                padding: '12px 14px',
                backgroundColor: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: radii.md,
                cursor: 'pointer',
                transition: 'all 150ms',
                color: colors.textPrimary,
                fontFamily,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = colors.surfaceHover;
                (e.currentTarget as HTMLElement).style.borderColor = colors.accentBorder;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = colors.surface;
                (e.currentTarget as HTMLElement).style.borderColor = colors.border;
              }}
            >
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: colors.textPrimary,
                  marginBottom: '3px',
                }}
              >
                {preset.name}
              </div>
              <div style={{ fontSize: '11px', color: colors.textMuted }}>{summarize(preset)}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Editor View ──────────────────────────────────────────────────────

function PresetEditorView(p: {
  readonly preset: Preset;
  readonly isNew: boolean;
  readonly onCancel: () => void;
  readonly onSaved: () => void;
  readonly onDelete: () => void;
}): JSX.Element {
  const [name, setName] = useState(p.preset.name);
  const [titles, setTitles] = useState(p.preset.config.titles.join('\n'));
  const [skills, setSkills] = useState(p.preset.config.includedSkills.join('\n'));
  const [excluded, setExcluded] = useState(p.preset.config.excludedSkills.join('\n'));
  const [location, setLocation] = useState(p.preset.config.location ?? '');
  const [cities, setCities] = useState(p.preset.config.cities ?? '');
  const [timeWindowHours, setTimeWindowHours] = useState(p.preset.config.timeWindowHours);
  const [sortByRecent, setSortByRecent] = useState(p.preset.config.sortByRecent);
  const [easyApply, setEasyApply] = useState(p.preset.config.easyApply);
  const [workplaceTypes, setWorkplaceTypes] = useState<readonly ('1' | '2' | '3')[]>(
    p.preset.config.workplaceTypes ?? [],
  );
  const [experienceLevels, setExperienceLevels] = useState<readonly string[]>(p.preset.config.experienceLevels ?? []);
  const [jobTypes, setJobTypes] = useState<readonly string[]>(p.preset.config.jobTypes ?? []);
  const [error, setError] = useState('');

  const save = useCallback(() => {
    const trimmedName = name.trim();
    if (trimmedName === '') {
      setError('Name is required');
      return;
    }

    const titlesArr = titles
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s !== '');
    const skillsArr = skills
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s !== '');
    const excludedArr = excluded
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s !== '');

    const newConfig: LinkedInSearchConfig = {
      ...p.preset.config,
      titles: titlesArr,
      includedSkills: skillsArr,
      excludedSkills: excludedArr,
      location: location.trim() === '' ? undefined : location.trim(),
      cities: cities.trim() === '' ? undefined : cities.trim(),
      timeWindowHours,
      sortByRecent,
      easyApply,
      workplaceTypes: workplaceTypes.length > 0 ? workplaceTypes : undefined,
      experienceLevels: experienceLevels.length > 0 ? experienceLevels : undefined,
      jobTypes: jobTypes.length > 0 ? jobTypes : undefined,
    };

    browser.storage.local.get(['linkedInSearchPresets'], (result) => {
      const existing: Preset[] = Array.isArray(result.linkedInSearchPresets)
        ? (result.linkedInSearchPresets as Preset[])
        : [];
      const filtered = existing.filter((x) => x.name !== p.preset.name);
      const next = [...filtered, { name: trimmedName, config: newConfig }];
      browser.storage.local.set({ linkedInSearchPresets: next }, () => {
        p.onSaved();
      });
    });
  }, [
    name,
    titles,
    skills,
    excluded,
    location,
    cities,
    timeWindowHours,
    sortByRecent,
    easyApply,
    workplaceTypes,
    experienceLevels,
    jobTypes,
    p,
  ]);

  const handleSearch = useCallback(() => {
    const trimmedName = name.trim();
    if (trimmedName === '') {
      setError('Name is required');
      return;
    }

    const titlesArr = titles
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s !== '');
    const skillsArr = skills
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s !== '');
    const excludedArr = excluded
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s !== '');

    const config: LinkedInSearchConfig = {
      ...p.preset.config,
      titles: titlesArr,
      includedSkills: skillsArr,
      excludedSkills: excludedArr,
      location: location.trim() === '' ? undefined : location.trim(),
      cities: cities.trim() === '' ? undefined : cities.trim(),
      timeWindowHours,
      sortByRecent,
      easyApply,
      workplaceTypes: workplaceTypes.length > 0 ? workplaceTypes : undefined,
      experienceLevels: experienceLevels.length > 0 ? experienceLevels : undefined,
      jobTypes: jobTypes.length > 0 ? jobTypes : undefined,
    };

    const url = buildLinkedInSearchUrl(config);
    browser.tabs.create({ url });
  }, [
    name,
    titles,
    skills,
    excluded,
    location,
    cities,
    timeWindowHours,
    sortByRecent,
    easyApply,
    workplaceTypes,
    experienceLevels,
    jobTypes,
    p,
  ]);

  const toggleWorkplace = useCallback((val: '1' | '2' | '3') => {
    setWorkplaceTypes((prev) => (prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]));
  }, []);

  const toggleExperience = useCallback((val: string) => {
    setExperienceLevels((prev) => (prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]));
  }, []);

  const toggleJobType = useCallback((val: string) => {
    setJobTypes((prev) => (prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]));
  }, []);

  const inputBase = {
    width: '100%',
    padding: '8px 10px',
    fontSize: '12px',
    border: `1px solid ${colors.border}`,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    fontFamily: '"JetBrains Mono", monospace',
    boxSizing: 'border-box' as const,
    outline: 'none',
    transition: 'border-color 150ms',
  };

  const label = {
    fontSize: '11px',
    fontWeight: 600,
    color: colors.textSecondary,
    marginBottom: '4px',
    display: 'block',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
  };

  const checkboxRow = {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '6px',
    marginTop: '4px',
  };

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '14px',
        }}
      >
        <button
          onClick={p.onCancel}
          style={{
            padding: '4px 8px',
            fontSize: '11px',
            fontWeight: 500,
            backgroundColor: 'transparent',
            color: colors.textMuted,
            border: 'none',
            cursor: 'pointer',
          }}
        >
          ← Back
        </button>
        <p
          style={{
            margin: 0,
            fontSize: '11px',
            fontWeight: 600,
            color: colors.accent,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          {p.isNew ? 'New Preset' : 'Edit Preset'}
        </p>
        <div style={{ width: '40px' }} />
      </div>

      <div style={{ marginBottom: '10px' }}>
        <label style={label}>Name</label>
        <input
          type="text"
          value={name}
          onInput={(e) => {
            setName((e.target as HTMLInputElement).value);
          }}
          placeholder="Backend Germany"
          style={inputBase}
        />
      </div>

      <div style={{ marginBottom: '10px' }}>
        <label style={label}>Job Titles (one per line)</label>
        <textarea
          value={titles}
          onInput={(e) => {
            setTitles((e.target as HTMLTextAreaElement).value);
          }}
          placeholder={'Software Engineer\nSenior Engineer'}
          rows={3}
          style={{ ...inputBase, height: 'auto', resize: 'vertical' as const, minHeight: '60px' }}
        />
      </div>

      <div style={{ marginBottom: '10px' }}>
        <label style={label}>Skills (one per line)</label>
        <textarea
          value={skills}
          onInput={(e) => {
            setSkills((e.target as HTMLTextAreaElement).value);
          }}
          placeholder={'Rust\nGo\nAWS'}
          rows={3}
          style={{ ...inputBase, height: 'auto', resize: 'vertical' as const, minHeight: '60px' }}
        />
      </div>

      <div style={{ marginBottom: '10px' }}>
        <label style={label}>Excluded (one per line)</label>
        <textarea
          value={excluded}
          onInput={(e) => {
            setExcluded((e.target as HTMLTextAreaElement).value);
          }}
          placeholder={'PHP\nJava'}
          rows={2}
          style={{ ...inputBase, height: 'auto', resize: 'vertical' as const, minHeight: '50px' }}
        />
      </div>

      <div style={{ marginBottom: '10px' }}>
        <label style={label}>Location</label>
        <input
          type="text"
          value={location}
          onInput={(e) => {
            setLocation((e.target as HTMLInputElement).value);
          }}
          placeholder="Germany"
          style={inputBase}
        />
      </div>

      <div style={{ marginBottom: '10px' }}>
        <label style={label}>Cities (comma-separated)</label>
        <input
          type="text"
          value={cities}
          onInput={(e) => {
            setCities((e.target as HTMLInputElement).value);
          }}
          placeholder="Berlin, Munich, Hamburg"
          style={inputBase}
        />
      </div>

      <div style={{ marginBottom: '10px' }}>
        <label style={label}>Time Posted</label>
        <select
          value={timeWindowHours}
          onChange={(e) => {
            setTimeWindowHours(parseInt((e.target as HTMLSelectElement).value, 10));
          }}
          style={{ ...selectStyle, fontSize: '12px', padding: '8px 10px' }}
        >
          {TIME_WINDOW_OPTIONS.map((opt) => (
            <option key={opt.hours} value={opt.hours}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: '10px' }}>
        <label style={{ ...label, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={sortByRecent}
            onChange={(e) => {
              setSortByRecent((e.target as HTMLInputElement).checked);
            }}
            style={{ width: '14px', height: '14px' }}
          />
          Sort by most recent
        </label>
      </div>

      <div style={{ marginBottom: '10px' }}>
        <label style={label}>Workplace Type</label>
        <div style={checkboxRow}>
          {WORKPLACE_OPTIONS.map((opt) => (
            <span
              key={opt.value}
              style={chip(workplaceTypes.includes(opt.value))}
              onClick={() => {
                toggleWorkplace(opt.value);
              }}
            >
              {opt.label}
            </span>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: '10px' }}>
        <label style={label}>Experience Level</label>
        <div style={checkboxRow}>
          {EXPERIENCE_OPTIONS.map((opt) => (
            <span
              key={opt.value}
              style={chip(experienceLevels.includes(opt.value))}
              onClick={() => {
                toggleExperience(opt.value);
              }}
            >
              {opt.label}
            </span>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: '10px' }}>
        <label style={{ ...label, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={easyApply}
            onChange={(e) => {
              setEasyApply((e.target as HTMLInputElement).checked);
            }}
            style={{ width: '14px', height: '14px' }}
          />
          Easy Apply only
        </label>
      </div>

      <div style={{ marginBottom: '14px' }}>
        <label style={label}>Job Type</label>
        <div style={checkboxRow}>
          {JOB_TYPE_OPTIONS.map((opt) => (
            <span
              key={opt.value}
              style={chip(jobTypes.includes(opt.value))}
              onClick={() => {
                toggleJobType(opt.value);
              }}
            >
              {opt.label}
            </span>
          ))}
        </div>
      </div>

      {error !== '' && (
        <p
          style={{
            margin: '0 0 10px',
            fontSize: '11px',
            color: colors.destructive,
            fontWeight: 500,
          }}
        >
          {error}
        </p>
      )}

      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
        {!p.isNew && (
          <button
            onClick={p.onDelete}
            style={{
              padding: '8px 12px',
              fontSize: '12px',
              fontWeight: 600,
              backgroundColor: colors.surface,
              color: colors.destructive,
              border: `1px solid ${colors.destructiveBorder}`,
              borderRadius: radii.sm,
              cursor: 'pointer',
            }}
          >
            Delete
          </button>
        )}
        <button
          onClick={save}
          style={{
            flex: 1,
            padding: '8px 12px',
            fontSize: '12px',
            fontWeight: 600,
            backgroundColor: colors.accent,
            color: colors.textWhite,
            border: 'none',
            borderRadius: radii.sm,
            cursor: 'pointer',
            boxShadow: colors.accentGlow,
          }}
        >
          {p.isNew ? 'Create Preset' : 'Save Changes'}
        </button>
      </div>

      <button
        onClick={handleSearch}
        style={{
          width: '100%',
          padding: '10px 12px',
          fontSize: '13px',
          fontWeight: 600,
          backgroundColor: colors.greenBg,
          color: colors.green,
          border: `1px solid ${colors.greenBorder}`,
          borderRadius: radii.sm,
          cursor: 'pointer',
          transition: 'all 150ms',
        }}
      >
        🔍 Search on LinkedIn
      </button>
    </div>
  );
}

// ── Presets View (Root) ──────────────────────────────────────────────

export function PresetsView(): JSX.Element {
  const [presets, setPresets] = useState<readonly Preset[]>([]);
  const [editing, setEditing] = useState<{ readonly name: string; readonly isNew: boolean } | null>(null);

  const reload = useCallback(() => {
    browser.storage.local.get(['linkedInSearchPresets'], (result) => {
      const stored = result.linkedInSearchPresets;
      if (Array.isArray(stored)) {
        const typed: Preset[] = stored.filter(
          (p): p is Preset =>
            typeof p === 'object' &&
            p !== null &&
            typeof (p as Preset).name === 'string' &&
            typeof (p as Preset).config === 'object',
        );
        setPresets(typed);
      } else {
        setPresets([]);
      }
    });
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleNew = useCallback(() => {
    setEditing({ name: '', isNew: true });
  }, []);

  const handleOpen = useCallback((name: string) => {
    setEditing({ name, isNew: false });
  }, []);

  const handleSaved = useCallback(() => {
    setEditing(null);
    reload();
  }, [reload]);

  const handleDelete = useCallback(() => {
    if (editing === null) return;
    const target = editing.name;
    browser.storage.local.get(['linkedInSearchPresets'], (result) => {
      const existing: Preset[] = Array.isArray(result.linkedInSearchPresets)
        ? (result.linkedInSearchPresets as Preset[])
        : [];
      const next = existing.filter((x) => x.name !== target);
      browser.storage.local.set({ linkedInSearchPresets: next }, () => {
        setEditing(null);
        reload();
      });
    });
  }, [editing, reload]);

  if (editing !== null) {
    const target = presets.find((x) => x.name === editing.name);
    const preset: Preset = target ?? { name: editing.name, config: EMPTY_CONFIG };
    return (
      <PresetEditorView
        preset={preset}
        isNew={editing.isNew}
        onCancel={() => {
          setEditing(null);
        }}
        onSaved={handleSaved}
        onDelete={handleDelete}
      />
    );
  }

  return <PresetListView presets={presets} onOpen={handleOpen} onNew={handleNew} />;
}
