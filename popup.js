let clues = {};

// Update counter display
function updateCounter() {
  const count = Object.keys(clues).length;
  document.getElementById('counter').textContent = `Clues recorded: ${count}`;
}

// Load existing clues on initialization
chrome.storage.local.get(['clues'], (result) => {
  if (result.clues) {
    clues = result.clues;
    updateCounter();
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
          updateCounter();
          document.getElementById('status').textContent = `Clue ${key} recorded!`;
        });
      }
    });
  });
});

document.getElementById('doneBtn').addEventListener('click', async () => {
  const doneBtn = document.getElementById('doneBtn');
  const originalText = doneBtn.textContent;
  doneBtn.disabled = true;
  doneBtn.textContent = 'Processing...';

  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    const clueKeys = Object.keys(clues);
    const tabId = tabs[0].id;

    // Inject content.js first to ensure window.getAnswerFromClueNumber is defined
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content.js']
      });
    } catch (e) {
      console.error("Error injecting content script:", e);
    }

    for (const key of clueKeys) {
      await new Promise((resolve) => {
        chrome.scripting.executeScript({
          target: { tabId },
          func: async (clueNumber) => {
            console.log("Getting answer for clue: ", clueNumber);
            let answer = await window.getAnswerFromClueNumber(clueNumber);
            console.log("Answer: ", answer);
            return answer;
          },
          args: [key]
        }, (results) => {
          if (results && results[0]) {
            clues[key].answer = results[0].result;
          }
          resolve();
        });
      });
    }

    const content = Object.values(clues)
      .map(item => `${item.clue} (${item.answer.length});${item.answer}`)
      .join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'clues.txt';
    a.click();
    URL.revokeObjectURL(url);

    doneBtn.disabled = false;
    doneBtn.textContent = originalText;
  });
});

document.getElementById('clearBtn').addEventListener('click', () => {
  clues = {};
  chrome.storage.local.set({ clues }, () => {
    updateCounter();
    document.getElementById('status').textContent = 'Clues list cleared!';
  });
});