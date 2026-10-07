import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Difficulty, GameMode } from "@/generated/prisma/client";

/**
 * A signed receipt that the server started a round. /api/rounds/start hands
 * one out with the questions and /api/rounds/complete only saves a result
 * that comes back with one. That does three things the bare result couldn't:
 *
 *  - a round has to really be started (a forger can't just POST results);
 *  - the claimed answering time can't exceed the wall-clock time since the
 *    start, which a script can't fake without actually waiting;
 *  - each token is single-use (its `id` is stored on the saved round), so a
 *    good result can't be submitted again and again.
 *
 * Stateless on purpose: it's an HMAC over the payload, so starting a round
 * needs no database write (guests start rounds too and never finish them).
 * It doesn't make the answers secret; see CLAUDE.md's known simplifications.
 */

export interface RoundTokenPayload {
  /** Random per round; stored on the saved result to make the token single-use. */
  id: string;
  mode: GameMode;
  difficulty: Difficulty;
  roundLength: number;
  /** When the round started, ms since the epoch (server clock). */
  issuedAt: number;
}

/** A round older than this can no longer be submitted. */
export const ROUND_TOKEN_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function secret(): string {
  // AUTH_SECRET is already required for sessions to work, so production always has it.
  return `${process.env.AUTH_SECRET ?? "geodex-dev-round-token"}:round`;
}

function sign(encodedPayload: string): string {
  return createHmac("sha256", secret()).update(encodedPayload).digest("base64url");
}

export function issueRoundToken(
  round: Pick<RoundTokenPayload, "mode" | "difficulty" | "roundLength">,
  now: number = Date.now(),
): string {
  const payload: RoundTokenPayload = {
    id: randomBytes(16).toString("hex"),
    mode: round.mode,
    difficulty: round.difficulty,
    roundLength: round.roundLength,
    issuedAt: now,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

/** The token's contents if it's genuine and not expired, otherwise null. */
export function verifyRoundToken(token: string, now: number = Date.now()): RoundTokenPayload | null {
  const [encoded, signature, ...rest] = token.split(".");
  if (!encoded || !signature || rest.length > 0) return null;

  const expected = Buffer.from(sign(encoded));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  let payload: RoundTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as RoundTokenPayload;
  } catch {
    return null;
  }

  if (
    typeof payload.id !== "string" ||
    typeof payload.issuedAt !== "number" ||
    typeof payload.roundLength !== "number"
  ) {
    return null;
  }
  const age = now - payload.issuedAt;
  if (age < 0 || age > ROUND_TOKEN_MAX_AGE_MS) return null;

  return payload;
}
