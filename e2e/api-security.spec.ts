import { expect, test } from "./support/test";
import { query } from "./support/db";
import { CONFIRM_SUBJECT, waitForMails } from "./support/mail";
import {
  createConfirmedUser,
  credentialsAttempt,
  newUser,
  registerViaApi,
  signInContext,
  uniqueEmail,
} from "./support/users";

const ROUND = { mode: "NAME", difficulty: "EASY", roundLength: 5 } as const;

/** A result an honest player could really have: all 5 right, 3 seconds in total. */
function honestResult(roundToken: string) {
  return { ...ROUND, score: 50, correct: 5, totalTimeMs: 3_000, bestStreak: 5, neighborCount: 0, roundToken };
}

test.describe("API security: rounds, enumeration and input hardening", () => {
  test("a forged, impossible or replayed round result is refused; an honest one is saved once", async ({
    context,
    request,
  }) => {
    const user = await createConfirmedUser(request);
    expect(await signInContext(context, user)).toBe(true);
    const api = context.request;

    const started = await api.post("/api/rounds/start", { data: ROUND });
    expect(started.status()).toBe(200);
    const { token } = (await started.json()) as { token: string };
    const honest = honestResult(token);

    // The cheap forgeries: every one of these is arithmetically impossible under the rules.
    const forgeries: Record<string, Partial<typeof honest>> = {
      "a made-up score": { score: 2_000_000 },
      "fewer points than the answers earn": { score: 5 },
      "faster than a person can play": { totalTimeMs: 100 },
      "slower than the idle rule allows": { totalTimeMs: 6 * 60_000 },
      "a streak longer than the correct answers": { correct: 2, bestStreak: 5, score: 20 },
      "more correct answers than questions": { correct: 9 },
    };
    for (const [what, change] of Object.entries(forgeries)) {
      const response = await api.post("/api/rounds/complete", { data: { ...honest, ...change } });
      expect(response.status(), what).toBe(400);
    }

    // None of those used up the token, so the honest result still goes through...
    const saved = await api.post("/api/rounds/complete", { data: honest });
    expect(saved.status()).toBe(201);
    // ...once.
    const replay = await api.post("/api/rounds/complete", { data: honest });
    expect(replay.status()).toBe(409);
  });

  test("a round token only works for the round it was issued for, and only for a signed-in player", async ({
    context,
    request,
  }) => {
    const user = await createConfirmedUser(request);
    expect(await signInContext(context, user)).toBe(true);
    const { token } = (await (await context.request.post("/api/rounds/start", { data: ROUND })).json()) as {
      token: string;
    };
    const honest = honestResult(token);

    // Wrong mode, wrong difficulty, wrong length for this token.
    for (const change of [{ mode: "SHAPE" }, { difficulty: "HARD" }, { roundLength: 10 }]) {
      const response = await context.request.post("/api/rounds/complete", { data: { ...honest, ...change } });
      expect(response.status(), JSON.stringify(change)).toBe(400);
    }

    // Tampered, garbage and missing tokens.
    const tampered = token.slice(0, -2) + (token.endsWith("aa") ? "bb" : "aa");
    for (const roundToken of [tampered, "not-a-token", ""]) {
      const response = await context.request.post("/api/rounds/complete", { data: { ...honest, roundToken } });
      expect(response.status(), `token "${roundToken.slice(0, 10)}"`).toBe(400);
    }

    // No session at all (the plain `request` has no cookies).
    const guest = await request.post("/api/rounds/complete", { data: honest });
    expect(guest.status()).toBe(401);
  });

  test("account endpoints answer the same for known and unknown addresses, so they can't be used to list users", async ({
    request,
  }) => {
    const known = await createConfirmedUser(request);
    const unconfirmed = newUser();
    expect((await registerViaApi(request, unconfirmed)).ok()).toBe(true);
    await waitForMails(unconfirmed.email, CONFIRM_SUBJECT);
    const stranger = uniqueEmail("nobody");

    // Forgot password: identical status and body for an account and for no account.
    const forgot = await Promise.all(
      [known.email, stranger].map(async (email) => {
        const response = await request.post("/api/account/forgot-password", { data: { email } });
        return { status: response.status(), body: await response.json() };
      }),
    );
    expect(forgot[0]).toEqual(forgot[1]);

    // Resend confirmation: same again, whether unconfirmed, already confirmed, or unknown.
    const resend = await Promise.all(
      [unconfirmed.email, known.email, stranger].map(async (email) => {
        const response = await request.post("/api/account/resend-verification", { data: { email } });
        return { status: response.status(), body: await response.json() };
      }),
    );
    expect(resend[0]).toEqual(resend[1]);
    expect(resend[1]).toEqual(resend[2]);

    // Login: a wrong password and an unknown account fail with the very same code.
    const wrongPassword = await credentialsAttempt(request, { email: known.email, password: "wrong-password-1" });
    const unknownAccount = await credentialsAttempt(request, { email: stranger, password: "wrong-password-1" });
    expect(wrongPassword).toEqual(unknownAccount);
    expect(wrongPassword.code).toBe("credentials");
  });

  test("starting a round hands out the right number of distinct, correctly tiered questions", async ({ request }) => {
    const easy = new Set(
      (await query<{ code: string }>('SELECT code FROM "Country" WHERE "difficultyTier" = \'EASY\'')).map((r) => r.code),
    );

    for (const roundLength of [5, 10, 15, 20]) {
      const response = await request.post("/api/rounds/start", { data: { ...ROUND, roundLength } });
      expect(response.status()).toBe(200);
      const { questions, token } = (await response.json()) as {
        questions: { code: string; name: string }[];
        token: string;
      };
      expect(questions, `length ${roundLength}`).toHaveLength(roundLength);
      expect(new Set(questions.map((q) => q.code)).size, "no repeats in a round").toBe(roundLength);
      expect(token.length).toBeGreaterThan(20);
      // An easy round only asks easy countries.
      for (const q of questions) expect(easy.has(q.code), `${q.code} is an easy country`).toBe(true);
    }

    // Bad configurations are refused, not guessed at.
    for (const bad of [
      { ...ROUND, mode: "SPEED" },
      { ...ROUND, difficulty: "IMPOSSIBLE" },
      { ...ROUND, roundLength: 7 },
      { ...ROUND, roundLength: 0 },
      {},
    ]) {
      const response = await request.post("/api/rounds/start", { data: bad });
      expect(response.status(), JSON.stringify(bad)).toBe(400);
    }
  });

  test("public endpoints only expose what they should", async ({ request }) => {
    const user = await createConfirmedUser(request, { displayName: "Public Facts" });

    const countries = await request.get("/api/countries");
    expect(countries.status()).toBe(200);
    const list = ((await countries.json()) as { countries: Record<string, unknown>[] }).countries;
    expect(list.length).toBe(195);
    expect(Object.keys(list[0]).sort()).toEqual(["code", "name"]);

    const board = await request.get("/api/leaderboard?mode=NAME&difficulty=EASY&roundLength=5");
    expect(board.status()).toBe(200);
    const boardText = JSON.stringify(await board.json());
    for (const secret of ["passwordHash", "email", user.email, "@gmail.com"]) {
      expect(boardText, `leaderboard leaks "${secret}"`).not.toContain(secret);
    }
    expect((await request.get("/api/leaderboard?mode=NOPE&difficulty=EASY&roundLength=5")).status()).toBe(400);
    expect((await request.get("/api/leaderboard")).status()).toBe(400);

    // Unknown players are a clean 404, not an error.
    expect((await request.get("/api/players/does-not-exist-12345")).status()).toBe(404);
  });

  test("signup input is hardened: malformed, oversized, offensive and consent-less requests never cause a server error", async ({
    request,
  }) => {
    const good = { displayName: "Fine Name", email: uniqueEmail(), password: "Long-Enough-1", acceptTerms: true };
    const attempts: Record<string, unknown> = {
      "no body": undefined,
      "an empty object": {},
      "an invalid email": { ...good, email: "not-an-email" },
      "a 10,000 character display name": { ...good, displayName: "x".repeat(10_000) },
      "a display name of one letter": { ...good, displayName: "A" },
      "a profane display name": { ...good, displayName: "sh1thead" },
      "a 1 MB password": { ...good, email: uniqueEmail(), password: "p".repeat(1_000_000) },
      "no consent": { ...good, acceptTerms: false },
      "wrong types": { ...good, acceptTerms: "yes", password: 12345678 },
    };

    for (const [what, data] of Object.entries(attempts)) {
      const response = await request.post("/api/register", data === undefined ? {} : { data });
      expect(response.status(), what).toBeLessThan(500);
    }

    // The ones that must be refused outright.
    for (const what of [
      "an invalid email",
      "a 10,000 character display name",
      "a display name of one letter",
      "a profane display name",
      "a 1 MB password",
      "no consent",
      "wrong types",
      "an empty object",
    ]) {
      const response = await request.post("/api/register", { data: attempts[what] as object });
      expect(response.status(), what).toBe(400);
    }
  });
});
