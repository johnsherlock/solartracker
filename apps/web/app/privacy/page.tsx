import type { Metadata } from 'next';
import { LegalList, LegalPage, LegalSection } from '@/src/components/LegalPage';

export const metadata: Metadata = { title: 'Privacy Policy · Solar Tracker' };

const S = 'font-medium text-slate-100';

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="15 October 2026">
      <LegalSection heading="Who we are">
        <p>
          Solar Tracker (<span className={S}>www.solartracker.app</span>) is operated by John Sherlock, an
          individual based in Ireland, who is the data controller for the personal data described here.
          In this policy, &ldquo;we&rdquo; and &ldquo;us&rdquo; mean Solar Tracker. You can contact us at{' '}
          <span className={S}>support@solartracker.app</span>.
        </p>
        <p>
          Solar Tracker is in an invite-only beta. This policy explains what data we collect, why, who
          helps us process it, and the rights you have over it.
        </p>
      </LegalSection>

      <LegalSection heading="What we collect">
        <LegalList
          items={[
            <><span className={S}>Your Google account details</span> when you sign in: your name, email address, and Google account ID. We never see your Google password.</>,
            <><span className={S}>Your email address</span> if you join the waitlist from the home page.</>,
            <><span className={S}>Your MyEnergi hub serial number and API key</span>, which you give us to connect your system. We store them encrypted (AES-256-GCM), and use them only to read data from MyEnergi. We never change settings or control your devices.</>,
            <><span className={S}>Energy data from your MyEnergi system</span>: generation, consumption, grid import and export, and diverter data at up to minute-level detail, plus the daily totals and costs we calculate from it.</>,
            <><span className={S}>Details you enter in Settings</span>: tariffs and contract dates, system size and costs, the location of your installation, and your notification preferences.</>,
            <><span className={S}>Technical data</span>: the cookies described below, and standard request logs (such as IP address, browser and page requested) kept by our hosting provider for security and troubleshooting.</>,
          ]}
        />
      </LegalSection>

      <LegalSection heading="How we use it">
        <LegalList
          items={[
            'To provide the service: show your live and historical energy data, apply your tariffs, and calculate savings and payback.',
            'To manage your access: sign-in, beta approval, and account administration.',
            'To send service emails, such as your beta approval notice and important account or service messages.',
            'To answer support requests and to keep the service secure and working.',
          ]}
        />
        <p>
          We do not sell your data, show advertising, or use third-party analytics or tracking.
        </p>
        <p>
          Under the GDPR, we process your data because it is necessary to provide the service you signed up
          for, and for our legitimate interest in keeping the service secure and running.
        </p>
      </LegalSection>

      <LegalSection heading="Who processes it for us">
        <p>We use these providers to run Solar Tracker. Each only receives what it needs to do its job:</p>
        <LegalList
          items={[
            <><span className={S}>Vercel</span>: hosts the website and runs the app, in its Dublin region.</>,
            <><span className={S}>Neon</span>: hosts our database, in its London region.</>,
            <><span className={S}>Google</span>: provides sign-in. Our pages also load fonts from Google Fonts, which means your browser shares your IP address with Google when you visit.</>,
            <><span className={S}>MyEnergi</span>: we fetch your energy data from MyEnergi using the credentials you give us.</>,
            <><span className={S}>Open-Meteo</span>: receives your installation&rsquo;s coordinates to provide weather and daylight information.</>,
            <><span className={S}>Geoapify</span>: receives the address text you type when setting your location, to look up coordinates.</>,
            <><span className={S}>Resend</span>: sends our service emails.</>,
            <><span className={S}>Zoho Mail</span>: hosts our support mailbox, so it holds any emails you send us.</>,
          ]}
        />
        <p>
          Some of these providers are based outside the European Economic Area. Where your data is
          transferred outside the EEA, it is protected by the safeguards those providers offer, such as the
          European Commission&rsquo;s Standard Contractual Clauses.
        </p>
      </LegalSection>

      <LegalSection heading="How long we keep it">
        <p>
          We keep your account and energy data for as long as your account is active, because the service
          depends on your history. Waitlist emails are kept until you are invited or ask us to remove them.
        </p>
        <p>
          You can ask us to delete your account and all associated data at any time by emailing{' '}
          <span className={S}>support@solartracker.app</span> from your account email address. We will
          delete it within 30 days and confirm when it is done. An in-app delete option is coming. Our
          database provider keeps short-lived recovery history, so deleted data may persist there for up to
          7 days before it is gone for good.
        </p>
      </LegalSection>

      <LegalSection heading="How we protect it">
        <p>
          All traffic to Solar Tracker is encrypted in transit. MyEnergi credentials are encrypted at rest
          with a key kept separately from the database. Access to production data is limited to the operator.
        </p>
      </LegalSection>

      <LegalSection heading="Cookies">
        <p>
          We only use cookies that are strictly necessary to run the service: a session cookie that keeps
          you signed in, and security cookies used during sign-in. We do not use advertising, analytics, or
          tracking cookies.
        </p>
      </LegalSection>

      <LegalSection heading="Your rights">
        <p>
          Under the GDPR, you have the right to access the personal data we hold about you, to have it
          corrected or deleted, to restrict or object to how we process it, and to receive a copy of it in
          a portable format. To use any of these rights, email{' '}
          <span className={S}>support@solartracker.app</span>.
        </p>
        <p>
          If you are unhappy with how we handle your data, you can complain to the Data Protection
          Commission in Ireland (<span className={S}>dataprotection.ie</span>) or your local data
          protection authority.
        </p>
      </LegalSection>

      <LegalSection heading="Children">
        <p>Solar Tracker is not intended for anyone under 18.</p>
      </LegalSection>

      <LegalSection heading="Changes to this policy">
        <p>
          We may update this policy as the service develops. If we make significant changes, we will tell
          you by email or in the app before they take effect. The date at the top shows when it was last
          updated.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
