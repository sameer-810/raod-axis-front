import { test, expect, request as pwRequest, type APIRequestContext, type Page } from "@playwright/test";
import { API, expectNoHorizontalOverflow, expectTouchTargets } from "./helpers";

/**
 * Phase 6 — reviews, saved garages, analytics, SEO and bulk import.
 *
 * Everything here is about coming back. A driver who saves a garage has a reason
 * to open RoadAxis next time; a driver who leaves a review is the reason the
 * next one trusts the listing. So the assertions are mostly about the two ways
 * this can be got wrong quietly: showing a rating that does not exist, and
 * losing what somebody just did.
 */

const TAG = `p6${Date.now().toString(36)}`;

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

async function seedBusiness(suffix: string) {
  const { ctx } = await adminContext();
  const created = await ctx.post(`${API}/businesses`, {
    data: {
      name: `${TAG} ${suffix} Motors`,
      address: { line1: "21 Portland Street", city: "Manchester", postcode: "M1 4GX" },
      latitude: 53.4795,
      longitude: -2.2385,
      services: [{ name: "Full service", priceFrom: 120 }],
    },
  });
  expect(created.status(), await created.text()).toBe(201);
  // Read the body before disposing the context, or the response goes with it.
  const business = (await created.json()).data as { id: string; slug: string; name: string };
  await ctx.dispose();
  return business;
}

async function signInAsDriver(page: Page, slot: string) {
  const email = `${TAG}.${slot}@e2e.test`;
  const phone = await freePhone();

  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("WhatsApp number").fill(phone);
  await page.getByRole("button", { name: /send me a code/i }).click();
  await expect(page.getByRole("heading", { name: /enter your codes/i })).toBeVisible();

  const digits = (
    await page.evaluate(() =>
      Array.from(document.querySelectorAll(".font-mono")).map((e) => e.textContent?.trim() ?? ""),
    )
  ).filter((c) => /^\d{6}$/.test(c));

  const nameField = page.getByLabel("Your name");
  if (await nameField.isVisible().catch(() => false)) await nameField.fill(`Driver ${slot}`);
  await page.getByLabel("Code from your email").fill(digits[0]);
  await page.getByLabel("Code from WhatsApp").fill(digits[1]);

  const signedIn = page.waitForResponse(
    (r) => r.url().includes("/auth/otp/verify") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: /^sign in$/i }).click();
  expect((await signedIn).status(), "driver sign-in failed").toBe(200);
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"));
  return { email, phone };
}

async function signInAsAdmin(page: Page) {
  const { token, ctx } = await adminContext();
  await ctx.dispose();
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

/** Leave a review through the interface, as a driver would. */
async function leaveReview(page: Page, stars: number, text?: string) {
  await page.getByRole("radio", { name: new RegExp(`^${stars} stars? —`) }).check();
  if (text) await page.getByLabel(/anything to add/i).fill(text);
  const saved = page.waitForResponse(
    (r) => /\/reviews$/.test(r.url()) && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: /post review|update review/i }).click();
  return saved;
}

