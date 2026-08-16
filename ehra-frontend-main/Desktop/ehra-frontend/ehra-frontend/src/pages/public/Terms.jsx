import LegalLayout from "../../components/legal/LegalLayout";
import c from "../../components/legal/LegalContent.module.css";

const SECTIONS = [
  { id: "what-ehral-is", number: "01", title: "What Ehral Is" },
  { id: "accounts", number: "02", title: "Accounts" },
  { id: "business-accounts", number: "03", title: "Business Accounts" },
  { id: "end-users", number: "04", title: "Employee and Other End Users" },
  { id: "acceptable-use", number: "05", title: "Acceptable Use" },
  { id: "your-content", number: "06", title: "Your Content" },
  { id: "accuracy", number: "07", title: "Accuracy of Information" },
  { id: "attendance-location", number: "08", title: "Attendance and Location" },
  { id: "communications", number: "09", title: "Communications" },
  { id: "third-party", number: "10", title: "Third-Party Services" },
  { id: "availability", number: "11", title: "Service Availability" },
  { id: "changes-to-ehral", number: "12", title: "Changes to Ehral" },
  { id: "ip", number: "13", title: "Intellectual Property" },
  { id: "suspension", number: "14", title: "Suspension and Termination" },
  { id: "data-after", number: "15", title: "Data After Termination" },
  { id: "no-advice", number: "16", title: "No Professional Advice" },
  { id: "disclaimer", number: "17", title: "Disclaimer" },
  { id: "liability", number: "18", title: "Limitation of Liability" },
  { id: "indemnification", number: "19", title: "Indemnification" },
  { id: "governing-law", number: "20", title: "Governing Law" },
  { id: "changes-to-terms", number: "21", title: "Changes to These Terms" },
  { id: "contact", number: "22", title: "Contact" },
];

