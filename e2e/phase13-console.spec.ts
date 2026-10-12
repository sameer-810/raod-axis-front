import {
  test,
  expect,
  request as pwRequest,
  type APIRequestContext,
  type Page,
  type TestInfo,
} from "@playwright/test";
import { API } from "./helpers";

/**
 * Phase 13 — a second country, in the console.
 *
 * Phases 11 and 12 put the United Arab Emirates into the server and onto the
 * site. This is the people who run the directory: that an administrator sees
 * both countries at once and can look at one, that the numbers say how each is
 * doing, and that a spreadsheet of UAE garages is told what to contain.
 */
const TAG = `p3${Date.now().toString(36).slice(-6)}`;

interface Session {
  accessToken: string;
  user: { id: string; name: string; email: string; role: string };
}

const fixture = {
  admin: null as Session | null,
  uae: `${TAG} Khalifa City Motors`,
  uk: `${TAG} Ancoats Brake Centre`,
};

function desktopOnly(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== "chromium", "Desktop-only: the phone gets cards");
}

async function adminLogin(): Promise<Session> {
  const ctx = await pwRequest.newContext();
  const res = await ctx.post(`${API}/auth/login`, {
    data: {
      email: process.env.E2E_ADMIN_EMAIL || "admin@roadaxis.online",
      password: process.env.E2E_ADMIN_PASSWORD || "ChangeMe@2026",
    },
  });
  expect(res.ok(), "could not sign in as the administrator").toBeTruthy();
  const data = (await res.json()).data;
  await ctx.dispose();
  return data;
}

function as(session: Session): Promise<APIRequestContext> {
  return pwRequest.newContext({
    extraHTTPHeaders: { Authorization: `Bearer ${session.accessToken}` },
  });
}

async function signIn(page: Page, session: Session) {
  await page.goto("/");
  await page.evaluate((s) => localStorage.setItem("roadaxis_auth", JSON.stringify(s)), {
    accessToken: session.accessToken,
    user: session.user,
  });
}

async function settle(page: Page) {
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeAttached({ timeout: 20_000 });
}

test.beforeAll(async () => {
  fixture.admin = await adminLogin();
  const admin = await as(fixture.admin);

  const uae = await admin.post(`${API}/businesses`, {
    data: {
      name: fixture.uae,
      address: {
        line1: "Street 12, Khalifa City A",
        city: "Khalifa City",
        region: "Abu Dhabi",
        country: "AE",
      },
      latitude: 24.4215,
      longitude: 54.5762,
    },
  });
  expect(uae.status(), await uae.text()).toBe(201);

  const uk = await admin.post(`${API}/businesses`, {
    data: {
      name: fixture.uk,
      address: { line1: "40 Great Ancoats Street", city: "Manchester", postcode: "M4 5AB" },
      latitude: 53.4841,
      longitude: -2.2301,
    },
  });
  expect(uk.status(), await uk.text()).toBe(201);
  await admin.dispose();
});

test.describe("Phase 13 · The directory, across countries", () => {
  test("the console lists both countries until it is asked for one", async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    await signIn(page, fixture.admin!);
    await page.goto("/admin/businesses");
    await settle(page);

    await page.getByRole("searchbox", { name: "Search listings" }).fill(TAG);
    const rows = page.locator("tbody tr[tabindex]");
    await expect(rows).toHaveCount(2);

    // Each row says where it is, and the UAE row has an emirate where the UK
    // one has a postcode.
    const uae = rows.filter({ hasText: fixture.uae });
    await expect(uae).toContainText("Abu Dhabi");
    await expect(uae).toContainText("AE");
    await expect(rows.filter({ hasText: fixture.uk })).toContainText("M4 5AB");

    await page.getByLabel("Country", { exact: true }).selectOption("AE");
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText(fixture.uae);
    // A silently filtered list reads as a list with records missing.
    await expect(page.getByText("Country: United Arab Emirates")).toBeVisible();

    await page.getByLabel("Country", { exact: true }).selectOption("GB");
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText(fixture.uk);

    await page.getByLabel("Country", { exact: true }).selectOption("");
    await expect(rows).toHaveCount(2);
  });

  test("on a phone the same filter narrows the cards", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "Phone-only");
    await signIn(page, fixture.admin!);
    await page.goto("/admin/businesses");
    await settle(page);

    await page.getByRole("searchbox", { name: "Search listings" }).fill(TAG);
    await expect(page.getByRole("link", { name: fixture.uae })).toBeVisible();
    await expect(page.getByRole("link", { name: fixture.uk })).toBeVisible();

    await page.getByLabel("Country", { exact: true }).selectOption("AE");
    await expect(page.getByRole("link", { name: fixture.uk })).toHaveCount(0);
    await expect(page.getByRole("link", { name: fixture.uae })).toBeVisible();
  });
});

