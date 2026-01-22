/**
 * Generates a PDF from the current page state.
 * @param {import('puppeteer').Page} page - The Puppeteer page instance.
 * @param {Object} config - PDF configuration.
 * @param {Object} config.pdf - Puppeteer PDF options (format, margin, scale, etc.).
 * @returns {Promise<Buffer>} The generated PDF as a buffer.
 */
export async function capturePDF(page, config) {
  return await page.pdf(config.pdf);
}
