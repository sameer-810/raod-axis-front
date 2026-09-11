import { test, expect, request as pwRequest, type Page } from "@playwright/test";
import { API, expectNoHorizontalOverflow } from "./helpers";

/**
 * Phase 2 — discovery, through the real interface.
 *
 * Everything here runs as a **guest**: a discovery marketplace that asks you to
 * sign in before you can look has no discovery in it.
 *
 * Requires the demo directory:
 *   cd raod-axis-back && npm run seed:categories && npm run seed:demo
 */

/** Manchester city centre, which the demo data is spread around. */
const CENTRE = { lat: 53.4808, lng: -2.2426 };
const NEAR = `?lat=${CENTRE.lat}&lng=${CENTRE.lng}`;

async function adminToken() {
  const ctx = await pwRequest.newContext();
  const res = await ctx.post(`${API}/auth/login`, {
    data: {
      email: process.env.E2E_ADMIN_EMAIL || "admin@roadaxis.online",
      password: process.env.E2E_ADMIN_PASSWORD || "ChangeMe@2026",
    },
  });
  expect(res.ok(), 'run "npm run seed:admin" in raod-axis-back').toBeTruthy();
  const token = (await res.json()).data.accessToken;
  await ctx.dispose();
  return token;
}

/**
 * Reach the filter controls, wherever this viewport keeps them. Desktop renders
 * them inline above the results; below `md` they move into a sheet behind a
 * Filters button. A test that clicks them directly passes on one profile and
 * fails on the other, which is a property of the test rather than the product.
 */
async function withFilters(page: Page, act: () => Promise<void>) {
  // Settle first. `isVisible()` is a synchronous snapshot with no waiting in
  // it, so asking before the page has rendered answers "no sheet here" and the
  // test then hunts for controls that are still behind one.
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  const openSheet = page.getByRole("button", { name: /^filters/i });
  const isSheet = await openSheet.isVisible().catch(() => false);

  if (isSheet) await openSheet.click();
  await act();
  if (isSheet) await page.getByRole("button", { name: /show \d+ results/i }).click();
}

/** Sign in as an administrator by seeding storage — the auth flow is Phase 1's job. */
async function signInAsAdmin(page: Page) {
  const token = await adminToken();
  await page.goto("/");
  await page.evaluate(
    ([t]) =>
      localStorage.setItem(
        "roadaxis_auth",
        JSON.stringify({
          accessToken: t,
          user: { id: "admin", name: "Admin", email: "a@b.c", role: "admin" },
        }),
      ),
    [token],
  );
}

test.describe("Phase 2 · The home page is the search page", () => {
  test("no marketing wall stands between a driver and the search box", async ({ page }) => {
    await page.goto("/");
    // Nothing between someone with a flat tyre and the list of tyre shops.
    await expect(page.getByLabel("What do you need?")).toBeVisible();
    await expect(page.getByLabel("Where?")).toBeVisible();
    await expect(page.getByRole("button", { name: "Search" })).toBeVisible();
  });

  test("services are reachable in the first screenful", async ({ page }) => {
    await page.goto("/");
    /*
      A prefix match, not an exact one. These are tiles now rather than chips and
      each carries its own count — "Tyres 11 places" — which is why the tile is
      better: it says in advance whether tapping it is worth the tap.
    */
    const tile = page.getByRole("link", { name: /^Tyres\b/ });
    await expect(tile).toBeVisible();
    const box = await tile.boundingBox();
    const viewport = page.viewportSize()!;
    // Tapping a service is faster than typing one, and is what most arrivals
    // actually want — so it cannot be far below the fold.
    expect(box!.y, "the services grid is below the fold").toBeLessThan(viewport.height * 1.3);
  });

  test("searching from home carries the query into the results", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("What do you need?").fill("tyre");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page).toHaveURL(/\/search\?.*q=tyre/);
  });
});

