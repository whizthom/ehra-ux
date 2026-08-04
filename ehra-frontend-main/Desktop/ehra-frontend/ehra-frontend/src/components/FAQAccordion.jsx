import { useState } from "react";
import styles from "./pricing.module.css";
import { FAQ_ITEMS } from "../../data/pricingPlans";

function ChevronIcon({ open }) {
  return (
    <svg
      className={styles.faqChevron}
      data-open={open}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M5 7.5l5 5 5-5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function FAQAccordion() {
  // Multiple items can be open at once — closing one to read another is
  // more friction than benefit for five short answers like these.
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section
      className={`${styles.section} ${styles.faqSection}`}
      aria-labelledby="faq-heading"
    >
      <h2 id="faq-heading" className={styles.sectionHeading}>
        Frequently asked questions
      </h2>
      <div>
        {FAQ_ITEMS.map((item, index) => {
          const isOpen = openIndex === index;
          return (
            <div key={item.question} className={styles.faqItem}>
              <button
                type="button"
                className={styles.faqTrigger}
                aria-expanded={isOpen}
                onClick={() => setOpenIndex(isOpen ? -1 : index)}
              >
                {item.question}
                <ChevronIcon open={isOpen} />
              </button>
              <div className={styles.faqAnswer} data-open={isOpen}>
                <p className={styles.faqAnswerInner}>{item.answer}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
