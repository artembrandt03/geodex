import { z } from "zod";

// Limits shared by the form (to fail fast, with a friendly message) and the
// API route (which is the one that actually enforces them). Total stays under
// ~5MB so a multipart request fits serverless platforms' ~6MB body cap.
export const MAX_ATTACHMENTS = 3;
export const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;
export const MAX_TOTAL_ATTACHMENT_BYTES = 4.5 * 1024 * 1024;
export const SUBJECT_MAX = 120;
export const DESCRIPTION_MAX = 4000;

export const FEEDBACK_KINDS = ["BUG", "FEEDBACK"] as const;
export type FeedbackKindValue = (typeof FEEDBACK_KINDS)[number];

export const feedbackFieldsSchema = z.object({
  kind: z.enum(FEEDBACK_KINDS),
  subject: z
    .string()
    .trim()
    .min(3, "Please add a short subject (at least 3 characters).")
    .max(SUBJECT_MAX, `Keep the subject under ${SUBJECT_MAX} characters.`)
    // Goes into an email header; a subject is one line anyway.
    .refine((s) => !/[\r\n]/.test(s), "The subject must be a single line."),
  description: z
    .string()
    .trim()
    .min(10, "Please describe it in a bit more detail (at least 10 characters).")
    .max(DESCRIPTION_MAX, `Keep the description under ${DESCRIPTION_MAX} characters.`),
  // Optional context the form attaches to help debugging a bug report.
  pageUrl: z.string().max(500).optional(),
  viewport: z.string().max(40).optional(),
  // Honeypot: real users never see or fill this, bots usually do.
  website: z.string().optional(),
});
export type FeedbackFields = z.infer<typeof feedbackFieldsSchema>;

export type ImageType = "image/png" | "image/jpeg" | "image/gif" | "image/webp";

export const IMAGE_EXTENSIONS: Record<ImageType, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};

/**
 * Identifies an image by its leading bytes rather than trusting the
 * filename or the browser-supplied MIME type, so only genuine PNG / JPEG /
 * GIF / WebP data is ever forwarded as an attachment.
 */
export function detectImageType(bytes: Uint8Array): ImageType | null {
  const startsWith = (sig: number[], offset = 0) =>
    bytes.length >= offset + sig.length && sig.every((b, i) => bytes[offset + i] === b);

  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith([0x47, 0x49, 0x46, 0x38])) return "image/gif"; // "GIF8"
  // WebP is a RIFF container: "RIFF" .... "WEBP"
  if (startsWith([0x52, 0x49, 0x46, 0x46]) && startsWith([0x57, 0x45, 0x42, 0x50], 8)) {
    return "image/webp";
  }
  return null;
}
