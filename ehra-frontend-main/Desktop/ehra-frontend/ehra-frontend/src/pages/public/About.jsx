import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Logo from "../../components/Logo";
import founderPhoto from "../../assets/emmanuel-oluwabamise.jpg";
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

const REALITY_POINTS = [
  "Mobile-first usage",
  "Phone-based identity",
  "SMS / OTP authentication",
  "Multiple business types",
  "Branch-based operations",
  "Flexible workforce structures",
];

const WHY_POINTS = [
  {
    icon: "ti-seedling",
    title: "Built for businesses while they're becoming",
    description: "Not only for businesses that have already made it.",
  },
  {
    icon: "ti-users-group",
    title: "People first",
    description: "Every business is ultimately powered by people.",
  },
  {
    icon: "ti-device-mobile",
    title: "Mobile-first",
    description:
      "Designed around how people actually work, not adapted to a phone afterward.",
  },
  {
    icon: "ti-plug-connected",
    title: "Connected by design",
    description:
      "Workforce, operations and relationships shouldn't live in isolated systems.",
  },
  {
    icon: "ti-map-pin",
    title: "Built around African realities",
    description: "Not adapted afterward — designed around them from the start.",
  },
  {
    icon: "ti-arrow-up-right",
    title: "Room to grow",
    description:
      "Ehral should become more useful as the business grows, not less.",
  },
];

const START_LINES = [
  "One classroom.",
  "One chair.",
  "One table.",
  "One shop.",
  "One idea.",
  "One employee.",
  "One customer.",
];

const STORY_STEPS = [
  { icon: "ti-user", label: "A few people" },
  { icon: "ti-trending-up", label: "Growing responsibilities" },
  { icon: "ti-apps", label: "Scattered systems" },
  {
    icon: "ti-hexagon-letter-e",
    label: "Ehral",
    sublabel: "Built to grow with it",
  },
];

