import { ACCEPTED_WORDS } from "./constants.js";

export async function blockCookies(page) {
  await page.evaluate(async (ACCEPTED_WORDS) => {
    // try to press esc to close modals
    // Simulate pressing the Escape key to close modals
    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        code: "Escape",
        which: 27,
        keyCode: 27,
        bubbles: true,
        cancelable: true,
      })
    );

    // Wait a short time for any potential animations to complete
    await new Promise((resolve) => setTimeout(resolve, 100));

    const selectors = [
      // Priority selectors for buttons in modals
      '.modal button, .modal input[type="button"], .modal input[type="submit"]',
      '.modal [role="button"]',
      // Close buttons
      'button[class*="close"], button[aria-label="Close"], button.close',
      // Overlay buttons
      ".modal-backdrop button, .modal-overlay button, .overlay button",
      "button",
      "div",
      "span",
    ];

    const flatAcceptWords = Object.values(ACCEPTED_WORDS).flat();

    selectors.forEach((selector) => {
      const elements = document.querySelectorAll(selector);
      for (let i = elements.length - 1; i >= 0; i--) {
        const el = elements[i];
        if (el.tagName.toLowerCase() === "a") continue; // Skip links
        const text = el.innerText.toLowerCase();
        if (flatAcceptWords.some((word) => text.includes(word.toLowerCase()))) {
          console.log("Found accept button:", el);
          el.click();
          break;
        }
      }
    });
  }, ACCEPTED_WORDS);

  // Wait for any animations to complete
  await new Promise((resolve) => setTimeout(resolve, 500));
}
