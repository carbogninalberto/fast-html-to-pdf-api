import sharp from "sharp";

export async function captureImage(page, config) {
  let result = await page.screenshot({
    fullPage: config.render?.fullPage ?? false,
  });

  let sharpImage = sharp(result);

  const {
    type,
    compression,
    smooth,
    quality,
    resize,
    rotate,
    roundedBorders,
    padding,
    crop,
  } = config.image;

  // Set image type
  switch (type) {
    case "jpeg":
      sharpImage = sharpImage.jpeg();
      break;
    case "png":
      sharpImage = sharpImage.png();
      break;
    case "webp":
      sharpImage = sharpImage.webp();
      break;
    case "gif":
      sharpImage = sharpImage.gif();
      break;
    case "avif":
      sharpImage = sharpImage.avif();
      break;
    default:
      sharpImage = sharpImage.png(); // Default to PNG
  }

  // Set compression
  if (compression && compression > 0) {
    const compressionLevel =
      compression === "low" ? 3 : compression === "medium" ? 6 : 9;
    sharpImage = sharpImage.png({ compressionLevel });
  }

  // Set quality
  if (quality && quality > 0) {
    sharpImage = sharpImage.png({ quality: quality ?? 100 });
  }

  // Set smooth (adaptive filtering)
  if (smooth) {
    sharpImage = sharpImage.png({ adaptiveFiltering: true });
  }

  // Rotate
  if (rotate && typeof rotate === "number" && rotate != 0) {
    sharpImage = sharpImage.rotate(rotate);
  }

  // Crop
  if (crop) {
    let { width, height, x, y } = crop;
    const metadata = await sharpImage.metadata();
    // check if width and height are set and are within, otherwise use metadata
    if (!width || width > metadata.width) width = metadata.width;
    if (!height || height > metadata.height) height = metadata.height;
    const cropConfig = {
      left: x ?? 0,
      top: y ?? 0,
      width: width,
      height: height,
    };
    sharpImage = sharpImage.extract(cropConfig);
  }

  // Resize
  if (resize && typeof resize === "number" && resize != 1) {
    const metadata = await sharpImage.metadata();
    let height = metadata.height;
    let width = metadata.width;

    // change based on crop options
    if (crop) {
      height = crop.height;
      width = crop.width;
    }

    const factor = Math.min(Math.max(resize, 0.1), 3); // Limit factor between 0.1 and 3
    const newWidth = Math.round(width * factor);
    const newHeight = Math.round(height * factor);
    sharpImage = sharpImage.resize(newWidth, newHeight);
  }

  // Rounded borders
  if (roundedBorders && roundedBorders > 0) {
    const cornerRadius =
      typeof roundedBorders === "number" ? roundedBorders : 20;
    let { width, height } = await sharpImage.metadata();

    if (crop) {
      height = crop.height;
      width = crop.width;
    }

    const roundedCorners = Buffer.from(
      `<svg><rect x="0" y="0" width="${width}" height="${height}" rx="${cornerRadius}" ry="${cornerRadius}"/></svg>`
    );
    sharpImage = sharpImage.composite([
      { input: roundedCorners, blend: "dest-in" },
    ]);
  }

  // Padding
  if (padding && padding > 0) {
    let pad = typeof padding === "number" ? padding : 20;
    sharpImage = sharpImage.extend({
      top: pad,
      bottom: pad,
      left: pad,
      right: pad,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    });
  }

  return await sharpImage.toBuffer();
}
