import type { JSX } from 'preact';
import { useCallback, useEffect, useState } from 'preact/hooks';
import { buildLinkedInSearchUrl } from '../utils/linkedin-search-builder';
import type { LinkedInSearchConfig } from '../utils/linkedin-search-builder';
import { colors, sectionTitle, fieldLabel, inputStyle, selectStyle, btnPrimary, btnSecondary, btnDestructive, chip } from './theme';

// ── Constants ─────────────────────────────────────────────────────────

const STORAGE_KEY = 'linkedInSearchPresets';

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

// ── Helpers ───────────────────────────────────────────────────────────

function parseCommaList(raw: string): readonly string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '');
}

// ── Component ─────────────────────────────────────────────────────────

export function LinkedInSearch(): JSX.Element {
  const [titles, setTitles] = useState('');
  const [includedSkills, setIncludedSkills] = useState('');
  const [excludedSkills, setExcludedSkills] = useState('');
  const [location, setLocation] = useState('');
  const [cities, setCities] = useState('');
  const [timeWindowHours, setTimeWindowHours] = useState(0);
  const [sortByRecent, setSortByRecent] = useState(true);
  const [workplaceTypes, setWorkplaceTypes] = useState<readonly ('1' | '2' | '3')[]>([]);
  const [experienceLevels, setExperienceLevels] = useState<readonly string[]>([]);
  const [easyApply, setEasyApply] = useState(false);
  const [jobTypes, setJobTypes] = useState<readonly string[]>([]);
  const [presetName, setPresetName] = useState('');
  const [presets, setPresets] = useState<readonly Preset[]>([]);
  const [selectedPreset, setSelectedPreset] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  // Load presets from storage on mount
  useEffect(() => {
    browser.storage.local.get([STORAGE_KEY], (result) => {
      const stored = result[STORAGE_KEY];
      if (Array.isArray(stored)) {
        const typed: Preset[] = stored.filter(
          (p): p is Preset =>
            typeof p === 'object' &&
            p !== null &&
            typeof (p as Preset).name === 'string' &&
            typeof (p as Preset).config === 'object',
        );
        setPresets(typed);
      }
    });
  }, []);

  // ── Preset handlers ──

  const loadPreset = useCallback(
    (name: string) => {
      const preset = presets.find((p) => p.name === name);
      if (preset === undefined) return;

      const cfg = preset.config;
      setTitles(cfg.titles.join(', '));
      setIncludedSkills(cfg.includedSkills.join(', '));
      setExcludedSkills(cfg.excludedSkills.join(', '));
      setLocation(cfg.location ?? '');
      setCities(cfg.cities ?? '');
      setTimeWindowHours(cfg.timeWindowHours);
      setSortByRecent(cfg.sortByRecent);
      setEasyApply(cfg.easyApply);
      setWorkplaceTypes(cfg.workplaceTypes ?? []);
      setExperienceLevels(cfg.experienceLevels ?? []);
      setJobTypes(cfg.jobTypes ?? []);
      setPresetName(name);

      showTempStatus(`✓ Loaded "${name}"`);
    },
    [presets],
  );

  const clearForm = useCallback(() => {
    setTitles('');
    setIncludedSkills('');
    setExcludedSkills('');
    setLocation('');
    setCities('');
    setTimeWindowHours(0);
    setSortByRecent(true);
    setEasyApply(false);
    setWorkplaceTypes([]);
    setExperienceLevels([]);
    setJobTypes([]);
  }, []);

  const handleSelectPreset = useCallback(
    (name: string) => {
      setSelectedPreset(name);
      if (name !== '') {
        loadPreset(name);
      } else {
        clearForm();
      }
    },
    [loadPreset, clearForm],
  );

  const handleSavePreset = useCallback(() => {
    const trimmed = presetName.trim();
    if (trimmed === '') {
      showTempStatus('Enter a preset name first');
      return;
    }

    const config: LinkedInSearchConfig = {
      titles: parseCommaList(titles),
      includedSkills: parseCommaList(includedSkills),
      excludedSkills: parseCommaList(excludedSkills),
      location: location.trim() || undefined,
      cities: cities.trim() || undefined,
      timeWindowHours,
      sortByRecent,
      easyApply,
      workplaceTypes: workplaceTypes.length > 0 ? workplaceTypes : undefined,
      experienceLevels: experienceLevels.length > 0 ? experienceLevels : undefined,
      jobTypes: jobTypes.length > 0 ? jobTypes : undefined,
    };

    const existing = presets.find((p) => p.name === trimmed);
    const updated: Preset[] = existing
      ? presets.map((p) => (p.name === trimmed ? { name: trimmed, config } : p))
      : [...presets, { name: trimmed, config }];

    browser.storage.local.set({ [STORAGE_KEY]: updated }, () => {
      setPresets(updated);
      setSelectedPreset(trimmed);
      showTempStatus(`✓ Saved "${trimmed}"`);
    });
  }, [presets, presetName, titles, includedSkills, excludedSkills, location, cities, timeWindowHours, sortByRecent, easyApply, workplaceTypes, experienceLevels, jobTypes]);

  const handleDeletePreset = useCallback(() => {
    if (selectedPreset === '') return;

    const updated = presets.filter((p) => p.name !== selectedPreset);
    browser.storage.local.set({ [STORAGE_KEY]: updated }, () => {
      setPresets(updated);
      const remaining = updated.length > 0 ? updated[0]?.name ?? '' : '';
      setSelectedPreset(remaining);
      showTempStatus(`✓ Deleted "${selectedPreset}"`);
    });
  }, [selectedPreset, presets]);

  // ── Checkbox toggle helpers ──

  const toggleWorkplace = useCallback(
    (val: '1' | '2' | '3') => {
      setWorkplaceTypes((prev) =>
        prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val],
      );
    },
    [],
  );

  const toggleExperience = useCallback((val: string) => {
    setExperienceLevels((prev) =>
      prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val],
    );
  }, []);

  const toggleJobType = useCallback((val: string) => {
    setJobTypes((prev) =>
      prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val],
    );
  }, []);

  // ── Search ──

  const handleSearch = useCallback(() => {
    const config: LinkedInSearchConfig = {
      titles: parseCommaList(titles),
      includedSkills: parseCommaList(includedSkills),
      excludedSkills: parseCommaList(excludedSkills),
      location: location.trim() || undefined,
      cities: cities.trim() || undefined,
      timeWindowHours,
      sortByRecent,
      easyApply,
      workplaceTypes: workplaceTypes.length > 0 ? workplaceTypes : undefined,
      experienceLevels: experienceLevels.length > 0 ? experienceLevels : undefined,
      jobTypes: jobTypes.length > 0 ? jobTypes : undefined,
    };

    const url = buildLinkedInSearchUrl(config);
    browser.tabs.create({ url });
  }, [titles, includedSkills, excludedSkills, location, cities, timeWindowHours, sortByRecent, easyApply, workplaceTypes, experienceLevels, jobTypes]);

  // ── Status message ──

  function showTempStatus(msg: string): void {
    setStatusMsg(msg);
    setTimeout(() => { setStatusMsg(''); }, 3000);
  }

  // ── Render ──

  const checkboxRow = {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '10px',
    marginTop: '4px',
  };

  return (
    <div style={{ marginTop: '10px' }}>
      <div style={sectionTitle}>🔍 LinkedIn Search Builder</div>

      {/* Preset management row */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
          marginBottom: '14px',
          flexWrap: 'wrap',
        }}
      >
        <select
          value={selectedPreset}
          onChange={(e) => { handleSelectPreset((e.target as HTMLSelectElement).value); }}
          style={{ ...selectStyle, width: 'auto', minWidth: '200px' }}
        >
          <option value="">-- Select a saved preset --</option>
          {presets.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name}
            </option>
          ))}
        </select>
        <button onClick={handleDeletePreset} style={btnDestructive}>
          Delete
        </button>
        <button
          onClick={() => {
            setSelectedPreset('');
            clearForm();
            setPresetName('');
          }}
          style={btnSecondary}
        >
          New
        </button>

        {statusMsg !== '' && (
          <span
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: statusMsg.startsWith('✓') ? colors.green : colors.destructive,
              marginLeft: '4px',
            }}
          >
            {statusMsg}
          </span>
        )}
      </div>

      {/* Preset save row */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
          marginBottom: '18px',
        }}
      >
        <input
          type="text"
          value={presetName}
          onInput={(e) => { setPresetName((e.target as HTMLInputElement).value); }}
          placeholder="Preset name (e.g. Backend Remote Germany)"
          style={{ ...inputStyle, maxWidth: '320px' }}
        />
        <button onClick={handleSavePreset} style={btnSecondary}>
          Save Preset
        </button>
      </div>

      {/* Job titles */}
      <div style={{ marginBottom: '12px' }}>
        <label style={fieldLabel}>Job Titles (comma-separated, OR'd together)</label>
        <input
          type="text"
          value={titles}
          onInput={(e) => { setTitles((e.target as HTMLInputElement).value); }}
          placeholder='"Software Engineer", "Senior Software Engineer", "Senior Architect"'
          style={inputStyle}
        />
      </div>

      {/* Included skills */}
      <div style={{ marginBottom: '12px' }}>
        <label style={fieldLabel}>Included Skills (comma-separated, OR'd together)</label>
        <input
          type="text"
          value={includedSkills}
          onInput={(e) => { setIncludedSkills((e.target as HTMLInputElement).value); }}
          placeholder="Rust, Golang, JavaScript"
          style={inputStyle}
        />
      </div>

      {/* Excluded skills */}
      <div style={{ marginBottom: '12px' }}>
        <label style={fieldLabel}>Excluded Skills (comma-separated, NOT'd together)</label>
        <input
          type="text"
          value={excludedSkills}
          onInput={(e) => { setExcludedSkills((e.target as HTMLInputElement).value); }}
          placeholder="PHP, Java, Python"
          style={inputStyle}
        />
      </div>

      {/* Location + cities side by side */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
        <div style={{ flex: 1 }}>
          <label style={fieldLabel}>Location</label>
          <input
            type="text"
            value={location}
            onInput={(e) => { setLocation((e.target as HTMLInputElement).value); }}
            placeholder="Germany or Berlin"
            style={inputStyle}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={fieldLabel}>Cities (comma-separated, overrides location)</label>
          <input
            type="text"
            value={cities}
            onInput={(e) => { setCities((e.target as HTMLInputElement).value); }}
            placeholder="e.g. Berlin, Munich, Hamburg"
            style={inputStyle}
          />
        </div>
      </div>

      {/* Time window */}
      <div style={{ marginBottom: '12px' }}>
        <label style={fieldLabel}>Time Posted</label>
        <select
          value={timeWindowHours}
          onChange={(e) => { setTimeWindowHours(parseInt((e.target as HTMLSelectElement).value, 10)); }}
          style={selectStyle}
        >
          {TIME_WINDOW_OPTIONS.map((opt) => (
            <option key={opt.hours} value={opt.hours}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Sort by */}
      <div style={{ marginBottom: '18px' }}>
        <label style={{ ...fieldLabel, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={sortByRecent}
            onChange={(e) => { setSortByRecent((e.target as HTMLInputElement).checked); }}
            style={{ width: '16px', height: '16px' }}
          />
          Sort by most recent
        </label>
      </div>

      {/* Workplace types */}
      <div style={{ marginBottom: '14px' }}>
        <label style={fieldLabel}>Workplace Type</label>
        <div style={checkboxRow}>
          {WORKPLACE_OPTIONS.map((opt) => (
            <span
              key={opt.value}
              style={chip(workplaceTypes.includes(opt.value))}
              onClick={() => { toggleWorkplace(opt.value); }}
            >
              {opt.label}
            </span>
          ))}
        </div>
      </div>

      {/* Experience levels */}
      <div style={{ marginBottom: '14px' }}>
        <label style={fieldLabel}>Experience Level</label>
        <div style={checkboxRow}>
          {EXPERIENCE_OPTIONS.map((opt) => (
            <span
              key={opt.value}
              style={chip(experienceLevels.includes(opt.value))}
              onClick={() => { toggleExperience(opt.value); }}
            >
              {opt.label}
            </span>
          ))}
        </div>
      </div>

      {/* Easy Apply */}
      <div style={{ marginBottom: '14px' }}>
        <label style={{ ...fieldLabel, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={easyApply}
            onChange={(e) => { setEasyApply((e.target as HTMLInputElement).checked); }}
            style={{ width: '16px', height: '16px' }}
          />
          Easy Apply only
        </label>
      </div>

      {/* Job types */}
      <div style={{ marginBottom: '20px' }}>
        <label style={fieldLabel}>Job Type</label>
        <div style={checkboxRow}>
          {JOB_TYPE_OPTIONS.map((opt) => (
            <span
              key={opt.value}
              style={chip(jobTypes.includes(opt.value))}
              onClick={() => { toggleJobType(opt.value); }}
            >
              {opt.label}
            </span>
          ))}
        </div>
      </div>

      {/* Search button */}
      <button onClick={handleSearch} style={{ ...btnPrimary, width: '100%', padding: '14px', fontSize: '16px' }}>
        🔍 Search on LinkedIn
      </button>
    </div>
  );
}