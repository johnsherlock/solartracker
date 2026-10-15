import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalList, LegalPage, LegalSection } from '@/src/components/LegalPage';

export const metadata: Metadata = { title: 'Terms of Service · Solar Tracker' };

const S = 'font-medium text-slate-100';

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="15 October 2026">
      <LegalSection heading="About these terms">
        <p>
          These terms apply to your use of Solar Tracker (<span className={S}>www.solartracker.app</span>),
          which is operated by John Sherlock, an individual based in Ireland (&ldquo;we&rdquo;,
          &ldquo;us&rdquo;). By signing in, you agree to these terms and to our{' '}
          <Link href="/privacy" className="text-slate-100 underline underline-offset-2">Privacy Policy</Link>.
        </p>
      </LegalSection>

      <LegalSection heading="A beta service">
        <p>
          Solar Tracker is in an invite-only beta. Features may change, be added, or be removed. The service
          may sometimes be unavailable, and figures may occasionally be wrong while we improve it. We may
          pause or end the beta, and will give you reasonable notice where we can.
        </p>
      </LegalSection>

      <LegalSection heading="Your account">
        <LegalList
          items={[
            'You sign in with a Google account, and access is granted at our discretion during the beta.',
            'You must be 18 or over.',
            'You may only connect a MyEnergi account that you own or are authorised to use.',
            'You are responsible for keeping your Google account and MyEnergi credentials secure. Tell us promptly if you think your account has been misused.',
          ]}
        />
      </LegalSection>

      <LegalSection heading="Your data">
        <p>
          Your energy data and the details you enter remain yours. You allow us to read data from your
          MyEnergi account and process it only to provide Solar Tracker to you, as described in our Privacy
          Policy. You can ask us to delete your account and data at any time.
        </p>
      </LegalSection>

      <LegalSection heading="Estimates, not advice">
        <p>
          Savings, costs, payback, and similar figures are estimates based on the data MyEnergi provides and
          the tariff and system details you enter. They are for information only. They are not financial
          advice, and may differ from your supplier&rsquo;s bills. Check important figures with your
          electricity supplier or installer before relying on them.
        </p>
      </LegalSection>

      <LegalSection heading="Acceptable use">
        <p>Please don&rsquo;t:</p>
        <LegalList
          items={[
            'access accounts or data that are not yours',
            'try to disrupt, overload, probe, or bypass the security of the service',
            'copy, resell, or scrape the service, or use automated tools against it',
            'use the service for anything unlawful',
          ]}
        />
        <p>We may suspend or close accounts that break these terms.</p>
      </LegalSection>

      <LegalSection heading="Third-party services">
        <p>
          Solar Tracker depends on services we don&rsquo;t control, including MyEnergi and Google. Their
          availability and their own terms apply to your use of them. Solar Tracker is independent and is
          not affiliated with or endorsed by MyEnergi.
        </p>
      </LegalSection>

      <LegalSection heading="Ending your use">
        <p>
          You can stop using Solar Tracker at any time and ask us to delete your data. We may end your access
          if you break these terms, or if the beta or service ends.
        </p>
      </LegalSection>

      <LegalSection heading="Liability">
        <p>
          We provide Solar Tracker &ldquo;as is&rdquo;, with reasonable care, but without guaranteeing that
          it will be uninterrupted, error-free, or that its figures will be exact. To the extent the law
          allows, we are not liable for indirect or consequential losses, or for decisions you make based on
          figures shown in the service.
        </p>
        <p>
          Nothing in these terms limits any rights you have as a consumer that cannot be limited by law, or
          our liability for anything that cannot be excluded by law.
        </p>
      </LegalSection>

      <LegalSection heading="Changes to these terms">
        <p>
          We may update these terms as the service develops. If we make significant changes, we will tell
          you by email or in the app before they take effect. If you keep using Solar Tracker after that,
          the updated terms apply.
        </p>
      </LegalSection>

      <LegalSection heading="Governing law">
        <p>
          These terms are governed by the laws of Ireland, and the courts of Ireland have jurisdiction. If
          you live elsewhere in the EU, you also keep the protection of the mandatory consumer laws of your
          country, and may bring claims in your local courts.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
