import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { clientIp, hashKey } from "@/lib/clientIp";
import { checkRateLimit, clearHits, minutesUntil, recordHit } from "@/lib/rateLimit";
import {
  EMAIL_NOT_VERIFIED_CODE,
  LOGIN_EMAIL_BUCKET,
  RATE_LIMITED_CODE_PREFIX,
  loginRules,
} from "@/lib/authLimits";
import { findUserByEmail } from "@/lib/accountEmail";
import { consumeToken } from "@/lib/emailTokens";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * Thrown when a login attempt is refused for too many recent failures. The
 * code (which the client receives) carries the wait in minutes, so the login
 * form can say how long, instead of the generic "invalid email or password".
 */
class RateLimitedSignin extends CredentialsSignin {
  constructor(minutes: number) {
    super();
    this.code = `${RATE_LIMITED_CODE_PREFIX}${minutes}`;
  }
}

/**
 * Thrown when the password was right but the account's email was never
 * confirmed. Only reachable with the correct password, so it can't be used to
 * discover which addresses have accounts.
 */
class EmailNotVerifiedSignin extends CredentialsSignin {
  code = EMAIL_NOT_VERIFIED_CODE;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    // "Log in to my account" on the email-confirmed page: swaps the one-time ticket the
    // confirmation just issued for a session, so the password isn't asked for twice.
    Credentials({
      id: "autologin",
      credentials: { token: { label: "Ticket", type: "text" } },
      async authorize(rawCredentials) {
        const token = typeof rawCredentials?.token === "string" ? rawCredentials.token : null;
        if (!token) return null;
        const userId = await consumeToken(token, "AUTO_LOGIN");
        if (!userId) return null;
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user?.emailVerifiedAt) return null;
        return { id: user.id, email: user.email, name: user.displayName };
      },
    }),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(rawCredentials, request) {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        // Refuse before doing any work once this email or this IP has failed too
        // often lately. Keyed by an HMAC of the lowercased email even when no such
        // account exists, so a guessed address can't be told apart from a real one.
        const emailKey = hashKey(email.trim().toLowerCase());
        const ip = clientIp(request);
        const rules = loginRules(emailKey, ip ? hashKey(ip) : null);
        for (const rule of rules) {
          const state = await checkRateLimit(rule);
          if (state.limited) throw new RateLimitedSignin(minutesUntil(state.retryAfterMs));
        }

        const user = await findUserByEmail(email);
        const passwordMatches = user ? await bcrypt.compare(password, user.passwordHash) : false;
        if (!user || !passwordMatches) {
          await Promise.all(rules.map((rule) => recordHit(rule.bucket, rule.key)));
          return null;
        }

        // A correct password starts the email's count over (the IP's keeps ticking).
        await clearHits(LOGIN_EMAIL_BUCKET, emailKey);

        // The account isn't active until the emailed link has been clicked.
        if (!user.emailVerifiedAt) throw new EmailNotVerifiedSignin();

        return { id: user.id, email: user.email, name: user.displayName };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
      }
      // The client calls update() after changing its display name. The new
      // name is re-read from the database, never taken from the client, so a
      // session can't claim a name it doesn't own.
      if (trigger === "update" && typeof token.id === "string") {
        const current = await prisma.user.findUnique({
          where: { id: token.id },
          select: { displayName: true },
        });
        if (current) token.name = current.displayName;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && typeof token.id === "string") {
        session.user.id = token.id;
      }
      return session;
    },
  },
});
