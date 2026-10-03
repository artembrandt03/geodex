import { describe, expect, it } from "vitest";
import { buildFeedbackEmail, type FeedbackEmailInput } from "./feedbackEmail";

const base: FeedbackEmailInput = {
  id: "abc123",
  kind: "BUG",
  subject: "Map won't load",
  description: "It stays blank.\nSecond line.",
  sender: null,
  userAgent: "TestBrowser/1.0",
  submittedAt: new Date("2026-10-03T01:00:00.000Z"),
  attachments: [],
};

describe("buildFeedbackEmail", () => {
  it("prefixes the subject with the report type", () => {
    expect(buildFeedbackEmail(base).subject).toBe("[Geodex bug report] Map won't load");
    expect(buildFeedbackEmail({ ...base, kind: "FEEDBACK" }).subject).toBe(
      "[Geodex feedback] Map won't load",
    );
  });

  it("identifies a signed-in sender, or marks the sender as a guest", () => {
    const signedIn = buildFeedbackEmail({
      ...base,
      sender: { displayName: "Ada", email: "ada@example.com" },
    });
    expect(signedIn.text).toContain("Ada <ada@example.com> (signed in)");
    expect(buildFeedbackEmail(base).text).toContain("Guest (not signed in)");
  });

  it("escapes user-supplied text in the HTML body", () => {
    const { html } = buildFeedbackEmail({
      ...base,
      subject: "<script>alert(1)</script>",
      description: `"quoted" & <b>bold</b>`,
    });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<b>bold</b>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&quot;quoted&quot; &amp; &lt;b&gt;bold&lt;/b&gt;");
  });

  it("names attachments from the detected type, not any user filename", () => {
    const { attachments } = buildFeedbackEmail({
      ...base,
      attachments: [
        { bytes: new Uint8Array([1]), type: "image/png" },
        { bytes: new Uint8Array([2]), type: "image/jpeg" },
      ],
    });
    expect(attachments.map((a) => a.filename)).toEqual(["screenshot-1.png", "screenshot-2.jpg"]);
    expect(attachments.map((a) => a.contentType)).toEqual(["image/png", "image/jpeg"]);
  });
});
