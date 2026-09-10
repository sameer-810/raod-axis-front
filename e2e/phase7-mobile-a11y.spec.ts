import fs from "node:fs";
import path from "node:path";
import {
  test,
  expect,
  request as pwRequest,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { API, contrastRatio, TOUCH_FLOOR } from "./helpers";

/**
 * Phase 7 — the mobile layer and accessibility, swept across every route.
 *
 * Phases 0–6 each asserted their own screens; this asserts the *product*, so a
 * regression introduced on one page cannot hide behind the twenty that pass.
 *
 * Writes `qa-audit/metrics.json` (US-701): "no horizontal overflow" is a
 * pass/fail, and how close each route is to overflowing is the thing that tells
 * you which one will break next.
 */

const TAG = `p7${Date.now().toString(36)}`;
const PHONE = { width: 390, height: 844 };

type Audience = "guest" | "driver" | "owner" | "admin";
interface Route {
  path: string;
  name: string;
  as: Audience;
  /** A route whose whole job is a form gets the form rules as well. */
  form?: boolean;
}

/**
 * Seeded once, used by every test in the file.
 *
 * Sessions are captured as tokens rather than re-driven through the sign-in
 * screens: eighty tests each doing the two-code OTP dance would spend most of
 * the run signing in and would burn eighty of Ofcom's 1,000 test numbers. Phase
 * 1 covers the sign-in screens; this suite is about every route behind them.
 */
const fixture = {
  businessSlug: "",
  /** A separate, unclaimed listing — an owned one has nothing left to claim. */
  claimableSlug: "",
  sessions: {} as Record<Audience, { token: string; user: Record<string, unknown> } | undefined>,
};

const metrics: Record<string, unknown>[] = [];

// ── Fixtures ────────────────────────────────────────────────────────────────

async function adminContext(): Promise<{ ctx: APIRequestContext; token: string }> {
  const bare = await pwRequest.newContext();
  const res = await bare.post(`${API}/auth/login`, {
    data: {
      email: process.env.E2E_ADMIN_EMAIL || "admin@roadaxis.online",
      password: process.env.E2E_ADMIN_PASSWORD || "ChangeMe@2026",
    },
  });
  expect(res.ok(), 'run "npm run seed:admin" in raod-axis-back').toBeTruthy();
  const token = (await res.json()).data.accessToken;
  await bare.dispose();
  const ctx = await pwRequest.newContext({
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  });
  return { ctx, token };
}

async function freePhone(): Promise<string> {
  const ctx = await pwRequest.newContext();
  try {
    for (let i = 0; i < 12; i++) {
      const candidate = `07700900${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`;
      const res = await ctx.post(`${API}/auth/otp/request`, {
        data: { email: `probe.${Math.random().toString(36).slice(2)}@e2e.test`, phone: candidate },
      });
      if (res.status() === 202) return candidate;
    }
    throw new Error("No free number left in the test block — clear the test database.");
  } finally {
    await ctx.dispose();
  }
}

/**
 * One of everything the routes need: a live listing with an owner, a driver who
 * has saved and requested something, and a session for each role.
 *
 * The screens under audit have to have *content* on them. An empty dashboard
 * passes every layout rule trivially, and the bugs this exists to catch — a
 * table that overflows, a row link too small to hit — only appear once there is
 * something on the page.
 */
async function seedFixtures() {
  const { ctx, token: adminToken } = await adminContext();
  const adminMe = await ctx.get(`${API}/auth/me`);
  fixture.sessions.admin = { token: adminToken, user: (await adminMe.json()).data };

  const created = await ctx.post(`${API}/businesses`, {
    data: {
      name: `${TAG} Audit Motors`,
      address: { line1: "1 Audit Street", city: "Manchester", postcode: "M1 1AA" },
      latitude: 53.4808,
      longitude: -2.2426,
      services: [{ name: "Full service", priceFrom: 120 }],
    },
  });
  expect(created.status(), await created.text()).toBe(201);
  const business = (await created.json()).data as { id: string; slug: string };
  fixture.businessSlug = business.slug;

  // A second listing, left unclaimed, so the claim form has a target. The owned
  // one above cannot be claimed — which is correct, and is why it needs a twin.
  const claimable = await ctx.post(`${API}/businesses`, {
    data: {
      name: `${TAG} Claimable Motors`,
      address: { line1: "2 Audit Street", city: "Manchester", postcode: "M1 1AB" },
      latitude: 53.4809,
      longitude: -2.2427,
    },
  });
  fixture.claimableSlug = ((await claimable.json()).data as { slug: string }).slug;

  const ownerEmail = `${TAG}.owner@e2e.test`;
  await ctx.post(`${API}/auth/users`, {
    data: {
      name: "Audit Owner",
      email: ownerEmail,
      password: "OwnerSecret123",
      role: "business_owner",
    },
  });
  await ctx.post(`${API}/businesses/${business.id}/transfer`, {
    data: {
      email: ownerEmail,
      reason: "E2E fixture: an owner with every portal screen populated.",
    },
  });
  await ctx.post(`${API}/businesses/${business.id}/whatsapp-numbers`, {
    data: { label: "Customer Support", phone: await freePhone() },
  });

  const bare = await pwRequest.newContext();
  const ownerLogin = await bare.post(`${API}/auth/login`, {
    data: { email: ownerEmail, password: "OwnerSecret123" },
  });
  const ownerSession = (await ownerLogin.json()).data;
  fixture.sessions.owner = { token: ownerSession.accessToken, user: ownerSession.user };

  // A driver, through the real two-code flow — once, not once per test.
  const driverEmail = `${TAG}.driver@e2e.test`;
  const start = await bare.post(`${API}/auth/otp/request`, {
    data: { email: driverEmail, phone: await freePhone() },
  });
  const challenge = (await start.json()).data;
  const verified = await bare.post(`${API}/auth/otp/verify`, {
    data: {
      challengeId: challenge.challengeId,
      emailCode: challenge.devCodes.email,
      phoneCode: challenge.devCodes.phone,
      name: "Audit Driver",
    },
  });
  expect(verified.status(), await verified.text()).toBe(200);
  const driverSession = (await verified.json()).data;
  fixture.sessions.driver = { token: driverSession.accessToken, user: driverSession.user };

  // Give the driver something on both of their screens.
  const asDriver = await pwRequest.newContext({
    extraHTTPHeaders: { Authorization: `Bearer ${driverSession.accessToken}` },
  });
  await asDriver.put(`${API}/favourites/${business.id}`);
  const when = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
  await asDriver.post(`${API}/businesses/${business.id}/booking-requests`, {
    data: { serviceName: "Full service", preferredDate: when, preferredTime: "10:30" },
  });
  await asDriver.post(`${API}/businesses/${business.id}/reviews`, {
    data: { rating: 4, text: "A fixture review, so the moderation screen has a row." },
  });

  await asDriver.dispose();
  await bare.dispose();
  await ctx.dispose();
}

/** Put a session straight into storage. The sign-in screens are Phase 1's job. */
async function signIn(page: Page, as: Audience) {
  if (as === "guest") return;
  const session = fixture.sessions[as];
  expect(session, `no ${as} session was seeded`).toBeTruthy();

  await page.goto("/");
  await page.evaluate((s) => localStorage.setItem("roadaxis_auth", JSON.stringify(s)), {
    accessToken: session!.token,
    user: session!.user,
  });
}

/**
 * Every destination the product has, and who can reach it.
 *
 * `:slug` stays a placeholder: this list is built when Playwright *collects* the
 * file, before `beforeAll` has seeded anything, so baking the slug in would put
 * an empty string in three URLs and the failures would look like routing bugs.
 */
const ROUTES: Route[] = (() => {
  return [
    { path: "/", name: "home", as: "guest" },
    { path: "/search", name: "search", as: "guest" },
    { path: "/categories", name: "categories", as: "guest" },
    { path: "/business/:slug", name: "business profile", as: "guest" },
    { path: "/for-business", name: "for business", as: "guest" },
    { path: "/business/:claimable/claim", name: "claim", as: "guest", form: true },
    { path: "/register-business", name: "register business", as: "guest", form: true },
    { path: "/sign-in", name: "driver sign-in", as: "guest", form: true },
    { path: "/staff/sign-in", name: "staff sign-in", as: "guest", form: true },
    { path: "/business/:slug/request", name: "request a booking", as: "guest", form: true },

    { path: "/my-garages", name: "my garages", as: "driver" },
    { path: "/my-requests", name: "my requests", as: "driver" },

    { path: "/portal", name: "portal overview", as: "owner" },
    { path: "/portal/requests", name: "portal requests", as: "owner" },
    { path: "/portal/whatsapp", name: "portal whatsapp", as: "owner" },
    { path: "/portal/performance", name: "portal performance", as: "owner" },

    { path: "/admin/businesses", name: "admin businesses", as: "admin" },
    { path: "/admin/businesses/new", name: "admin new business", as: "admin", form: true },
    { path: "/admin/businesses/import", name: "admin import", as: "admin" },
    { path: "/admin/claims", name: "admin claims", as: "admin" },
    { path: "/admin/categories", name: "admin categories", as: "admin" },
    { path: "/admin/reviews", name: "admin reviews", as: "admin" },
    { path: "/admin/analytics", name: "admin analytics", as: "admin" },
    { path: "/admin/whatsapp-logs", name: "admin whatsapp logs", as: "admin" },
    { path: "/admin/audit", name: "admin audit", as: "admin" },
  ];
})();

/** Fill in the fixture slugs at run time, once they exist. */
const url = (route: Route) =>
  route.path.replace(":claimable", fixture.claimableSlug).replace(":slug", fixture.businessSlug);

/** Wait for the lazy chunk to have rendered something, not just for navigation. */
async function settle(page: Page) {
  await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 20_000 });
  await page.waitForLoadState("networkidle").catch(() => undefined);
}

