import { test, expect, request as pwRequest, type Page } from "@playwright/test";
import { API } from "./helpers";

/**
 * Phase 18 — opening and pausing a country from the console (DECISIONS.md D-043).
 *
 * The server side — what a pause hides, what it refuses, that it is audited
 * and undone — is the API suite's, which runs one check at a time. Here the
 * writes are intercepted: actually pausing the UAE in the middle of a parallel
 * browser run would pull it out from under every other UAE test.
 */
interface Session {
  accessToken: string;
  user: { id: string; name: string; email: string; role: string };
}

let admin: Session;

test.beforeAll(async () => {
  const ctx = await pwRequest.newContext();
  const res = await ctx.post(`${API}/auth/login`, {
    data: {
      email: process.env.E2E_ADMIN_EMAIL || "admin@roadaxis.online",
      password: process.env.E2E_ADMIN_PASSWORD || "ChangeMe@2026",
    },
  });
  expect(res.ok(), "could not sign in as the administrator").toBeTruthy();
  admin = (await res.json()).data;
  await ctx.dispose();
});

async function signIn(page: Page) {
  await page.goto("/");
  await page.evaluate((s) => localStorage.setItem("roadaxis_auth", JSON.stringify(s)), {
    accessToken: admin.accessToken,
    user: admin.user,
  });
}

/** The site's country list as the server sends it while the UAE is paused. */
async function withUaePaused(page: Page) {
  await page.route(/\/api\/markets$/, async (route) => {
    const res = await route.fetch();
    const body = await res.json();
    body.data.markets = body.data.markets.filter((m: { code: string }) => m.code !== "AE");
    body.data.all = body.data.all.map((m: { code: string }) =>
      m.code === "AE" ? { ...m, live: false } : m,
    );
    await route.fulfill({ response: res, json: body });
  });
}

/** One row, whichever layout the width is showing. */
const row = (page: Page, name: string) =>
  page.getByRole("checkbox", { name: new RegExp(`(pause|open) ${name}`, "i") }).filter({
    visible: true,
  });

test.describe("Phase 18 · Countries in the console", () => {
  test("every served country is listed, open, with its listings", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/countries");
    await expect(page.getByRole("heading", { name: "Countries", level: 1 })).toBeVisible();
    await expect(page.getByText("United Kingdom").filter({ visible: true })).toBeVisible();
    await expect(page.getByText("United Arab Emirates").filter({ visible: true })).toBeVisible();
    await expect(row(page, "United Arab Emirates")).toBeChecked();
    await expect(page.getByText(/\d+ live/).first()).toBeVisible();
  });

  test("pausing asks first and says what will disappear; cancel changes nothing", async ({
    page,
  }) => {
    await signIn(page);
    let wrote = false;
    await page.route(/\/api\/markets\/AE$/, async (route) => {
      wrote = true;
      await route.abort();
    });
    await page.goto("/admin/countries");
    await row(page, "United Arab Emirates").click({ force: true });

    const dialog = page.getByRole("dialog", { name: /pause the uae/i });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/stops showing the UAE/);
    await expect(dialog).toContainText(/Nothing is\s+deleted/);
    await dialog.getByRole("button", { name: "Cancel" }).click();

    await expect(dialog).toHaveCount(0);
    await expect(row(page, "United Arab Emirates")).toBeChecked();
    expect(wrote, "cancelling must not write").toBe(false);
  });

  test("confirming pauses it, and the last open country cannot be switched off", async ({
    page,
  }) => {
    await signIn(page);
    let sent: unknown = null;
    await page.route(/\/api\/markets\/AE$/, async (route) => {
      sent = route.request().postDataJSON();
      const current = await (
        await page.request.get(`${API}/markets/admin`, {
          headers: { Authorization: `Bearer ${admin.accessToken}` },
        })
      ).json();
      const data = current.data.map((c: { code: string }) =>
        c.code === "AE" ? { ...c, live: false } : c,
      );
      await route.fulfill({ json: { success: true, data } });
    });
    await page.goto("/admin/countries");
    await row(page, "United Arab Emirates").click({ force: true });
    await page
      .getByRole("dialog", { name: /pause the uae/i })
      .getByRole("button", { name: /pause/i })
      .click();

    expect(sent).toEqual({ live: false });
    await expect(page.getByText(/the uae is paused/i)).toBeVisible();
    await expect(row(page, "United Arab Emirates")).not.toBeChecked();
    // One left open: its switch is off-limits, and the page says why.
    await expect(row(page, "United Kingdom")).toBeDisabled();
    await expect(page.getByText(/at least one country stays open/i)).toBeVisible();
  });
});

test.describe("Phase 18 · What a paused country means elsewhere", () => {
  test("the public site stops offering it", async ({ page }) => {
    await withUaePaused(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // With one country open there is no choice to offer.
    await expect(page.getByRole("button", { name: /^Country:/ })).toHaveCount(0);
  });

  test("the console still lists it, marked paused", async ({ page }, info) => {
    test.skip(info.project.name !== "chromium", "The filter bar is the desktop control");
    await withUaePaused(page);
    await signIn(page);
    await page.goto("/admin/businesses");
    await expect(
      page.getByLabel("Country").locator("option", { hasText: "United Arab Emirates (paused)" }),
    ).toHaveCount(1);
  });
});
