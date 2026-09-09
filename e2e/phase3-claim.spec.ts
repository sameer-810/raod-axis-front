import { test, expect, request as pwRequest, type Page } from "@playwright/test";
import { API, expectNoHorizontalOverflow, expectTouchTargets } from "./helpers";

/**
 * Phase 3 — ownership, through the real interface.
 *
 * The most consequential journey in the product: at the end of it a stranger
 * controls a business's public listing. So this suite follows the whole thing —
 * apply as a guest, be reviewed by an administrator, set a password, reach the
 * portal — rather than testing the screens in isolation.
 */

const TAG = `c3${Date.now().toString(36)}`;

/** A one-pixel PNG, which is a real image as far as the type check is concerned. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const licence = (name = "business-licence.png") => ({
  name,
  mimeType: "image/png",
  buffer: PNG,
});

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

/** Seed a fresh unclaimed listing, so each test owns its own fixture. */
async function seedListing(name: string) {
  const token = await adminToken();
  const ctx = await pwRequest.newContext({
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  });
  const res = await ctx.post(`${API}/businesses`, {
    data: {
      name,
      address: { line1: "1 Portland Street", city: "Manchester", postcode: "M1 3BE" },
      latitude: 53.4791,
      longitude: -2.2401,
    },
  });
  expect(res.status(), await res.text()).toBe(201);
  const business = (await res.json()).data;
  await ctx.dispose();
  return business as { id: string; slug: string; name: string };
}

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

/** Fill and submit a claim form on whichever page is open. */
async function applyOnPage(page: Page, suffix: string, files = [licence()]) {
  await page.getByLabel("Your name").fill(`E2E Applicant ${suffix}`);
  await page.getByLabel("Your email").fill(`${TAG}.${suffix}@e2e.test`);
  await page.getByLabel("Your phone").fill("07700900321");
  await page.getByLabel("Your role").fill("Owner");
  await page.locator('input[type="file"]').setInputFiles(files);
  await page.getByRole("button", { name: /send application/i }).click();
}

test.describe("Phase 3 · Owners find their own listing", () => {
  test("the for-business page leads with a search of the directory", async ({ page }) => {
    await page.goto("/for-business");
    // Most people arriving here are already listed and do not know it, because
    // an administrator seeded the market before anyone signed up.
    await expect(page.getByRole("heading", { name: /finding your business/i })).toBeVisible();
    await expect(page.getByLabel("Your business name")).toBeVisible();
  });

  test("an unclaimed listing offers 'This is mine'", async ({ page }) => {
    const business = await seedListing(`${TAG} Portland Tyres`);
    await page.goto("/for-business");

    await page.getByLabel("Your business name").fill(business.name);
    await page.getByRole("button", { name: /find it/i }).click();

    const row = page.locator("li", { hasText: business.name }).first();
    await expect(row).toBeVisible();
    await expect(row.getByText("Unclaimed")).toBeVisible();
    await row.getByRole("link", { name: /this is mine/i }).click();

    await expect(page).toHaveURL(new RegExp(`/business/${business.slug}/claim`));
  });

  test("a name that is not listed offers registration instead", async ({ page }) => {
    await page.goto("/for-business");
    await page.getByLabel("Your business name").fill("zzzznotarealbusinessname");
    await page.getByRole("button", { name: /find it/i }).click();

    await expect(page.getByText(/not listed yet/i)).toBeVisible();
    await page.getByRole("button", { name: /add my business/i }).click();
    await expect(page).toHaveURL(/register-business/);
  });
});