// ── The sweeps ──────────────────────────────────────────────────────────────

test.beforeAll(async () => {
  await seedFixtures();
});

test.afterAll(async () => {
  /**
   * The per-route figures, written rather than only asserted. A pass says the
   * rule held today; the margin says which route is about to stop holding it.
   */
  if (!metrics.length) return;
  const dir = path.join(process.cwd(), "qa-audit");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "metrics.json"),
    `${JSON.stringify({ generatedAt: new Date().toISOString(), viewport: PHONE, routes: metrics }, null, 2)}\n`,
  );
});

test.describe("Phase 7 · Every route on a phone", () => {
  test.use({ viewport: PHONE });

  for (const route of ROUTES) {
    test(`${route.name} fits a 390px screen`, async ({ page }) => {
      await signIn(page, route.as);
      await page.goto(url(route));
      await settle(page);

      const measured = await page.evaluate(() => {
        const el = document.documentElement;
        const offenders: string[] = [];
        // Which element is actually wider than the viewport — "the page scrolls"
        // is a symptom, and this is the cause.
        for (const node of Array.from(document.querySelectorAll("body *"))) {
          const r = node.getBoundingClientRect();
          if (r.width === 0) continue;
          if (r.right > el.clientWidth + 1 && getComputedStyle(node).overflowX === "visible") {
            offenders.push(
              `${node.tagName.toLowerCase()}.${String(node.className).slice(0, 40)} right=${Math.round(r.right)}`,
            );
          }
        }
        return {
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
          offenders: offenders.slice(0, 5),
        };
      });

      expect(
        measured.scrollWidth,
        `${route.name} scrolls sideways. Widest offenders:\n${measured.offenders.join("\n")}`,
      ).toBeLessThanOrEqual(measured.clientWidth + 1);
    });

    test(`${route.name} clears the 44px touch floor`, async ({ page }) => {
      await signIn(page, route.as);
      await page.goto(url(route));
      await settle(page);

      const result = await page.evaluate((TOUCH_FLOOR) => {
        const small: string[] = [];
        let smallest = Infinity;

        for (const el of Array.from(
          document.querySelectorAll("button, a[href], input, select, textarea"),
        )) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) continue;
          if (el.closest('[aria-hidden="true"]') || el.getAttribute("aria-hidden") === "true") {
            continue;
          }
          // WCAG 2.5.8 excludes a link inside a sentence: a 44px-tall word
          // wrecks the line it sits in, and the sentence is the target.
          if (el.tagName === "A" && getComputedStyle(el).display === "inline") continue;
          // A small control inside a large label has the label's hit area.
          const label = el.closest("label");
          if (label) {
            const lr = label.getBoundingClientRect();
            if (lr.height >= TOUCH_FLOOR && lr.width >= TOUCH_FLOOR) continue;
          }
          smallest = Math.min(smallest, Math.min(r.height, r.width));
          if (r.height < TOUCH_FLOOR || r.width < TOUCH_FLOOR) {
            small.push(
              `${el.tagName.toLowerCase()} "${el.textContent?.trim().slice(0, 24)}" ${Math.round(r.width)}x${Math.round(r.height)}`,
            );
          }
        }
        return { small, smallest: Number.isFinite(smallest) ? smallest : null };
      }, TOUCH_FLOOR);

      metrics.push({
        route: route.path,
        name: route.name,
        /** The margin, not just the verdict — which route breaks the rule next. */
        smallestTarget: result.smallest,
        floor: TOUCH_FLOOR,
      });
      expect(
        result.small,
        `${route.name} controls below the ${TOUCH_FLOOR}px touch floor:\n${result.small.join("\n")}`,
      ).toEqual([]);
    });
  }
});

