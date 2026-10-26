import { test, expect } from "@playwright/test";

/**
 * Phase 17 — the client's list of 26 October 2026 (DECISIONS.md D-042).
 *
 * Distance is a filter a driver may use, not one they must; what and where
 * share one line; the quick filters fit a phone without scrolling; the owners'
 * card is the client's own; and the service tiles carry the client's icons.
 */
const NEAR = "?lat=53.4808&lng=-2.2426";

test.describe("Phase 17 · Distance is optional", () => {
  test("a search near a place has no distance limit until one is chosen", async ({ page }) => {
    await page.goto(`/search${NEAR}`);
    await expect(page.locator("article").first()).toBeVisible();
    await expect(page).not.toHaveURL(/radius=/);
    // Says what it is doing instead of naming a radius nobody chose.
    await expect(page.getByText(/nearest first/i).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /near your location|near you/i })).toBeVisible();
  });

  test("Any is offered first, and choosing a distance can be undone", async ({ page }, info) => {
    test.skip(info.project.name !== "chromium", "The rail is the desktop control");
    await page.goto(`/search${NEAR}`);
    const rail = page.locator("aside");
    await expect(rail.getByRole("button", { name: "Any" })).toHaveAttribute("aria-pressed", "true");

    await rail.getByRole("button", { name: "2.0 km" }).click();
    await expect(page).toHaveURL(/radius=2000/);
    await expect(rail.getByRole("button", { name: "Any" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await expect(page.getByRole("button", { name: /within 2(\.0)? km/i })).toBeVisible();

    await rail.getByRole("button", { name: "Any" }).click();
    await expect(page).not.toHaveURL(/radius=/);
  });
});

test.describe("Phase 17 · The search fits on one line", () => {
  for (const width of [360, 390]) {
    test(`what and where share a row at ${width} px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/");
      const what = await page.getByLabel("What do you need?").boundingBox();
      const where = await page.getByLabel("Where?").boundingBox();
      const go = await page.getByRole("button", { name: "Search", exact: true }).boundingBox();
      expect(what && where && go).toBeTruthy();
      expect(Math.abs(what!.y - where!.y), "the two boxes are on one line").toBeLessThan(2);
      const middle = (b: { y: number; height: number }) => b.y + b.height / 2;
      expect(
        Math.abs(middle(what!) - middle(go!)),
        "the button sits on the same line",
      ).toBeLessThan(4);
      expect(what!.height, "and no taller than a button").toBeLessThanOrEqual(48);
      expect(go!.width, "the button is still a thumb's width").toBeGreaterThanOrEqual(44);
    });

    test(`all four quick filters are on screen at ${width} px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/");
      for (const name of ["Near me", "Verified", "Open now", "Map"]) {
        const chip = page.getByRole(name === "Near me" ? "button" : "link", { name, exact: true });
        const box = await chip.boundingBox();
        expect(box, `${name} is rendered`).toBeTruthy();
        expect(box!.x, `${name} starts on screen`).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width, `${name} ends on screen`).toBeLessThanOrEqual(width);
        expect(box!.height, `${name} keeps the 44 px floor`).toBeGreaterThanOrEqual(44);
      }
    });
  }

  test("the search page is one row on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto("/search");
    const what = await page.getByLabel("Search for a service or business").boundingBox();
    const where = await page.getByLabel("Town or postcode").boundingBox();
    const filters = await page.getByRole("button", { name: /filters/i }).boundingBox();
    expect(what && where && filters).toBeTruthy();
    expect(Math.abs(what!.y - where!.y)).toBeLessThan(2);
    expect(Math.abs(what!.y - filters!.y)).toBeLessThan(4);
  });
});

test.describe("Phase 17 · The home page", () => {
  test("the owners' card is the client's: a question, a line, one link", async ({ page }) => {
    await page.goto("/");
    const card = page.locator("section", {
      has: page.getByRole("heading", { name: "Own an automotive business?" }),
    });
    await expect(card).toBeVisible();
    await expect(
      card.getByText("You may already be listed. Register or claim your business."),
    ).toBeVisible();
    const link = card.getByRole("link", { name: /register or claim your business/i });
    await link.click();
    await expect(page).toHaveURL(/\/for-business/);
  });

  test("the service tiles carry the client's icons, and they load", async ({ page }) => {
    await page.goto("/");
    const tyres = page.locator('a[href*="category=tyres"] img');
    await expect(tyres).toHaveAttribute("src", "/images/categories/tyres.webp");
    await tyres.scrollIntoViewIfNeeded();
    const width = await tyres.evaluate((img: HTMLImageElement) =>
      img.decode().then(
        () => img.naturalWidth,
        () => 0,
      ),
    );
    expect(width).toBeGreaterThan(0);
    // An icon sits whole on its plate; only an uploaded photograph is cropped.
    await expect(tyres).toHaveCSS("object-fit", "contain");
  });
});
