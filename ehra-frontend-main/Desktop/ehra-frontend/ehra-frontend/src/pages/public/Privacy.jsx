import LegalLayout from "../../components/legal/LegalLayout";
import c from "../../components/legal/LegalContent.module.css";

const SECTIONS = [
  { id: "who-we-are", number: "01", title: "Who We Are" },
  {
    id: "information-we-collect",
    number: "02",
    title: "Information We May Collect",
  },
  { id: "how-we-collect", number: "03", title: "How We Collect Information" },
  { id: "why-we-use", number: "04", title: "Why We Use Personal Data" },
  { id: "lawful-basis", number: "05", title: "Lawful Basis" },
  {
    id: "businesses-using-ehral",
    number: "06",
    title: "Businesses Using Ehral",
  },
  { id: "sharing", number: "07", title: "Sharing Information" },
  { id: "service-providers", number: "08", title: "Service Providers" },
  { id: "international", number: "09", title: "International Processing" },
  { id: "security", number: "10", title: "Security" },
  { id: "authentication", number: "11", title: "Passwords and Authentication" },
  { id: "location", number: "12", title: "Location Information" },
  { id: "cookies", number: "13", title: "Cookies" },
  { id: "retention", number: "14", title: "Data Retention" },
  { id: "your-rights", number: "15", title: "Your Rights" },
  { id: "requests", number: "16", title: "Requests" },
  { id: "children", number: "17", title: "Children's Data" },
  { id: "breaches", number: "18", title: "Data Breaches" },
  { id: "automated", number: "19", title: "Automated Processing and AI" },
  { id: "changes", number: "20", title: "Changes to This Policy" },
  { id: "contact", number: "21", title: "Contact" },
];

