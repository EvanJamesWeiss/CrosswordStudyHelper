/**
 * @jest-environment jsdom
 */

describe('Popup script', () => {
  let recordBtn;
  let doneBtn;

  beforeEach(() => {
    document.body.innerHTML = `
      <button id="recordBtn">Record Clue</button>
      <button id="doneBtn">Done</button>
      <div id="status"></div>
    `;
    recordBtn = document.getElementById('recordBtn');
    doneBtn = document.getElementById('doneBtn');

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

    // Verify status message
    const status = document.getElementById('status');
    expect(status.textContent).toBe('Clue 1A recorded! Total clues: 1');

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

  test('clicking Done should generate a txt file', () => {
    require('./popup.js');

    // Simulate some recorded clues (we need to trigger the record first or mock the internal state)
    // For now, let's just test that it calls createObjectURL
    doneBtn.click();
    expect(global.URL.createObjectURL).toHaveBeenCalled();
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
    expect(status.textContent).toBe('Clue 3A recorded! Total clues: 2');
  });
});
