import { defineConfig } from 'wxt';
import type { UserManifestFn } from 'wxt';
import preact from '@preact/preset-vite';
import { resolve } from 'path';

const manifest: UserManifestFn = ({ browser }) => {
  const base = {
    name: 'AI Job Copilot',
    description:
      'Local-first AI job application assistant. Scrapes, tailors, and fills — never submits.',
    permissions: ['activeTab', 'storage', 'scripting'],
    host_permissions: ['<all_urls>'],
    icons: {
      '16': 'assets/icon-16.png',
      '32': 'assets/icon-32.png',
      '48': 'assets/icon-48.png',
      '128': 'assets/icon-128.png',
    },
  };

  if (browser === 'firefox') {
    return {
      ...base,
      browser_specific_settings: {
        gecko: {
          id: 'ai-job-copilot@extension.local',
          strict_min_version: '128.0',
        },
      },
    };
  }

  return base;
};

const SUPPRESS_WARNINGS = {
  /**
   * Firefox requires data_collection_permissions for new extensions
   * submitted after November 3, 2025. Suppress the build-time warning
   * since this extension is not yet being submitted to AMO. The actual
   * manifest key must be added before Firefox Store submission.
   *
   * @see https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/
   */
  firefoxDataCollection: true,
} as const;

export default defineConfig({
  manifest,
  suppressWarnings: SUPPRESS_WARNINGS,
  vite: () => ({
    plugins: [preact()],
    resolve: {
      alias: {
        '@popup': resolve(__dirname, 'src/popup'),
        '@options': resolve(__dirname, 'src/options'),
      },
    },
  }),
});