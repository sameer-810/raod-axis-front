import { expect, type Page } from "@playwright/test";

export const API = process.env.E2E_API_URL || "http://localhost:5005/api";

/**
 * A tag stamped into every record these tests create, so fixtures are easy to
 * find, filter on and delete — and impossible to confuse with real data.
 */
export const RUN_TAG = `E2E${Date.now().toString(36).toUpperCase()}`;

/** Accepts "rgb(r, g, b)", "rgba(...)" and "#rrggbb". */
export function parseColor(css: string): [number, number, number] {
  const rgb = css.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  const hex = css.trim().replace("#", "");
  if (hex.length === 6) {
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
    ];
  }
  throw new Error(`Cannot parse colour: ${css}`);
}

/**
 * Contrast ratio between two colours, per WCAG 2.x.
 *
 * Implemented here rather than pulled from a package because it is fifteen
 * lines and it is the assertion the whole colour system rests on: RoadAxis
 * orange fails against white and passes against the brand ink, and every
 * primary button in the product depends on getting that the right way round.
 */
export function contrastRatio(a: string, b: string): number {
  const lum = (css: string) => {
    const [r, g, bl] = parseColor(css).map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const l1 = lum(a);
  const l2 = lum(b);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * The colour actually painted behind an element, as a browser-side function
 * body — one implementation, injected wherever it is needed.
 *
 * It is a string because Playwright serialises the function passed to
 * `page.evaluate` and cannot capture anything from this module's scope. Two
 * copies of this algorithm is exactly the drift that let a real failure hide:
 * the naive version stops at the first element with a `background-color` and
 * reports a warning badge — amber text on a 10% amber tint — as 1.00:1, a
 * catastrophe no user has ever seen, while a heading on a photographic hero is
 * measured against the *page* ground two hundred pixels away and reads 1.05:1.
 *
 * So: walk up, collect every layer, and composite them the way an eye does.
 */
export const GROUND_OF = `
  const layers = [];
  let node = el;
  while (node) {
    const bg = getComputedStyle(node).backgroundColor;
    const m = bg.match(/rgba?\\(\\s*([\\d.]+)[,\\s]+([\\d.]+)[,\\s]+([\\d.]+)(?:[,/\\s]+([\\d.]+))?/i);
    if (m) {
      const alpha = m[4] === undefined ? 1 : Number(m[4]);
      if (alpha > 0) {
        layers.push([Number(m[1]), Number(m[2]), Number(m[3]), alpha]);
        if (alpha >= 1) break;
      }
    }
    node = node.parentElement;
  }
  layers.push([255, 255, 255, 1]);
  let [r, g, b] = layers[layers.length - 1];
  for (let i = layers.length - 2; i >= 0; i--) {
    const [lr, lg, lb, la] = layers[i];
    r = lr * la + r * (1 - la);
    g = lg * la + g * (1 - la);
    b = lb * la + b * (1 - la);
  }
  return 'rgb(' + Math.round(r) + ', ' + Math.round(g) + ', ' + Math.round(b) + ')';
`;

/**
 * The contrast ratio of one element's text against what is really behind it.
 *
 * Use this rather than reading `document.body`'s background: the hero paints
 * white text on ink over a photograph, and a body-ground measurement of it
 * returns a number describing nothing that exists on the screen.
 */
export async function contrastOf(page: Page, selector: string): Promise<number> {
  const { color, background } = await page.evaluate(
    ({ sel, groundSource }) => {
      const el = document.querySelector(sel);
      if (!el) throw new Error(`No element matched ${sel}`);
      const groundOf = new Function("el", groundSource) as (e: Element) => string;
      return { color: getComputedStyle(el).color, background: groundOf(el) };
    },
    { sel: selector, groundSource: GROUND_OF },
  );
  return contrastRatio(color, background);
}

/** No route may scroll sideways. The most common mobile-layout failure there is. */
export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(
    overflow.scrollWidth,
    `page scrolls horizontally: ${overflow.scrollWidth}px of content in a ${overflow.clientWidth}px viewport`,
  ).toBeLessThanOrEqual(overflow.clientWidth + 1);
}

/**
 * The floor itself, in one place.
 *
 * It was 40 here while DESIGN.md said 44, which meant four pixels of the rule
 * were documented and not enforced — and the Phase 7 route sweep found real
 * controls living in exactly that gap. A threshold that differs from the stated
 * rule is worse than no threshold, because it is quoted as if it were the rule.
 */
export const TOUCH_FLOOR = 44;

/**
 * Every interactive control must clear the touch floor.
 *
 * Two exemptions, both principled rather than convenient:
 *
 *  - **A link inside a sentence.** WCAG success criterion 2.5.8 excludes
 *    targets "in a sentence or block of text", because the alternative is a
 *    44px-tall word wrecking the line it sits on. Only inline links qualify; a
 *    standalone control that happens to be an anchor gets no relief.
 *  - **Anything hidden from assistive technology.** A visually-hidden input
 *    driven by a real button beside it is not a target anybody can hit, and
 *    counting it produces a failure with no user behind it.
 */
export async function expectTouchTargets(page: Page, context = "") {
  const small = await page.evaluate((TOUCH_FLOOR) =>
    Array.from(document.querySelectorAll("button, a[href], input, select, textarea"))
      .filter((el) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) return false;
        if (el.closest('[aria-hidden="true"]') || el.getAttribute("aria-hidden") === "true") {
          return false;
        }
        if (el.tagName === "A" && getComputedStyle(el).display === "inline") return false;
        /**
         * A control wrapped in a label that is itself large enough.
         *
         * A 16px checkbox inside a 44px `<label>` has a 44px hit area — the
         * label is what receives the tap, which is the whole reason for
         * wrapping it. Measuring the input alone reports a failure with no
         * user behind it.
         */
        const label = el.closest("label");
        if (label) {
          const lr = label.getBoundingClientRect();
          if (lr.height >= TOUCH_FLOOR && lr.width >= TOUCH_FLOOR) return false;
        }
        return r.height < TOUCH_FLOOR || r.width < TOUCH_FLOOR;
      })
      .map(
        (el) =>
          `${el.tagName.toLowerCase()} "${el.textContent?.trim().slice(0, 24)}" ${Math.round(
            el.getBoundingClientRect().height,
          )}px`,
      ),
    TOUCH_FLOOR,
  );
  expect(
    small,
    `${context} controls below the ${TOUCH_FLOOR}px touch floor:\n${small.join("\n")}`,
  ).toEqual([]);
}

/** Switch theme through the header control, which is how a user does it. */
export async function setTheme(page: Page, theme: "light" | "dark") {
  const current = await page.evaluate(() =>
    document.documentElement.classList.contains("dark") ? "dark" : "light",
  );
  if (current === theme) return;
  await page.getByRole("button", { name: /switch to (light|dark) theme/i }).click();
  await expect
    .poll(() =>
      page.evaluate(() => (document.documentElement.classList.contains("dark") ? "dark" : "light")),
    )
    .toBe(theme);
}