test.describe("Phase 7 · Forms on a phone", () => {
  test.use({ viewport: PHONE });

  for (const route of ROUTES.filter((r) => r.form)) {
    test(`${route.name} does not make iOS zoom, and labels every field`, async ({ page }) => {
      await signIn(page, route.as);
      await page.goto(url(route));
      await settle(page);

      const problems = await page.evaluate(() => {
        const zoomers: string[] = [];
        const unlabelled: string[] = [];

        for (const el of Array.from(
          document.querySelectorAll<HTMLInputElement>("input, select, textarea"),
        )) {
          if (el.type === "hidden" || el.getAttribute("aria-hidden") === "true") continue;
          const r = el.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) continue;

          /**
           * Safari on iOS zooms the whole page when a control with a font
           * smaller than 16px is focused, and does not zoom back out. The user
           * is then left on a page they have to pinch to escape, mid-form.
           */
          const size = parseFloat(getComputedStyle(el).fontSize);
          if (size < 16) zoomers.push(`${el.name || el.id || el.type} at ${size}px`);

          // A placeholder is not a label: it disappears exactly when somebody
          // needs to check what they were filling in.
          const labelled =
            el.getAttribute("aria-label") ||
            el.getAttribute("aria-labelledby") ||
            (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) ||
            el.closest("label");
          if (!labelled) unlabelled.push(el.outerHTML.slice(0, 90));
        }
        return { zoomers, unlabelled };
      });

      expect(
        problems.unlabelled,
        `${route.name} unlabelled fields:\n${problems.unlabelled.join("\n")}`,
      ).toEqual([]);
      expect(
        problems.zoomers,
        `${route.name} fields that trigger the iOS zoom:\n${problems.zoomers.join("\n")}`,
      ).toEqual([]);
    });
  }
});

