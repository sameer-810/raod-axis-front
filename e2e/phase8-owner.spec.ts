import { test, expect, request as pwRequest, type Page } from "@playwright/test";
import { API, expectNoHorizontalOverflow, expectTouchTargets } from "./helpers";

/**
 * Phase 8 — an owner keeps their own listing right.
 *
 * FR-BIZ-01 and FR-BIZ-02 were never assigned to a phase, so an owner could
 * claim a listing and then not change a word of it. This follows the screen that
 * fixes that: the dashboard says what the listing is missing, the listing page is
 * where it gets fixed, and the public page shows the result.
 */

const TAG = `p8${Date.now().toString(36)}`;

async function adminCtx() {
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
  return pwRequest.newContext({ extraHTTPHeaders: { Authorization: `Bearer ${token}` } });
}

/** A live listing with an owner who can sign in, and nothing else filled in. */
async function seedOwnedListing(suffix: string) {
  const ctx = await adminCtx();
  const created = await ctx.post(`${API}/businesses`, {
    data: {
      name: `${TAG} ${suffix} Motors`,
      address: { line1: "8 Owner Way", city: "Manchester", postcode: "M1 2AB" },
      latitude: 53.4811,
      longitude: -2.2401,
    },
  });
  expect(created.status(), await created.text()).toBe(201);
  const business = (await created.json()).data as { id: string; slug: string; name: string };

  const email = `${TAG}.${suffix}@e2e.test`.toLowerCase();
  const password = "OwnerSecret123";
  await ctx.post(`${API}/auth/users`, {
    data: { name: `${suffix} Owner`, email, password, role: "business_owner" },
  });
  await ctx.post(`${API}/businesses/${business.id}/transfer`, {
    data: { email, reason: "E2E fixture: an owner with an unfinished listing." },
  });
  await ctx.dispose();
  return { business, email, password };
}

async function signInAsOwner(page: Page, email: string, password: string) {
  await page.goto("/staff/sign-in");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL(/\/portal/);
}

test.describe("Phase 8 · The dashboard says what is missing", () => {
  test("an unfinished listing shows a checklist that links to where it gets finished", async ({
    page,
  }) => {
    const { email, password } = await seedOwnedListing("Checklist");
    await signInAsOwner(page, email, password);

    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
    // A dashboard that only reports is a report. Every item is a link.
    await expect(page.getByText(/% complete/)).toBeVisible();
    await page.getByRole("link", { name: /describe what you do/i }).click();
    await expect(page).toHaveURL(/\/portal\/listing/);
  });

  test("the placeholder from Phase 4 is gone", async ({ page }) => {
    const { email, password } = await seedOwnedListing("Placeholder");
    await signInAsOwner(page, email, password);
    // "Booking requests arrive in the next release" outlived the release by
    // several weeks and was the first sentence a paying customer read.
    await expect(page.getByText(/next release/i)).toHaveCount(0);
  });
});

test.describe("Phase 8 · Editing the listing", () => {
  test("an owner changes their description and services and the public page follows", async ({
    page,
  }) => {
    const { business, email, password } = await seedOwnedListing("Edits");
    await signInAsOwner(page, email, password);
    await page.goto("/portal/listing");

    await expect(page.getByRole("heading", { name: business.name })).toBeVisible();
    await page
      .getByLabel("Description")
      .fill("Family-run since 2009. MOTs while you wait, no appointment needed.");

    await page.getByRole("button", { name: /add a service/i }).click();
    await page.getByLabel("Service 1 name").fill("MOT");
    await page.getByLabel("Service 1 price from").fill("45");

    const saved = page.waitForResponse(
      (r) => r.url().includes(`/businesses/${business.id}`) && r.request().method() === "PATCH",
    );
    await page.getByRole("button", { name: /save changes/i }).click();
    expect((await saved).status()).toBe(200);
    await expect(page.getByText("Your listing is updated", { exact: true })).toBeVisible();

    // Nobody at RoadAxis was involved, and the change is live.
    await page.goto(`/business/${business.slug}`);
    await expect(page.getByText(/MOTs while you wait, no appointment needed/)).toBeVisible();
    await expect(page.getByText("MOT", { exact: true })).toBeVisible();
    await expect(page.getByText(/from/).first()).toBeVisible();
  });

  test("the checklist ticks off what was just done", async ({ page }) => {
    const { email, password } = await seedOwnedListing("Ticks");
    await signInAsOwner(page, email, password);
    await page.goto("/portal/listing");
    await page.getByLabel("Description").fill("Now described.");
    await page.getByRole("button", { name: /save changes/i }).click();
    await expect(page.getByText("Your listing is updated", { exact: true })).toBeVisible();

    await page.goto("/portal");
    // The item is still listed — struck through, not vanished — so the owner
    // can see it was done rather than wondering where it went.
    const done = page.getByText("Describe what you do", { exact: true });
    await expect(done).toBeVisible();
    await expect(done).toHaveCSS("text-decoration-line", "line-through");
  });

  test("an owner never sees the administrator's duplicate warning or number override", async ({
    page,
  }) => {
    const { email, password } = await seedOwnedListing("Scope");
    await signInAsOwner(page, email, password);
    await page.goto("/portal/listing");
    await expect(page.getByRole("heading", { name: /listing/i }).first()).toBeVisible();
    await expect(page.getByText(/possibly already listed/i)).toHaveCount(0);
    await expect(page.getByText(/recorded in the audit log/i)).toHaveCount(0);
    // Numbers have their own page, and the form says so rather than hiding it.
    await expect(page.getByRole("link", { name: /their own page/i })).toHaveAttribute(
      "href",
      "/portal/whatsapp",
    );
  });
});

test.describe("Phase 8 · On a phone", () => {
  test("the dashboard and the listing form fit a 390px screen", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "Mobile-only assertions");
    const { email, password } = await seedOwnedListing("Mobile");
    await signInAsOwner(page, email, password);

    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectTouchTargets(page, "portal dashboard");

    await page.goto("/portal/listing");
    await expect(page.getByLabel("Description")).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectTouchTargets(page, "my listing");
  });
});
