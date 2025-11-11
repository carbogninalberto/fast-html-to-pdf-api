// ... existing imports ...

// Add this import at the top of the file
import { z } from "zod";

export function validateConfig(config) {
  const configSchema = z.object({
    url: z.string().url().optional(),
    html: z.string().optional(),
    type: z.enum(["image", "pdf", "video", "html"]),
    headers: z.record(z.string()).optional(),
    render: z
      .object({
        block: z
          .object({
            cookies: z.boolean().optional(),
            ads: z.boolean().optional(),
            trackers: z.boolean().optional(),
            banners: z.boolean().optional(),
          })
          .optional(),
        waitTime: z.number().nonnegative().optional(),
        timeout: z.number().positive().optional(),
        fullPage: z.boolean().optional(),
        triggerLazyAnimations: z.boolean().optional(),
        scroll: z
          .object({
            position: z.number().nonnegative().optional(),
            animate: z.boolean().optional(),
            duration: z.number().nonnegative().optional(),
            animation: z.string().optional(),
          })
          .optional(),
        waitUntil: z
          .enum(["networkidle0", "domcontentloaded", "load", "networkidle2"])
          .optional(),
      })
      .optional(),
    device: z
      .object({
        userAgent: z.string().optional(),
        deviceScaleFactor: z.number().positive().optional(),
        width: z.number().positive().optional(),
        height: z.number().positive().optional(),
        locale: z.string().optional(),
        timezone: z.string().optional(),
        cache: z.boolean().optional(),
        cacheKey: z.string().optional(),
      })
      .optional(),
    image: z
      .object({
        type: z.enum(["png", "jpeg", "webp", "gif", "avif"]).optional(),
        compression: z.number().min(0).max(9).optional(),
        smooth: z.boolean().optional(),
        quality: z.number().min(0).max(100).optional(),
        resize: z.number().min(0.1).max(3).optional(),
        rotate: z.number().min(0).max(360).optional(),
        roundedBorders: z
          .union([z.boolean(), z.number().nonnegative()])
          .optional(),
        padding: z.number().nonnegative().optional(),
        crop: z
          .union([
            z.object({
              left: z.number().nonnegative(),
              top: z.number().nonnegative(),
              width: z.number().positive(),
              height: z.number().positive(),
            }),
            z.null(),
          ])
          .optional(),
      })
      .optional(),
    video: z
      .object({
        fps: z.number().positive().default(60),
        followNewTab: z.boolean().default(true),
        videoFrame: z
          .object({
            width: z.number().positive().default(1920),
            height: z.number().positive().default(1080),
          })
          .optional(),
        videoCrf: z
          .number()
          .positive()
          .default(23)
          .refine((val) => val === 23, {
            message: "videoCrf must be strictly 23",
          })
          .optional(),
        videoCodec: z.literal("libx264").optional(),
        videoPreset: z
          .enum(["ultrafast", "fast", "slower"])
          .default("ultrafast")
          .optional(),
        videoBitrate: z
          .number()
          .positive()
          .default(3000)
          .refine((val) => val === 3000, {
            message: "videoBitrate must be strictly 3000",
          })
          .optional(),
        recordDurationLimit: z
          .number()
          .positive()
          .default(30)
          .refine((val) => val === 30, {
            message: "recordDurationLimit must be strictly 30",
          })
          .optional(),
      })
      .optional(),
    pdf: z
      .object({
        scale: z.number().positive().default(1),
        displayHeaderFooter: z.boolean().default(false),
        headerTemplate: z.string().default(""),
        footerTemplate: z.string().default(""),
        printBackground: z.boolean().default(true),
        landscape: z.boolean().default(false),
        pageRanges: z.string().default(""),
        format: z.string().default("A4"),
        width: z.number().positive().optional(),
        height: z.number().positive().optional(),
        margin: z
          .object({
            top: z.string().default("0px"),
            right: z.string().default("0px"),
            bottom: z.string().default("0px"),
            left: z.string().default("0px"),
          })
          .optional(),
        preferCSSPageSize: z.boolean().default(false),
        omitBackground: z.boolean().default(false),
        timeout: z.number().positive().default(30000),
      })
      .optional(),
  }).refine((data) => data.url || data.html, {
    message: "Either 'url' or 'html' must be provided",
    path: ["url", "html"],
  });

  try {
    configSchema.parse(config);
    return { error: false };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorObject = {
        error: true,
        message: {
          summary: "Invalid configuration",
          details: error.errors.map((err) => ({
            path: err.path.join("."),
            message: err.message,
          })),
        },
      };
      return errorObject;
    }
    return { error: true, message: JSON.stringify(error.message) };
  }
}
