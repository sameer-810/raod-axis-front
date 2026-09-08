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
