import { defineConfig } from 'wxt';
import type { UserManifestFn } from 'wxt';
import preact from '@preact/preset-vite';
import { resolve } from 'path';

const manifest: UserManifestFn = ({ browser, manifest: generated }) => {
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

  const result = {
    ...(generated ?? {}),
    ...base,
    options_ui: {
      ...(generated?.options_ui ?? {}),
      open_in_tab: true,
    },
  };

  if (browser === 'firefox') {
    return {
      ...result,
      browser_specific_settings: {
        gecko: {
          id: 'ai-job-copilot@extension.local',
          strict_min_version: '128.0',
          data_collection_permissions: {
            required: ['none'],
          },
        },
      },
    };
  }

  return result;
};

export default defineConfig({
  srcDir: '.',
  manifest,
  vite: () => ({
    plugins: [preact()],
  }),
});
