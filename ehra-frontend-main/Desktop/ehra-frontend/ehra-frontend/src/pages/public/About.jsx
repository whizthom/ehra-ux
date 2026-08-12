import { useEffect } from "react";
import { Link } from "react-router-dom";
import Logo from "../../components/Logo";
import DeviceFrame from "../../components/about/DeviceFrame";
import ProductShowcase from "../../components/about/ProductShowcase";
import DashboardPreview from "../../components/about/DashboardPreview";
import MobileProductPreview from "../../components/about/MobileProductPreview";
import FeatureVisual from "../../components/about/FeatureVisual";
import WorkflowDiagram from "../../components/about/WorkflowDiagram";
import QRCodeAttendanceDemo from "../../components/about/QRCodeAttendanceDemo";
import LeaveWorkflow from "../../components/about/LeaveWorkflow";
import EcosystemDiagram from "../../components/about/EcosystemDiagram";
import styles from "./About.module.css";

const WORKFORCE_FEATURES = [
  {
    icon: "ti-id-badge-2",
    title: "Employee management",
    description: "Organized, up-to-date profiles for every person on the team.",
  },
  {
    icon: "ti-sitemap",
    title: "Departments",
    description: "Group employees by department and responsibility.",
  },
  {
    icon: "ti-fingerprint",
    title: "Attendance",
    description: "Know who arrived, when, and from where.",
  },
  {
    icon: "ti-calendar-off",
    title: "Leave management",
    description:
      "Structured requests, reviews and decisions — not chat threads.",
  },
  {
    icon: "ti-adjustments",
    title: "Employment settings",
    description: "Schedules, positions and employment types, kept current.",
  },
  {
    icon: "ti-bell-ringing",
    title: "Notifications",
    description: "Employees stay informed about what matters to them.",
  },
];

const BUSINESS_FEATURES = [
  {
    icon: "ti-building",
    title: "Business profile",
    description: "One place holding what your business is and how it runs.",
  },
  {
    icon: "ti-map-2",
    title: "Branches",
    description: "Manage multiple locations under one account.",
  },
  {
    icon: "ti-report-analytics",
    title: "Reports",
    description:
      "Attendance, leave and workforce reports, whenever you need them.",
  },
  {
    icon: "ti-speakerphone",
    title: "Announcements",
    description: "Reach your whole team with one message.",
  },
  {
    icon: "ti-users",
    title: "Customers",
    description: "Keep a record of who your business serves.",
    status: "vision",
  },
  {
    icon: "ti-receipt",
    title: "Payments & receipts",
    description: "Record payments and issue receipts from the same place.",
    status: "vision",
  },
];

const BUSINESS_TYPES = [
  { icon: "ti-school", label: "Schools" },
  { icon: "ti-scissors", label: "Salons & barbershops" },
  { icon: "ti-building-skyscraper", label: "Hotels" },
  { icon: "ti-tools-kitchen-2", label: "Restaurants" },
  { icon: "ti-shopping-cart", label: "Supermarkets & retail" },
  { icon: "ti-stethoscope", label: "Clinics" },
  { icon: "ti-trending-up", label: "Growing businesses" },
];

const WHY_POINTS = [
  {
    icon: "ti-plug-connected",
    title: "One connected platform",
    description:
      "Workforce, attendance and business records in the same place.",
  },
  {
    icon: "ti-users-group",
    title: "Built around the workforce",
    description:
      "The people behind the business come first, not the paperwork.",
  },
  {
    icon: "ti-device-mobile",
    title: "Mobile-first",
    description:
      "Designed to be used from a phone, not adapted to one afterward.",
  },
  {
    icon: "ti-list-check",
    title: "Structured workflows",
    description:
      "Leave, attendance and approvals follow a clear, repeatable process.",
  },
  {
    icon: "ti-map-pin",
    title: "Built for this region",
    description:
      "Phone-based identity, local payments, and realities other tools ignore.",
  },
  {
    icon: "ti-arrow-up-right",
    title: "Room to grow",
    description: "Starts with the workforce, and grows with the business.",
  },
];

const NG_POINTS = [
  "Mobile-first usage",
  "Phone-based identity",
  "SMS / OTP authentication",
  "Multiple business types",
  "Branch-based operations",
  "Flexible workforce structures",
];