export default function Privacy() {
  return (
    <LegalLayout
      eyebrow="Legal"
      title="Privacy Policy"
      intro="How Ehral Systems collects, uses, discloses, stores and protects personal data when you use our websites, applications and services."
      effectiveDate="17th August 2026"
      lastUpdated="17th August 2026"
      sections={SECTIONS}
    >
      <p className={c.lead}>
        Ehral Systems ("Ehral", "we", "us" or "our") respects your privacy and
        is committed to handling personal data responsibly. This Policy should
        be read together with our <a href="/terms">Terms of Service</a> and any
        applicable business or data-processing agreement.
      </p>

      <section id="who-we-are" className={c.section}>
        <div className={c.sectionHead}>
          <span className={c.sectionNum}>01</span>
          <h2 className={c.sectionTitle}>Who We Are</h2>
        </div>
        <p className={c.p}>
          Ehral is a business management platform currently operating from
          Nigeria and intended to serve businesses and users in Nigeria and,
          over time, other markets.
        </p>
        <p className={c.p}>For privacy questions, contact:</p>
        <div className={c.contactCard}>
          <strong>Ehral Systems</strong>
          <span className={c.contactRow}>
            <i className="ti ti-lock" aria-hidden="true" />
            <a href="mailto:contact@ehral.com">
              <span className={c.placeholder}>contact@ehral.com</span>
            </a>
          </span>
        </div>
      </section>

      <section id="information-we-collect" className={c.section}>
        <div className={c.sectionHead}>
          <span className={c.sectionNum}>02</span>
          <h2 className={c.sectionTitle}>Information We May Collect</h2>
        </div>
        <p className={c.p}>Depending on how you use Ehral, we may collect:</p>

        <h3 className={c.subheading}>Account information</h3>
        <ul className={c.list}>
          <li>name;</li>
          <li>phone number;</li>
          <li>email address;</li>
          <li>password credentials in appropriately secured form;</li>
          <li>profile photograph;</li>
          <li>account preferences;</li>
          <li>authentication information.</li>
        </ul>

        <h3 className={c.subheading}>Business information</h3>
        <ul className={c.list}>
          <li>business name;</li>
          <li>business contact information;</li>
          <li>business address;</li>
          <li>branches;</li>
          <li>departments;</li>
          <li>business settings;</li>
          <li>business roles;</li>
          <li>employment structures.</li>
        </ul>

        <h3 className={c.subheading}>Workforce information</h3>
        <p className={c.p}>
          Where a business uses Ehral to manage employees, information may
          include:
        </p>
        <ul className={c.list}>
          <li>employee name;</li>
          <li>phone number;</li>
          <li>email;</li>
          <li>job title;</li>
          <li>department;</li>
          <li>employment type;</li>
          <li>work schedule;</li>
          <li>employment status;</li>
          <li>attendance information;</li>
          <li>leave information;</li>
          <li>business communications;</li>
          <li>profile information;</li>
          <li>information voluntarily added by the business.</li>
        </ul>

        <h3 className={c.subheading}>Attendance and technical information</h3>
        <p className={c.p}>Depending on enabled functionality:</p>
        <ul className={c.list}>
          <li>check-in and check-out records;</li>
          <li>date and time;</li>
          <li>device information;</li>
          <li>IP address;</li>
          <li>
            approximate or precise location information where location
            verification is enabled;
          </li>
          <li>browser information;</li>
          <li>operating system;</li>
          <li>diagnostic information;</li>
          <li>security logs.</li>
        </ul>

        <h3 className={c.subheading}>Customer information</h3>
        <p className={c.p}>
          Where customer-management features are used, businesses may submit
          information about their customers.
        </p>
        <p className={c.p}>
          The organization using Ehral is responsible for ensuring that it has
          an appropriate legal basis for providing such information to Ehral.
        </p>

        <h3 className={c.subheading}>Communications</h3>
        <p className={c.p}>
          We may collect information contained in communications sent through
          Ehral where necessary to provide the communication functionality,
          maintain security, investigate abuse or comply with law.
        </p>
      </section>

      <section id="how-we-collect" className={c.section}>
        <div className={c.sectionHead}>
          <span className={c.sectionNum}>03</span>
          <h2 className={c.sectionTitle}>How We Collect Information</h2>
        </div>
        <p className={c.p}>We may collect information:</p>
        <ul className={c.list}>
          <li>directly from you;</li>
          <li>from your employer or organization;</li>
          <li>when you create an account;</li>
          <li>when you use Ehral;</li>
          <li>when another authorized user adds information about you;</li>
          <li>automatically through technical systems;</li>
          <li>through cookies and similar technologies;</li>
          <li>through service providers acting on our behalf.</li>
        </ul>
      </section>

      <section id="why-we-use" className={c.section}>
        <div className={c.sectionHead}>
          <span className={c.sectionNum}>04</span>
          <h2 className={c.sectionTitle}>Why We Use Personal Data</h2>
        </div>
        <p className={c.p}>We may process personal data to:</p>
        <ul className={c.list}>
          <li>create and manage accounts;</li>
          <li>authenticate users;</li>
          <li>provide workforce-management functionality;</li>
          <li>process attendance;</li>
          <li>manage leave;</li>
          <li>provide notifications;</li>
          <li>provide communications;</li>
          <li>generate reports;</li>
          <li>maintain business records;</li>
          <li>provide customer-management functionality;</li>
          <li>protect accounts;</li>
          <li>prevent fraud and abuse;</li>
          <li>detect security incidents;</li>
          <li>troubleshoot technical problems;</li>
          <li>improve the Service;</li>
          <li>communicate important service information;</li>
          <li>process payments where applicable;</li>
          <li>comply with legal obligations;</li>
          <li>establish, exercise or defend legal claims; and</li>
          <li>
            perform other purposes described at the time information is
            collected.
          </li>
        </ul>
      </section>

      <section id="lawful-basis" className={c.section}>
        <div className={c.sectionHead}>
          <span className={c.sectionNum}>05</span>
          <h2 className={c.sectionTitle}>Lawful Basis</h2>
        </div>
        <p className={c.p}>
          Depending on the circumstances, we may rely on one or more lawful
          bases recognized under applicable data-protection law, including:
        </p>
        <ul className={c.list}>
          <li>performance of a contract;</li>
          <li>compliance with legal obligations;</li>
          <li>legitimate interests;</li>
          <li>consent;</li>
          <li>protection of vital interests; and</li>
          <li>other lawful bases available under applicable law.</li>
        </ul>
        <p className={c.p}>
          Consent is not necessarily the legal basis for every processing
          activity.
        </p>
        <p className={c.p}>
          Where consent is relied upon, you may withdraw consent subject to
          applicable legal limitations and the consequences explained at the
          time consent is requested.
        </p>
      </section>

      <section id="businesses-using-ehral" className={c.section}>
        <div className={c.sectionHead}>
          <span className={c.sectionNum}>06</span>
          <h2 className={c.sectionTitle}>Businesses Using Ehral</h2>
        </div>
        <p className={c.p}>
          Ehral is designed for businesses to manage information about their
          workforce and operations.
        </p>
        <p className={c.p}>
          Where a business uses Ehral to process employee or customer
          information, that business may determine:
        </p>
        <ul className={c.list}>
          <li>what information is collected;</li>
          <li>why it is collected;</li>
          <li>how it is used;</li>
          <li>who within the organization may access it; and</li>
          <li>how long it should be retained.</li>
        </ul>
        <p className={c.p}>
          In those circumstances, the business may act as the relevant data
          controller while Ehral acts as a service provider/data processor for
          the applicable processing.
        </p>
        <p className={c.p}>
          The precise roles depend on the processing activity and applicable
          law.
        </p>
      </section>

      <section id="sharing" className={c.section}>
        <div className={c.sectionHead}>
          <span className={c.sectionNum}>07</span>
          <h2 className={c.sectionTitle}>Sharing Information</h2>
        </div>
        <p className={c.p}>We may disclose personal data to:</p>
        <ul className={c.list}>
          <li>the business or organization associated with your account;</li>
          <li>authorized users within that organization;</li>
          <li>infrastructure and hosting providers;</li>
          <li>email and SMS delivery providers;</li>
          <li>authentication providers;</li>
          <li>payment providers;</li>
          <li>analytics and monitoring providers;</li>
          <li>security providers;</li>
          <li>professional advisers;</li>
          <li>regulators or government authorities where legally required;</li>
          <li>
            courts or law-enforcement authorities where legally required; and
          </li>
          <li>
            other parties where you have been informed and applicable law
            permits the disclosure.
          </li>
        </ul>
        <div className={c.callout}>
          <i className="ti ti-shield-lock" aria-hidden="true" />
          <p>We do not sell personal data as a business model.</p>
        </div>
      </section>

      <section id="service-providers" className={c.section}>
        <div className={c.sectionHead}>
          <span className={c.sectionNum}>08</span>
          <h2 className={c.sectionTitle}>Service Providers</h2>
        </div>
        <p className={c.p}>
          We may use carefully selected third-party providers to help operate
          Ehral.
        </p>
        <p className={c.p}>
          Depending on the services used, these providers may process
          information such as:
        </p>
        <ul className={c.list}>
          <li>authentication information;</li>
          <li>email addresses;</li>
          <li>phone numbers;</li>
          <li>technical information;</li>
          <li>application data;</li>
          <li>payment information.</li>
        </ul>
        <p className={c.p}>
          We seek to use appropriate contractual and technical safeguards for
          such processing.
        </p>
      </section>

      <section id="international" className={c.section}>
        <div className={c.sectionHead}>
          <span className={c.sectionNum}>09</span>
          <h2 className={c.sectionTitle}>International Processing</h2>
        </div>
        <p className={c.p}>
          Some service providers or infrastructure may operate outside Nigeria.
        </p>
        <p className={c.p}>
          Where personal data is transferred or made accessible outside Nigeria,
          we will take steps required by applicable law to ensure appropriate
          safeguards are used.
        </p>
      </section>

      <section id="security" className={c.section}>
        <div className={c.sectionHead}>
          <span className={c.sectionNum}>10</span>
          <h2 className={c.sectionTitle}>Security</h2>
        </div>
        <p className={c.p}>
          We use reasonable technical and organizational measures designed to
          protect personal data against unauthorized access, alteration,
          disclosure, loss, destruction and misuse.
        </p>
        <p className={c.p}>Security measures may include:</p>
        <ul className={c.list}>
          <li>encrypted communications;</li>
          <li>access controls;</li>
          <li>role-based permissions;</li>
          <li>authentication protections;</li>
          <li>logging and monitoring;</li>
          <li>secure credential handling;</li>
          <li>backups;</li>
          <li>infrastructure security controls;</li>
          <li>rate limiting;</li>
          <li>abuse detection.</li>
        </ul>
        <p className={c.p}>
          However, no internet-based service can guarantee absolute security.
        </p>
      </section>

      <section id="authentication" className={c.section}>
        <div className={c.sectionHead}>
          <span className={c.sectionNum}>11</span>
          <h2 className={c.sectionTitle}>Passwords and Authentication</h2>
        </div>
        <div className={c.callout}>
          <i className="ti ti-key" aria-hidden="true" />
          <p>We do not intentionally store user passwords in plain text.</p>
        </div>
        <p className={c.p}>Authentication mechanisms may include:</p>
        <ul className={c.list}>
          <li>passwords;</li>
          <li>email verification;</li>
          <li>phone OTP;</li>
          <li>password-reset OTP;</li>
          <li>authenticator applications;</li>
          <li>other security mechanisms introduced by Ehral.</li>
        </ul>
        <p className={c.p}>
          Authentication codes are intended to be temporary and may expire.
        </p>
        <p className={c.p}>
          Users must not share authentication codes with other people.
        </p>
      </section>

      <section id="location" className={c.section}>
        <div className={c.sectionHead}>
          <span className={c.sectionNum}>12</span>
          <h2 className={c.sectionTitle}>Location Information</h2>
        </div>
        <p className={c.p}>
          Certain attendance functionality may use location information where an
          organization enables location verification.
        </p>
        <p className={c.p}>Location processing may be used to:</p>
        <ul className={c.list}>
          <li>verify attendance;</li>
          <li>
            identify whether a check-in occurred within a configured area;
          </li>
          <li>prevent attendance abuse;</li>
          <li>support attendance reporting.</li>
        </ul>
        <p className={c.p}>
          Location features may be configurable by the organization using Ehral.
        </p>
      </section>

      <section id="cookies" className={c.section}>
        <div className={c.sectionHead}>
          <span className={c.sectionNum}>13</span>
          <h2 className={c.sectionTitle}>Cookies</h2>
        </div>
        <p className={c.p}>
          Ehral may use cookies and similar technologies for purposes such as:
        </p>
        <ul className={c.list}>
          <li>authentication;</li>
          <li>maintaining sessions;</li>
          <li>remembering preferences;</li>
          <li>security;</li>
          <li>analytics;</li>
          <li>improving the Service.</li>
        </ul>
        <p className={c.p}>
          Where consent is required for non-essential cookies, we will provide
          appropriate controls.
        </p>
      </section>

      <section id="retention" className={c.section}>
        <div className={c.sectionHead}>
          <span className={c.sectionNum}>14</span>
          <h2 className={c.sectionTitle}>Data Retention</h2>
        </div>
        <p className={c.p}>
          We retain personal data only for as long as reasonably necessary for
          the purposes for which it was collected, unless a longer period is
          required or permitted by law.
        </p>
        <p className={c.p}>Retention may depend on:</p>
        <ul className={c.list}>
          <li>the type of information;</li>
          <li>the purpose of processing;</li>
          <li>the user's relationship with an organization;</li>
          <li>contractual requirements;</li>
          <li>legal obligations;</li>
          <li>security requirements;</li>
          <li>dispute resolution;</li>
          <li>legitimate business requirements.</li>
        </ul>
      </section>

      <section id="your-rights" className={c.section}>
        <div className={c.sectionHead}>
          <span className={c.sectionNum}>15</span>
          <h2 className={c.sectionTitle}>Your Rights</h2>
        </div>
        <p className={c.p}>
          Subject to applicable law, you may have rights including:
        </p>
        <ul className={c.list}>
          <li>the right to be informed;</li>
          <li>the right to access personal data;</li>
          <li>the right to request correction;</li>
          <li>the right to object to certain processing;</li>
          <li>the right to request restriction where applicable;</li>
          <li>the right to data portability;</li>
          <li>the right to request erasure where applicable;</li>
          <li>
            the right to withdraw consent where processing is based on consent;
          </li>
          <li>rights concerning automated decision-making; and</li>
          <li>
            the right to lodge a complaint with the applicable supervisory
            authority.
          </li>
        </ul>
        <div className={c.callout}>
          <i className="ti ti-gavel" aria-hidden="true" />
          <p>
            The NDPC expressly recognizes these categories of data-subject
            rights.
          </p>
        </div>
      </section>

      <section id="requests" className={c.section}>
        <div className={c.sectionHead}>
          <span className={c.sectionNum}>16</span>
          <h2 className={c.sectionTitle}>Requests</h2>
        </div>
        <p className={c.p}>To exercise a privacy right, contact:</p>
        <div className={c.contactCard}>
          <span className={c.contactRow}>
            <i className="ti ti-lock" aria-hidden="true" />
            <span className={c.placeholder}>[INSERT PRIVACY EMAIL]</span>
          </span>
        </div>
        <p className={c.p} style={{ marginTop: 16 }}>
          We may need to verify your identity before fulfilling a request.
        </p>
        <p className={c.p}>
          If your information is controlled by a business using Ehral, we may
          refer your request to that organization where appropriate.
        </p>
      </section>

      <section id="children" className={c.section}>
        <div className={c.sectionHead}>
          <span className={c.sectionNum}>17</span>
          <h2 className={c.sectionTitle}>Children's Data</h2>
        </div>
        <p className={c.p}>
          Ehral is primarily designed for businesses and working-age users.
        </p>
        <div className={`${c.callout} ${c.calloutAmber}`}>
          <i className="ti ti-alert-triangle" aria-hidden="true" />
          <p>
            Unless specifically stated otherwise, Ehral is not intended to be
            used independently by children.
          </p>
        </div>
        <p className={c.p}>
          Organizations must not provide children's personal data to Ehral
          unless they have a lawful basis and any required parental, guardian or
          other authorization.
        </p>
      </section>

      <section id="breaches" className={c.section}>
        <div className={c.sectionHead}>
          <span className={c.sectionNum}>18</span>
          <h2 className={c.sectionTitle}>Data Breaches</h2>
        </div>
        <p className={c.p}>
          If we become aware of a personal-data breach affecting information
          processed by us, we will assess and respond to the incident in
          accordance with applicable law and our incident-response procedures.
        </p>
        <p className={c.p}>
          Where notification is legally required, we will make the appropriate
          notifications.
        </p>
      </section>

      <section id="automated" className={c.section}>
        <div className={c.sectionHead}>
          <span className={c.sectionNum}>19</span>
          <h2 className={c.sectionTitle}>Automated Processing and AI</h2>
        </div>
        <p className={c.p}>
          Where Ehral introduces automated decision-making, profiling or
          artificial-intelligence features, we will provide appropriate
          information about those features and the relevant rights and
          safeguards.
        </p>
        <p className={c.p}>
          Ehral will not represent automated outputs as infallible.
        </p>
        <p className={c.p}>
          Users should review important decisions before acting on automated
          recommendations.
        </p>
      </section>

      <section id="changes" className={c.section}>
        <div className={c.sectionHead}>
          <span className={c.sectionNum}>20</span>
          <h2 className={c.sectionTitle}>Changes to This Policy</h2>
        </div>
        <p className={c.p}>
          We may update this Privacy Policy from time to time.
        </p>
        <p className={c.p}>
          Material changes will be communicated where required.
        </p>
        <p className={c.p}>
          The latest version will always be made available through Ehral.
        </p>
      </section>

      <section id="contact" className={c.section}>
        <div className={c.sectionHead}>
          <span className={c.sectionNum}>21</span>
          <h2 className={c.sectionTitle}>Contact</h2>
        </div>
        <div className={c.contactCard}>
          <strong>Ehral Systems</strong>
          <span className={c.contactRow}>
            <i className="ti ti-world" aria-hidden="true" />
            <a href="https://www.ehral.com" target="_blank" rel="noreferrer">
              www.ehral.com
            </a>
          </span>
          <span className={c.contactRow}>
            <i className="ti ti-lock" aria-hidden="true" />
            <span className={c.placeholder}>[INSERT PRIVACY EMAIL]</span>
          </span>
          <span className={c.contactRow}>
            <i className="ti ti-mail" aria-hidden="true" />
            <span className={c.placeholder}>[INSERT GENERAL EMAIL]</span>
          </span>
        </div>
      </section>
    </LegalLayout>
  );
}
