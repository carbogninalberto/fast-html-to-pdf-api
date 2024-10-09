export async function capturePDF(page, config) {
  return await page.pdf(config.pdf);
}
