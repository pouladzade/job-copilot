type ExtensionMessage = { readonly type: 'scrape' } | { readonly type: 'fillForm'; readonly answers: ReadonlyArray<{ readonly label: string; readonly value: string }> };

type ScrapeResult = { readonly url: string; readonly title: string };

chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, _sender, sendResponse: (response: ScrapeResult | { readonly error: string } | { readonly filled: number }) => void): boolean => {
    if (message.type === 'scrape') {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tabId = tabs[0]?.id;
        if (tabId !== undefined) {
          chrome.tabs.sendMessage(tabId, { type: 'scrape' }, (response: ScrapeResult) => {
            sendResponse(response);
          });
        } else {
          sendResponse({ error: 'No active tab found' });
        }
      });

      return true;
    }

    if (message.type === 'fillForm') {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tabId = tabs[0]?.id;
        if (tabId !== undefined) {
          chrome.tabs.sendMessage(tabId, { type: 'fillForm', answers: message.answers }, (response: { readonly filled: number }) => {
            sendResponse(response);
          });
        } else {
          sendResponse({ error: 'No active tab found' });
        }
      });

      return true;
    }

    return false;
  },
);
