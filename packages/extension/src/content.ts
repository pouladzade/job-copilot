chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'scrape') {
    const result = scrapeCurrentPage();
    sendResponse(result);
  }

  if (message.type === 'fillForm') {
    const result = fillFormFields(message.answers as Array<{ label: string; value: string }>);
    sendResponse(result);
  }
});

function scrapeCurrentPage(): { url: string; title: string } {
  return {
    url: window.location.href,
    title: document.title,
  };
}

function fillFormFields(answers: Array<{ label: string; value: string }>): { filled: number } {
  return { filled: answers.length };
}