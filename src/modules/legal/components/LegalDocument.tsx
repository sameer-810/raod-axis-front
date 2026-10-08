import { Link } from "react-router-dom";

/**
 * The frame both legal pages sit in.
 *
 * Written to be read, which most legal pages are not: one column at a reading
 * measure, a contents list that is a real set of links, and sections that say
 * what they are about in the heading rather than "4.2 Processing".
 */
export function LegalDocument({
  title,
  updated,
  summary,
  sections,
  other,
}: {
  title: string;
  /** Shown as written — "7 October 2026". A date nobody has to parse. */
  updated: string;
  /** The page in two sentences, for the people who will read only those. */
  summary: React.ReactNode;
  sections: Array<{ id: string; heading: string; body: React.ReactNode }>;
  /** The sister document, linked from the foot. */
  other: { to: string; label: string };
}) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-8 md:py-12">
      <header>
        <p className="ra-eyebrow text-muted-foreground">Last updated {updated}</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          {title}
        </h1>
        <div className="mt-4 text-base leading-relaxed text-foreground">{summary}</div>
      </header>

      <nav aria-label="On this page" className="ra-panel mt-8 p-4">
        <h2 className="text-sm font-semibold text-foreground">On this page</h2>
        <ol className="mt-2 grid gap-x-6 sm:grid-cols-2">
          {sections.map((s, i) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="ra-focus flex min-h-[44px] items-center gap-2 rounded text-sm text-muted-foreground transition-colors hover:text-foreground md:min-h-9"
              >
                <span className="w-5 font-mono text-xs tabular-nums">{i + 1}</span>
                {s.heading}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="mt-10 space-y-10">
        {sections.map((s, i) => (
          <section
            key={s.id}
            id={s.id}
            aria-labelledby={`${s.id}-heading`}
            className="scroll-mt-20"
          >
            <h2
              id={`${s.id}-heading`}
              className="font-display text-xl font-semibold tracking-tight text-foreground"
            >
              <span className="me-2 font-mono text-sm font-normal tabular-nums text-muted-foreground">
                {i + 1}
              </span>
              {s.heading}
            </h2>
            <div className="ra-legal mt-3 space-y-3 text-[15px] leading-relaxed text-foreground">
              {s.body}
            </div>
          </section>
        ))}
      </div>

      <footer className="mt-12 border-t border-border pt-6 text-sm text-muted-foreground">
        See also our{" "}
        <Link
          to={other.to}
          className="font-medium text-foreground underline underline-offset-2 hover:text-primary-text"
        >
          {other.label}
        </Link>
        .
      </footer>
    </article>
  );
}

/** A bulleted list at the document's own measure and rhythm. */
export function LegalList({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1.5 ps-5 marker:text-muted-foreground">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}
