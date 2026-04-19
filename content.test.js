/**
 * @jest-environment jsdom
 */

describe('Content script', () => {
  let consoleSpy;
  let alertSpy;

  beforeEach(() => {
    // Mock console.log and window.alert
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});

    // Clear module cache to re-execute the script for each test
    jest.resetModules();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    alertSpy.mockRestore();
  });

  test('should log message to console when loaded', () => {
    require('./content.js');
    expect(consoleSpy).toHaveBeenCalledWith('CrosswordStudyHelper content script loaded');
  });

  test('getAnswerFromClueNumber should return the correct answer string', async () => {
    require('./content.js');
    jest.useFakeTimers();

    // Mock DOM structure
    document.body.innerHTML = `
      <div class="parent">
        <div class="xwd__clue--label">1</div>
      </div>
      <div class="parent">
        <div class="xwd__clue--label">2</div>
      </div>
      <div class="parent">
        <div class="xwd__cell--highlighted"></div>
        <text text-anchor="middle"><span>A</span></text>
      </div>
      <div class="parent">
        <div class="xwd__cell--highlighted"></div>
        <text text-anchor="middle"><span>B</span></text>
      </div>
    `;

    // Mock getHTML for JSDOM
    const spans = document.querySelectorAll('span');
    spans.forEach(span => {
      span.getHTML = function() { return this.innerHTML; };
    });

    const clue1 = document.querySelectorAll('.xwd__clue--label')[0];
    const clickSpy = jest.spyOn(clue1, 'click').mockImplementation(function() {
      // Manually trigger the event because JSDOM .click() doesn't always trigger listeners in some environments
      // or we want to ensure it's synchronous for the test if possible,
      // but waitForClick is waiting for an event.
      this.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // Call the global function
    const promise = window.getAnswerFromClueNumber("1", "Across");

    // Fast-forward time for both the click event (if needed) and the UI wait
    // Since we are using fake timers, and waitForClick is a promise,
    // we might need to resolve it.
    await jest.runAllTimersAsync();

    const result = await promise;

    expect(clickSpy).toHaveBeenCalled();
    expect(result).toBe("AB");
    jest.useRealTimers();
  });

  test('getAnswerFromClueNumber should handle ambiguous clue numbers with direction', async () => {
    require('./content.js');
    jest.useFakeTimers();

    document.body.innerHTML = `
      <div class="xwd__clue--label">5</div>
      <div class="xwd__clue--label">5</div>
      <div class="parent">
        <div class="xwd__cell--highlighted"></div>
        <text text-anchor="middle"><span>X</span></text>
      </div>
    `;

    const labels = document.querySelectorAll('.xwd__clue--label');
    labels.forEach(label => {
      label.click = jest.fn(function() {
        this.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      label.getHTML = function() { return this.innerHTML; };
    });
    
    // Mock getHTML for spans
    const spans = document.querySelectorAll('span');
    spans.forEach(span => {
      span.getHTML = function() { return this.innerHTML; };
    });

    // Test Across (index 0)
    const promiseAcross = window.getAnswerFromClueNumber("5", "Across");
    await jest.runAllTimersAsync();
    await promiseAcross;
    expect(labels[0].click).toHaveBeenCalled();

    // Test Down (index 1)
    const promiseDown = window.getAnswerFromClueNumber("5", "Down");
    await jest.runAllTimersAsync();
    await promiseDown;
    expect(labels[1].click).toHaveBeenCalled();

    jest.useRealTimers();
  });

  test('getAnswerFromClueNumber should handle missing text elements', async () => {
    require('./content.js');
    jest.useFakeTimers();

    document.body.innerHTML = `
      <div class="xwd__clue--label">3</div>
      <div class="parent">
        <div class="xwd__cell--highlighted"></div>
        <!-- No text element -->
      </div>
    `;

    const promise = window.getAnswerFromClueNumber("3", "Across");
    await jest.runAllTimersAsync();
    const result = await promise;
    expect(result).toBe("");
    jest.useRealTimers();
  });

  test('getAnswerFromClueNumber should return empty string if clue label is not found', async () => {
    require('./content.js');
    document.body.innerHTML = '';
    const result = await window.getAnswerFromClueNumber("99", "Across");
    expect(result).toBe("");
  });
});