export default function About() {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = "Ehral — Workforce, Attendance & Business Management";

    let meta = document.querySelector('meta[name="description"]');
    const prevDesc = meta?.getAttribute("content");
    if (meta) {
      meta.setAttribute(
        "content",
        "Ehral is a connected platform for workforce, attendance and business management, designed to help growing businesses manage their people and operations in one place.",
      );
    }

    return () => {
      document.title = prevTitle;
      if (meta && prevDesc) meta.setAttribute("content", prevDesc);
    };
  }, []);

  return (
    <div className={styles.page}>
      {/* ── Nav ── */}
      <header className={styles.nav}>
        <Link to="/" className={styles.navLogo} aria-label="Ehral home">
          <Logo variant="horizontal" size={44} />
        </Link>
        <div className={styles.navActions}>
          <Link to="/login" className={styles.navGhost}>
            Sign in
          </Link>
          <Link to="/" className={styles.navCta}>
            Get Started
          </Link>
        </div>
      </header>

      {/* ── 1. Hero ── */}
      <section className={styles.hero}>
        <span className={styles.eyebrow}>Business management, connected</span>
        <h1 className={styles.h1}>
          Workforce, attendance and business management — in your pocket.
        </h1>
        <p className={styles.heroDesc}>
          Ehral brings essential business operations — employee records,
          attendance, leave, communication and more — into one connected
          platform.
        </p>
        <div className={styles.heroCtas}>
          <Link to="/" className={styles.btnPrimary}>
            Get Started
          </Link>
          <a href="#what-is-ehral" className={styles.btnGhost}>
            Explore the platform
          </a>
        </div>
        <ProductShowcase />
        <p className={styles.heroFooter}>
          Built for businesses. Designed for people.
        </p>
      </section>

      {/* ── 2. The problem ── */}
      <section className={styles.section}>
        <span className={styles.eyebrowDark}>The problem</span>
        <h2 className={styles.h2}>
          Running a business shouldn&rsquo;t mean managing ten different tools.
        </h2>
        <p className={styles.lead}>
          Attendance in one place. Employee information somewhere else. Leave
          requests over WhatsApp. Payment records in a notebook. Ehral brings
          all of it into one environment.
        </p>
        <div className={styles.transformCard}>
          <WorkflowDiagram
            endGlow
            steps={[
              { icon: "ti-table", label: "Spreadsheets" },
              { icon: "ti-brand-whatsapp", label: "WhatsApp" },
              { icon: "ti-notebook", label: "Paper records" },
              { icon: "ti-apps", label: "Separate tools" },
              {
                icon: "ti-hexagon-letter-e",
                label: "Ehral",
                sublabel: "One connected platform",
              },
            ]}
          />
        </div>
      </section>

      {/* ── 3. What is Ehral ── */}
      <section id="what-is-ehral" className={styles.section}>
        <span className={styles.eyebrowDark}>What is Ehral?</span>
        <h2 className={styles.h2}>More than HR.</h2>
        <p className={styles.lead}>
          Ehral is a connected platform designed to help businesses manage their
          workforce, organize daily operations, and build stronger connections
          with the people they work with and serve.
        </p>
        <DeviceFrame
          variant="browser"
          label="app.ehral.com/dashboard"
          className={styles.centerFrame}
        >
          <DashboardPreview screen="overview" />
        </DeviceFrame>
      </section>

      {/* ── 4. Workforce ── */}
      <section className={styles.section}>
        <span className={styles.eyebrowDark}>The Ehral workforce</span>
        <h2 className={styles.h2}>Know your workforce. Manage it better.</h2>
        <p className={styles.lead}>
          Your employees are at the heart of your business. Ehral gives
          employers a structured way to manage the people behind it.
        </p>
        <div className={styles.grid3}>
          {WORKFORCE_FEATURES.map((f) => (
            <FeatureVisual key={f.title} {...f} />
          ))}
        </div>
      </section>

      {/* ── 5. Smart attendance ── */}
      <section className={`${styles.section} ${styles.sectionCard}`}>
        <span className={styles.eyebrowDark}>Smart attendance</span>
        <h2 className={styles.h2}>Attendance without the attendance book.</h2>
        <p className={styles.lead}>
          A dynamic QR code that refreshes periodically, with optional location
          verification — designed to make clocking in simple while giving
          employers better visibility.
        </p>
        <QRCodeAttendanceDemo />
      </section>

      {/* ── 6. Leave management ── */}
      <section className={`${styles.section} ${styles.sectionCard}`}>
        <span className={styles.eyebrowDark}>Leave management</span>
        <h2 className={styles.h2}>
          Turn leave requests into a real business process.
        </h2>
        <p className={styles.lead}>
          Instead of &ldquo;Sir, please I want to go on leave next week&rdquo;
          followed by several WhatsApp messages, Ehral turns the request into a
          structured workflow.
        </p>
        <LeaveWorkflow />
      </section>

      {/* ── 7. Communication ── */}
      <section className={styles.section}>
        <span className={styles.eyebrowDark}>Communication</span>
        <h2 className={styles.h2}>Keep your business connected.</h2>
        <p className={styles.lead}>
          Notifications, announcements and real-time messaging — so employees
          hear about what matters directly from their workplace, not through a
          group chat.
        </p>
        <div className={styles.phoneRow}>
          <MobileProductPreview screen="chat" />
          <MobileProductPreview screen="notifications" />
        </div>
      </section>

      {/* ── 8. Reports ── */}
      <section className={styles.section}>
        <span className={styles.eyebrowDark}>Reports & visibility</span>
        <h2 className={styles.h2}>
          See what&rsquo;s happening inside your business.
        </h2>
        <p className={styles.lead}>
          Attendance rates, leave taken, department health — the picture
          business owners often don&rsquo;t have, made visible.
        </p>
        <DeviceFrame
          variant="browser"
          label="app.ehral.com/reports"
          className={styles.centerFrame}
        >
          <DashboardPreview screen="reports" />
        </DeviceFrame>
      </section>

      {/* ── 9. Business management ── */}
      <section className={styles.section}>
        <span className={styles.eyebrowDark}>Business management</span>
        <h2 className={styles.h2}>Your business, organized in one place.</h2>
        <p className={styles.lead}>
          Beyond individual employee records, Ehral is becoming the place where
          more of your everyday business activity happens.
        </p>
        <div className={styles.grid3}>
          {BUSINESS_FEATURES.map((f) => (
            <FeatureVisual key={f.title} {...f} />
          ))}
        </div>
      </section>

      {/* ── 10. Mobile-first ── */}
      <section className={`${styles.section} ${styles.sectionDark}`}>
        <span className={styles.eyebrowLight}>Mobile-first</span>
        <h2 className={styles.h2Light}>
          Your business doesn&rsquo;t stop when you leave the office.
        </h2>
        <p className={styles.leadLight}>
          Attendance, leave, employee management and communication — all
          designed to work as well from a phone as from a desk.
        </p>
        <div className={styles.phoneRow}>
          <MobileProductPreview screen="attendance" />
          <MobileProductPreview screen="leave" />
          <MobileProductPreview screen="chat" />
        </div>
      </section>

      {/* ── 11. Built for real businesses ── */}
      <section className={styles.section}>
        <span className={styles.eyebrowDark}>Who it&rsquo;s for</span>
        <h2 className={styles.h2}>
          Built for the businesses that keep everyday life moving.
        </h2>
        <p className={styles.lead}>
          Ehral is designed particularly with small and medium-sized businesses
          in mind — not exclusively for these industries, but built with them
          front of mind.
        </p>
        <div className={styles.typeGrid}>
          {BUSINESS_TYPES.map((t) => (
            <div className={styles.typeChip} key={t.label}>
              <i className={`ti ${t.icon}`} />
              <span>{t.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── 12. One identity ── */}
      <section className={`${styles.section} ${styles.sectionCard}`}>
        <span className={styles.eyebrowDark}>One identity</span>
        <h2 className={styles.h2}>
          One person. Multiple business relationships.
        </h2>
        <p className={styles.lead}>
          Someone could be an employer in one business, an employee in another,
          and — over time — a customer of a third. Ehral is built around a
          connected identity rather than separate logins for every relationship.
        </p>
        <div className={styles.identityWrap}>
          <div className={styles.identityRoles}>
            <div className={styles.identityRole}>
              <i className="ti ti-briefcase" />
              <span>Employer, Business A</span>
            </div>
            <div className={styles.identityRole}>
              <i className="ti ti-id-badge-2" />
              <span>Employee, Business B</span>
            </div>
            <div className={styles.identityRole}>
              <i className="ti ti-heart-handshake" />
              <span>Customer, Business C</span>
            </div>
          </div>
          <i
            className={`ti ti-arrow-narrow-right ${styles.identityArrow}`}
            aria-hidden="true"
          />
          <div className={styles.identityOne}>
            <i className="ti ti-hexagon-letter-e" />
            <span>One Ehral identity</span>
          </div>
        </div>
      </section>

      {/* ── 13 & 14. The bigger vision + ecosystem ── */}
      <section className={`${styles.section} ${styles.sectionDark}`}>
        <span className={styles.tagVisionLight}>Where we&rsquo;re going</span>
        <h2 className={styles.h2Light}>
          Ehral is becoming more than workforce software.
        </h2>
        <p className={styles.leadLight}>
          Today, Ehral connects a business to its workforce and operations. The
          longer-term vision connects businesses, employees, customers and other
          businesses within one ecosystem — never presented as available today,
          always as the direction we&rsquo;re building toward.
        </p>
        <EcosystemDiagram />
        <div className={styles.visionGrid}>
          <FeatureVisual
            icon="ti-map"
            title="Business discovery"
            description="Find and be found by businesses nearby."
            status="vision"
          />
          <FeatureVisual
            icon="ti-cash"
            title="Payments"
            description="Customers interacting financially with the businesses they use."
            status="vision"
          />
          <FeatureVisual
            icon="ti-affiliate"
            title="Business-to-business"
            description="Businesses connecting, communicating and collaborating."
            status="vision"
          />
        </div>
      </section>

      {/* ── 15. Why Ehral ── */}
      <section className={styles.section}>
        <span className={styles.eyebrowDark}>Why Ehral?</span>
        <h2 className={styles.h2}>
          Because small businesses deserve powerful software too.
        </h2>
        <div className={styles.grid3}>
          {WHY_POINTS.map((p) => (
            <FeatureVisual key={p.title} {...p} status={undefined} />
          ))}
        </div>
      </section>

      {/* ── 16. Built for the region ── */}
      <section className={`${styles.section} ${styles.sectionCard}`}>
        <span className={styles.eyebrowDark}>
          Built for this business environment
        </span>
        <h2 className={styles.h2}>
          Technology that adapts to how businesses actually operate.
        </h2>
        <p className={styles.lead}>
          Ehral isn&rsquo;t enterprise software copied from another market —
          it&rsquo;s built with the realities of the businesses that use it
          every day in mind.
        </p>
        <ul className={styles.ngList}>
          {NG_POINTS.map((point) => (
            <li key={point}>
              <i className="ti ti-check" />
              {point}
            </li>
          ))}
        </ul>
      </section>

      {/* ── 17. Cinematic future statement ── */}
      <section className={styles.finalStatement}>
        <Logo variant="icon" size={56} />
        <p className={styles.finalLine}>
          Ehral begins with the workforce.
          <br />
          It grows into business management.
          <br />
          And ultimately connects businesses, employees and customers in one
          ecosystem.
        </p>
      </section>

      {/* ── 18. Final CTA ── */}
      <section className={styles.cta}>
        <h2 className={styles.h2}>Ready to bring your business together?</h2>
        <p className={styles.lead}>
          Start managing your workforce and business operations with Ehral.
        </p>
        <div className={styles.heroCtas}>
          <Link to="/" className={styles.btnPrimary}>
            Get Started
          </Link>
          <Link to="/login" className={styles.btnGhost}>
            Sign in
          </Link>
        </div>
      </section>

      <footer className={styles.footer}>
        <Logo variant="horizontal" size={36} />
        <p>Workforce, attendance and business management — in your pocket.</p>
        <span>© 2026 Ehral. All rights reserved.</span>
      </footer>
    </div>
  );
}
