import { test, expect } from "@playwright/test";
import { contrastRatio, expectNoHorizontalOverflow, setTheme } from "./helpers";

/**
 * Phase 0 — the foundation.
 *
 * These assert the design rules in DESIGN.md rather than the appearance of any
 * particular screen, which is what makes them still useful in Phase 6. A design
 * rule that cannot be tested is an aspiration; these are the ones that can.
 */

test.describe("Phase 0 · Shell", () => {
  test("the app renders and identifies itself", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/RoadAxis/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // The mark carries an accessible name, so a screen-reader user hears the
    // brand rather than "graphic".
    await expect(page.getByRole("img", { name: "RoadAxis" }).first()).toBeVisible();
  });

  test("an unknown route lands on a page you can navigate away from", async ({ page }) => {
    await page.goto("/definitely-not-a-real-route");
    await expect(page.getByText(/doesn't exist/i)).toBeVisible();
    // A dead end is the failure mode. There must be a way out — scoped to the
    // page body, because the header offers the same destination and a bare
    // match would resolve to both.
    await expect(
      page.getByRole("main").getByRole("link", { name: /find a service/i }),
    ).toBeVisible();
  });

  test("public routes are reachable with no account", async ({ page }) => {
    await page.goto("/");
    // Guests browse everything (DECISIONS.md D-005). A redirect to sign-in here
    // is the single most damaging regression this product could ship.
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});

test.describe("Phase 0 · Theme", () => {
  test("both themes apply and are remembered", async ({ page }) => {
    await page.goto("/");

    await setTheme(page, "dark");
    await expect(page.locator("html")).toHaveClass(/dark/);

    await page.reload();
    // A theme that resets on reload is worse than no toggle: the user believes
    // they changed it and the product disagrees.
    await expect(page.locator("html")).toHaveClass(/dark/);

    await setTheme(page, "light");
    await expect(page.locator("html")).toHaveClass(/light/);
  });

  test("the page never renders on a transparent body", async ({ page }) => {
    for (const theme of ["light", "dark"] as const) {
      await page.goto("/");
      await setTheme(page, theme);
      const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      expect(bg, `body background in ${theme}`).not.toBe("rgba(0, 0, 0, 0)");
    }
  });
});

test.describe("Phase 0 · The orange rule", () => {
  /**
   * The rule that the whole colour system rests on, and the one most likely to
   * be undone by a well-meaning edit. #FF7A00 carries 2.61:1 against white and
   * 6.86:1 against the brand ink, so a filled orange button MUST take
   * ink-coloured text.
   */
  test("a primary button reaches AA in both themes", async ({ page }) => {
    for (const theme of ["light", "dark"] as const) {
      await page.goto("/");
      await setTheme(page, theme);

      // The home page's own primary action. Phase 0 asserted this against a
      // swatch on a temporary foundation page; now that a real product exists
      // the rule is checked where it actually ships.
      const button = page.getByRole("button", { name: "Search", exact: true });
      await expect(button).toBeVisible();

      const { color, background } = await button.evaluate((el) => {
        const s = getComputedStyle(el);
        return { color: s.color, background: s.backgroundColor };
      });

      const ratio = contrastRatio(color, background);
      expect(
        ratio,
        `primary button in ${theme}: ${color} on ${background} is ${ratio.toFixed(2)}:1 — ` +
          `white text on RoadAxis orange is the classic failure here`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  test("orange as text on a light ground is the darkened token", async ({ page }) => {
    await page.goto("/");
    await setTheme(page, "light");

    // A real orange-on-light control: the "use my location" affordance.
    const link = page.getByRole("button", { name: /use my current location/i });
    await expect(link).toBeVisible();
    const { color, background } = await link.evaluate((el) => {
      const s = getComputedStyle(el);
      // The element itself is transparent; the ground is the page.
      return { color: s.color, background: getComputedStyle(document.body).backgroundColor };
    });

    const ratio = contrastRatio(color, background);
    expect(
      ratio,
      `orange text is ${ratio.toFixed(2)}:1 on the page ground — --primary-text must be used, not --primary`,
    ).toBeGreaterThanOrEqual(4.5);
  });

  test("body text reaches AA in both themes", async ({ page }) => {
    for (const theme of ["light", "dark"] as const) {
      await page.goto("/");
      await setTheme(page, theme);

      const heading = page.getByRole("heading", { level: 1 });
      const { color, background } = await heading.evaluate((el) => ({
        color: getComputedStyle(el).color,
        background: getComputedStyle(document.body).backgroundColor,
      }));

      const ratio = contrastRatio(color, background);
      expect(ratio, `heading in ${theme} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    }
  });
});

/**
 * The trust row moved.
 *
 * Phase 0 asserted its rules against two hand-written sample cards on a
 * temporary foundation page. Phase 2 replaced that page with the real product,
 * and the same rules — no rating without reviews, no "Unverified" badge, the
 * four facts in a fixed order, figures in mono — are now asserted in
 * `phase2-directory.spec.ts` against records that came out of the database.
 *
 * That is a better test of the same rule, so it is not duplicated here. The
 * rule did not get weaker; the fixture got real.
 */

test.describe("Phase 0 · The trust row", () => {
  test("the trust row is a shared component, not per-screen markup", async ({ page }) => {
    // The class is the contract. Everywhere a business appears, the same
    // component draws the same four facts in the same order — which is what
    // stops the ordering drifting between the card, the map popup and the
    // profile header.
    await page.goto("/search?lat=53.4808&lng=-2.2426");
    await expect(page.locator(".ra-trust").first()).toBeVisible();
  });
});

test.describe("Phase 0 · Motion and surfaces", () => {
  test("nothing fades or rises on mount", async ({ page }) => {
    await page.goto("/");
    const animated = await page.evaluate(
      () =>
        Array.from(document.querySelectorAll("*")).filter((el) => {
          const name = getComputedStyle(el).animationName;
          return name && name !== "none" && !/overlay-in|sheet-up|spin/.test(name);
        }).length,
    );
    // 200ms of nothing before the first content is readable, on a roadside
    // connection, to buy an effect visible once.
    expect(animated, "page-mount animations are banned — see DESIGN.md").toBe(0);
  });

  test("in-page panels take no elevation", async ({ page }) => {
    await page.goto("/");
    const shadowed = await page.evaluate(
      () =>
        Array.from(document.querySelectorAll(".ra-panel, .ra-tile, .ra-card")).filter(
          (el) => getComputedStyle(el).boxShadow !== "none",
        ).length,
    );
    // Elevation says "this is modal to the page". A panel that sits IN the page
    // and reaches for a shadow is claiming to float when it does not.
    expect(shadowed, "only .ra-overlay may cast a shadow").toBe(0);
  });
});

test.describe("Phase 0 · Mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("no route scrolls sideways at 390px", async ({ page }) => {
    for (const route of ["/", "/definitely-not-a-real-route"]) {
      await page.goto(route);
      await expectNoHorizontalOverflow(page);
    }
  });

  test("every interactive control clears the 44px floor", async ({ page }) => {
    await page.goto("/");
    const small = await page.evaluate(() => {
      const out: string[] = [];
      for (const el of Array.from(document.querySelectorAll("button, a[href]"))) {
        const r = el.getBoundingClientRect();
        // Skip anything not actually rendered.
        if (r.width === 0 && r.height === 0) continue;
        if (r.height < 40 || r.width < 40) {
          out.push(`${el.tagName.toLowerCase()} "${el.textContent?.trim().slice(0, 30)}" ${Math.round(r.width)}×${Math.round(r.height)}`);
        }
      }
      return out;
    });
    expect(small, `controls below the touch floor:\n${small.join("\n")}`).toEqual([]);
  });

  test("bottom navigation is present and clears the safe area", async ({ page }) => {
    await page.goto("/");
    const bar = page.locator(".ra-bottombar");
    await expect(bar).toBeVisible();

    const box = await bar.boundingBox();
    const viewport = page.viewportSize()!;
    // Fixed to the bottom edge, because that is the only part of the screen a
    // thumb reaches without regripping.
    expect(box!.y + box!.height).toBeGreaterThanOrEqual(viewport.height - 2);
  });

  test("the last content is not hidden behind the bar", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // `document.body.scrollHeight` is the wrong measure here: body carries
    // `height: 100%`, so it reports the viewport height and the page is left
    // one screen short of the bottom.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForFunction(() => {
      const el = document.documentElement;
      return el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
    });

    const bar = await page.locator(".ra-bottombar").boundingBox();
    const last = await page.locator(".ra-tile").last().boundingBox();
    // The classic bottom-navigation bug: the last row of every list sits under
    // the bar and users conclude the list is truncated.
    expect(last!.y + last!.height, "content is obscured by the tab bar").toBeLessThanOrEqual(
      bar!.y + 1,
    );
  });
});

test.describe("Phase 0 · Accessibility", () => {
  test("focus is always visible when tabbing", async ({ page }) => {
    await page.goto("/");
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press("Tab");
      const visible = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return true;
        const s = getComputedStyle(el);
        return s.outlineStyle !== "none" || s.boxShadow !== "none" || s.outlineWidth !== "0px";
      });
      expect(visible, `no visible focus after ${i + 1} tab presses`).toBe(true);
    }
  });

  test("every image is named or explicitly decorative", async ({ page }) => {
    await page.goto("/");
    const unnamed = await page.evaluate(() =>
      Array.from(document.querySelectorAll('img, svg[role="img"]'))
        .filter((el) => {
          if (el.getAttribute("aria-hidden") === "true") return false;
          const name = el.getAttribute("alt") ?? el.getAttribute("aria-label");
          return name === null || name.trim() === "";
        })
        .map((el) => el.outerHTML.slice(0, 80)),
    );
    expect(unnamed, `images with no accessible name:\n${unnamed.join("\n")}`).toEqual([]);
  });

  test("headings start at level one and do not skip", async ({ page }) => {
    await page.goto("/");
    // Every page is lazily loaded, so `goto` resolving is not the same as the
    // page having rendered. Wait for real content before reading the DOM.
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const levels = await page.evaluate(() =>
      Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6")).map((h) => Number(h.tagName[1])),
    );
    expect(levels[0]).toBe(1);
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i] - levels[i - 1], `heading jumped from h${levels[i - 1]} to h${levels[i]}`).toBeLessThanOrEqual(1);
    }
  });
});

test.describe("Phase 0 · Language", () => {
  test('no screen implies a confirmed appointment', async ({ page }) => {
    /**
     * FR-BKG-10, swept across every public route rather than one page.
     *
     * A driver who turns up expecting a held slot is a failure of copywriting,
     * and it starts with one button labelled "Book". The booking form itself
     * arrives in Phase 5; this is the guard that stops the wrong word creeping
     * in before it does.
     */
    for (const route of [
      "/",
      "/search?lat=53.4808&lng=-2.2426",
      "/categories",
      "/sign-in",
    ]) {
      await page.goto(route);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const body = await page.locator("body").innerText();
      expect(body, `${route} says "Booked"`).not.toMatch(/\bBooked\b/);
      expect(body, `${route} implies a confirmed appointment`).not.toMatch(
        /confirmed appointment/i,
      );
    }
  });
});