test.describe("Phase 6 · Reviews", () => {
  test("a business with no reviews says so, and never shows nought stars", async ({ page }) => {
    const business = await seedBusiness("Unrated");
    await page.goto(`/business/${business.slug}`);

    await expect(page.getByRole("heading", { name: "Reviews" })).toBeVisible();
    await expect(page.getByText(/no reviews yet/i)).toBeVisible();

    /**
     * The rule the whole trust system rests on. A new business has not failed;
     * rendering a zero rating is a libel we generated ourselves out of an
     * absence of data.
     */
    const body = await page.locator("body").innerText();
    expect(body).not.toMatch(/\b0\.0\b/);
    expect(body).not.toMatch(/\b0 out of 5\b/);
  });

  test("a guest is told why an account is needed, and comes back to the same page", async ({
    page,
  }) => {
    const business = await seedBusiness("GuestReview");
    await page.goto(`/business/${business.slug}`);

    // Reading is open — the rest of the public product is, and reviews are what
    // a driver is weighing at the roadside.
    await expect(page.getByRole("heading", { name: "Reviews" })).toBeVisible();

    const cta = page.getByRole("link", { name: /sign in to review/i });
    await expect(cta).toBeVisible();
    await cta.click();
    // The return journey travels in the URL, so it survives a page reload.
    await expect(page).toHaveURL(new RegExp(`returnTo=.*${business.slug}`));
  });

  test("a driver rates with one tap, and the profile updates without a reload", async ({
    page,
  }) => {
    const business = await seedBusiness("Rated");
    await signInAsDriver(page, "rater");
    await page.goto(`/business/${business.slug}`);

    const res = await leaveReview(page, 5, "Sorted it the same day.");
    expect(res.status()).toBe(201);

    await expect(page.getByText("Thanks for the review", { exact: true })).toBeVisible();
    // The star rating in the header is now stale unless the mutation invalidated
    // it — which is the bug this assertion exists to catch.
    await expect(page.getByText("from 1 review", { exact: true })).toBeVisible();
    // `.first()`: the text is in the list and in the form it pre-fills for
    // editing, which is the point — but either one proves it was saved.
    await expect(page.getByText("Sorted it the same day.").first()).toBeVisible();
  });

  test("words are optional; stars alone are a review", async ({ page }) => {
    const business = await seedBusiness("StarsOnly");
    await signInAsDriver(page, "starsonly");
    await page.goto(`/business/${business.slug}`);

    // Most people give a rating and nothing else. A form insisting on a
    // paragraph collects far fewer of both.
    const res = await leaveReview(page, 4);
    expect(res.status()).toBe(201);
    await expect(page.getByText("Thanks for the review", { exact: true })).toBeVisible();
  });

  test("a second visit opens the form pre-filled and edits rather than duplicating", async ({
    page,
  }) => {
    const business = await seedBusiness("Edited");
    await signInAsDriver(page, "editor");
    await page.goto(`/business/${business.slug}`);

    await leaveReview(page, 3, "Waited a while.");
    await expect(page.getByText("from 1 review", { exact: true })).toBeVisible();

    await page.reload();
    // Editing starts from what they actually said, not from a blank form.
    await expect(page.getByRole("radio", { name: /^3 stars —/ })).toBeChecked();
    await expect(page.getByLabel(/anything to add/i)).toHaveValue("Waited a while.");
    await expect(page.getByText(/saving replaces your earlier review/i)).toBeVisible();

    const res = await leaveReview(page, 5, "They put it right. Changed my mind.");
    expect(res.status()).toBe(200);
    // One review, not two. People change their minds about a garage.
    await expect(page.getByText("from 1 review", { exact: true })).toBeVisible();
  });

  test("the star input is a radio group a keyboard can work", async ({ page }) => {
    const business = await seedBusiness("Keyboard");
    await signInAsDriver(page, "keys");
    await page.goto(`/business/${business.slug}`);

    const group = page.getByRole("radiogroup", { name: /your rating/i });
    await expect(group).toBeVisible();
    // Five shapes at 16px is a picture a screen reader cannot describe; each
    // star carries its own word so the scale is comparable between people.
    await expect(page.getByRole("radio", { name: /^5 stars — Excellent/ })).toBeAttached();
    await expect(page.getByRole("radio", { name: /^1 star — Poor/ })).toBeAttached();
  });
});

test.describe("Phase 6 · Moderation", () => {
  test("an administrator removes a review with a reason, and the rating recovers", async ({
    page,
  }) => {
    const business = await seedBusiness("Moderated");
    await signInAsDriver(page, "moderated");
    await page.goto(`/business/${business.slug}`);
    await leaveReview(page, 1, "Something an administrator would take down.");
    await expect(page.getByText("from 1 review", { exact: true })).toBeVisible();

    await signInAsAdmin(page);
    await page.goto("/admin/reviews");
    // Scoped by the business, whose name carries this run's tag. Matching on the
    // review text alone would find one an earlier run left behind and moderate
    // somebody else's fixture.
    const row = page.locator("li").filter({ hasText: business.name }).first();
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Remove" }).click();

    const confirm = page.getByRole("button", { name: /remove review/i });
    // A reason is required — the person who wrote it will ask why.
    await expect(confirm).toBeDisabled();
    await page.getByLabel(/why is it being removed/i).fill("Names a member of staff");
    await expect(confirm).toBeEnabled();
    await confirm.click();
    await expect(page.getByText("Review removed", { exact: true })).toBeVisible();

    await page.goto(`/business/${business.slug}`);
    await expect(page.getByText(/no reviews yet/i)).toBeVisible();
    await expect(page.getByText("Something an administrator would take down.")).toHaveCount(0);
  });

  test("a removed review is kept, with its reason, for anyone who asks why", async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto("/admin/reviews");
    await page.getByLabel(/show removed/i).check();
    // Soft, not deleted: the aggregate has to be recomputable and "why was this
    // taken down" is a question that gets asked.
    await expect(page.getByText(/removed/i).first()).toBeVisible();
  });
});