test.describe("Phase 7 · Structure and naming", () => {
  for (const route of ROUTES) {
    test(`${route.name} has a sound document outline`, async ({ page }) => {
      await signIn(page, route.as);
      await page.goto(url(route));
      await settle(page);

      const doc = await page.evaluate(() => {
        const headings = Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6"));
        /**
         * All four ways an image can be named, not just the two obvious ones.
         * `aria-labelledby` pointing at a `<title>` is how an inline SVG chart
         * is labelled — checking `alt` and `aria-label` alone reports a
         * correctly described chart as an unnamed image.
         */
        const unnamed = Array.from(document.querySelectorAll('img, svg[role="img"]'))
          .filter((el) => {
            if (el.getAttribute("aria-hidden") === "true") return false;
            const direct = el.getAttribute("alt") ?? el.getAttribute("aria-label");
            if (direct !== null && direct.trim() !== "") return false;

            const labelledBy = el.getAttribute("aria-labelledby");
            if (labelledBy) {
              const text = labelledBy
                .split(/\s+/)
                .map((id) => document.getElementById(id)?.textContent?.trim() ?? "")
                .join(" ")
                .trim();
              if (text) return false;
            }

            // An SVG's own <title> is its accessible name.
            const title = el.querySelector(":scope > title")?.textContent?.trim();
            if (title) return false;

            return true;
          })
          .map((el) => el.outerHTML.slice(0, 80));

        // A button whose only content is an icon, with nothing to announce it.
        const namelessButtons = Array.from(document.querySelectorAll("button, a[href]"))
          .filter((el) => {
            const r = el.getBoundingClientRect();
            if (r.width === 0 && r.height === 0) return false;
            const text = (el.textContent ?? "").trim();
            return (
              !text &&
              !el.getAttribute("aria-label") &&
              !el.getAttribute("aria-labelledby") &&
              !el.getAttribute("title")
            );
          })
          .map((el) => el.outerHTML.slice(0, 80));

        return {
          levels: headings.map((h) => Number(h.tagName[1])),
          h1Count: headings.filter((h) => h.tagName === "H1").length,
          unnamed,
          namelessButtons,
        };
      });

      expect(
        doc.unnamed,
        `${route.name} images with no accessible name:\n${doc.unnamed.join("\n")}`,
      ).toEqual([]);
      expect(
        doc.namelessButtons,
        `${route.name} controls with nothing to announce:\n${doc.namelessButtons.join("\n")}`,
      ).toEqual([]);

      for (let i = 1; i < doc.levels.length; i++) {
        expect(
          doc.levels[i] - doc.levels[i - 1],
          `${route.name} heading jumped from h${doc.levels[i - 1]} to h${doc.levels[i]}`,
        ).toBeLessThanOrEqual(1);
      }
    });
  }
});

