import { expect, test } from "./support/test";
import { query, userByEmail } from "./support/db";
import { mailsTo } from "./support/mail";
import { createConfirmedUser, signInContext } from "./support/users";

const FEEDBACK_INBOX = "feedback@e2e.test";

/** A real 1x1 PNG, so the server's magic-byte check accepts it. */
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function uniqueSubject(tag: string) {
  return `${tag} ${Math.random().toString(36).slice(2, 8)}`;
}

async function feedbackMails(subject: string) {
  // The inbox is shared by every test, so a message is found by its unique subject.
  const deadline = Date.now() + 10_000;
  for (;;) {
    const found = (await mailsTo(FEEDBACK_INBOX)).filter((m) => m.subject.includes(subject));
    if (found.length > 0 || Date.now() > deadline) return found;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}

test.describe("bug reports and feedback", () => {
  test("a guest sends a bug report with a screenshot: it is saved, and emailed to the developer", async ({
    page,
  }) => {
    const subject = uniqueSubject("Map click bug");
    await page.goto("/setup");
    await page.getByRole("button", { name: /Bug reports/ }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Report a bug or send feedback" })).toBeVisible();
    await dialog.getByLabel("Subject").fill(subject);
    await dialog.getByLabel("Description").fill("Clicking Cuba twice zoomed instead of answering. Steps: start a round, wait.");
    await dialog.locator('input[type="file"]').setInputFiles({
      name: "screenshot.png",
      mimeType: "image/png",
      buffer: TINY_PNG,
    });
    await expect(dialog.getByRole("button", { name: "Remove screenshot.png" })).toBeVisible();
    await dialog.getByRole("button", { name: "Send", exact: true }).click();

    await expect(dialog.getByText("Thank you!")).toBeVisible();
    await expect(dialog.getByText("Your bug report has been received")).toBeVisible();

    const rows = await query<{ kind: string; attachmentCount: number; emailedAt: Date | null; userId: string | null }>(
      'SELECT kind, "attachmentCount", "emailedAt", "userId" FROM "Feedback" WHERE subject = $1',
      [subject],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "BUG", attachmentCount: 1, userId: null });
    expect(rows[0].emailedAt).not.toBeNull();

    const [mail] = await feedbackMails(subject);
    expect(mail.subject).toBe(`[Geodex bug report] ${subject}`);
    expect(mail.text).toContain("Clicking Cuba twice zoomed");
    expect(mail.text).toContain("Guest (not signed in)");
    expect(mail.attachments).toBe(1);
    expect(mail.replyTo).toBeNull();
  });

  test("a signed-in sender is attached to the report, and Reply goes to their own address", async ({
    context,
    request,
  }) => {
    const user = await createConfirmedUser(request, { displayName: "Helpful Tester" });
    expect(await signInContext(context, user)).toBe(true);
    const subject = uniqueSubject("Nice idea");

    const response = await context.request.post("/api/feedback", {
      multipart: {
        kind: "FEEDBACK",
        subject,
        description: "Could the streak flame be bigger? Love the game otherwise.",
      },
    });
    expect(response.status()).toBe(201);

    const row = await userByEmail(user.email);
    const saved = await query<{ userId: string | null; kind: string }>(
      'SELECT "userId", kind FROM "Feedback" WHERE subject = $1',
      [subject],
    );
    expect(saved).toEqual([{ userId: row!.id, kind: "FEEDBACK" }]);

    const [mail] = await feedbackMails(subject);
    expect(mail.subject).toBe(`[Geodex feedback] ${subject}`);
    expect(mail.text).toContain("Helpful Tester");
    expect(mail.replyTo).toContain(user.email);
  });

  test("bad submissions are refused: too short, a fake image, and a bot's hidden field", async ({ request }) => {
    const subject = uniqueSubject("Validation");
    const base = { kind: "BUG", description: "A reasonably long description of the problem." };

    const tooShort = await request.post("/api/feedback", { multipart: { ...base, subject: "hi" } });
    expect(tooShort.status()).toBe(400);

    // A text file renamed .png: the server checks the bytes, not the name or the claimed type.
    const fakeImage = await request.post("/api/feedback", {
      multipart: {
        ...base,
        subject,
        screenshots: { name: "evil.png", mimeType: "image/png", buffer: Buffer.from("this is not an image at all") },
      },
    });
    expect(fakeImage.status()).toBe(400);
    expect((await fakeImage.json()).error).toMatch(/PNG, JPEG, GIF or WebP/);

    // A bot filling the hidden "website" field gets a cheerful OK and nothing is stored or sent.
    const bot = await request.post("/api/feedback", { multipart: { ...base, subject, website: "http://spam.example" } });
    expect(bot.status()).toBe(200);

    const stored = await query('SELECT 1 FROM "Feedback" WHERE subject = $1', [subject]);
    expect(stored).toHaveLength(0);
    expect(await mailsTo(FEEDBACK_INBOX).then((m) => m.filter((x) => x.subject.includes(subject)))).toHaveLength(0);
  });

  test("two reports an hour is the limit: the third is refused, and the form says so instead of opening", async ({
    page,
    request,
  }) => {
    for (const n of [1, 2]) {
      const sent = await request.post("/api/feedback", {
        multipart: { kind: "FEEDBACK", subject: uniqueSubject(`Limit ${n}`), description: "Within the allowance." },
      });
      expect(sent.status()).toBe(201);
    }

    const third = await request.post("/api/feedback", {
      multipart: { kind: "FEEDBACK", subject: uniqueSubject("Limit 3"), description: "One too many." },
    });
    expect(third.status()).toBe(429);
    expect(third.headers()["retry-after"]).toBeDefined();
    expect((await third.json()).error).toMatch(/up to 2 reports per hour/);

    // The form checks first, so nobody writes a report they can't send.
    await page.goto("/setup");
    await page.getByRole("button", { name: /Bug reports/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("You've reached the limit")).toBeVisible();
    await expect(dialog.getByLabel("Subject")).toHaveCount(0);
  });
});