export default function About() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const prevTitle = document.title;
    document.title = "Ehral — Building the Future of African Business";

    let meta = document.querySelector('meta[name="description"]');
    const prevDesc = meta?.getAttribute("content");
    if (meta) {
      meta.setAttribute(
        "content",
        "Ehral helps African businesses manage their people, organize their operations and grow toward a more connected business ecosystem.",
      );
    }

    return () => {
      document.title = prevTitle;
      if (meta && prevDesc) meta.setAttribute("content", prevDesc);
    };
  }, []);

  return (
    <div className={styles.page}>
      {/* ── Nav — sticky; transparent over the hero, solid once scrolled ── */}
      <header
        className={`${styles.nav} ${scrolled ? styles.navScrolled : styles.navTransparent}`}
      >
        <Link to="/" className={styles.navLogo} aria-label="Ehral home">
          <Logo
            variant="horizontal"
            size={44}
            tone={scrolled ? "brand" : "sidebar"}
          />
        </Link>
        <div className={styles.navActions}>
          <Link to="/login" className={styles.navGhost}>
            Sign in
          </Link>
          <Link to="/" className={styles.navCta}>
            Get started
          </Link>
        </div>
      </header>

      {/* ── 1. Hero — story-first, not feature-first ── */}
      <section className={styles.hero}>
        <span className={styles.eyebrow}>Africa is building</span>
        <h1 className={styles.h1}>
          Africa is building.
          <br />
          We&rsquo;re building with it.
        </h1>
        <p className={styles.heroDesc}>
          Every day, businesses across Africa begin with an idea, a few people
          and the determination to make something work. Ehral exists to help
          those businesses grow — by bringing their people, operations and
          relationships into one connected platform.
        </p>
        <div className={styles.heroCtas}>
          <Link to="/" className={styles.btnPrimary}>
            Get started
          </Link>
          <a href="#belief" className={styles.btnGhost}>
            Discover Ehral
          </a>
        </div>
        <ProductShowcase />
        <p className={styles.heroFooter}>
          Behind every business is a living organization of people.
        </p>
      </section>

      {/* ── Story behind Ehral — why it exists, right after the hero ── */}
      <section className={styles.storySection}>
        <div className={styles.storyLabel}>
          <span className={styles.eyebrowDark}>Our story</span>
          <h2 className={styles.h2}>The story behind Ehral.</h2>
        </div>
        <div className={styles.storyText}>
          <p className={styles.lead}>
            Ehral started with a simple observation: businesses can grow faster
            than the systems around them.
          </p>
          <p className={styles.lead}>
            A business begins with a few people and a simple way of doing
            things. Then it grows — more employees, more responsibilities, more
            decisions, more information to keep track of. And the simple systems
            that worked at the start begin to strain.
          </p>
          <p className={styles.lead}>
            Employee information ends up in spreadsheets. Attendance lives in a
            notebook. Leave requests happen over WhatsApp. Announcements
            disappear inside group chats. The owner becomes the person holding
            it all together.
          </p>
          <p className={styles.leadStrong}>
            The business is growing. But the systems supporting it are
            struggling to grow with it.
          </p>
          <p className={styles.lead}>
            Ehral was created around a simple belief: businesses shouldn&rsquo;t
            have to become large before they can have the right systems around
            them. We wanted to build something that could start where a business
            is today, and grow with it tomorrow.
          </p>
          <p className={styles.lead}>
            We started with the workforce, because people are at the heart of
            every business. That is where Ehral begins — but it doesn&rsquo;t
            have to end there. Over time, we believe Ehral can connect
            businesses, employees and customers through one identity and one
            growing ecosystem.
          </p>
          <p className={styles.leadStrong}>
            Today, we&rsquo;re focused on helping businesses manage their people
            and operations better. Tomorrow, we want to help them connect.
          </p>
          <div className={styles.storyVisual}>
            <WorkflowDiagram endGlow steps={STORY_STEPS} />
          </div>
        </div>
      </section>

      {/* ── 2. Every business starts somewhere ── */}
      <section className={styles.section}>
        <h2 className={styles.h2}>Every great business starts somewhere.</h2>
        <p className={styles.lead}>
          A classroom. A salon chair. A restaurant table. A shop. A small
          office. A kitchen. A few people who decided to build something of
          their own.
        </p>
        <p className={styles.leadStrong}>
          The business may be small. The ambition rarely is.
        </p>
        <div className={styles.transformCard}>
          <WorkflowDiagram
            endGlow
            steps={[
              { icon: "ti-user", label: "One person" },
              { icon: "ti-bulb", label: "One idea" },
              { icon: "ti-building-store", label: "One business" },
              { icon: "ti-users", label: "A team" },
              { icon: "ti-trending-up", label: "Growth" },
            ]}
          />
        </div>
      </section>

      {/* ── 3. The real problem ── */}
      <section className={styles.section}>
        <span className={styles.eyebrowDark}>The real problem</span>
        <h2 className={styles.h2}>
          When the business grows, everything around it grows too.
        </h2>
        <p className={styles.lead}>
          More people. More locations. More decisions. More responsibilities.
          More information.
        </p>
        <p className={styles.lead}>
          An employee&rsquo;s information may be in a spreadsheet. Attendance
          may live in a notebook. Leave requests may arrive through WhatsApp.
          Important announcements may disappear inside group chats. Payments may
          be written down somewhere else. And the owner becomes the system
          connecting everything together.
        </p>
        <p className={styles.leadStrong}>
          The business is growing.
          <br />
          But the systems holding it together are struggling to grow with it.
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

      {/* ── 4. The belief — emotional peak ── */}
      <section
        id="belief"
        className={`${styles.section} ${styles.sectionDark}`}
      >
        <h2 className={styles.beliefLine}>
          We believe the size of a business should never limit the quality of
          the tools behind it.
        </h2>
        <p className={styles.leadLight}>
          A five-person business can represent someone&rsquo;s life&rsquo;s
          work. A small school can shape hundreds of lives. A growing restaurant
          can support families. A local business can become tomorrow&rsquo;s
          great company.
        </p>
        <p className={styles.beliefSmall}>
          Small does not mean insignificant.
          <br />
          Growing does not mean unimportant.
        </p>
      </section>

      {/* ── 5. Built for African realities ── */}
      <section className={styles.section}>
        <span className={styles.eyebrowDark}>
          Built for this business environment
        </span>
        <h2 className={styles.h2}>
          Technology should adapt to the way businesses actually work.
        </h2>
        <p className={styles.lead}>
          We don&rsquo;t believe African businesses need to become more like
          enterprise companies somewhere else before technology can work for
          them. Businesses here have their own realities. People use phones
          first. Teams can span locations. Owners often wear several hats.
          Relationships between people and businesses are rarely simple.
        </p>
        <ul className={styles.ngList}>
          {REALITY_POINTS.map((point) => (
            <li key={point}>
              <i className="ti ti-check" />
              {point}
            </li>
          ))}
        </ul>
      </section>

      {/* ── 6. Every business is powered by people ── */}
      <section className={styles.section}>
        <span className={styles.eyebrowDark}>The Ehral workforce</span>
        <h2 className={styles.h2}>Every business is powered by people.</h2>
        <p className={styles.lead}>
          Before there are reports, branches or revenue, there are people
          showing up every day to make the business work. Know your workforce.
          Manage it better.
        </p>
        <div className={styles.grid3}>
          {WORKFORCE_FEATURES.map((f) => (
            <FeatureVisual key={f.title} {...f} status={undefined} />
          ))}
        </div>
      </section>

      {/* ── 7. Smart attendance ── */}
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

      {/* ── 8. Leave management ── */}
      <section className={`${styles.section} ${styles.sectionCard}`}>
        <span className={styles.eyebrowDark}>Leave management</span>
        <h2 className={styles.h2}>Turn conversations into processes.</h2>
        <p className={styles.lead}>
          Instead of &ldquo;Sir, please I want to go on leave next week&rdquo;
          followed by several WhatsApp messages, Ehral turns the request into a
          structured workflow.
        </p>
        <LeaveWorkflow />
      </section>

      {/* ── 9. Business management ── */}
      <section className={styles.section}>
        <span className={styles.eyebrowDark}>Business management</span>
        <h2 className={styles.h2}>
          The business is bigger than the workforce.
        </h2>
        <p className={styles.lead}>
          Once the people are organized, businesses need a place to organize
          everything else.
        </p>
        <div className={styles.grid3}>
          {BUSINESS_FEATURES.map((f) => (
            <FeatureVisual key={f.title} {...f} status={f.status} />
          ))}
        </div>
      </section>

      {/* ── 10. Product proof — one real dashboard, once ── */}
      <section className={styles.section}>
        <span className={styles.eyebrowDark}>See it for yourself</span>
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
        <div className={styles.phoneRow}>
          <MobileProductPreview screen="attendance" />
          <MobileProductPreview screen="leave" />
          <MobileProductPreview screen="chat" />
        </div>
      </section>

      {/* ── 11. One identity ── */}
      <section className={`${styles.section} ${styles.sectionCard}`}>
        <span className={styles.eyebrowDark}>One identity</span>
        <h2 className={styles.h2}>
          A person doesn&rsquo;t belong to just one business.
        </h2>
        <p className={styles.lead}>
          Someone can be an employer in one business. An employee in another. A
          customer of a third. And perhaps a business owner again somewhere
          else.
        </p>
        <p className={styles.leadStrong}>
          Real life doesn&rsquo;t divide people into separate accounts. Why
          should technology?
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

      {/* ── 12. Founder story — a face, not the hero ── */}
      <section className={styles.founderSection}>
        <div className={styles.founderPortrait}>
          <img
            src={founderPhoto}
            alt="Emmanuel Oluwabamise, Founder of Ehral Systems"
            className={styles.founderImage}
          />
        </div>
        <div className={styles.founderText}>
          <span className={styles.eyebrowDark}>Why I started Ehral</span>
          <h2 className={styles.h2}>
            &ldquo;I kept seeing the same challenge.&rdquo;
          </h2>
          <p className={styles.lead}>
            I started Ehral because I kept seeing the same challenge: businesses
            trying to grow while important parts of their operations remained
            scattered across spreadsheets, paper, phones and conversations.
          </p>
          <p className={styles.lead}>
            I believe African businesses shouldn&rsquo;t have to become large
            corporations before they can have access to powerful technology.
            Ehral is my attempt to build something different — technology
            designed around the realities of the businesses and people it is
            meant to serve.
          </p>
          <p className={styles.lead}>
            We are starting with the workforce because people are at the heart
            of every business. But the ambition is much bigger. I want Ehral to
            grow alongside African businesses — from helping them manage their
            day-to-day work to eventually helping businesses, employees and
            customers connect within one ecosystem.
          </p>
          <div className={styles.founderSignature}>
            <strong>Emmanuel Oluwabamise</strong>
            <span>Founder, Ehral Systems</span>
          </div>
        </div>
      </section>

      {/* ── 13. The bigger ambition + connected ecosystem ── */}
      <section className={`${styles.section} ${styles.sectionDark}`}>
        <span className={styles.tagVisionLight}>Long-term vision</span>
        <h2 className={styles.h2Light}>
          We&rsquo;re building something bigger than workforce software.
        </h2>
        <p className={styles.leadLight}>
          Today, Ehral helps businesses manage their people and operations. But
          we believe the future can be much more connected. A school may need a
          supplier. A restaurant may need a local producer. A salon may need a
          distributor. A customer may be looking for a business they can trust.
          We envision a future where businesses, employees and customers can
          discover, connect and interact through one connected ecosystem.
        </p>
        <EcosystemDiagram />
        <div className={styles.visionGrid}>
          <FeatureVisual
            icon="ti-map"
            title="Business discovery"
            description="Businesses finding one another, and being found."
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
        <p className={styles.visionNote}>
          Some of these capabilities are part of our long-term vision and are
          not available today.
        </p>
      </section>

      {/* ── 14. Why Ehral ── */}
      <section className={styles.section}>
        <span className={styles.eyebrowDark}>Why Ehral</span>
        <h2 className={styles.h2}>
          Because the size of a business doesn&rsquo;t measure the size of its
          ambition.
        </h2>
        <div className={styles.grid3}>
          {WHY_POINTS.map((p) => (
            <FeatureVisual key={p.title} {...p} status={undefined} />
          ))}
        </div>
      </section>

      {/* ── 15. Emotional center — cinematic ── */}
      <section className={styles.finalStatement}>
        <div className={styles.stackedLines}>
          {START_LINES.map((line) => (
            <span key={line} className={styles.stackedLine}>
              {line}
            </span>
          ))}
        </div>
        <p className={styles.finalLine}>
          Every great business starts somewhere.
          <br />
          Ehral is built to grow with it.
        </p>
      </section>

      {/* ── 16. Where we're going ── */}
      <section className={`${styles.section} ${styles.sectionDark}`}>
        <span className={styles.tagVisionLight}>Where we&rsquo;re going</span>
        <p className={styles.roadmapLine}>
          Today, we help businesses run better.
        </p>
        <p className={styles.roadmapLine}>
          Tomorrow, we want to help them connect.
        </p>
        <p className={styles.roadmapLine}>
          Eventually, we want Ehral to become part of the infrastructure through
          which businesses, employees and customers interact.
        </p>
        <p className={styles.leadLight}>
          We&rsquo;re building toward a world where businesses don&rsquo;t just
          manage their operations — they become part of a connected business
          ecosystem.
        </p>
      </section>

      {/* ── 17. Final CTA — mission, not a feature pitch ── */}
      <section className={styles.cta}>
        <h2 className={styles.h2}>Your business is becoming something.</h2>
        <p className={styles.lead}>Give it the systems to grow with it.</p>
        <div className={styles.heroCtas}>
          <Link to="/" className={styles.btnPrimary}>
            Get started with Ehral
          </Link>
          <Link to="/login" className={styles.btnGhost}>
            Explore the platform
          </Link>
        </div>
        <p className={styles.finalInvitation}>
          Africa is building.
          <br />
          Let&rsquo;s build with it.
        </p>
      </section>

      <footer className={styles.footer}>
        <Logo variant="horizontal" size={36} />
        <p>Workforce, attendance and business management — in your pocket.</p>
        <span>© 2026 Ehral. All rights reserved.</span>
      </footer>
    </div>
  );
}
