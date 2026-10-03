import { describe, expect, it } from "vitest";
import { detectImageType, feedbackFieldsSchema } from "./feedback";

const bytes = (...b: number[]) => new Uint8Array(b);
const ascii = (s: string) => new Uint8Array([...s].map((c) => c.charCodeAt(0)));

describe("detectImageType", () => {
  it("recognizes PNG, JPEG, GIF and WebP by their leading bytes", () => {
    expect(detectImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe(
      "image/png",
    );
    expect(detectImageType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(detectImageType(ascii("GIF89a"))).toBe("image/gif");
    expect(
      detectImageType(new Uint8Array([...ascii("RIFF"), 1, 2, 3, 4, ...ascii("WEBP")])),
    ).toBe("image/webp");
  });

  it("rejects things that merely claim to be images", () => {
    expect(detectImageType(ascii("<svg xmlns='http://www.w3.org/2000/svg'/>"))).toBeNull();
    expect(detectImageType(ascii("MZ\u0090\u0000"))).toBeNull(); // Windows executable
    expect(detectImageType(ascii("hello world"))).toBeNull();
    expect(detectImageType(new Uint8Array())).toBeNull();
  });

  it("does not treat a non-WebP RIFF file (e.g. WAV) as WebP", () => {
    expect(
      detectImageType(new Uint8Array([...ascii("RIFF"), 1, 2, 3, 4, ...ascii("WAVE")])),
    ).toBeNull();
  });
});

describe("feedbackFieldsSchema", () => {
  const valid = { kind: "BUG", subject: "Map won't load", description: "It stays blank on Safari." };

  it("accepts a normal submission and trims whitespace", () => {
    const result = feedbackFieldsSchema.parse({ ...valid, subject: "  Map won't load  " });
    expect(result.subject).toBe("Map won't load");
  });

  it("rejects a multi-line subject (it ends up in an email header)", () => {
    expect(feedbackFieldsSchema.safeParse({ ...valid, subject: "Hi\nBcc: x@y.z" }).success).toBe(
      false,
    );
  });

  it("enforces minimum and maximum lengths", () => {
    expect(feedbackFieldsSchema.safeParse({ ...valid, subject: "ab" }).success).toBe(false);
    expect(feedbackFieldsSchema.safeParse({ ...valid, description: "too short" }).success).toBe(
      false,
    );
    expect(
      feedbackFieldsSchema.safeParse({ ...valid, description: "x".repeat(4001) }).success,
    ).toBe(false);
  });

  it("only allows the two known kinds", () => {
    expect(feedbackFieldsSchema.safeParse({ ...valid, kind: "SPAM" }).success).toBe(false);
  });
});
