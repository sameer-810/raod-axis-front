import { test, expect } from "@playwright/test";

/**
 * Phase 20 — the search box finds the words a driver types (DECISIONS.md D-045).
 *
 * "tyres" typed on the home page found nothing: the garages say "Tyre
 * replacement", and the search matched letter for letter. Found while
 * preparing the technical readiness document.
 */
test.describe("Phase 20 · Search finds the words a driver types", () => {
  test("“tyres” from the home page finds tyre garages", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("What do you need?").fill("tyres");
    await page.getByLabel("What do you need?").press("Enter");

    await expect(page).toHaveURL(/q=tyres/);
    await expect(page.locator("article").first()).toBeVisible();
    // Every result is there for a reason a driver would recognise.
    const first = page.locator("article").first();
    await expect(first).toContainText(/tyre/i);
  });

  test("singular and plural give the same list", async ({ page }) => {
    const count = async (q: string) => {
      await page.goto(`/search?q=${q}`);
      await expect(page.locator("article").first()).toBeVisible();
      return page.locator("article").count();
    };
    expect(await count("tyres")).toBe(await count("tyre"));
  });
});