export default function Terms() {
  return (
    <LegalLayout
      eyebrow="Legal"
      title="Terms of Service"
      intro="These Terms govern your access to and use of Ehral's websites, applications, software, services and related products."
      effectiveDate="[INSERT DATE]"
      lastUpdated="[INSERT DATE]"
      sections={SECTIONS}
    >
      <p className={c.lead}>
        Welcome to Ehral. Ehral is operated by <strong>Ehral Systems</strong>{" "}
        ("Ehral", "we", "us" or "our"). By creating an account, accessing the
        Service, accepting these Terms, or otherwise using Ehral, you agree to
        be bound by these Terms. If you do not agree with these Terms, you
        should not use the Service.
      </p>

      <section id="what-ehral-is" className={c.section}>
        <div className={c.sectionHead}>
          <span className={c.sectionNum}>01</span>
          <h2 className={c.sectionTitle}>What Ehral Is</h2>
        </div>
        <p className={c.p}>
          Ehral is a business management platform designed to help businesses
          organize their workforce and business operations.
        </p>
        <p className={c.p}>
          Depending on the Service and subscription available to you, Ehral may
          provide functionality including:
        </p>
        <ul className={c.list}>
          <li>employee management;</li>
          <li>employee profiles;</li>
          <li>departments;</li>
          <li>attendance;</li>
          <li>leave management;</li>
          <li>employment settings;</li>
          <li>notifications;</li>
          <li>announcements;</li>
          <li>business profiles;</li>
          <li>branches;</li>
          <li>reports;</li>
          <li>communication;</li>
          <li>customer records;</li>
          <li>authentication and account security; and</li>
          <li>other functionality introduced from time to time.</li>
        </ul>
        <p className={c.p}>
          Features may differ depending on your plan, account type, location and
          the version of the Service available to you.
        </p>
      </section>

      <section id="accounts" className={c.section}>
        <div className={c.sectionHead}>
          <span className={c.sectionNum}>02</span>
          <h2 className={c.sectionTitle}>Accounts</h2>
        </div>
        <p className={c.p}>
          You may be required to create an account to use certain features.
        </p>
        <p className={c.p}>You agree to:</p>
        <ul className={c.list}>
          <li>provide accurate information;</li>
          <li>keep your account information current;</li>
          <li>
            maintain the confidentiality of your password and authentication
            credentials;
          </li>
          <li>use your own account;</li>
          <li>
            notify us promptly if you believe your account has been compromised;
            and
          </li>
          <li>
            be responsible for activity conducted through your account, subject
            to applicable law.
          </li>
        </ul>
        <p className={c.p}>
          You must not create an account using another person's identity or
          impersonate another person or organization.
        </p>
      </section>

      <section id="business-accounts" className={c.section}>
        <div className={c.sectionHead}>
          <span className={c.sectionNum}>03</span>
          <h2 className={c.sectionTitle}>Business Accounts</h2>
        </div>
        <p className={c.p}>
          If you create or administer an Ehral account on behalf of a business,
          organization or other entity:
        </p>
        <ul className={c.list}>
          <li>you represent that you have authority to act for that entity;</li>
          <li>
            you are responsible for ensuring that information submitted to Ehral
            is collected and processed lawfully;
          </li>
          <li>
            you are responsible for configuring your organization's use of Ehral
            appropriately;
          </li>
          <li>
            you are responsible for assigning appropriate roles and permissions;
            and
          </li>
          <li>
            you are responsible for ensuring that your organization's employees
            and other authorized users understand applicable policies.
          </li>
        </ul>
        <p className={c.p}>
          Where your organization uses Ehral to manage employee or customer
          information, your organization may determine the purposes for which
          that information is processed.
        </p>
        <p className={c.p}>Additional data-processing terms may apply.</p>
      </section>

      <section id="end-users" className={c.section}>
        <div className={c.sectionHead}>
          <span className={c.sectionNum}>04</span>
          <h2 className={c.sectionTitle}>Employee and Other End Users</h2>
        </div>
        <p className={c.p}>
          If you use Ehral because an organization has invited you to use its
          Ehral account, that organization may control certain aspects of your
          account and the information associated with your use of Ehral.
        </p>
        <p className={c.p}>
          For example, your employer may be able to manage or view information
          relating to:
        </p>
        <ul className={c.list}>
          <li>your employee profile;</li>
          <li>attendance;</li>
          <li>leave;</li>
          <li>department;</li>
          <li>employment status;</li>
          <li>work schedules;</li>
          <li>business communications; and</li>
          <li>
            other information the organization chooses to manage through Ehral.
          </li>
        </ul>
        <p className={c.p}>
          Questions about how your organization uses your information should
          generally first be directed to that organization.
        </p>
        <p className={c.p}>
          Ehral may also process information as necessary to provide, secure and
          maintain the Service.
        </p>
      </section>

      <section id="acceptable-use" className={c.section}>
        <div className={c.sectionHead}>
          <span className={c.sectionNum}>05</span>
          <h2 className={c.sectionTitle}>Acceptable Use</h2>
        </div>
        <p className={c.p}>You must use Ehral lawfully and responsibly.</p>
        <p className={c.p}>You must not:</p>
        <ul className={c.list}>
          <li>use Ehral for unlawful purposes;</li>
          <li>attempt to gain unauthorized access to accounts or systems;</li>
          <li>interfere with the operation of Ehral;</li>
          <li>introduce malicious software;</li>
          <li>abuse authentication, OTP or password-reset mechanisms;</li>
          <li>attempt to circumvent security controls;</li>
          <li>scrape or systematically extract data without authorization;</li>
          <li>use Ehral to distribute unlawful or harmful material;</li>
          <li>impersonate another person or organization;</li>
          <li>misuse another user's personal information;</li>
          <li>use Ehral to facilitate fraud or other unlawful activity; or</li>
          <li>
            use the Service in a manner that could materially harm Ehral, its
            users or third parties.
          </li>
        </ul>
        <p className={c.p}>
          We may suspend or restrict access where reasonably necessary to
          protect the Service, users or third parties.
        </p>
      </section>

      <section id="your-content" className={c.section}>
        <div className={c.sectionHead}>
          <span className={c.sectionNum}>06</span>
          <h2 className={c.sectionTitle}>Your Content</h2>
        </div>
        <p className={c.p}>
          You retain ownership of information and content that you submit to
          Ehral, subject to the rights necessary for Ehral to provide the
          Service.
        </p>
        <p className={c.p}>
          You grant Ehral the limited rights necessary to host, store, process,
          transmit, display and otherwise handle that content for the purpose of
          providing and improving the Service, maintaining security, complying
          with law and performing our contractual obligations.
        </p>
        <div className={c.callout}>
          <i className="ti ti-shield-check" aria-hidden="true" />
          <p>
            We do not acquire ownership of your business records merely because
            you use Ehral.
          </p>
        </div>
      </section>

      <section id="accuracy" className={c.section}>
        <div className={c.sectionHead}>
          <span className={c.sectionNum}>07</span>
          <h2 className={c.sectionTitle}>Accuracy of Information</h2>
        </div>
        <p className={c.p}>
          You are responsible for ensuring that information you submit to Ehral
          is accurate and lawful.
        </p>
        <p className={c.p}>Ehral is a software platform.</p>
        <p className={c.p}>
          We do not independently verify every employee record, attendance
          entry, leave request, business record or other information entered by
          users.
        </p>
      </section>

      <section id="attendance-location" className={c.section}>
        <div className={c.sectionHead}>
          <span className={c.sectionNum}>08</span>
          <h2 className={c.sectionTitle}>Attendance and Location Features</h2>
        </div>
        <p className={c.p}>
          Where an organization enables attendance functionality involving QR
          codes, device information or location verification, information may be
          processed to provide the attendance service.
        </p>
        <p className={c.p}>
          Organizations are responsible for configuring such functionality
          appropriately and communicating relevant workplace practices to their
          employees.
        </p>
        <p className={c.p}>
          Ehral does not guarantee that location information will always be
          perfectly accurate because location technologies depend on device
          capabilities, operating systems, network conditions and other factors.
        </p>
      </section>

      <section id="communications" className={c.section}>
        <div className={c.sectionHead}>
          <span className={c.sectionNum}>09</span>
          <h2 className={c.sectionTitle}>Communications</h2>
        </div>
        <p className={c.p}>
          Ehral may send service-related communications including:
        </p>
        <ul className={c.list}>
          <li>authentication codes;</li>
          <li>account-security messages;</li>
          <li>password-reset instructions;</li>
          <li>email verification messages;</li>
          <li>system notifications;</li>
          <li>important service announcements; and</li>
          <li>other communications necessary to operate the Service.</li>
        </ul>
        <p className={c.p}>
          Transactional and security communications may be sent even where you
          have not subscribed to promotional communications.
        </p>
      </section>

      <section id="third-party" className={c.section}>
        <div className={c.sectionHead}>
          <span className={c.sectionNum}>10</span>
          <h2 className={c.sectionTitle}>Third-Party Services</h2>
        </div>
        <p className={c.p}>
          Ehral may rely on third-party service providers for infrastructure,
          hosting, messaging, email delivery, authentication, analytics, payment
          processing, security and other services.
        </p>
        <p className={c.p}>
          Third-party providers may process information on Ehral's behalf as
          necessary to provide those services.
        </p>
        <p className={c.p}>
          Where appropriate, such providers are required to maintain appropriate
          confidentiality and security obligations.
        </p>
      </section>

      <section id="availability" className={c.section}>
        <div className={c.sectionHead}>
          <span className={c.sectionNum}>11</span>
          <h2 className={c.sectionTitle}>Service Availability</h2>
        </div>
        <p className={c.p}>
          We aim to keep Ehral reliable and available, but we do not guarantee
          uninterrupted or error-free operation.
        </p>
        <p className={c.p}>
          The Service may occasionally be unavailable because of:
        </p>
        <ul className={c.list}>
          <li>maintenance;</li>
          <li>upgrades;</li>
          <li>infrastructure failures;</li>
          <li>network problems;</li>
          <li>third-party service interruptions;</li>
          <li>security incidents;</li>
          <li>circumstances beyond our reasonable control; or</li>
          <li>other technical or operational reasons.</li>
        </ul>
      </section>

      <section id="changes-to-ehral" className={c.section}>
        <div className={c.sectionHead}>
          <span className={c.sectionNum}>12</span>
          <h2 className={c.sectionTitle}>Changes to Ehral</h2>
        </div>
        <p className={c.p}>
          We may modify, improve, replace or discontinue features of Ehral from
          time to time.
        </p>
        <p className={c.p}>
          Where changes materially affect the Service or your rights, we will
          provide notice where required by applicable law or our contractual
          obligations.
        </p>
      </section>

      <section id="ip" className={c.section}>
        <div className={c.sectionHead}>
          <span className={c.sectionNum}>13</span>
          <h2 className={c.sectionTitle}>Intellectual Property</h2>
        </div>
        <p className={c.p}>
          Ehral and its software, branding, designs, interfaces, logos,
          documentation and underlying technology are owned by or licensed to
          Ehral and are protected by applicable intellectual-property laws.
        </p>
        <p className={c.p}>
          Except as expressly permitted, you may not copy, modify, distribute,
          reverse engineer or commercially exploit the Service or its underlying
          technology.
        </p>
      </section>

      <section id="suspension" className={c.section}>
        <div className={c.sectionHead}>
          <span className={c.sectionNum}>14</span>
          <h2 className={c.sectionTitle}>Suspension and Termination</h2>
        </div>
        <p className={c.p}>You may stop using Ehral at any time.</p>
        <p className={c.p}>
          We may suspend or terminate access where reasonably necessary because
          of:
        </p>
        <ul className={c.list}>
          <li>violation of these Terms;</li>
          <li>unlawful use;</li>
          <li>security risks;</li>
          <li>fraud or abuse;</li>
          <li>non-payment where applicable;</li>
          <li>requests by an organization administering your account;</li>
          <li>legal requirements; or</li>
          <li>
            circumstances where continued access would materially threaten the
            Service or other users.
          </li>
        </ul>
        <p className={c.p}>
          Where appropriate, we will provide reasonable notice before
          termination.
        </p>
      </section>

      <section id="data-after" className={c.section}>
        <div className={c.sectionHead}>
          <span className={c.sectionNum}>15</span>
          <h2 className={c.sectionTitle}>Data After Termination</h2>
        </div>
        <p className={c.p}>
          Following account termination, information may be retained for periods
          necessary to:
        </p>
        <ul className={c.list}>
          <li>comply with legal obligations;</li>
          <li>resolve disputes;</li>
          <li>enforce agreements;</li>
          <li>maintain security;</li>
          <li>prevent fraud;</li>
          <li>satisfy legitimate operational requirements; or</li>
          <li>fulfill other lawful purposes.</li>
        </ul>
        <p className={c.p}>
          Business customers may have additional data-export and deletion rights
          under their agreement with Ehral.
        </p>
      </section>

      <section id="no-advice" className={c.section}>
        <div className={c.sectionHead}>
          <span className={c.sectionNum}>16</span>
          <h2 className={c.sectionTitle}>No Professional Advice</h2>
        </div>
        <p className={c.p}>Ehral provides software and organizational tools.</p>
        <div className={`${c.callout} ${c.calloutAmber}`}>
          <i className="ti ti-alert-triangle" aria-hidden="true" />
          <p>
            Information generated or displayed by Ehral should not automatically
            be treated as legal, accounting, tax, employment, financial or
            professional advice.
          </p>
        </div>
        <p className={c.p}>
          Users remain responsible for decisions made using information provided
          through the Service.
        </p>
      </section>

      <section id="disclaimer" className={c.section}>
        <div className={c.sectionHead}>
          <span className={c.sectionNum}>17</span>
          <h2 className={c.sectionTitle}>Disclaimer</h2>
        </div>
        <p className={c.p}>
          To the extent permitted by law, Ehral provides the Service on an "as
          available" basis.
        </p>
        <p className={c.p}>
          We do not guarantee that the Service will be completely uninterrupted,
          error-free, secure from every possible threat, or suitable for every
          particular purpose.
        </p>
        <p className={c.p}>
          Nothing in these Terms excludes rights or remedies that cannot
          lawfully be excluded.
        </p>
      </section>

      <section id="liability" className={c.section}>
        <div className={c.sectionHead}>
          <span className={c.sectionNum}>18</span>
          <h2 className={c.sectionTitle}>Limitation of Liability</h2>
        </div>
        <p className={c.p}>
          To the maximum extent permitted by applicable law, Ehral will not be
          liable for indirect, incidental, special, consequential or punitive
          losses arising from your use of the Service.
        </p>
        <p className={c.p}>
          Nothing in these Terms limits liability where such limitation is
          prohibited by applicable law.
        </p>
      </section>

      <section id="indemnification" className={c.section}>
        <div className={c.sectionHead}>
          <span className={c.sectionNum}>19</span>
          <h2 className={c.sectionTitle}>Indemnification</h2>
        </div>
        <p className={c.p}>
          Where permitted by law, you agree to indemnify Ehral against claims,
          losses and reasonable expenses arising from your unlawful use of the
          Service, violation of these Terms, or infringement of another person's
          rights.
        </p>
      </section>

      <section id="governing-law" className={c.section}>
        <div className={c.sectionHead}>
          <span className={c.sectionNum}>20</span>
          <h2 className={c.sectionTitle}>Governing Law</h2>
        </div>
        <p className={c.p}>
          These Terms shall be governed by the laws of the Federal Republic of
          Nigeria, subject to applicable mandatory legal requirements.
        </p>
      </section>

      <section id="changes-to-terms" className={c.section}>
        <div className={c.sectionHead}>
          <span className={c.sectionNum}>21</span>
          <h2 className={c.sectionTitle}>Changes to These Terms</h2>
        </div>
        <p className={c.p}>We may update these Terms from time to time.</p>
        <p className={c.p}>
          Where appropriate, we will notify users of material changes.
        </p>
        <p className={c.p}>
          Your continued use of Ehral after the effective date of updated Terms
          constitutes acceptance of the updated Terms where legally permitted.
        </p>
      </section>

      <section id="contact" className={c.section}>
        <div className={c.sectionHead}>
          <span className={c.sectionNum}>22</span>
          <h2 className={c.sectionTitle}>Contact</h2>
        </div>
        <p className={c.p}>For questions regarding these Terms:</p>
        <div className={c.contactCard}>
          <strong>Ehral Systems</strong>
          <span className={c.contactRow}>
            <i className="ti ti-world" aria-hidden="true" />
            <a href="https://www.ehral.com" target="_blank" rel="noreferrer">
              www.ehral.com
            </a>
          </span>
          <span className={c.contactRow}>
            <i className="ti ti-mail" aria-hidden="true" />
            <span className={c.placeholder}>
              [INSERT LEGAL/GENERAL CONTACT EMAIL]
            </span>
          </span>
          <span className={c.contactRow}>
            <i className="ti ti-lock" aria-hidden="true" />
            <span className={c.placeholder}>[INSERT PRIVACY EMAIL]</span>
          </span>
        </div>
      </section>
    </LegalLayout>
  );
}
