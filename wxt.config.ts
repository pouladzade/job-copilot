import { defineConfig } from 'wxt';
import type { UserManifestFn } from 'wxt';
import type { Plugin } from 'vite';
import preact from '@preact/preset-vite';

const manifest: UserManifestFn = ({ browser, manifest: generated }) => {
  const base = {
    name: 'AI Job Copilot',
    description: 'Local-first AI job application assistant. Scrapes, tailors, and fills — never submits.',
    permissions: ['activeTab', 'storage', 'scripting'],
    host_permissions: ['<all_urls>'],
    icons: {
      '16': 'assets/icon-16.png',
      '32': 'assets/icon-32.png',
      '48': 'assets/icon-48.png',
      '128': 'assets/icon-128.png',
    },
  };

  const result: Record<string, unknown> = {
    ...(generated ?? {}),
    ...base,
  };

  // WXT auto-generates options_ui from entrypoints/options/
  // Replace with options_page so the browser always opens settings in a full tab
  // (Chrome's options_ui can still show inline even with open_in_tab: true)
  delete result.options_ui;
  result.options_page = 'options.html';

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
    } as ReturnType<UserManifestFn>;
  }

  return result as ReturnType<UserManifestFn>;
};

/**
 * Vite adds crossorigin attributes to module scripts for CORS preloading.
 * In a chrome-extension:// context, these are unnecessary and can cause
 * loading issues. This plugin strips them from the generated HTML.
 */
function stripCrossorigin(): Plugin {
  return {
    name: 'strip-crossorigin',
    transformIndexHtml(html) {
      return html.replace(/\scrossorigin(?:=["'][^"']*["'])?/g, '');
    },
  };
}

export default defineConfig({
  srcDir: '.',
  manifest,
  vite: () => ({
    plugins: [preact(), stripCrossorigin()],
  }),
});
