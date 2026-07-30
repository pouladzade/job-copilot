import { defineContentScript } from 'wxt/utils/define-content-script';
import '../src/content';

export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    // src/content.ts registers chrome.runtime.onMessage.addListener as a side effect
  },
});