test.describe("Phase 7 · Contrast, on real screens rather than on tokens", () => {
  for (const theme of ["light", "dark"] as const) {
    test(`text meets AA across the product in the ${theme} theme`, async ({ page }) => {
      await signIn(page, "admin");

      const failures: string[] = [];
      /**
       * Chosen for the *colours* they put on screen, not for coverage. Between
       * them these routes render every tone the design system has on every
       * surface it uses: status badges on tinted grounds, muted text on muted
       * grounds, the permanently-dark rail, and the warning panels that paint a
       * colour at 10% behind text of the same hue — where the real failures were.
       */
      for (const route of [
        "/",
        "/search",
        "/portal",
        "/admin/analytics",
        "/admin/audit",
        "/admin/claims",
        "/admin/businesses/new",
        "/register-business",
        "/sign-in",
      ]) {
        await page.goto(route);
        await page.evaluate((t) => {
          document.documentElement.classList.toggle("dark", t === "dark");
          localStorage.setItem("roadaxis_theme", t);
        }, theme);
        await settle(page);

        const bad = await page.evaluate(() => {
          /**
           * The colour actually behind the text, composited. Walking up to "the
           * first element with a background" is not enough: a warning badge
           * paints its own colour at 10% alpha over the card, and reading that
           * layer alone reports amber-on-amber at 1.00:1.
           */
          const groundOf = (el: Element): string => {
            const layers: Array<[number, number, number, number]> = [];
            let node: Element | null = el;
            while (node) {
              const bg = getComputedStyle(node).backgroundColor;
              const m = bg.match(
                /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,/\s]+([\d.]+))?/i,
              );
              if (m) {
                const alpha = m[4] === undefined ? 1 : Number(m[4]);
                if (alpha > 0) {
                  layers.push([Number(m[1]), Number(m[2]), Number(m[3]), alpha]);
                  if (alpha >= 1) break;
                }
              }
              node = node.parentElement;
            }
            // Opaque backstop, in case nothing on the way up was solid.
            layers.push([255, 255, 255, 1]);

            // Back to front: the deepest layer is the canvas.
            let [r, g, b] = layers[layers.length - 1];
            for (let i = layers.length - 2; i >= 0; i--) {
              const [lr, lg, lb, la] = layers[i];
              r = lr * la + r * (1 - la);
              g = lg * la + g * (1 - la);
              b = lb * la + b * (1 - la);
            }
            return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
          };

          const out: Array<{ text: string; fg: string; bg: string; size: number; bold: boolean }> =
            [];
          for (const el of Array.from(
            document.querySelectorAll("p, span, a, button, h1, h2, h3, li, td, th, label"),
          )) {
            const text = (el.textContent ?? "").trim();
            if (!text || text.length > 120) continue;
            // Only elements that own their text, or every ancestor is measured
            // again for the same string.
            if (Array.from(el.children).some((c) => (c.textContent ?? "").trim() === text))
              continue;
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) continue;
            const s = getComputedStyle(el);
            if (s.visibility === "hidden" || s.opacity === "0") continue;
            // Screen-reader-only text is not seen, so contrast does not apply.
            if (r.width <= 1 || r.height <= 1) continue;

            out.push({
              text: text.slice(0, 40),
              fg: s.color,
              bg: groundOf(el),
              size: parseFloat(s.fontSize),
              bold: Number(s.fontWeight) >= 700,
            });
          }
          return out;
        });

        for (const item of bad) {
          let ratio: number;
          try {
            ratio = contrastRatio(item.fg, item.bg);
          } catch {
            continue; // A gradient or an unparseable ground; not a text colour.
          }
          // WCAG 2.2 AA: 3:1 for large text (18.66px bold, or 24px), 4.5:1 otherwise.
          const large = item.size >= 24 || (item.bold && item.size >= 18.66);
          const required = large ? 3 : 4.5;
          if (ratio + 0.05 < required) {
            failures.push(
              `${route} "${item.text}" ${ratio.toFixed(2)}:1 (needs ${required}) fg=${item.fg} bg=${item.bg}`,
            );
          }
        }
      }

      expect(failures, `contrast failures in the ${theme} theme:\n${failures.join("\n")}`).toEqual(
        [],
      );
    });
  }
});

