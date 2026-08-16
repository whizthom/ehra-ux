import { useEffect, useRef, useState } from "react";
import LegalNav from "./LegalNav";
import SiteFooter from "./SiteFooter";
import styles from "./LegalLayout.module.css";

/**
 * Shared page shell for standalone legal documents (Terms, Privacy).
 *
 * Handles the three things both documents need identically: a reading
 * hero (title + effective/updated dates), a sticky table of contents
 * that tracks which section is currently on screen, and a top progress
 * bar showing how far through the document you are. The actual legal
 * text is passed in as `children` — this component only owns the
 * scaffolding around it.
 *
 * `sections` drives the TOC: [{ id, number, title }]. Each entry's
 * `id` must match the id on the corresponding <h2> in `children` for
 * both the jump-links and the scroll-spy highlighting to work.
 */
export default function LegalLayout({
  eyebrow,
  title,
  intro,
  effectiveDate,
  lastUpdated,
  sections,
  children,
}) {
  const [activeId, setActiveId] = useState(sections?.[0]?.id ?? null);
  const [tocOpen, setTocOpen] = useState(false);
  const progressRef = useRef(null);

  // Reading-progress bar: width tracks how far through the document
  // body (not the whole page — the hero and footer shouldn't count)
  // the reader has scrolled. Mutates the bar's width directly via ref
  // instead of storing it in state, since this fires on every scroll
  // tick and a re-render per pixel would be wasteful.
  useEffect(() => {
    const article = document.getElementById("legal-article");
    if (!article) return;

    const onScroll = () => {
      const rect = article.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      const scrolled = Math.min(Math.max(-rect.top, 0), Math.max(total, 1));
      const pct = total > 0 ? (scrolled / total) * 100 : 0;
      if (progressRef.current) {
        progressRef.current.style.width = `${pct}%`;
      }
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Scroll-spy: highlight whichever section heading is currently
  // nearest the top of the viewport, so the TOC always reflects where
  // you actually are, not just where you last clicked.
  useEffect(() => {
    if (!sections?.length) return;

    const targets = sections
      .map((s) => document.getElementById(s.id))
      .filter(Boolean);

    if (!targets.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) {
          const topMost = visible.reduce((a, b) =>
            a.boundingClientRect.top < b.boundingClientRect.top ? a : b,
          );
          setActiveId(topMost.target.id);
        }
      },
      { rootMargin: "-15% 0px -70% 0px", threshold: 0 },
    );

    targets.forEach((t) => observer.observe(t));
    return () => observer.disconnect();
  }, [sections]);

  const handleTocClick = () => setTocOpen(false);

  return (
    <div className={styles.page}>
      <div className={styles.progressTrack} aria-hidden="true">
        <div className={styles.progressBar} ref={progressRef} />
      </div>

      <LegalNav />

      <header className={styles.hero}>
        <span className={styles.eyebrow}>{eyebrow}</span>
        <h1 className={styles.title}>{title}</h1>
        {intro && <p className={styles.intro}>{intro}</p>}
        <div className={styles.metaRow}>
          <span className={styles.metaPill}>
            <i className="ti ti-calendar-event" aria-hidden="true" />
            Effective {effectiveDate}
          </span>
          <span className={styles.metaPill}>
            <i className="ti ti-refresh" aria-hidden="true" />
            Last updated {lastUpdated}
          </span>
        </div>
      </header>

      {/* Mobile-only TOC toggle — the sticky sidebar becomes a
          collapsible drawer below the two-column breakpoint. */}
      <button
        type="button"
        className={styles.tocToggle}
        onClick={() => setTocOpen((v) => !v)}
        aria-expanded={tocOpen}
      >
        <i className="ti ti-list" aria-hidden="true" />
        On this page
        <i
          className={`ti ti-chevron-down ${styles.tocToggleChevron}`}
          aria-hidden="true"
          style={{ transform: tocOpen ? "rotate(180deg)" : "none" }}
        />
      </button>

      <div className={styles.body}>
        <nav
          className={`${styles.toc} ${tocOpen ? styles.tocOpen : ""}`}
          aria-label="Table of contents"
        >
          <span className={styles.tocHeading}>On this page</span>
          <ol className={styles.tocList}>
            {sections.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  onClick={handleTocClick}
                  className={
                    activeId === s.id ? styles.tocLinkActive : styles.tocLink
                  }
                >
                  <span className={styles.tocNum}>{s.number}</span>
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <article id="legal-article" className={styles.article}>
          {children}
        </article>
      </div>

      <SiteFooter />
    </div>
  );
}