test.describe("Phase 13 · The numbers, by country", () => {
  test("analytics shows each country on its own row", async ({ page }) => {
    await signIn(page, fixture.admin!);
    const [answer] = await Promise.all([
      page.waitForResponse(
        // The API's answer, not the page of the same name.
        (r) => r.url().startsWith(`${API}/analytics`) && r.request().method() === "GET",
      ),
      page.goto("/admin/analytics"),
    ]);
    await settle(page);
    const data = (await answer.json()).data as {
      totals: { liveBusinesses: number };
      countries: Array<{ name: string; liveBusinesses: number; bookingRequests: number }>;
    };

    await expect(page.getByRole("heading", { name: "By country" })).toBeVisible();
    const table = page.getByRole("table").filter({ hasText: "Live listings" });
    expect(data.countries.map((c) => c.name)).toEqual(["United Kingdom", "United Arab Emirates"]);
    for (const c of data.countries) {
      const row = table.getByRole("row", { name: new RegExp(c.name) });
      await expect(row).toBeVisible();
      await expect(row.getByRole("cell").first()).toHaveText(String(c.liveBusinesses));
    }

    // The two rows are the headline figure, split — not a second opinion.
    expect(data.countries.reduce((sum, c) => sum + c.liveBusinesses, 0)).toBe(
      data.totals.liveBusinesses,
    );
  });
});

test.describe("Phase 13 · A spreadsheet for either country", () => {
  test("the import page says what a UAE row needs", async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    await signIn(page, fixture.admin!);
    await page.goto("/admin/businesses/import");
    await settle(page);

    await page.getByText("What the columns mean").click();
    await expect(page.getByText("country, region")).toBeVisible();
    await expect(page.getByText(/AE and the emirate/)).toBeVisible();
    await expect(page.getByText(/placed in the middle of its area/)).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download the column template" }).click(),
    ]);
    const stream = await download.createReadStream();
    let header = "";
    for await (const chunk of stream) header += chunk.toString();
    expect(header).toContain("region");
    expect(header).toContain("country");
  });

  test("a UAE file is previewed and imported from the console", async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    await signIn(page, fixture.admin!);
    await page.goto("/admin/businesses/import");
    await settle(page);

    // Short words on purpose: the importer skips a row that looks like a
    // listing already nearby, and an earlier run left one in this very spot.
    const name = `${TAG} UAE Row`;
    const csv = `name,line1,city,region,country,phone\n"${name}",Street 23,Al Barsha,Dubai,AE,04 398 7654\n`;
    await page
      .locator('input[type="file"]')
      .setInputFiles([{ name: "uae.csv", mimeType: "text/csv", buffer: Buffer.from(csv) }]);
    await page.getByRole("button", { name: "Check the file" }).click();

    // No coordinates in the file: the preview owns up to where the pin went.
    await expect(page.getByText(/Placed at the centre of Al Barsha/)).toBeVisible({
      timeout: 20_000,
    });

    await page.getByRole("button", { name: /Import 1 listing/ }).click();
    // And says so again once it is real, on the row itself.
    await expect(page.getByText(/Listed\. Placed at the centre of Al Barsha/)).toBeVisible({
      timeout: 20_000,
    });

    const admin = await as(fixture.admin!);
    const found = await admin.get(
      `${API}/businesses/admin?search=${encodeURIComponent(name)}&country=AE&limit=5`,
    );
    const hit = (await found.json()).data.find((b: { name: string }) => b.name === name);
    expect(hit, "the imported listing is in the UAE").toBeTruthy();
    expect(hit.currency).toBe("AED");
    await admin.dispose();
  });
});
