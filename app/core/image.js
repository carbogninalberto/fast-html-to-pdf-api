import sharp from "sharp";
import { IMAGE_RESIZE_MIN, IMAGE_RESIZE_MAX } from "../config/constants.js";

export async function captureImage(page, config) {
  let result = await page.screenshot({
    fullPage: config.render?.fullPage ?? false,
  });

  const {
    type = "png",
    compression,
    smooth,
    quality,
    resize,
    rotate,
    roundedBorders,
    padding,
    crop,
  } = config.image;

  // Get metadata from raw buffer before building the pipeline
  const { width: origWidth, height: origHeight } = await sharp(result).metadata();

  // Initialize Sharp pipeline
  let sharpImage = sharp(result);
  result = null; // Free screenshot buffer after Sharp init

  // Track current dimensions for operations that need them
  let currentWidth = origWidth;
  let currentHeight = origHeight;

  // Apply crop first if specified (before other transformations)
  if (crop) {
    let { width, height, x, y } = crop;
    
    // Validate and adjust crop dimensions
    if (!width || width > currentWidth) width = currentWidth;
    if (!height || height > currentHeight) height = currentHeight;
    
    const cropConfig = {
      left: x ?? 0,
      top: y ?? 0,
      width: width,
      height: height,
    };
    
    sharpImage = sharpImage.extract(cropConfig);
    
    // Update current dimensions after crop
    currentWidth = width;
    currentHeight = height;
  }

  // Apply rotation (affects dimensions)
  if (rotate && typeof rotate === "number" && rotate !== 0) {
    sharpImage = sharpImage.rotate(rotate);
    
    // Update dimensions if rotation is 90 or 270 degrees
    if (rotate % 180 === 90) {
      [currentWidth, currentHeight] = [currentHeight, currentWidth];
    }
  }

  // Apply resize
  if (resize && typeof resize === "number" && resize !== 1) {
    const factor = Math.min(Math.max(resize, IMAGE_RESIZE_MIN), IMAGE_RESIZE_MAX);
    const newWidth = Math.round(currentWidth * factor);
    const newHeight = Math.round(currentHeight * factor);
    
    sharpImage = sharpImage.resize(newWidth, newHeight, {
      fit: 'fill',
      kernel: 'lanczos3' // Better quality for resizing
    });
    
    // Update current dimensions
    currentWidth = newWidth;
    currentHeight = newHeight;
  }

  // Apply rounded borders
  if (roundedBorders && roundedBorders > 0) {
    const cornerRadius = typeof roundedBorders === "number" ? roundedBorders : 20;
    
    const roundedCorners = Buffer.from(
      `<svg><rect x="0" y="0" width="${currentWidth}" height="${currentHeight}" rx="${cornerRadius}" ry="${cornerRadius}"/></svg>`
    );
    
    sharpImage = sharpImage.composite([
      { input: roundedCorners, blend: "dest-in" },
    ]);
  }

  // Apply padding
  if (padding && padding > 0) {
    const pad = typeof padding === "number" ? padding : 20;
    sharpImage = sharpImage.extend({
      top: pad,
      bottom: pad,
      left: pad,
      right: pad,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    });
  }

  // Set output format and compression settings in a single chain
  const formatOptions = {};
  
  switch (type) {
    case "jpeg":
      formatOptions.quality = quality ?? 80;
      formatOptions.mozjpeg = true; // Use mozjpeg for better compression
      sharpImage = sharpImage.jpeg(formatOptions);
      break;
      
    case "png":
      formatOptions.quality = quality ?? 100;
      
      // Set compression level
      if (compression && compression > 0) {
        formatOptions.compressionLevel = 
          compression === "low" ? 3 : 
          compression === "medium" ? 6 : 
          typeof compression === "number" ? compression : 9;
      }
      
      // Set adaptive filtering for smoothing
      if (smooth) {
        formatOptions.adaptiveFiltering = true;
        formatOptions.palette = true; // Optimize palette for smaller file size
      }
      
      sharpImage = sharpImage.png(formatOptions);
      break;
      
    case "webp":
      formatOptions.quality = quality ?? 80;
      formatOptions.effort = 4; // Balance between speed and compression
      sharpImage = sharpImage.webp(formatOptions);
      break;
      
    case "avif":
      formatOptions.quality = quality ?? 50;
      formatOptions.speed = 5; // Balance between speed and compression
      sharpImage = sharpImage.avif(formatOptions);
      break;
      
    case "gif":
      sharpImage = sharpImage.gif({
        effort: 7,
        dither: 1.0
      });
      break;
      
    default:
      sharpImage = sharpImage.png(); // Default to PNG
  }

  // Return the final buffer
  return await sharpImage.toBuffer();
}