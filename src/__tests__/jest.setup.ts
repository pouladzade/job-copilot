// Polyfill CSS.escape for jsdom test environment
// The real browser has CSS.escape natively; jsdom does not.
if (typeof CSS === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-extraneous-class
  (globalThis as Record<string, unknown>)['CSS'] = {
    escape(value: string): string {
      if (value === '') {
        return value;
      }

      return value.replace(/[^\u0020-\u007E\u00A0-\uFFFF]/gu, (ch) => {
        return '\\' + ch.codePointAt(0)!.toString(16) + ' ';
      });
    },
  };
}

// Minimal chrome.storage.session shim for tests that exercise the extraction cache.
const sessionMem = new Map<string, unknown>();
const sessionShim = {
  get(key: string): Promise<Record<string, unknown>> {
    if (sessionMem.has(key)) return Promise.resolve({ [key]: sessionMem.get(key) });
    return Promise.resolve({});
  },
  set(items: Record<string, unknown>): Promise<void> {
    for (const [k, v] of Object.entries(items)) sessionMem.set(k, v);
    return Promise.resolve();
  },
  remove(key: string): Promise<void> {
    sessionMem.delete(key);
    return Promise.resolve();
  },
  clear(): Promise<void> {
    sessionMem.clear();
    return Promise.resolve();
  },
};
const existingChrome = (globalThis as Record<string, unknown>)['chrome'] as Record<string, unknown> | undefined;
const existingStorage = existingChrome?.['storage'] as Record<string, unknown> | undefined;
(globalThis as Record<string, unknown>)['chrome'] = {
  ...(existingChrome ?? {}),
  storage: { ...(existingStorage ?? {}), session: sessionShim },
};

// Alias browser.* → chrome.* for WXT's webextension-polyfill.
// In the real extension, WXT maps both; in tests we simply share the same mock.
(globalThis as Record<string, unknown>)['browser'] =
  (globalThis as Record<string, unknown>)['chrome'];
