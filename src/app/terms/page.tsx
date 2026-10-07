import type { Metadata } from "next";
import Link from "next/link";
import {
  ContactDetails,
  LegalList,
  LegalPage,
  LegalSection,
} from "@/components/legal/LegalPage";
import { MINIMUM_AGE, OPERATOR_NAME } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms of Use | Geodex",
  description: "The simple ground rules for playing Geodex.",
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Use">
      <LegalSection title="The short version">
        <p>
          Geodex is a free game made by one person as a hobby. Play fair, be decent, and don&apos;t
          break the site. In return you get a game and, if you like, a place on the leaderboards. These
          terms are the details.
        </p>
      </LegalSection>

      <LegalSection title="Agreeing to these terms">
        <p>
          By using Geodex you agree to these terms and to the{" "}
          <Link href="/privacy" className="text-primary underline underline-offset-4">
            Privacy Policy
          </Link>
          . If you don&apos;t agree, please don&apos;t use the site. You must be at least{" "}
          {MINIMUM_AGE} years old to make an account. Younger players can play as guests.
        </p>
      </LegalSection>

      <LegalSection title="Your account">
        <LegalList>
          <li>Give a real email address you can use to log in, and keep your password to yourself.</li>
          <li>You are responsible for what happens under your account.</li>
          <li>One person, one account. Please don&apos;t make extra accounts to climb the leaderboards.</li>
          <li>You can delete your account at any time from your profile page.</li>
        </LegalList>
      </LegalSection>

      <LegalSection title="Playing fair">
        <p>The leaderboards are only fun if they are honest. Please don&apos;t:</p>
        <LegalList>
          <li>
            use scripts, bots or other automation to play, or send made-up or altered results to the
            server;
          </li>
          <li>exploit bugs to get scores, and if you find one, tell us using the feedback window;</li>
          <li>try to break, overload, probe or get around the security of the site or other accounts;</li>
          <li>
            choose a display name that is offensive, hateful, sexual, or that impersonates someone
            else.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="Keeping things in order">
        <p>
          To keep the game fair and friendly, {OPERATOR_NAME} may remove scores, change or remove
          display names, reset statistics, or suspend or delete accounts that break these terms, without
          notice when that is needed to protect the site or other players.
        </p>
      </LegalSection>

      <LegalSection title="What you send us">
        <p>
          Your display name is visible to other players, as the privacy policy explains. If you send
          feedback, a bug report or a screenshot, you are free to say anything, and you allow us to use
          it to improve Geodex without owing you anything for it. Please don&apos;t include anything
          private in a screenshot.
        </p>
      </LegalSection>

      <LegalSection title="Who owns what">
        <p>
          Geodex, its design, artwork and text belong to its developer, except for third-party materials
          credited in the project&apos;s README on GitHub. The map data is from Natural Earth, which is
          in the public domain, and the site is built with open-source software under its own licenses.
          You may play and share links to Geodex freely, but please don&apos;t copy the artwork or
          present the game as yours.
        </p>
      </LegalSection>

      <LegalSection title="Maps, borders and names">
        <p>
          Geodex is an entertainment and learning game. Its maps are simplified, and the list of
          countries, their names and their borders are chosen for gameplay only. They do not express a
          view on any political or territorial dispute, and they may not match everyone&apos;s.
        </p>
      </LegalSection>

      <LegalSection title="The service as it is">
        <p>
          Geodex is provided free and &quot;as is&quot;. It is a hobby project, so it may change,
          have bugs, go offline, or have its scores, statistics and accounts reset, and there are no
          guarantees about availability. If it ever shuts down, we will try to say so first.
        </p>
      </LegalSection>

      <LegalSection title="Limits on responsibility">
        <p>
          To the fullest extent the law allows, {OPERATOR_NAME} is not responsible for losses arising
          from using Geodex or from it being unavailable. Nothing in these terms limits any right you
          have under Quebec or Canadian law that cannot be waived.
        </p>
      </LegalSection>

      <LegalSection title="Changes and governing law">
        <p>
          We may update these terms. The date at the top will change and, for significant changes, we
          will say so on the site. Continuing to use Geodex after a change means you accept it. These
          terms are governed by the laws of Quebec and the federal laws of Canada that apply there, and
          disputes belong to the courts of Quebec in the district of Montreal, unless the law gives you
          the right to go elsewhere.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <ContactDetails />
      </LegalSection>
    </LegalPage>
  );
}
