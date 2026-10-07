import type { Metadata } from "next";
import Link from "next/link";
import {
  ContactDetails,
  LegalList,
  LegalPage,
  LegalSection,
} from "@/components/legal/LegalPage";
import { MINIMUM_AGE, OPERATOR_NAME, OPERATOR_PLACE } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy Policy | Geodex",
  description: "What personal information Geodex collects, why, who sees it, and how to control or delete it.",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <LegalSection title="The short version">
        <p>
          Geodex is a free geography game. You can play without giving us anything. If you make an
          account we keep your email, a scrambled version of your password, a display name and the
          results of the rounds you play. We don&apos;t sell your information, show ads, or use
          analytics or tracking. You can see, change, reset or delete almost all of it yourself from
          your profile page.
        </p>
      </LegalSection>

      <LegalSection title="Who is responsible">
        <p>
          Geodex is made and run by {OPERATOR_NAME} in {OPERATOR_PLACE}, who is also the person
          responsible for protecting personal information under Quebec&apos;s privacy law (Law 25).
          Questions or requests about your information:
        </p>
        <ContactDetails />
      </LegalSection>

      <LegalSection title="What we collect, and why">
        <LegalList>
          <li>
            <strong>Your account</strong> (only if you sign up): your email address, your password,
            your display name, and when the account was created. The email is how you log in. Your
            password is stored only as a one-way hash, so nobody, including me, can read it. The
            display name is what other players see.
          </li>
          <li>
            <strong>Your game results</strong> (only while signed in): for each finished round, the
            mode, difficulty, length, score, how many you got right, your total time, your best
            streak, your close guesses and the date. This powers the leaderboards, your stats and your
            match history. Rounds played as a guest are not saved.
          </li>
          <li>
            <strong>Your settings</strong>: whether your profile is public.
          </li>
          <li>
            <strong>Feedback you send</strong>: the subject, the message and whether it is a bug
            report or general feedback, plus any screenshots you attach. If you are signed in the
            report is linked to your account. It also records your browser type (user agent), and the
            page and screen size are included in the email to help reproduce problems. Screenshots are
            only emailed to the developer; they are not kept in the database.
          </li>
          <li>
            <strong>Abuse prevention</strong>: to slow down password guessing, fake signups and spam,
            failed logins, signup attempts and feedback submissions are counted against a scrambled
            (hashed) form of your IP address or email. The app does not store your raw IP address.
            These counters are short-lived.
          </li>
        </LegalList>
        <p>
          We use this information only to run Geodex: to let you log in, to show leaderboards and
          profiles, to keep the site working and secure, and to respond to what you send us.
        </p>
      </LegalSection>

      <LegalSection title="Cookies">
        <p>
          Geodex uses only the cookies needed to keep you signed in and to protect the login form from
          forgery. There are no advertising, analytics or third-party tracking cookies, and no third
          party scripts. Playing as a guest sets no sign-in cookie.
        </p>
      </LegalSection>

      <LegalSection title="What other players can see">
        <LegalList>
          <li>
            <strong>The leaderboards</strong> show the top players for each game setup with their
            display name, score and number correct. This applies even if your profile is private.
          </li>
          <li>
            <strong>A public profile</strong> (the default) can be opened from the leaderboard and
            shows your display name, the month you joined, your stats and your match history. It never
            shows your email address.
          </li>
          <li>
            You can make your profile private at any time from your profile page. To also stop your
            display name appearing on the leaderboards, change it to something that doesn&apos;t
            identify you, reset your statistics, or delete your account.
          </li>
        </LegalList>
        <p>Please don&apos;t use your real name as a display name unless you are comfortable with that.</p>
      </LegalSection>

      <LegalSection title="Who we share it with">
        <p>
          We don&apos;t sell or rent your information. A few service providers handle it so the site
          can run:
        </p>
        <LegalList>
          <li>a hosting provider (Netlify) that serves the website;</li>
          <li>a database provider that stores accounts and results;</li>
          <li>an email provider that delivers feedback emails to the developer.</li>
        </LegalList>
        <p>
          They may process or store information on servers outside Quebec and outside Canada, including
          in the United States, where different privacy laws apply. We share only what they need to
          do their job. We may also disclose information if the law requires it.
        </p>
      </LegalSection>

      <LegalSection title="How long we keep it">
        <LegalList>
          <li>
            Your account and results are kept until you delete your account, or, for results, until
            you reset your statistics.
          </li>
          <li>
            Feedback is kept as long as it is useful. If you delete your account, feedback you sent
            stays but is no longer linked to you.
          </li>
          <li>
            The abuse-prevention counters stop counting after at most an hour and old ones are cleaned
            up automatically.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="How we protect it">
        <p>
          Passwords are hashed, connections to the site are encrypted, login and signup attempts are
          rate limited, and access to the database is limited to the developer. No system is perfectly
          secure. If an incident creates a risk of serious harm to you, we will tell you and the
          Commission d&apos;accès à l&apos;information du Québec as the law requires.
        </p>
      </LegalSection>

      <LegalSection title="Your rights">
        <p>You can ask to see what we hold about you, have it corrected, withdraw your consent, or have it deleted, and ask for a copy in a common format. Most of this you can do yourself on your <Link href="/profile" className="text-primary underline underline-offset-4">profile page</Link>:</p>
        <LegalList>
          <li>change your display name and your password;</li>
          <li>make your profile private;</li>
          <li>reset your statistics, which erases your match history and leaderboard places;</li>
          <li>delete your account, which erases your account and results.</li>
        </LegalList>
        <p>
          For anything else, contact us as above. We will answer within 30 days. If you are not
          satisfied you can complain to the Commission d&apos;accès à l&apos;information du Québec
          (cai.gouv.qc.ca).
        </p>
      </LegalSection>

      <LegalSection title="Children">
        <p>
          You must be at least {MINIMUM_AGE} to make an account. Under Quebec law, a child under{" "}
          {MINIMUM_AGE} needs a parent&apos;s or guardian&apos;s consent for their personal information
          to be collected, and Geodex does not ask for it, so younger players can play as guests. If
          you believe a child under {MINIMUM_AGE} has made an account, tell us and we will delete it.
        </p>
      </LegalSection>

      <LegalSection title="Changes to this policy">
        <p>
          If this policy changes in a way that matters, the date at the top will change and, for
          significant changes, we will say so on the site. See also the{" "}
          <Link href="/terms" className="text-primary underline underline-offset-4">
            Terms of Use
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
