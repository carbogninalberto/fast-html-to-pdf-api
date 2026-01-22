import { HTML_CAPTURE_MAX_SIZE_BYTES } from "../config/constants.js";

/**
 * Captures the full HTML content of a page with all resources (CSS, JS, images, fonts) embedded inline.
 * @param {import('puppeteer').Page} page - The Puppeteer page instance.
 * @returns {Promise<Buffer>} The complete HTML document as a UTF-8 buffer.
 * @throws {Error} If the resulting HTML exceeds the size limit.
 */
export async function captureHTML(page) {
  // Get the full HTML content of the page with embedded CSS, JS, and images
  const htmlContent = await page.evaluate(async () => {
    // Resource cache to avoid re-fetching the same URLs
    const resourceCache = new Map();

    // Function to fetch and encode resources with caching
    const fetchAndEncode = async (url) => {
      if (resourceCache.has(url)) {
        return resourceCache.get(url);
      }
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        const result = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        resourceCache.set(url, result);
        return result;
      } catch (error) {
        console.error(`Failed to fetch and encode: ${url}`, error);
        return url; // Return original URL if fetching fails
      }
    };

    // Function to safely decode base64
    const safeAtob = (encodedData) => {
      try {
        return atob(encodedData);
      } catch (error) {
        console.error("Failed to decode base64:", error);
        return ""; // Return empty string if decoding fails
      }
    };

    // Embed external CSS
    const styles = await Promise.all(
      Array.from(document.styleSheets).map(async (styleSheet) => {
        if (styleSheet.href) {
          const encodedCSS = await fetchAndEncode(styleSheet.href);
          const decodedCSS = safeAtob(encodedCSS.split(",")[1] || "");
          return `<style>${decodedCSS}</style>`; // Decode and embed CSS content directly
        } else {
          return `<style>${Array.from(styleSheet.cssRules)
            .map((rule) => rule.cssText)
            .join("\n")}</style>`;
        }
      })
    );

    // Embed external JS
    const scripts = await Promise.all(
      Array.from(document.scripts).map(async (script) => {
        if (script.src) {
          const encodedJS = await fetchAndEncode(script.src);
          const decodedJS = safeAtob(encodedJS.split(",")[1] || "");
          return `<script>${decodedJS}</script>`; // Decode and embed JS content directly
        } else {
          return `<script>${script.innerText}</script>`;
        }
      })
    );

    // Embed images
    const embedImages = async () => {
      const images = Array.from(document.images);
      for (const img of images) {
        if (img.src) {
          img.src = await fetchAndEncode(img.src);
        }
      }
    };

    await embedImages();

    // Embed web fonts
    const embedFonts = async () => {
      const fontFaces = [];
      for (const styleSheet of document.styleSheets) {
        try {
          for (const rule of styleSheet.cssRules) {
            if (rule instanceof CSSFontFaceRule) {
              const fontUrl = rule.style
                .getPropertyValue("src")
                .match(/url\(['"]?(.+?)['"]?\)/)?.[1];
              if (fontUrl) {
                const encodedFont = await fetchAndEncode(fontUrl);
                fontFaces.push(
                  `@font-face { ${rule.cssText.replace(fontUrl, encodedFont)} }`
                );
              }
            }
          }
        } catch (error) {
          console.error("Error accessing styleSheet rules", error);
        }
      }
      return fontFaces.join("\n");
    };

    const embeddedFonts = await embedFonts();

    // Embed Font Awesome and other icon fonts
    const embedIconFonts = async () => {
      const iconFonts = [];
      const iconLinks = document.querySelectorAll(
        'link[rel="stylesheet"][href*="font-awesome"], link[rel="stylesheet"][href*="icons"]'
      );
      for (const link of iconLinks) {
        try {
          let css = await fetchAndEncode(link.href);
          css = safeAtob(css.split(",")[1] || ""); // Decode the base64 encoded CSS
          const fontUrls = css.match(/url\((['"])(.*?)\1\)/g) || [];
          for (const fontUrl of fontUrls) {
            const url = fontUrl.slice(5, -2).replace(/["']/g, "");
            const encodedFont = await fetchAndEncode(url);
            css = css.replace(url, encodedFont);
          }
          iconFonts.push(`<style>${css}</style>`);
        } catch (error) {
          console.error(
            `Failed to embed icon font stylesheet: ${link.href}`,
            error
          );
        }
      }
      return iconFonts.join("\n");
    };

    const embeddedIconFonts = await embedIconFonts();

    // Embed SVG sprites (often used for icons)
    const embedSvgSprites = async () => {
      const svgSprites = [];
      const svgUses = document.querySelectorAll("svg use");
      for (const use of svgUses) {
        const href = use.getAttribute("href") || use.getAttribute("xlink:href");
        if (href && href.startsWith("#")) {
          const spriteId = href.slice(1);
          const sprite = document.getElementById(spriteId);
          if (sprite) {
            svgSprites.push(sprite.outerHTML);
          }
        }
      }
      return svgSprites.join("\n");
    };

    const embeddedSvgSprites = await embedSvgSprites();

    // Capture favicon
    const favicon = document.querySelector('link[rel*="icon"]');
    const faviconHtml = favicon
      ? `<link rel="icon" href="${await fetchAndEncode(favicon.href)}">`
      : "";

    // Capture all meta tags
    const metaTags = Array.from(document.getElementsByTagName("meta"))
      .map((meta) => meta.outerHTML)
      .join("\n");

    // Combine everything
    return `
      <!DOCTYPE html>
      <html lang="${document.documentElement.lang || "en"}" dir="${
      document.documentElement.dir || "ltr"
    }">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          ${metaTags}
          ${faviconHtml}
          ${styles.join("\n")}
          ${embeddedIconFonts}
          <style>${embeddedFonts}</style>
        </head>
        <body>
          ${embeddedSvgSprites}
          ${document.body.innerHTML}
          ${scripts.join("\n")}
        </body>
      </html>
    `.trim();
  });

  // Convert the HTML string to a Buffer
  const buffer = Buffer.from(htmlContent, "utf8");

  if (buffer.byteLength > HTML_CAPTURE_MAX_SIZE_BYTES) {
    throw new Error("HTML capture exceeded 500MB size limit");
  }

  return buffer;
}
