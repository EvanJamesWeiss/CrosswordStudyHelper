/**
 * @jest-environment jsdom
 */

describe('Popup script', () => {
  let recordBtn;
  let doneBtn;
  let clearBtn;

  beforeEach(() => {
    document.body.innerHTML = `
      <button id="recordBtn">Record Clue</button>
      <button id="doneBtn">Done</button>
      <button id="clearBtn">Clear</button>
      <div id="counter">Clues recorded: 0</div>
      <div id="status"></div>
    `;
    recordBtn = document.getElementById('recordBtn');
    doneBtn = document.getElementById('doneBtn');
    clearBtn = document.getElementById('clearBtn');

    global.chrome = {
      tabs: {
        query: jest.fn()
      },
      scripting: {
        executeScript: jest.fn()
      },
      storage: {
        local: {
          get: jest.fn((keys, callback) => callback({})),
          set: jest.fn((data, callback) => callback && callback())
        }
      }
    };

    // Mock URL.createObjectURL and HTMLAnchorElement.prototype.click
    global.URL.createObjectURL = jest.fn(() => 'blob:url');
    global.URL.revokeObjectURL = jest.fn();
    HTMLAnchorElement.prototype.click = jest.fn();

    jest.resetModules();
  });

  test('Record Clue button should exist', () => {
    require('./popup.js');
    expect(recordBtn).not.toBeNull();
    expect(recordBtn.textContent).toBe('Record Clue');
  });

  test('Done button should exist', () => {
    require('./popup.js');
    expect(doneBtn).not.toBeNull();
    expect(doneBtn.textContent).toBe('Done');
  });

  test('Clear button should exist', () => {
    require('./popup.js');
    expect(clearBtn).not.toBeNull();
    expect(clearBtn.textContent).toBe('Clear');
  });

  test('Counter should exist and show 0 initially', () => {
    require('./popup.js');
    const counter = document.getElementById('counter');
    expect(counter).not.toBeNull();
    expect(counter.textContent).toBe('Clues recorded: 0');
  });

  test('Counter should show correct count when clues are loaded from storage', () => {
    chrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({ clues: { '1A': { clue: 'clue', answer: '' }, '2D': { clue: 'clue2', answer: '' } } });
    });
    require('./popup.js');
    const counter = document.getElementById('counter');
    expect(counter.textContent).toBe('Clues recorded: 2');
  });

  test('clicking Record Clue should call chrome.scripting.executeScript and handle results', async () => {
    require('./popup.js');

    chrome.tabs.query.mockImplementation((query, callback) => {
      callback([{ id: 123 }]);
    });

    let scriptFunc;
    chrome.scripting.executeScript.mockImplementation((config, callback) => {
      scriptFunc = config.func;
      callback([{ result: { key: '1A', clueText: 'The clue' } }]);
    });

    recordBtn.click();

    expect(chrome.tabs.query).toHaveBeenCalledWith({ active: true, currentWindow: true }, expect.any(Function));
    expect(chrome.scripting.executeScript).toHaveBeenCalled();
    expect(chrome.storage.local.set).toHaveBeenCalled();

    // Verify status message and counter
    const status = document.getElementById('status');
    expect(status.textContent).toBe('Clue 1A recorded!');
    const counter = document.getElementById('counter');
    expect(counter.textContent).toBe('Clues recorded: 1');

    // Verify results are handled
    // Now call with null to test negative path in results callback
    chrome.scripting.executeScript.mockImplementation((config, callback) => {
      callback(null);
    });
    recordBtn.click();

    chrome.scripting.executeScript.mockImplementation((config, callback) => {
      callback([]);
    });
    recordBtn.click();

    chrome.scripting.executeScript.mockImplementation((config, callback) => {
      callback([{ result: null }]);
    });
    recordBtn.click();

    // Test the internal function used in executeScript
    // Mock the DOM for the internal function
    document.body.innerHTML = `
      <div class="xwd__clue--selected">
        <span>1A</span>
        <span>The clue</span>
      </div>
    `;
    // We need to mock getHTML as it's not in standard JSDOM
    Element.prototype.getHTML = function() { return this.innerHTML; };

    const result = scriptFunc();
    expect(result).toEqual({ key: '1A', clueText: 'The clue' });

    // Test error case in internal function
    document.body.innerHTML = '';
    const resultError = scriptFunc();
    expect(resultError).toBeNull();
  });

  test('clicking Done should call getAnswerFromClueNumber for each clue and generate a txt file', async () => {
    chrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({ clues: { '1A': { clue: 'The clue', answer: '' } } });
    });

    require('./popup.js');

    chrome.tabs.query.mockImplementation((query, callback) => {
      callback([{ id: 123 }]);
    });

    chrome.scripting.executeScript.mockImplementation((config, callback) => {
      // Handle file injection (no callback usually for files, but we mock it)
      if (config.files) {
        if (callback) callback();
        return Promise.resolve();
      }
      // Mock result from getAnswerFromClueNumber
      callback([{ result: 'ANSWER' }]);
    });

    // We need to wait for the async work inside the click listener
    // Trigger the click
    doneBtn.click();

    // The click handler is async, so we need to wait for all microtasks to finish
    await new Promise(resolve => setTimeout(resolve, 500));

    // Test the internal function used in executeScript for doneBtn
    let doneScriptFunc;
    chrome.scripting.executeScript.mock.calls.forEach(call => {
      if (call[0].args && call[0].args[0] === '1A') {
        doneScriptFunc = call[0].func;
      }
    });

    if (doneScriptFunc) {
      window.getAnswerFromClueNumber = jest.fn(async () => 'MOCKED_ANSWER');
      const result = await doneScriptFunc('1A');
      expect(result).toBe('MOCKED_ANSWER');
      expect(window.getAnswerFromClueNumber).toHaveBeenCalledWith('1A');
    }

    expect(chrome.tabs.query).toHaveBeenCalledWith({ active: true, currentWindow: true }, expect.any(Function));
    expect(chrome.scripting.executeScript).toHaveBeenCalledWith(
      expect.objectContaining({
        args: ['1A']
      }),
      expect.any(Function)
    );
    expect(global.URL.createObjectURL).toHaveBeenCalled();
  });

  test('clicking Done should handle missing results from executeScript', async () => {
    chrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({ clues: { '1A': { clue: 'The clue', answer: '' } } });
    });

    require('./popup.js');

    chrome.tabs.query.mockImplementation((query, callback) => {
      callback([{ id: 123 }]);
    });

    chrome.scripting.executeScript.mockImplementation((config, callback) => {
      if (config.files) {
        if (callback) callback();
        return Promise.resolve();
      }
      callback(null); // Simulate failure
    });

    doneBtn.click();
    await new Promise(resolve => setTimeout(resolve, 500));

    expect(global.URL.createObjectURL).toHaveBeenCalled();
  });

  test('clicking Done should handle errors during content script injection', async () => {
    chrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({ clues: { '1A': { clue: 'The clue', answer: '' } } });
    });

    require('./popup.js');

    chrome.tabs.query.mockImplementation((query, callback) => {
      callback([{ id: 123 }]);
    });

    chrome.scripting.executeScript.mockImplementation((config, callback) => {
      if (config.files) {
        return Promise.reject(new Error('Injection failed'));
      }
      if (callback) callback([{ result: 'ANSWER' }]);
      return Promise.resolve([{ result: 'ANSWER' }]);
    });

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    doneBtn.click();
    await new Promise(resolve => setTimeout(resolve, 500));

    expect(consoleErrorSpy).toHaveBeenCalledWith('Error injecting content script:', expect.any(Error));
    expect(global.URL.createObjectURL).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  test('clicking Clear should reset clues and update UI', () => {
    chrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({ clues: { '1A': { clue: 'clue', answer: '' } } });
    });
    require('./popup.js');
    const counter = document.getElementById('counter');
    const status = document.getElementById('status');
    
    expect(counter.textContent).toBe('Clues recorded: 1');

    clearBtn.click();

    expect(chrome.storage.local.set).toHaveBeenCalledWith({ clues: {} }, expect.any(Function));
    expect(counter.textContent).toBe('Clues recorded: 0');
    expect(status.textContent).toBe('Clues list cleared!');
  });

  test('should load clues from storage on start', () => {
    chrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({ clues: { '2D': { clue: 'Another clue', answer: '' } } });
    });

    require('./popup.js');
    expect(chrome.storage.local.get).toHaveBeenCalledWith(['clues'], expect.any(Function));

    // To verify it actually loaded, we can trigger recordBtn and check the count
    chrome.tabs.query.mockImplementation((query, callback) => callback([{ id: 123 }]));
    chrome.scripting.executeScript.mockImplementation((config, callback) => {
      callback([{ result: { key: '3A', clueText: 'New clue' } }]);
    });

    recordBtn.click();
    const status = document.getElementById('status');
    const counter = document.getElementById('counter');
    expect(status.textContent).toBe('Clue 3A recorded!');
    expect(counter.textContent).toBe('Clues recorded: 2');
  });
});
