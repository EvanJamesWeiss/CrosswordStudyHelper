async function waitForClick(element) {
  return new Promise(resolve => {
    element.addEventListener('click', () => {
      resolve();
    }, { once: true });
  });
}

async function getAnswerFromClueNumber(clueNumber, direction) {
  const matchingLabels = Array.from(document.querySelectorAll('.xwd__clue--label')).filter(el => el.textContent.trim() === clueNumber);
  
  let clueElement;
  if (matchingLabels.length > 1) {
    const index = direction === "Across" ? 0 : 1;
    clueElement = matchingLabels[index];
  } else {
    clueElement = matchingLabels[0];
  }

  if (!clueElement) return "";

  const clickPromise = waitForClick(clueElement);
  clueElement.click();
  await clickPromise;

  // Wait for the UI to update
  await new Promise(resolve => setTimeout(resolve, 500));

  const letters = Array.from(document.getElementsByClassName("xwd__cell--highlighted")).map(cell => {
    const parent = cell.parentElement;
    const textElement = Array.from(parent.children).find(
      el => el.tagName.toLowerCase() === "text" && el.getAttribute("text-anchor") === "middle"
    );
    return textElement ? textElement.children[0].getHTML() : null;
  });
  return letters.join("");
}

window.getAnswerFromClueNumber = getAnswerFromClueNumber;
console.log('CrosswordStudyHelper content script loaded');