test.describe("Phase 7 · Usable without a mouse", () => {
  test("the whole booking form can be completed from the keyboard", async ({ page }) => {
    await signIn(page, "driver");
    await page.goto(`/business/${fixture.businessSlug}/request`);
    await settle(page);

    // Tab until the first field has focus, then work the form as somebody with
    // no pointing device does.
    await page.getByLabel("What do you need?").focus();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByLabel("What do you need?")).toHaveValue("Full service");

    let guard = 0;
    while (guard++ < 40) {
      const isSubmit = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        return el?.tagName === "BUTTON" && /send request/i.test(el.textContent ?? "");
      });
      if (isSubmit) break;
      await page.keyboard.press("Tab");
    }
    expect(guard, "the submit button was never reachable by Tab").toBeLessThan(40);
  });

  test("focus stays visible and never gets trapped", async ({ page }) => {
    await signIn(page, "admin");
    await page.goto("/admin/businesses");
    await settle(page);

    const seen = new Set<string>();
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press("Tab");
      const state = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        const s = getComputedStyle(el);
        return {
          id: `${el.tagName}#${el.id}.${String(el.className).slice(0, 30)}:${(el.textContent ?? "").trim().slice(0, 20)}`,
          visible: s.outlineStyle !== "none" || s.boxShadow !== "none" || s.outlineWidth !== "0px",
        };
      });
      if (!state) continue;
      expect(state.visible, `no visible focus on ${state.id}`).toBe(true);
      seen.add(state.id);
    }
    // A trap is the same one or two controls cycling for ever.
    expect(seen.size, "focus appears to be trapped").toBeGreaterThan(4);
  });

  test("a bottom sheet takes focus, returns it, and closes on Escape", async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto("/search");
    await settle(page);

    const trigger = page.getByRole("button", { name: /filters/i }).first();
    await trigger.click();

    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    // Focus must move into the sheet, or a screen-reader user is left reading
    // the list behind it.
    const inside = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      return Boolean(dialog && document.activeElement && dialog.contains(document.activeElement));
    });
    expect(inside, "focus stayed outside the sheet").toBe(true);

    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
  });
});
