import PublicHeader from "@/components/shared/PublicHeader";
import PublicFooter from "@/components/shared/PublicFooter";

export const metadata = {
  title: "Privacy Policy — Cloak",
  description: "How Cloak collects, uses, and protects your personal data under UK GDPR and the Data Protection Act 2018.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <PublicHeader />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-12">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-400">Legal</p>
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900">Privacy Policy</h1>
          <p className="mt-4 text-sm text-zinc-500">Last updated: 21 June 2026</p>
        </div>

        <div className="prose prose-zinc max-w-none text-zinc-700 [&_h2]:mb-3 [&_h2]:mt-10 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-zinc-900 [&_h3]:mb-2 [&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-zinc-800 [&_li]:mb-1 [&_p]:mb-4 [&_p]:leading-7 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-5">

          <p>
            Cloak ("we", "us", "our") is committed to protecting your personal data. This Privacy Policy explains what
            personal information we collect, why we collect it, how we use it, and your rights under the UK General Data
            Protection Regulation (UK GDPR) and the Data Protection Act 2018.
          </p>

          <p>
            This policy applies to all users of the Cloak platform, including guests who obtain a digital cloakroom
            pass and venue operators and staff who manage cloakroom operations.
          </p>

          <h2>1. Who we are</h2>
          <p>
            Cloak is a digital cloakroom management platform operated by Cloak Group Limited, a company incorporated
            in England and Wales (Companies House number 14766375) ("the Company"). We act as a data controller in
            respect of personal data collected through our platform.
          </p>
          <p>
            If you have any questions about this policy or how we handle your data, please contact us at:{" "}
            <a className="text-zinc-900 underline underline-offset-2" href="mailto:support@cloakqr.com">
              support@cloakqr.com
            </a>
          </p>

          <h2>2. What personal data we collect</h2>

          <h3>Guests (people obtaining a cloakroom pass)</h3>
          <ul>
            <li>Name</li>
            <li>Mobile phone number</li>
            <li>Items deposited (type and quantity)</li>
            <li>QR code and text fallback code associated with your pass</li>
            <li>Timestamp and location of check-in at the venue</li>
          </ul>

          <h3>Venue operators and staff</h3>
          <ul>
            <li>Name and email address</li>
            <li>Venue name, address, and contact details</li>
            <li>Role within the platform (manager or staff)</li>
            <li>Login activity and session information</li>
            <li>Operational data generated through the dashboard (ticket volumes, peak hours, item types)</li>
          </ul>

          <h3>Automatically collected data</h3>
          <ul>
            <li>IP address and device/browser type when you access our platform</li>
            <li>Session authentication tokens (strictly necessary for you to remain logged in)</li>
          </ul>

          <h2>3. How we use your personal data</h2>

          <h3>Guests</h3>
          <ul>
            <li>
              <strong>To provide the cloakroom pass service</strong> — processing your check-in, generating your QR
              pass, and enabling staff to return your items (lawful basis: contract performance, UK GDPR Art. 6(1)(b))
            </li>
            <li>
              <strong>To send your pass via SMS</strong> — delivering your digital pass to your mobile device (lawful
              basis: contract performance, UK GDPR Art. 6(1)(b))
            </li>
            <li>
              <strong>To maintain an audit trail</strong> — keeping a record of item deposits and returns to resolve
              any disputes (lawful basis: legitimate interests, UK GDPR Art. 6(1)(f))
            </li>
          </ul>

          <h3>Venue operators and staff</h3>
          <ul>
            <li>
              <strong>To provide the platform</strong> — account creation, authentication, and access to venue
              management tools (lawful basis: contract performance, UK GDPR Art. 6(1)(b))
            </li>
            <li>
              <strong>To provide analytics</strong> — generating operational insights such as hourly ticket volumes
              and item-type breakdowns (lawful basis: contract performance, UK GDPR Art. 6(1)(b))
            </li>
            <li>
              <strong>To communicate with you</strong> — sending service notifications, onboarding information, and
              support responses (lawful basis: legitimate interests, UK GDPR Art. 6(1)(f))
            </li>
          </ul>

          <h2>4. How long we keep your data</h2>
          <ul>
            <li>
              <strong>Guest pass data</strong> — retained for as long as necessary to provide the service,
              resolve disputes, and meet our legal obligations. You may request erasure at any time (see
              &ldquo;Your rights&rdquo; below).
            </li>
            <li>
              <strong>Venue account data</strong> — retained for the duration of the venue's account, and for 12
              months after account closure, after which it is deleted.
            </li>
            <li>
              <strong>Authentication session data</strong> — deleted on logout or expiry, whichever is sooner.
            </li>
          </ul>

          <h2>5. Who we share your data with</h2>
          <p>
            We do not sell your personal data. We share data only with the following third-party processors, each
            bound by appropriate data processing agreements:
          </p>
          <ul>
            <li>
              <strong>Supabase</strong> — our database and authentication infrastructure provider. Data is stored
              within the European Economic Area (EEA).
            </li>
            <li>
              <strong>Resend</strong> — used to send transactional emails to venue operators.
            </li>
            <li>
              <strong>Apple Inc. and Google LLC</strong> — when a guest adds their pass to Apple Wallet or Google
              Wallet, the pass data is transmitted to and stored by Apple or Google under their respective privacy
              policies.
            </li>
            <li>
              <strong>Stripe</strong> — payment processing for venue subscriptions, if applicable. Stripe handles
              payment card data under PCI DSS compliance; we do not store card details.
            </li>
          </ul>
          <p>
            We may also disclose data where required by law, court order, or to protect the rights or safety of
            our users or the public.
          </p>

          <h2>6. International transfers</h2>
          <p>
            Where any of our processors transfer data outside the UK or EEA, we ensure appropriate safeguards are in
            place — such as the UK International Data Transfer Agreement (IDTA) or equivalent standard contractual
            clauses — in accordance with UK GDPR Chapter V.
          </p>

          <h2>7. Your rights</h2>
          <p>Under UK GDPR, you have the right to:</p>
          <ul>
            <li>
              <strong>Access</strong> — request a copy of the personal data we hold about you
            </li>
            <li>
              <strong>Rectification</strong> — ask us to correct inaccurate or incomplete data
            </li>
            <li>
              <strong>Erasure</strong> — ask us to delete your data where there is no lawful basis for continued
              processing
            </li>
            <li>
              <strong>Restriction</strong> — ask us to limit how we use your data in certain circumstances
            </li>
            <li>
              <strong>Portability</strong> — receive your data in a structured, machine-readable format
            </li>
            <li>
              <strong>Object</strong> — object to processing based on legitimate interests
            </li>
            <li>
              <strong>Withdraw consent</strong> — where processing is based on consent, you may withdraw it at any
              time without affecting the lawfulness of prior processing
            </li>
          </ul>
          <p>
            To exercise any of these rights, email us at{" "}
            <a className="text-zinc-900 underline underline-offset-2" href="mailto:support@cloakqr.com">
              support@cloakqr.com
            </a>
            . We will respond within one calendar month.
          </p>

          <h2>8. Complaints</h2>
          <p>
            If you are unhappy with how we have handled your personal data, you have the right to lodge a complaint
            with the UK's supervisory authority:
          </p>
          <p>
            <strong>Information Commissioner's Office (ICO)</strong>
            <br />
            Website:{" "}
            <a
              className="text-zinc-900 underline underline-offset-2"
              href="https://ico.org.uk"
              rel="noopener noreferrer"
              target="_blank"
            >
              ico.org.uk
            </a>
            <br />
            Helpline: 0303 123 1113
          </p>
          <p>We would, however, appreciate the chance to address your concerns before you contact the ICO.</p>

          <h2>9. Changes to this policy</h2>
          <p>
            We may update this Privacy Policy from time to time. When we do, we will revise the "last updated" date
            at the top of this page. For significant changes, we will notify venue operators by email. We encourage
            you to review this policy periodically.
          </p>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
