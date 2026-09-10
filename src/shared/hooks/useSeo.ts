import { useEffect } from "react";

/**
 * @module useSeo
 * @description Per-page title, description, canonical URL and structured data —
 * FR-SEO-03 and FR-SEO-04.
 *
 * A single-page app serves one `index.html` for every route, so without this every
 * business profile shares one title and one description, which is the same as
 * having none. Google executes JavaScript before indexing, so this works; it is
 * not the same as server rendering, and the README says so plainly.
 *
 * Every tag written here is removed on unmount, so a stale description cannot
 * follow the user from a business profile onto the search page.
 */

const SITE_NAME = "RoadAxis";
const JSON_LD_ID = "ra-structured-data";

interface Seo {
  title: string;
  description?: string;
  /** Absolute or path. Absent means "this URL", which is right nearly always. */
  canonical?: string;
  /** Somebody's own saved list, or a form. Real pages omit this. */
  noIndex?: boolean;
  /** A `LocalBusiness` object, or anything else schema.org describes. */
  structuredData?: Record<string, unknown>;
}

/** Create the tag if it is missing, and remember whether we made it. */
function upsertMeta(selector: string, create: () => HTMLElement): [HTMLElement, boolean] {
  const existing = document.head.querySelector<HTMLElement>(selector);
  if (existing) return [existing, false];
  const el = create();
  document.head.appendChild(el);
  return [el, true];
}

export function useSeo({ title, description, canonical, noIndex, structuredData }: Seo) {
  /**
   * The dependency is the serialised payload, not the object. Callers build the
   * JSON-LD inline from query data, so the object identity changes on every render
   * while its contents do not — and depending on it would rewrite the tag each time.
   */
  const structuredJson = structuredData ? JSON.stringify(structuredData) : null;

  useEffect(() => {
    const previousTitle = document.title;
    // The page name first. A tab strip truncates from the right, and "RoadAxis —"
    // repeated across nine tabs identifies none of them.
    document.title = title ? `${title} · ${SITE_NAME}` : SITE_NAME;

    const cleanups: Array<() => void> = [() => (document.title = previousTitle)];

    const setContent = (selector: string, create: () => HTMLElement, content: string) => {
      const [el, created] = upsertMeta(selector, create);
      const previous = el.getAttribute("content");
      el.setAttribute("content", content);
      cleanups.push(() => {
        if (created) el.remove();
        else if (previous !== null) el.setAttribute("content", previous);
      });
    };

    if (description) {
      setContent(
        'meta[name="description"]',
        () => Object.assign(document.createElement("meta"), { name: "description" }),
        description,
      );
      // Open Graph as well: a business profile shared into a WhatsApp group is
      // one of the ways this product spreads, and an unfurled link with a real
      // name and description is worth more than any amount of on-page copy.
      setContent(
        'meta[property="og:description"]',
        () => {
          const el = document.createElement("meta");
          el.setAttribute("property", "og:description");
          return el;
        },
        description,
      );
    }

    setContent(
      'meta[property="og:title"]',
      () => {
        const el = document.createElement("meta");
        el.setAttribute("property", "og:title");
        return el;
      },
      title || SITE_NAME,
    );

    const href = canonical ?? `${window.location.origin}${window.location.pathname}`;
    const [link, linkCreated] = upsertMeta('link[rel="canonical"]', () =>
      Object.assign(document.createElement("link"), { rel: "canonical" }),
    ) as [HTMLLinkElement, boolean];
    const previousHref = link.href;
    link.href = href;
    cleanups.push(() => {
      if (linkCreated) link.remove();
      else link.href = previousHref;
    });

    if (noIndex) {
      const el = Object.assign(document.createElement("meta"), {
        name: "robots",
        content: "noindex",
      });
      document.head.appendChild(el);
      cleanups.push(() => el.remove());
    }

    if (structuredJson) {
      // Replaced rather than appended: two LocalBusiness blocks on one page
      // describe two businesses, which is worse than describing none.
      document.getElementById(JSON_LD_ID)?.remove();
      const script = document.createElement("script");
      script.id = JSON_LD_ID;
      script.type = "application/ld+json";
      script.textContent = structuredJson;
      document.head.appendChild(script);
      cleanups.push(() => script.remove());
    }

    return () => {
      for (const cleanup of cleanups.reverse()) cleanup();
    };
  }, [title, description, canonical, noIndex, structuredJson]);
}

/**
 * A business profile as schema.org describes it — FR-SEO-04.
 *
 * `AutoRepair` rather than the generic `LocalBusiness`: the specific type is what
 * earns the rating stars and opening hours in a result. `aggregateRating` is
 * emitted only when there are reviews — Google penalises a zero rating from none.
 */
export function localBusinessJsonLd(business: {
  name: string;
  slug: string;
  description?: string;
  address: { line1: string | null; city: string | null; postcode: string | null; country: string };
  coordinates: { latitude: number; longitude: number } | null;
  phone: string | null;
  website: string | null;
  primaryPhotoUrl?: string | null;
  averageRating: number | null;
  reviewCount: number;
  workingHours: Array<{ day: number; closed: boolean; open?: string; close?: string }>;
}): Record<string, unknown> {
  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  return {
    "@context": "https://schema.org",
    "@type": "AutoRepair",
    name: business.name,
    url: `${window.location.origin}/business/${business.slug}`,
    ...(business.description ? { description: business.description } : {}),
    ...(business.primaryPhotoUrl ? { image: business.primaryPhotoUrl } : {}),
    ...(business.phone ? { telephone: business.phone } : {}),
    ...(business.website ? { sameAs: [business.website] } : {}),
    address: {
      "@type": "PostalAddress",
      streetAddress: business.address.line1 ?? undefined,
      addressLocality: business.address.city ?? undefined,
      postalCode: business.address.postcode ?? undefined,
      addressCountry: business.address.country || "GB",
    },
    ...(business.coordinates
      ? {
          geo: {
            "@type": "GeoCoordinates",
            latitude: business.coordinates.latitude,
            longitude: business.coordinates.longitude,
          },
        }
      : {}),
    ...(business.reviewCount > 0 && business.averageRating !== null
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: business.averageRating,
            reviewCount: business.reviewCount,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
    openingHoursSpecification: business.workingHours
      .filter((d) => !d.closed && d.open && d.close)
      .map((d) => ({
        "@type": "OpeningHoursSpecification",
        dayOfWeek: `https://schema.org/${DAYS[d.day]}`,
        opens: d.open,
        closes: d.close,
      })),
  };
}
