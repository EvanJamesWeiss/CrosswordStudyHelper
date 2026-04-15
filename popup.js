let clues = {};

// Load existing clues on initialization
chrome.storage.local.get(['clues'], (result) => {
  if (result.clues) {
    clues = result.clues;
  }
});

document.getElementById('recordBtn').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: () => {
        try {
          const selectedClue = document.getElementsByClassName("xwd__clue--selected")[0];
          const key = selectedClue.children[0].getHTML();
          const clueText = selectedClue.children[1].getHTML();
          return { key, clueText };
        } catch (e) {
          return null;
        }
      }
    }, (results) => {
      if (results && results[0] && results[0].result) {
        const { key, clueText } = results[0].result;
        clues[key] = {
          clue: clueText,
          answer: ""
        };
        chrome.storage.local.set({ clues }, () => {
          const count = Object.keys(clues).length;
          document.getElementById('status').textContent = `Clue ${key} recorded! Total clues: ${count}`;
        });
      }
    });
  });
});

document.getElementById('doneBtn').addEventListener('click', () => {
  const content = JSON.stringify(clues, null, 2);
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'clues.txt';
  a.click();
  URL.revokeObjectURL(url);
});