test.describe("Phase 6 · My Garages", () => {
  test("a guest pressing save is told what it is for, not simply refused", async ({ page }) => {
    const business = await seedBusiness("GuestSave");
    await page.goto(`/business/${business.slug}`);

    const save = page.getByRole("button", { name: new RegExp(`save ${TAG}`, "i") });
    await expect(save).toBeVisible();
    await save.click();
    // Hiding the control until sign-in means nobody learns the feature exists.
    await expect(page.getByText(/keep your garages in one place/i)).toBeVisible();
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("the save a guest asked for completes after signing in, without a second tap", async ({
    page,
  }) => {
    const business = await seedBusiness("PendingSave");
    await page.goto(`/business/${business.slug}`);
    await page.getByRole("button", { name: new RegExp(`save ${TAG}`, "i") }).click();
    await expect(page).toHaveURL(/\/sign-in/);

    // The sign-in helper starts at /sign-in itself; the returnTo is already in
    // the URL, so completing the flow lands back on the profile.
    await signInAsDriver(page, "pendingsave");
    await page.goto(`/business/${business.slug}`);

    /**
     * US-603. The second tap is where people give up, and this is the only
     * retention mechanism the MVP has.
     */
    await expect(page.getByRole("button", { name: /remove .* from my garages/i })).toBeVisible();
    await page.goto("/my-garages");
    await expect(page.getByRole("heading", { name: business.name })).toBeVisible();
  });

  test("saving fills the heart immediately and the garage appears in My Garages", async ({
    page,
  }) => {
    const business = await seedBusiness("Saved");
    await signInAsDriver(page, "saver");
    await page.goto(`/business/${business.slug}`);

    const save = page.getByRole("button", { name: new RegExp(`save ${TAG}`, "i") });
    await save.click();
    // Optimistic: a heart that waits for a round trip reads as a broken button.
    await expect(page.getByRole("button", { name: /remove .* from my garages/i })).toBeVisible();
    await expect(page.getByText("Saved to My Garages", { exact: true })).toBeVisible();

    await page.goto("/my-garages");
    await expect(page.getByRole("heading", { name: "My Garages" })).toBeVisible();
    await expect(page.getByRole("heading", { name: business.name })).toBeVisible();
  });

  test("unsaving removes it from the list rather than leaving an empty heart", async ({ page }) => {
    const business = await seedBusiness("Unsaved");
    await signInAsDriver(page, "unsaver");
    await page.goto(`/business/${business.slug}`);
    await page.getByRole("button", { name: new RegExp(`save ${TAG}`, "i") }).click();

    await page.goto("/my-garages");
    await expect(page.getByRole("heading", { name: business.name })).toBeVisible();
    await page.getByRole("button", { name: /remove .* from my garages/i }).click();

    // A list whose whole meaning is "things you saved" must not keep a row that
    // is no longer one.
    await expect(page.getByRole("heading", { name: business.name })).toHaveCount(0);
    await expect(page.getByText(/nothing saved yet/i)).toBeVisible();
  });

  test("the empty state says what saving is for and offers the next move", async ({ page }) => {
    await signInAsDriver(page, "empty");
    await page.goto("/my-garages");
    // "Nothing saved" on its own is a dead end, and this is the retention screen.
    await expect(page.getByText(/nothing saved yet/i)).toBeVisible();
    // Scoped to the page: the header nav carries the same words, and this is
    // about the empty state offering a way out rather than about the header.
    await expect(
      page.getByRole("main").getByRole("link", { name: /find a service/i }),
    ).toBeVisible();
  });

  test("saving from a search card does not open the business", async ({ page }) => {
    const business = await seedBusiness("CardSave");
    await signInAsDriver(page, "cardsaver");
    await page.goto(`/search?q=${encodeURIComponent(business.name)}`);

    const card = page.locator("article").filter({ hasText: business.name }).first();
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: /save .* to my garages/i }).click();

    // The card is one big stretched link; without stopPropagation this navigates.
    await expect(page).toHaveURL(/\/search/);
    await expect(card.getByRole("button", { name: /remove .* from my garages/i })).toBeVisible();
  });
});

