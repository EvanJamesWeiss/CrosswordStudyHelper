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

  test('should display hello world popup when clicking on document', () => {
    require('./content.js');

    // Trigger click on the document
    const event = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window
    });
    document.dispatchEvent(event);

    // Verify alert was called with 'hello world'
    expect(alertSpy).toHaveBeenCalledWith('hello world');
  });
});