test.describe("Phase 2 · Search", () => {
  test("a guest sees results with no account", async ({ page }) => {
    await page.goto(`/search${NEAR}`);
    await expect(page.getByRole("heading", { name: /find a garage/i })).toBeVisible();
    await expect(page.locator("article").first()).toBeVisible();
    await expect(page).not.toHaveURL(/sign-in/);
  });

  test("results are nearest first and carry a distance", async ({ page }) => {
    await page.goto(`/search${NEAR}&radius=5000`);
    await expect(page.locator("article").first()).toBeVisible();

    // Read the raw value rather than parsing the rendered string: the unit and
    // the rounding are display decisions that can change without the ordering
    // being wrong, and a test that breaks on those is testing the wrong thing.
    const distances = await page.evaluate(() =>
      Array.from(document.querySelectorAll("article [data-distance-metres]")).map((el) =>
        Number(el.getAttribute("data-distance-metres")),
      ),
    );
    expect(distances.length, "no card showed a distance").toBeGreaterThan(1);
    for (let i = 1; i < distances.length; i++) {
      expect(distances[i], `card ${i} is closer than card ${i - 1}`).toBeGreaterThanOrEqual(
        distances[i - 1] - 1,
      );
    }
  });

  test("every filter lands in the URL and survives a reload", async ({ page }) => {
    await page.goto(`/search${NEAR}`);
    await withFilters(page, async () => {
      await page.getByRole("button", { name: "Open now" }).click();
      await page.getByRole("button", { name: "Verified" }).click();
    });

    await expect(page).toHaveURL(/openNow=true/);
    await expect(page).toHaveURL(/verified=true/);

    // FR-DIS-09: a search you cannot send to a friend is one you rebuild every
    // time. The URL is the state, so a reload must restore it exactly.
    await page.reload();
    await withFilters(page, async () => {
      await expect(page.getByRole("button", { name: "Open now" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await expect(page.getByRole("button", { name: "Verified" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    });
  });

  test("Back undoes a filter", async ({ page }) => {
    await page.goto(`/search${NEAR}`);
    await expect(page.locator("article").first()).toBeVisible();
    await withFilters(page, async () => {
      await page.getByRole("button", { name: "Verified" }).click();
    });
    await expect(page).toHaveURL(/verified=true/);

    await page.goBack();
    // The browser's history is the undo stack, which is what putting filter
    // state in the URL buys.
    await expect(page).not.toHaveURL(/verified=true/);
  });

  test("the verified filter actually narrows the list", async ({ page }) => {
    await page.goto(`/search${NEAR}&radius=20000`);
    await expect(page.locator("article").first()).toBeVisible();
    const before = await page.locator("article").count();

    await withFilters(page, async () => {
      await page.getByRole("button", { name: "Verified" }).click();
    });
    await expect(page).toHaveURL(/verified=true/);
    await expect(page.locator("article").first()).toBeVisible();
    const after = await page.locator("article").count();

    expect(after).toBeLessThanOrEqual(before);
    // Every remaining card must carry the badge it was filtered on.
    const cards = page.locator("article");
    for (let i = 0; i < (await cards.count()); i++) {
      await expect(cards.nth(i).getByText("Verified")).toBeVisible();
    }
  });

  test("a search matching nothing explains itself and offers a way out", async ({ page }) => {
    await page.goto(`/search${NEAR}&q=zzzqqqnothingatall`);
    // An empty result on the highest-leverage screen in the product is where a
    // session ends unless it says why and what to do next.
    await expect(page.getByText(/nothing here yet/i)).toBeVisible();
    await expect(
      page
        .getByRole("button", { name: /search within/i })
        .or(page.getByRole("button", { name: /clear filters/i })),
    ).toBeVisible();
  });

  test("widening the radius from the empty state recovers results", async ({ page }) => {
    await page.goto(`/search${NEAR}&radius=500&category=recovery`);
    const widen = page.getByRole("button", { name: /search within/i });
    if (await widen.isVisible().catch(() => false)) {
      await widen.click();
      await expect(page).toHaveURL(/radius=10000/);
    }
  });

  test("the result count is announced, not just shown", async ({ page }) => {
    await page.goto(`/search${NEAR}`);
    const count = page.locator("[aria-live='polite']").filter({ hasText: /business/i });
    await expect(count.first()).toBeVisible();
  });
});

test.describe("Phase 2 · Location is offered, never demanded", () => {
  test("the search works with no location at all", async ({ page }) => {
    await page.goto("/search");
    await expect(page.locator("article").first()).toBeVisible();
    // FR-DIS-05: a declined permission must not produce an empty screen.
    await expect(page.getByLabel("Town or postcode")).toBeVisible();
  });

  test("a postcode is geocoded into a radius search", async ({ page }) => {
    await page.goto("/search");
    await page.getByLabel("Town or postcode").fill("M1 1LN");
    await page.getByLabel("Town or postcode").press("Enter");

    await expect(page).toHaveURL(/lat=53\./, { timeout: 20_000 });
    await expect(page.getByText(/within/i).first()).toBeVisible();
  });

  test("an unfindable place says so and leaves search working", async ({ page }) => {
    await page.goto("/search");
    await page.getByLabel("Town or postcode").fill("zzzznotaplace");
    await page.getByLabel("Town or postcode").press("Enter");

    await expect(page.getByRole("alert")).toBeVisible({ timeout: 20_000 });
    // Losing the radius filter is a far smaller failure than losing the site.
    await expect(page.locator("article").first()).toBeVisible();
  });

  test("clearing the location returns to a nationwide search", async ({ page }) => {
    await page.goto(`/search${NEAR}`);
    await page.getByRole("button", { name: "Change" }).click();
    await expect(page).not.toHaveURL(/lat=/);
    await expect(page.getByLabel("Town or postcode")).toBeVisible();
  });
});

test.describe("Phase 2 · The trust row", () => {
  test("a business with no reviews shows no rating anywhere", async ({ page }) => {
    await page.goto(`/search?q=Trafford Park Valeting`);
    const card = page.locator("article", { hasText: "Trafford Park Valeting" });
    await expect(card).toBeVisible();
    // A new business has not failed. "0.0" here is a libel we generated
    // ourselves out of an absence of data.
    await expect(card.getByText(/0\.0/)).toHaveCount(0);
    await expect(card.getByText(/no reviews/i)).toHaveCount(0);
  });

  test("unverified is silent, verified is stated", async ({ page }) => {
    // Searched by name rather than by radius. Other suites seed listings around
    // the same city centre, and a distance-sorted page of twenty can fill up
    // with them — which would make this pass or fail on how many fixtures
    // happen to exist rather than on the rule under test.
    await page.goto(`/search?q=Ancoats Motor Works`);
    const card = page.locator("article", { hasText: "Ancoats Motor Works" });
    await expect(card).toBeVisible();
    // "Verified" is a claim we can substantiate from a reviewed document.
    // "Unverified" is an accusation we cannot.
    await expect(card.getByText("Verified")).toBeVisible();
    await expect(page.getByText(/unverified/i)).toHaveCount(0);
  });

  test("distances are set in the monospace family", async ({ page }) => {
    await page.goto(`/search${NEAR}`);
    const distance = page.locator("article .font-mono").first();
    await expect(distance).toBeVisible();
    const family = await distance.evaluate((el) => getComputedStyle(el).fontFamily);
    // A column of figures only scans when the digits are the same width.
    expect(family).toMatch(/plex mono/i);
  });
});

test.describe("Phase 2 · Map and list are one search", () => {
  test("switching to the map keeps the same results", async ({ page }) => {
    await page.goto(`/search${NEAR}&radius=5000`);
    await expect(page.locator("article").first()).toBeVisible();
    const listed = await page.locator("article").count();

    await page.getByRole("button", { name: "Map" }).click();
    await expect(page.locator(".leaflet-container")).toBeVisible({ timeout: 20_000 });

    const pins = await page.locator(".leaflet-marker-icon").count();
    expect(pins, "the map shows a different set from the list").toBe(listed);
  });

  test("the list is the default view", async ({ page }) => {
    await page.goto(`/search${NEAR}`);
    // A map answers "where"; a list answers "which". Someone who already knows
    // roughly where they are is choosing.
    // `exact`: a card's "Save Checklist Motors to My Garages" button also
    // matches a substring "List" once another spec has left that fixture here.
    await expect(page.getByRole("button", { name: "List", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
      { timeout: 20_000 },
    );
  });

  test("attribution is present on the map", async ({ page }) => {
    await page.goto(`/search${NEAR}`);
    await page.getByRole("button", { name: "Map" }).click();
    await expect(page.locator(".leaflet-container")).toBeVisible({ timeout: 20_000 });
    // Required by the ODbL. Not decoration.
    await expect(page.getByText(/OpenStreetMap/i)).toBeVisible();
  });
});

test.describe("Phase 2 · The business profile", () => {
  test("a guest can read a full profile and act on it", async ({ page }) => {
    await page.goto(`/search?q=Ancoats Motor Works`);
    await page
      .getByRole("link", { name: /Ancoats Motor Works/ })
      .first()
      .click();

    await expect(page).toHaveURL(/\/business\/ancoats-motor-works-/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Ancoats Motor Works");
    await expect(page.getByRole("heading", { name: "Opening hours" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Services" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Find them" })).toBeVisible();
  });

  test("directions open Google Maps with the coordinates the right way round", async ({ page }) => {
    await page.goto(`/search?q=Ancoats Motor Works`);
    await page
      .getByRole("link", { name: /Ancoats Motor Works/ })
      .first()
      .click();

    /*
      The visible copy. The profile renders its actions twice — a sticky rail
      above `lg`, a pinned bottom bar below it — and only one is displayed, so
      `.first()` picks whichever the markup happens to list first.
    */
    const link = page
      .getByRole("link", { name: /directions/i })
      .filter({ visible: true })
      .first();
    await expect(link).toBeVisible();
    const href = await link.getAttribute("href");
    expect(href).toContain("google.com/maps/dir/");
    // GeoJSON stores [lng, lat] and every map URL is lat,lng. A transposition
    // does not throw — it puts a Manchester garage in the North Sea.
    expect(href).toMatch(/destination=53\.4\d+%2C-2\.\d+/);
    // `await`, which was missing: an un-awaited web-first assertion resolves
    // after the test body has finished and is reported as an unhandled
    // rejection with no useful location attached to it.
    await expect(link).toHaveAttribute("target", "_blank");
  });

  test("an unclaimed listing invites its owner without warning the driver", async ({ page }) => {
    await page.goto(`/search?q=Northern Quarter Quick Fit`);
    await page
      .getByRole("link", { name: /Northern Quarter Quick Fit/ })
      .first()
      .click();

    await expect(page.getByText(/is this your business/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /claim your business/i })).toBeVisible();
    // Neutral information addressed to an owner, never a warning about the
    // business aimed at a driver.
    await expect(page.getByText(/not trusted|beware|caution/i)).toHaveCount(0);
  });

  test("today is picked out in the opening hours", async ({ page }) => {
    await page.goto(`/search?q=Ancoats Motor Works`);
    await page
      .getByRole("link", { name: /Ancoats Motor Works/ })
      .first()
      .click();
    await expect(page.getByText("(today)", { exact: false })).toHaveCount(1);
  });

  test("an unknown slug offers a way back rather than a dead end", async ({ page }) => {
    await page.goto("/business/not-a-real-business-0000");
    await expect(page.getByText(/couldn't find that business/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /find a service/i }).last()).toBeVisible();
  });
});

test.describe("Phase 2 · Administration", () => {
  test("a guest cannot reach the console", async ({ page }) => {
    await page.goto("/admin/businesses");
    await expect(page).toHaveURL(/sign-in/);
  });

  test("an admin lists and filters the directory", async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto("/admin/businesses");

    // Scoped to the page. The navigation gained an "Import listings" entry in
    // Phase 6, and on a phone that sits in the collapsed sidebar — so an
    // unscoped match resolves to something deliberately hidden.
    await expect(
      page
        .getByRole("main")
        .getByText(/listings/i)
        .first(),
    ).toBeVisible();
    await page.getByLabel("Search listings").fill("Deansgate");
    await expect(page.getByRole("link", { name: /Deansgate/ }).first()).toBeVisible();
  });

  test("an admin manages categories and the public list follows", async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto("/admin/categories");

    const name = `E2E Cat ${Date.now().toString(36)}`;
    await page.getByRole("button", { name: /^add category$/i }).click();
    await page.getByLabel("Category name").fill(name);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /^add category$/i })
      .click();

    // `exact`, because the confirmation toast is still on screen and contains
    // the same name inside a longer sentence — as does the row's own
    // screen-reader label.
    await expect(page.getByText(name, { exact: true })).toBeVisible();

    // FR-ADM-05 is only met if a change reaches the public filter without a
    // deploy, so this checks the other side of it.
    await page.goto("/search");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await withFilters(page, async () => {
      /*
        Text, not a role: the same filter is a checkbox in the desktop rail and a
        chip button in the phone sheet. `filter({ visible: true })` because both
        layouts are in the DOM at every width — one is display:none — so
        `.first()` picks the hidden one on a phone.
      */
      await expect(
        page.getByText(name, { exact: true }).filter({ visible: true }).first(),
      ).toBeVisible();
    });

    // Clean up: an unused category deletes cleanly. Delete lives behind the
    // row's action menu — fifty rows each carrying a visible destructive
    // control is how people stop seeing destructive controls.
    await page.goto("/admin/categories");
    await page.getByRole("button", { name: `Actions for ${name}` }).click();
    await page.getByRole("menuitem", { name: /^delete$/i }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /^delete$/i })
      .click();
    await expect(page.getByText(name, { exact: true })).toHaveCount(0);
  });

  test("deleting a category that is in use is refused with a count", async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto("/admin/categories");
    await page.getByRole("button", { name: "Actions for Tyres" }).click();
    await page.getByRole("menuitem", { name: /^delete$/i }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /^delete$/i })
      .click();
    // "You can't" without a number leaves an administrator with no next step.
    await expect(page.getByText(/business(es)? use this category/i)).toBeVisible();
  });
});

test.describe("Phase 2 · On a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("no discovery route scrolls sideways", async ({ page }) => {
    for (const route of ["/", "/search", `/search${NEAR}`, "/categories"]) {
      await page.goto(route);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }
  });

  test("a business profile does not scroll sideways", async ({ page }) => {
    await page.goto(`/search?q=Deansgate`);
    await page
      .getByRole("link", { name: /Deansgate/ })
      .first()
      .click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("filters are behind a sheet and report their count", async ({ page }) => {
    await page.goto(`/search${NEAR}`);
    const button = page.getByRole("button", { name: /filters/i });
    await expect(button).toBeVisible();

    await button.click();
    await expect(page.getByRole("dialog", { name: "Filters" })).toBeVisible();
    await page.getByRole("button", { name: "Verified" }).click();
    await page.getByRole("button", { name: /show \d+ results/i }).click();

    // Once the controls are hidden, a silently filtered list reads as a list
    // with records missing.
    await expect(button).toContainText("1");
  });

  test("the profile actions stay within reach", async ({ page }) => {
    await page.goto(`/search?q=Deansgate`);
    await page
      .getByRole("link", { name: /Deansgate/ })
      .first()
      .click();
    // The URL, not the heading: the search page has an h1 too, so waiting on
    // one passes instantly and the measurement below is taken against a search
    // card that happens to be below the fold.
    await expect(page).toHaveURL(/\/business\//);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // `:visible` rather than `.first()`: the profile renders the action pair
    // twice — pinned to the bottom edge below `md`, inline above it — and only
    // one is ever shown. Taking the first in DOM order picks whichever the
    // markup happens to list first, which is not the one on screen.
    const directions = page
      .locator("a:visible")
      .filter({ hasText: /directions/i })
      .first();
    /**
     * Asserted visible before it is measured. `boundingBox()` does not auto-wait
     * for visibility — it returns `null` while the element is attached but not
     * yet painted, and the test then dies on `null.y`.
     */
    await expect(directions).toBeVisible();
    const box = await directions.boundingBox();
    const viewport = page.viewportSize()!;
    // Pinned above the tab bar. Someone on this page is nearly always about to
    // do one of these two things.
    expect(box!.y, "the primary action is off-screen").toBeLessThan(viewport.height);
  });

  test("every standalone control clears the touch floor", async ({ page }) => {
    await page.goto(`/search${NEAR}`);
    await expect(page.locator("article").first()).toBeVisible();
    const small = await page.evaluate(() =>
      Array.from(document.querySelectorAll("button, a[href], input, select"))
        .filter((el) => {
          const r = el.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) return false;
          // WCAG 2.5.8 exempts targets inside a sentence or block of text.
          if (el.tagName === "A" && getComputedStyle(el).display === "inline") return false;
          return r.height < 40 || r.width < 40;
        })
        .map((el) => `${el.tagName.toLowerCase()} "${el.textContent?.trim().slice(0, 24)}"`),
    );
    expect(small, `below the touch floor:\n${small.join("\n")}`).toEqual([]);
  });
});

test.describe("Phase 2 · Accessibility", () => {
  test("every photo is named for the business it belongs to", async ({ page }) => {
    await page.goto(`/search${NEAR}`);
    await expect(page.locator("article").first()).toBeVisible();
    const bad = await page.evaluate(() =>
      Array.from(document.querySelectorAll("img"))
        .filter((el) => !el.getAttribute("alt")?.trim())
        .map((el) => el.getAttribute("src") ?? ""),
    );
    // "image" is not alt text. A photo's alt says whose premises it is.
    expect(bad, `images with no alt text:\n${bad.join("\n")}`).toEqual([]);
  });

  test("filter toggles report their pressed state", async ({ page }) => {
    await page.goto(`/search${NEAR}`);
    await withFilters(page, async () => {
      const openNow = page.getByRole("button", { name: "Open now" });
      await expect(openNow).toHaveAttribute("aria-pressed", "false");
      await openNow.click();
      await expect(openNow).toHaveAttribute("aria-pressed", "true");
    });
  });

  test("headings start at level one and do not skip", async ({ page }) => {
    for (const route of ["/", `/search${NEAR}`, "/categories"]) {
      await page.goto(route);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const levels = await page.evaluate(() =>
        Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6"))
          .filter((h) => h.textContent?.trim())
          .map((h) => Number(h.tagName[1])),
      );
      expect(levels[0], route).toBe(1);
      for (let i = 1; i < levels.length; i++) {
        expect(
          levels[i] - levels[i - 1],
          `${route}: h${levels[i - 1]} → h${levels[i]}`,
        ).toBeLessThanOrEqual(1);
      }
    }
  });
});
