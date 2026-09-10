import {
  test,
  expect,
  request as pwRequest,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { API, expectNoHorizontalOverflow, expectTouchTargets } from "./helpers";

/**
 * Phase 4 — WhatsApp numbers, admin control, and the audit trail.
 *
 * These two rows of data decide whether a real business hears about a customer
 * at all, so the suite follows both sides: an owner setting it up, and an
 * administrator intervening on somebody else's listing.
 */

const TAG = `p4${Date.now().toString(36)}`;

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

/**
 * A listing with an owner who can actually sign in. Built through the product's
 * own routes — an admin seeds the listing, creates a staff account, and
 * transfers ownership — so the access under test is the access the product
 * grants rather than a fixture that bypasses it.
 */
async function seedOwnedBusiness(suffix: string) {
  const { ctx } = await adminContext();

  const created = await ctx.post(`${API}/businesses`, {
    data: {
      name: `${TAG} ${suffix} Motors`,
      address: { line1: "12 Trinity Way", city: "Salford", postcode: "M3 7BB" },
      latitude: 53.4855,
      longitude: -2.2555,
    },
  });
  expect(created.status(), await created.text()).toBe(201);
  const business = (await created.json()).data as { id: string; slug: string; name: string };

  const email = `${TAG}.${suffix}@e2e.test`.toLowerCase();
  const password = "OwnerSecret123";
  await ctx.post(`${API}/auth/users`, {
    data: { name: `${suffix} Owner`, email, password, role: "business_owner" },
  });
  const transfer = await ctx.post(`${API}/businesses/${business.id}/transfer`, {
    data: { email, reason: "E2E fixture: giving this listing a signed-in owner." },
  });
  expect(transfer.status(), await transfer.text()).toBe(200);

  await ctx.dispose();
  return { business, email, password };
}

/** Sign in through the real form, so the session is the one the product issues. */
async function signIn(page: Page, email: string, password: string) {
  await page.goto("/staff/sign-in");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL(/\/portal/);
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

async function addNumber(page: Page, label: string, phone: string) {
  await page.getByRole("button", { name: /add a number/i }).click();
  await page.getByLabel("What is this number for?").fill(label);
  await page.getByLabel("WhatsApp number").fill(phone);
  await page.getByRole("button", { name: /add number/i }).click();
  await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
}

test.describe("Phase 4 · An owner sets up their numbers", () => {
  test("the portal says plainly whether customers can reach them", async ({ page }) => {
    const { email, password } = await seedOwnedBusiness("Reach");
    await signIn(page, email, password);

    // WhatsApp is the only channel this product has, so "can customers reach
    // me" is not a detail on a settings screen — it is the dashboard.
    await expect(page.getByText(/customers can't reach you/i)).toBeVisible();
    await expect(page.getByText(/add a whatsapp number/i)).toBeVisible();
  });

  test("adding the first number makes it primary and routes to it", async ({ page }) => {
    const { email, password } = await seedOwnedBusiness("First");
    await signIn(page, email, password);
    await page.goto("/portal/whatsapp");

    await addNumber(page, "Customer Support", "07700 900 711");

    // A business with numbers and no Primary is unreachable by the automatic
    // path, so the first one takes the role whether or not anyone asked.
    // `exact` — the page's own explanatory copy also contains the word.
    await expect(page.getByText("Primary", { exact: true })).toBeVisible();
    await expect(page.getByText(/booking requests go to/i)).toBeVisible();
    await expect(page.getByText("Customer Support").first()).toBeVisible();
  });

  test("a number needs a label, because that is the point of having two", async ({ page }) => {
    const { email, password } = await seedOwnedBusiness("Label");
    await signIn(page, email, password);
    await page.goto("/portal/whatsapp");

    await page.getByRole("button", { name: /add a number/i }).click();
    await page.getByLabel("WhatsApp number").fill("07700900712");
    await page.getByRole("button", { name: /add number/i }).click();

    // Two unlabelled numbers on a public profile ask a driver to guess.
    await expect(page.getByText(/give the number a label/i)).toBeVisible();
  });

  test("the primary can be switched, and the other number covers when it is off", async ({
    page,
  }) => {
    const { email, password } = await seedOwnedBusiness("Fallback");
    await signIn(page, email, password);
    await page.goto("/portal/whatsapp");

    await addNumber(page, "Customer Support", "07700900713");
    await addNumber(page, "Emergency", "07700900714");

    await page.getByRole("button", { name: /make primary/i }).click();
    await expect(page.getByText(/booking requests go to/i)).toBeVisible();
    await expect(page.getByText(/emergency/i).first()).toBeVisible();

    // The entire reason for allowing two numbers.
    await page.getByRole("checkbox", { name: /switch off emergency/i }).click();
    await expect(page.getByText(/primary number \(emergency\) is switched off/i)).toBeVisible();
    await expect(page.getByText(/booking requests go to/i)).toBeVisible();
  });

  test("switching the last number off warns that nothing can be delivered", async ({ page }) => {
    const { email, password } = await seedOwnedBusiness("LastOff");
    await signIn(page, email, password);
    await page.goto("/portal/whatsapp");

    await addNumber(page, "Customer Support", "07700900715");
    await page.getByRole("checkbox", { name: /switch off customer support/i }).click();

    // Not an error — a business closing for a fortnight is entitled to. But
    // saying so is the difference between a decision and an accident.
    await expect(page.getByText(/can't be delivered/i).first()).toBeVisible();
  });

  test("a third number is refused with the limit named", async ({ page }) => {
    const { email, password } = await seedOwnedBusiness("Limit");
    await signIn(page, email, password);
    await page.goto("/portal/whatsapp");

    await addNumber(page, "Customer Support", "07700900716");
    await addNumber(page, "Emergency", "07700900717");

    await expect(page.getByRole("button", { name: /add a number/i })).toHaveCount(0);
    await expect(page.getByText(/up to.*2.*numbers/i)).toBeVisible();
  });
});

test.describe("Phase 4 · What a driver sees", () => {
  test("both labelled numbers are offered on the public profile", async ({ page }) => {
    const { business, email, password } = await seedOwnedBusiness("Public");
    await signIn(page, email, password);
    await page.goto("/portal/whatsapp");
    await addNumber(page, "Customer Support", "07700900718");
    await addNumber(page, "Emergency", "07700900719");

    await page.evaluate(() => localStorage.clear());
    await page.goto(`/business/${business.slug}`);

    // FR-PRO-04: choosing "Emergency" over "Customer Support" is the reason a
    // business has two numbers, so both are offered with their labels.
    const section = page
      .getByRole("region", { name: /message them/i })
      .or(page.locator("section", { hasText: "Message them" }));
    await expect(section.getByText("Customer Support")).toBeVisible();
    await expect(section.getByText("Emergency")).toBeVisible();

    const link = page.getByRole("link", { name: /customer support/i });
    await expect(link).toHaveAttribute("href", /^https:\/\/wa\.me\/447700900718/);
    await expect(link).toHaveAttribute("target", "_blank");
  });

  test("a switched-off number disappears from the profile entirely", async ({ page }) => {
    const { business, email, password } = await seedOwnedBusiness("Hidden");
    await signIn(page, email, password);
    await page.goto("/portal/whatsapp");
    await addNumber(page, "Customer Support", "07700900720");
    await addNumber(page, "Emergency", "07700900721");

    // The toggle is optimistic — the screen changes before the server has.
    // Navigating away on the optimistic state cancels the PATCH in flight, and
    // the public page then truthfully shows a number that was never switched
    // off. Wait for the write, not the paint.
    const switchedOff = page.waitForResponse(
      (r) => r.url().includes("/whatsapp-numbers/") && r.request().method() === "PATCH",
    );
    await page.getByRole("checkbox", { name: /switch off emergency/i }).click();
    expect((await switchedOff).status()).toBe(200);

    await page.evaluate(() => localStorage.clear());
    await page.goto(`/business/${business.slug}`);

    // Greyed out would still invite a driver to try it, and the whole reason it
    // is off is that somebody does not want customers reaching it.
    await expect(page.getByText("Customer Support")).toBeVisible();
    await expect(page.getByText("Emergency")).toHaveCount(0);
  });

  test("which number the business routes to is not public", async ({ page }) => {
    const { business, email, password } = await seedOwnedBusiness("Private");
    await signIn(page, email, password);
    await page.goto("/portal/whatsapp");
    await addNumber(page, "Customer Support", "07700900722");

    await page.evaluate(() => localStorage.clear());
    await page.goto(`/business/${business.slug}`);
    // Surfacing it would nudge every driver onto the same one, which is the
    // opposite of why there are two.
    await expect(page.getByText("Primary", { exact: true })).toHaveCount(0);
  });
});

test.describe("Phase 4 · Admin intervention", () => {
  test("an admin must give a reason before silencing a number", async ({ page }) => {
    const { business, email, password } = await seedOwnedBusiness("AdminOff");
    await signIn(page, email, password);
    await page.goto("/portal/whatsapp");
    await addNumber(page, "Customer Support", "07700900723");

    await signInAsAdmin(page);
    await page.goto(`/admin/businesses/${business.id}`);

    await expect(page.getByRole("heading", { name: /whatsapp numbers/i })).toBeVisible();
    await page.getByRole("checkbox", { name: /switch off customer support/i }).click();

    // The owner reads this reason in their portal; without one their next
    // contact with us is "my phone stopped working".
    await expect(page.getByRole("heading", { name: /switch off customer support/i })).toBeVisible();
    await expect(page.getByText(/owner sees this reason/i)).toBeVisible();

    await page.getByLabel("Reason").fill("Reported as intercepting another garage's customers.");
    await page.getByRole("button", { name: /^switch off$/i }).click();
    await expect(page.getByText("Off").first()).toBeVisible();
  });

  test("the owner can see that RoadAxis switched it off, and why", async ({ page }) => {
    const { business, email, password } = await seedOwnedBusiness("Visible");
    await signIn(page, email, password);
    await page.goto("/portal/whatsapp");
    await addNumber(page, "Customer Support", "07700900724");

    const { ctx } = await adminContext();
    const numbers = await ctx.get(`${API}/businesses/${business.id}/whatsapp-numbers`);
    const number = (await numbers.json()).data[0];
    await ctx.patch(`${API}/businesses/${business.id}/whatsapp-numbers/${number.id}`, {
      data: { isActive: false, reason: "Under investigation after a customer report." },
    });
    await ctx.dispose();

    // Already signed in from above — going back through the sign-in form would
    // land on the "you're already signed in" redirect and never show the fields.
    await page.reload();
    await page.goto("/portal/whatsapp");

    // US-403. Discovering it as "my phone stopped working" is how a support
    // call becomes an accusation.
    await expect(page.getByText(/roadaxis switched this off/i)).toBeVisible();
    await expect(page.getByText(/under investigation/i)).toBeVisible();
  });

  test("an owner cannot reach another business's numbers", async ({ page }) => {
    const other = await seedOwnedBusiness("Neighbour");
    const mine = await seedOwnedBusiness("Mine");

    await signIn(page, mine.email, mine.password);
    // The console is admin-only, so an owner has no route to it at all — and
    // the server refuses the underlying request regardless.
    await page.goto(`/admin/businesses/${other.business.id}`);
    await expect(page).toHaveURL(/^(?!.*\/admin).*$/);
  });
});

test.describe("Phase 4 · The audit trail", () => {
  test("a guest cannot reach it", async ({ page }) => {
    await page.goto("/admin/audit");
    await expect(page).toHaveURL(/sign-in/);
  });

  test("every change to a number is recorded with who and why", async ({ page }) => {
    const { business, email, password } = await seedOwnedBusiness("Audited");
    await signIn(page, email, password);
    await page.goto("/portal/whatsapp");
    await addNumber(page, "Customer Support", "07700900725");

    const { ctx } = await adminContext();
    const numbers = await ctx.get(`${API}/businesses/${business.id}/whatsapp-numbers`);
    const number = (await numbers.json()).data[0];
    await ctx.patch(`${API}/businesses/${business.id}/whatsapp-numbers/${number.id}`, {
      data: { isActive: false, reason: "E2E: recorded so the audit page has something to show." },
    });
    await ctx.dispose();

    await signInAsAdmin(page);
    await page.goto("/admin/audit");

    await expect(page.getByText(/whatsapp number deactivated/i).first()).toBeVisible();
    await expect(page.getByText(/E2E: recorded so the audit page/i)).toBeVisible();
    await expect(page.getByText(business.name).first()).toBeVisible();
  });

  test("the log can be narrowed to one kind of action", async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto("/admin/audit");

    await page.getByLabel("Action").selectOption("business.ownership_transferred");
    await expect(page.getByText(/business ownership transferred/i).first()).toBeVisible();
    await expect(page.getByText(/whatsapp number added/i)).toHaveCount(0);
  });

  test("consequential actions are marked, routine ones are not", async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto("/admin/audit");

    // A log where every row is highlighted has no highlights. Only the actions
    // whose consequences reach outside RoadAxis are marked.
    const marked = page.locator(".border-warning\\/30").first();
    await expect(marked).toBeVisible();
  });
});

test.describe("Phase 4 · On a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the WhatsApp screens do not scroll sideways", async ({ page }) => {
    const { email, password } = await seedOwnedBusiness("Mobile");
    await signIn(page, email, password);
    await page.goto("/portal/whatsapp");
    // The page's own copy, not "Booking requests" — that phrase is also a
    // sidebar destination, which is present but hidden below `md`.
    await expect(page.getByText(/sent to your primary number/i)).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await addNumber(page, "Customer Support", "07700900726");
    await expectNoHorizontalOverflow(page);
  });

  test("every standalone control clears the touch floor", async ({ page }) => {
    const { email, password } = await seedOwnedBusiness("Touch");
    await signIn(page, email, password);
    await page.goto("/portal/whatsapp");
    await addNumber(page, "Customer Support", "07700900727");
    await expectTouchTargets(page, "/portal/whatsapp");
  });

  test("the audit log does not scroll sideways", async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto("/admin/audit");
    await expect(page.getByText(/entries/i).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});

test.describe("Phase 4 · Accessibility", () => {
  test("each toggle names the number it controls", async ({ page }) => {
    const { email, password } = await seedOwnedBusiness("A11y");
    await signIn(page, email, password);
    await page.goto("/portal/whatsapp");
    await addNumber(page, "Customer Support", "07700900728");
    await addNumber(page, "Emergency", "07700900729");

    // Two unlabelled checkboxes in a list is a screen reader announcing
    // "checkbox, checked" twice with no way to tell which phone is which.
    await expect(
      page.getByRole("checkbox", { name: /switch off customer support/i }),
    ).toBeVisible();
    await expect(page.getByRole("checkbox", { name: /switch off emergency/i })).toBeVisible();
  });

  test("headings start at level one and do not skip", async ({ page }) => {
    const { email, password } = await seedOwnedBusiness("Headings");
    await signIn(page, email, password);

    for (const route of ["/portal", "/portal/whatsapp"]) {
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