test.describe("Phase 3 · Claiming a listing", () => {
  test("a guest can apply with no account", async ({ page }) => {
    const business = await seedListing(`${TAG} Oxford Road Motors`);
    await page.goto(`/business/${business.slug}/claim`);

    // No sign-in wall. Verification belongs after the commitment, not before it.
    await expect(page).not.toHaveURL(/sign-in/);
    await expect(page.getByRole("heading", { name: new RegExp(`Claim ${TAG}`) })).toBeVisible();

    // The page says what it costs and what happens next before asking for a
    // licence — an unexplained document request is where people leave.
    await expect(page.getByText(/we check it/i)).toBeVisible();
    await expect(page.getByText(/set a password/i)).toBeVisible();

    await applyOnPage(page, "a");
    await expect(page.getByRole("heading", { name: /application received/i })).toBeVisible();
    await expect(page.getByText(`${TAG}.a@e2e.test`)).toBeVisible();
  });

  test("a document is required, and it is said before the upload", async ({ page }) => {
    const business = await seedListing(`${TAG} No Docs Garage`);
    await page.goto(`/business/${business.slug}/claim`);

    await page.getByLabel("Your name").fill("E2E No Docs");
    await page.getByLabel("Your email").fill(`${TAG}.nodocs@e2e.test`);
    await page.getByLabel("Your phone").fill("07700900321");
    await page.getByRole("button", { name: /send application/i }).click();

    await expect(page.getByText(/attach at least one document/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: /application received/i })).toHaveCount(0);
  });

  test("the form names exactly what counts as proof", async ({ page }) => {
    const business = await seedListing(`${TAG} Proof Garage`);
    await page.goto(`/business/${business.slug}/claim`);
    // The highest-friction step in the product. "Send proof" with no examples
    // is how an application never arrives.
    await expect(page.getByText(/business licence/i)).toBeVisible();
    await expect(page.getByText(/photo taken on your phone is fine/i)).toBeVisible();
  });

  test("an attached document can be removed before sending", async ({ page }) => {
    const business = await seedListing(`${TAG} Remove Doc Garage`);
    await page.goto(`/business/${business.slug}/claim`);

    await page.locator('input[type="file"]').setInputFiles([licence("licence.png")]);
    await expect(page.getByText("licence.png")).toBeVisible();
    await page.getByRole("button", { name: /remove licence\.png/i }).click();
    await expect(page.getByText("licence.png")).toHaveCount(0);
  });

  test("a second applicant is queued and told so plainly", async ({ page }) => {
    const business = await seedListing(`${TAG} Contested Tyres`);

    await page.goto(`/business/${business.slug}/claim`);
    await applyOnPage(page, "first");
    await expect(page.getByRole("heading", { name: /application received/i })).toBeVisible();

    await page.goto(`/business/${business.slug}/claim`);
    await applyOnPage(page, "second");

    // They may be the legitimate owner and the first may be the impostor.
    // Silently discarding their application would make that undiscoverable.
    await expect(page.getByRole("heading", { name: /you're in the queue/i })).toBeVisible();
    await expect(page.getByText(/someone else has already applied/i)).toBeVisible();
  });

  test("a claimed listing refuses further applications", async ({ page }) => {
    const business = await seedListing(`${TAG} Already Owned`);

    const token = await adminToken();
    const ctx = await pwRequest.newContext({
      extraHTTPHeaders: { Authorization: `Bearer ${token}` },
    });
    // Take it out of play the way the product does — by transferring ownership.
    await ctx.post(`${API}/businesses/${business.id}/transfer`, {
      data: {
        email: `${TAG}.existing@e2e.test`,
        name: "Existing Owner",
        reason: "E2E fixture: listing already has an owner.",
      },
    });
    await ctx.dispose();

    await page.goto(`/business/${business.slug}/claim`);
    await expect(page.getByText(/already has an owner/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /send application/i })).toHaveCount(0);
  });
});

test.describe("Phase 3 · Registering a new business", () => {
  test("registration warns about a listing that already exists", async ({ page }) => {
    await seedListing(`${TAG} Duplicate Check Motors`);
    await page.goto("/register-business");

    await page.getByLabel("Business name").fill(`${TAG} Duplicate Check Motors`);
    await page.getByLabel("Postcode").fill("M1 3BE");
    await page.getByLabel("Postcode").blur();

    // Advisory, never a block — but offering the claim route to somebody about
    // to create a duplicate saves them a week and saves us a merge.
    await expect(page.getByText(/already on roadaxis/i)).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByRole("link", { name: new RegExp(`${TAG} Duplicate Check`) }),
    ).toBeVisible();
  });

  test("a postcode is resolved to a position", async ({ page }) => {
    await page.goto("/register-business");
    await page.getByLabel("Postcode").fill("M1 1LN");
    await page.getByLabel("Postcode").blur();
    // A listing without coordinates is excluded from every distance search —
    // the only view that matters — so this step is not optional.
    await expect(page.getByText(/^Found:/)).toBeVisible({ timeout: 20_000 });
  });

  test("a full registration is accepted and held for review", async ({ page }) => {
    await page.goto("/register-business");

    const name = `${TAG} Brand New Garage`;
    await page.getByLabel("Business name").fill(name);
    await page.getByLabel("Street address").fill("14 Deansgate");
    await page.getByLabel("Town or city").fill("Manchester");
    await page.getByLabel("Postcode").fill("M3 2RJ");
    await page.getByLabel("Postcode").blur();
    await expect(page.getByText(/^Found:/)).toBeVisible({ timeout: 20_000 });

    await applyOnPage(page, "register");

    await expect(page.getByRole("heading", { name: /application received/i })).toBeVisible();
    // Publishing first and reviewing later would make the review decorative.
    await expect(page.getByText(/goes live once we've checked/i)).toBeVisible();

    await page.goto(`/search?q=${encodeURIComponent(name)}`);
    await expect(page.getByText(/nothing here yet/i)).toBeVisible();
  });
});

test.describe("Phase 3 · The review queue", () => {
  test("a guest cannot reach it", async ({ page }) => {
    await page.goto("/admin/claims");
    await expect(page).toHaveURL(/sign-in/);
  });

  test("an administrator reviews, rejects with a reason, and the queue moves on", async ({
    page,
  }) => {
    const business = await seedListing(`${TAG} Review Me Tyres`);
    await page.goto(`/business/${business.slug}/claim`);
    await applyOnPage(page, "reviewed");
    await expect(page.getByRole("heading", { name: /application received/i })).toBeVisible();

    await signInAsAdmin(page);
    await page.goto("/admin/claims");

    // Searched rather than scrolled. The queue is oldest-first and paginated,
    // so on a database with any backlog a brand-new application is several
    // pages down — which is the same reason a reviewer needs this box.
    await page.getByLabel("Search applications").fill(`${TAG}.reviewed@e2e.test`);
    const row = page.getByRole("button").filter({ hasText: business.name }).first();
    await expect(row).toBeVisible();
    await row.click();

    // Everything a decision needs, on one page.
    await expect(page.getByRole("heading", { name: business.name })).toBeVisible();
    // `exact` scopes to the detail panel's own field; the queue item beside it
    // shows the same address inside a longer summary line.
    await expect(page.getByText(`${TAG}.reviewed@e2e.test`, { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: /evidence/i })).toBeVisible();

    await page.getByRole("button", { name: /^reject$/i }).click();
    // The applicant reads this verbatim and may apply again, so the reason is
    // the only thing that makes a second attempt different from the first.
    await expect(page.getByText(/sent to the applicant word for word/i)).toBeVisible();

    await page
      .getByLabel(/why are you rejecting/i)
      .fill("The document you sent isn't in the business's name. Please send a business licence.");
    await page.getByRole("button", { name: /reject and notify/i }).click();

    await expect(page.getByText(/applicant has been told why/i)).toBeVisible();
  });

  test("an ownership document opens in the reviewer's browser", async ({ page }) => {
    const business = await seedListing(`${TAG} Document Garage`);
    await page.goto(`/business/${business.slug}/claim`);
    await applyOnPage(page, "docs", [licence("proof-of-ownership.png")]);
    await expect(page.getByRole("heading", { name: /application received/i })).toBeVisible();

    await signInAsAdmin(page);
    await page.goto("/admin/claims");
    await page.getByLabel("Search applications").fill(`${TAG}.docs@e2e.test`);
    await page.getByRole("button").filter({ hasText: business.name }).first().click();

    await page.getByRole("button", { name: /proof-of-ownership\.png/i }).click();
    // Private media: no URL appears in any DTO, so it is fetched with the
    // session's token and shown from a blob.
    const dialog = page.getByRole("dialog", { name: /proof-of-ownership/i });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("img")).toHaveAttribute("src", /^blob:/);
  });

  test("the queue reports how long each application has waited", async ({ page }) => {
    const business = await seedListing(`${TAG} Waiting Garage`);
    await page.goto(`/business/${business.slug}/claim`);
    await applyOnPage(page, "waiting");

    await signInAsAdmin(page);
    await page.goto("/admin/claims");
    await page.getByLabel("Search applications").fill(`${TAG}.waiting@e2e.test`);
    // Age, not date. A claim left four days is more urgent than one filed this
    // morning, and it is what the one-working-day target is measured against.
    await expect(page.getByText(/just now|m ago|h ago/).first()).toBeVisible();
  });
});

test.describe("Phase 3 · Approval hands over the keys", () => {
  test("approving verifies the listing and lets the owner in", async ({ page }) => {
    const business = await seedListing(`${TAG} Handover Motors`);

    await page.goto(`/business/${business.slug}/claim`);
    await applyOnPage(page, "owner");
    await expect(page.getByRole("heading", { name: /application received/i })).toBeVisible();

    // Approve through the API, then follow the invitation through the UI — the
    // link is the only part of this journey a test cannot get from an inbox.
    const token = await adminToken();
    const ctx = await pwRequest.newContext({
      extraHTTPHeaders: { Authorization: `Bearer ${token}` },
    });
    // Searched, not paged. The queue is oldest-first, so on a database with a
    // backlog a `limit=100` sweep can miss an application filed a moment ago.
    const queue = await ctx.get(`${API}/claims?search=${TAG}.owner@e2e.test`);
    const claim = (await queue.json()).data.find(
      (c: { business?: { id: string } }) => c.business?.id === business.id,
    );
    expect(claim, "the application was not found in the queue").toBeTruthy();
    const approved = await ctx.post(`${API}/claims/${claim.id}/approve`);
    expect(approved.status(), await approved.text()).toBe(200);
    const inviteUrl = (await approved.json()).data.devInviteUrl as string;
    await ctx.dispose();

    expect(inviteUrl, "no set-password link was issued").toBeTruthy();

    // The badge the whole pipeline exists to produce.
    await page.goto(`/business/${business.slug}`);
    await expect(page.getByText("Verified").first()).toBeVisible();
    await expect(page.getByText(/is this your business/i)).toHaveCount(0);

    await page.goto(new URL(inviteUrl).pathname + new URL(inviteUrl).search);

    // The page names the business, so a garage owner opening this a week later
    // knows it is the thing they applied for rather than a phishing attempt.
    await expect(page.getByText(business.name)).toBeVisible();
    await expect(page.getByText(`${TAG}.owner@e2e.test`)).toBeVisible();

    await page.getByLabel("New password", { exact: true }).fill("OwnerSecret123");
    await page.getByLabel("Confirm password").fill("MISMATCH123456");
    await page.getByRole("button", { name: /set password and continue/i }).click();
    await expect(page.getByRole("alert")).toContainText(/don't match/i);

    await page.getByLabel("Confirm password").fill("OwnerSecret123");
    await page.getByRole("button", { name: /set password and continue/i }).click();

    // Straight into the portal — setting a password and then typing it back on
    // a sign-in page is friction with nothing behind it.
    await page.waitForURL(/\/portal/);
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
  });

  test("a used invitation link says so", async ({ page }) => {
    await page.goto("/accept-invite?token=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    await expect(page.getByText(/expired/i)).toBeVisible();
  });

  test("an invitation link with no token is handled", async ({ page }) => {
    await page.goto("/accept-invite");
    await expect(page.getByText(/incomplete/i)).toBeVisible();
  });
});

test.describe("Phase 3 · On a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("no onboarding route scrolls sideways", async ({ page }) => {
    const business = await seedListing(`${TAG} Mobile Garage`);
    for (const route of [
      "/for-business",
      "/register-business",
      `/business/${business.slug}/claim`,
    ]) {
      await page.goto(route);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }
  });

  test("the upload control is a real target, not a default file input", async ({ page }) => {
    const business = await seedListing(`${TAG} Upload Garage`);
    await page.goto(`/business/${business.slug}/claim`);

    const chooser = page.getByRole("button", { name: /choose a document/i });
    await expect(chooser).toBeVisible();
    const box = await chooser.boundingBox();
    // A garage owner doing this one-handed on a forecourt.
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });

  test("every standalone control clears the touch floor", async ({ page }) => {
    const business = await seedListing(`${TAG} Touch Garage`);
    for (const route of ["/for-business", `/business/${business.slug}/claim`]) {
      await page.goto(route);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expectTouchTargets(page, route);
    }
  });
});

test.describe("Phase 3 · Accessibility", () => {
  test("every claim field is labelled and errors are announced", async ({ page }) => {
    const business = await seedListing(`${TAG} A11y Garage`);
    await page.goto(`/business/${business.slug}/claim`);

    const unlabelled = await page.evaluate(() =>
      Array.from(document.querySelectorAll("input, textarea, select"))
        .filter((el) => {
          if (el.getAttribute("aria-label")) return false;
          if (el.classList.contains("sr-only")) return false;
          const id = el.getAttribute("id");
          return !id || !document.querySelector(`label[for="${id}"]`);
        })
        .map((el) => el.outerHTML.slice(0, 90)),
    );
    expect(unlabelled, unlabelled.join("\n")).toEqual([]);

    await page.getByRole("button", { name: /send application/i }).click();
    await expect(page.getByRole("alert").first()).toBeVisible();
  });

  test("headings start at level one and do not skip", async ({ page }) => {
    for (const route of ["/for-business", "/register-business"]) {
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