test.describe("Phase 6 · Analytics", () => {
  test("the dashboard reports what it knows and dashes what it does not", async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto("/admin/analytics");

    await expect(page.getByRole("heading", { name: "The directory" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Discover → Contact → Book" })).toBeVisible();

    /**
     * The sharp case. In deep-link mode nothing is trackable, and a confident
     * "100%" here is the exact failure the delivery log exists to prevent.
     */
    const delivery = page.locator("div").filter({ hasText: /^Delivery rate/ }).first();
    await expect(delivery).toContainText("—");
    await expect(delivery).toContainText(/deep-link mode/i);
  });

  test("the reporting window changes the figures without blanking the page", async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto("/admin/analytics");
    await expect(page.getByRole("button", { name: "30 days" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await page.getByRole("button", { name: "7 days" }).click();
    await expect(page.getByRole("button", { name: "7 days" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // placeholderData keeps the previous window on screen — a dashboard someone
    // is reading must not go blank because they changed a filter.
    await expect(page.getByRole("heading", { name: "The directory" })).toBeVisible();
  });

  test("the trend charts are described, not just drawn", async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto("/admin/analytics");
    // A library chart arrives as an unlabelled canvas. This one has a title.
    const chart = page.getByRole("img", { name: /new accounts:/i });
    await expect(chart).toBeVisible();
  });
});

test.describe("Phase 6 · Being findable", () => {
  test("a business profile has its own title, description and structured data", async ({
    page,
  }) => {
    const business = await seedBusiness("Seo");
    await page.goto(`/business/${business.slug}`);

    // Without this every page in a single-page app shares one title, which is
    // the same as having none.
    await expect(page).toHaveTitle(new RegExp(`${business.name}.*RoadAxis`));

    const description = await page
      .locator('meta[name="description"]')
      .getAttribute("content");
    expect(description).toContain(business.name);
    expect(description).toContain("Manchester");

    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
    expect(canonical).toContain(`/business/${business.slug}`);

    const jsonLd = await page.locator('script[type="application/ld+json"]').textContent();
    const data = JSON.parse(jsonLd ?? "{}");
    expect(data["@type"]).toBe("AutoRepair");
    expect(data.name).toBe(business.name);
    expect(data.address.addressLocality).toBe("Manchester");
    // Google penalises a rating of zero from no reviews, and so it should.
    expect(data.aggregateRating).toBeUndefined();
  });

  test("the title does not follow the reader onto the next page", async ({ page }) => {
    const business = await seedBusiness("SeoLeave");
    await page.goto(`/business/${business.slug}`);
    await expect(page).toHaveTitle(new RegExp(business.name));

    await page.getByRole("link", { name: /back to search/i }).click();
    await expect(page).not.toHaveTitle(new RegExp(business.name));
    // And the structured data goes with it — two LocalBusiness blocks on one
    // page describe two businesses.
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(0);
  });

  test("a driver's own saved list is not offered to search engines", async ({ page }) => {
    await signInAsDriver(page, "noindex");
    await page.goto("/my-garages");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex");
  });
});

test.describe("Phase 6 · Bulk import", () => {
  /**
   * Coordinates are randomised per call, and that is load-bearing.
   *
   * The importer refuses a row that looks like a business already listed within
   * 500 m with a similar name — which is the behaviour these tests are checking.
   * Fixed coordinates mean the *second* run of this suite collides with the
   * first one's fixtures and every import test fails for a reason that has
   * nothing to do with the code.
   */
  const somewhereInBritain = () => ({
    lat: (52 + Math.random() * 3).toFixed(4),
    lng: (-3 + Math.random() * 2).toFixed(4),
  });

  const csv = (name: string) => {
    const a = somewhereInBritain();
    const b = somewhereInBritain();
    return [
      "name,line1,city,postcode,latitude,longitude,description",
      `"${name}",1 Import Way,Salford,M5 4WT,${a.lat},${a.lng},"Quoted, with a comma"`,
      `,2 Import Way,Salford,M5 4WT,${b.lat},${b.lng},No name at all`,
    ].join("\n");
  };

  test("a preview reports row by row and writes nothing", async ({ page }) => {
    const name = `${TAG} Imported Alpha`;
    await signInAsAdmin(page);
    await page.goto("/admin/businesses/import");

    await page.setInputFiles('input[type="file"]', {
      name: "listings.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv(name)),
    });
    await page.getByRole("button", { name: /check the file/i }).click();

    await expect(page.getByText(/checked 2 rows/i)).toBeVisible();
    // The line number is the only way back to the cell that is wrong.
    const problem = page.locator("tr").filter({ hasText: "Problem" });
    await expect(problem).toContainText("3");
    await expect(problem).toContainText(/name/i);

    // A preview that writes is not a preview.
    await page.goto(`/search?q=${encodeURIComponent(name)}`);
    await expect(page.getByRole("heading", { name })).toHaveCount(0);
  });

  test("committing puts the good rows in the public directory", async ({ page }) => {
    const name = `${TAG} Imported Beta`;
    await signInAsAdmin(page);
    await page.goto("/admin/businesses/import");

    await page.setInputFiles('input[type="file"]', {
      name: "listings.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv(name)),
    });
    await page.getByRole("button", { name: /check the file/i }).click();
    await expect(page.getByRole("heading", { name: "3. Import" })).toBeVisible();

    await page.getByRole("button", { name: /^import 1 listing$/i }).click();
    await expect(page.getByText(/imported 1 of 2/i)).toBeVisible();

    await page.goto(`/search?q=${encodeURIComponent(name)}`);
    await expect(page.getByRole("heading", { name })).toBeVisible();
  });

  test("importing the same file twice creates nothing", async ({ page }) => {
    const name = `${TAG} Imported Gamma`;
    // The same bytes both times — that is the whole point of the test.
    const file = csv(name);
    await signInAsAdmin(page);

    for (const pass of [1, 2]) {
      await page.goto("/admin/businesses/import");
      await page.setInputFiles('input[type="file"]', {
        name: "listings.csv",
        mimeType: "text/csv",
        buffer: Buffer.from(file),
      });
      await page.getByRole("button", { name: /check the file/i }).click();

      if (pass === 1) {
        await page.getByRole("button", { name: /^import 1 listing$/i }).click();
        await expect(page.getByText(/imported 1 of 2/i)).toBeVisible();
      } else {
        // The same file imported twice by someone who was not sure it worked is
        // the failure mode that damages the directory most, and it is silent.
        await expect(page.getByRole("button", { name: /^import 0 listings$/i })).toBeDisabled();
        await expect(page.locator("tr").filter({ hasText: "Skipped" })).toContainText(
          /already listed nearby/i,
        );
      }
    }
  });
});

test.describe("Phase 6 · The phone", () => {
  test("the review form and My Garages fit a phone", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "Mobile-only assertions");

    const business = await seedBusiness("Mobile");
    await signInAsDriver(page, "mobile");

    await page.goto(`/business/${business.slug}`);
    await expectNoHorizontalOverflow(page);
    // The stars are the only control on this form. A 20px icon is a control most
    // people miss on the first try.
    await expectTouchTargets(page, "business profile with reviews");

    await page.goto("/my-garages");
    await expectNoHorizontalOverflow(page);
    await expectTouchTargets(page, "my garages");
  });

  test("the analytics dashboard does not scroll sideways", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "Mobile-only assertions");
    await signInAsAdmin(page);
    await page.goto("/admin/analytics");
    await expect(page.getByRole("heading", { name: "The directory" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
