import { test, expect, request as pwRequest, type APIRequestContext, type Page } from "@playwright/test";
import { API, expectNoHorizontalOverflow, expectTouchTargets } from "./helpers";

/**
 * Phase 5 — the core loop, through the real interface.
 *
 * Discover → Contact → Book, which is the whole product. This suite follows one
 * request the entire way: a guest fills in the form, hits the one wall, signs
 * in, sends it, and a garage owner answers it — and then checks that the words
 * on every screen say "request" rather than "booking".
 */

const TAG = `p5${Date.now().toString(36)}`;

/** A number nobody owns — Ofcom's reserved drama range. */
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

/** A listing that can actually receive a request: services, an owner, a number. */
async function seedBookableBusiness(suffix: string) {
  const { ctx } = await adminContext();

  const created = await ctx.post(`${API}/businesses`, {
    data: {
      name: `${TAG} ${suffix} Tyres`,
      address: { line1: "5 Whitworth Street", city: "Manchester", postcode: "M1 3AL" },
      latitude: 53.4761,
      longitude: -2.2402,
      services: [
        { name: "Tyre replacement", priceFrom: 55 },
        { name: "Brake check", priceFrom: 40 },
      ],
    },
  });
  expect(created.status(), await created.text()).toBe(201);
  const business = (await created.json()).data as { id: string; slug: string; name: string };

  const email = `${TAG}.${suffix}owner@e2e.test`.toLowerCase();
  const password = "OwnerSecret123";
  await ctx.post(`${API}/auth/users`, {
    data: { name: `${suffix} Owner`, email, password, role: "business_owner" },
  });
  await ctx.post(`${API}/businesses/${business.id}/transfer`, {
    data: { email, reason: "E2E fixture: an owner who can work the inbox." },
  });
  await ctx.post(`${API}/businesses/${business.id}/whatsapp-numbers`, {
    data: { label: "Customer Support", phone: await freePhone() },
  });

  await ctx.dispose();
  return { business, email, password };
}

/** Sign in as a driver through the real one-time-code flow. */
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
  const res = await signedIn;
  expect(res.status(), "driver sign-in failed").toBe(200);
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"));
  return { email, phone };
}

async function signInAsOwner(page: Page, email: string, password: string) {
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

/** Fill in and submit the request form on whichever page is open. */
async function fillRequest(page: Page, service = "Tyre replacement", daysAhead = 2) {
  const when = new Date(Date.now() + daysAhead * 86_400_000);
  const date = new Date(when.getTime() - when.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);

  await page.getByLabel("What do you need?").selectOption(service);
  await page.getByLabel("Preferred date").fill(date);
  await page.getByLabel("Preferred time").fill("10:30");
  await page.getByLabel(/anything they should know/i).fill("Front nearside, 205/55 R16");
  await page.getByRole("button", { name: /send request/i }).click();
  return date;
}

test.describe("Phase 5 · The wall, and getting through it", () => {
  test("the profile's primary action asks for a booking, never books one", async ({ page }) => {
    const { business } = await seedBookableBusiness("Primary");
    await page.goto(`/business/${business.slug}`);

    const cta = page.getByRole("link", { name: "Request a Booking" }).first();
    await expect(cta).toBeVisible();
    // FR-BKG-10, on the most-clicked control in the product.
    const body = await page.locator("body").innerText();
    expect(body).not.toMatch(/\bBook now\b/i);
    expect(body).not.toMatch(/\bBooked\b/);
  });

  test("a guest can fill in the whole form before being asked to sign in", async ({ page }) => {
    const { business } = await seedBookableBusiness("Guest");
    await page.goto(`/business/${business.slug}/request`);

    // The page itself is open. Verification belongs after the commitment.
    await expect(page).not.toHaveURL(/sign-in/);
    await expect(page.getByRole("heading", { name: /request a booking/i })).toBeVisible();
    await expect(page.getByText(/doesn't hold a slot/i)).toBeVisible();

    await fillRequest(page);
    await expect(page).toHaveURL(/\/sign-in\?returnTo=/);
  });

  test("the draft survives the sign-in detour", async ({ page }) => {
    const { business } = await seedBookableBusiness("Draft");
    await page.goto(`/business/${business.slug}/request`);
    const date = await fillRequest(page, "Brake check", 5);

    await expect(page).toHaveURL(/\/sign-in/);
    await signInAsDriver(page, "draft");
    await page.goto(`/business/${business.slug}/request`);

    // Losing what somebody was doing is how authentication friction turns into
    // an abandoned session, and the cost is worst on a phone.
    await expect(page.getByLabel("What do you need?")).toHaveValue("Brake check");
    await expect(page.getByLabel("Preferred date")).toHaveValue(date);
    await expect(page.getByLabel(/anything they should know/i)).toHaveValue(/205\/55/);
  });
});

test.describe("Phase 5 · Sending a request", () => {
  test("a signed-in driver sends one and is told what happens next", async ({ page }) => {
    const { business } = await seedBookableBusiness("Send");
    await signInAsDriver(page, "send");
    await page.goto(`/business/${business.slug}/request`);

    await fillRequest(page);

    await expect(page.getByRole("heading", { name: /request sent/i })).toBeVisible();
    await expect(page.getByText(/get back to you/i)).toBeVisible();
    // A reference is the shared handle between a WhatsApp conversation and a
    // row in the database.
    await expect(page.getByText(/^RA-\d{6}$/)).toBeVisible();
    await expect(page.getByText(business.name).first()).toBeVisible();
  });

  test("in deep-link mode the driver is given the message to send", async ({ page }) => {
    const { business } = await seedBookableBusiness("DeepLink");
    await signInAsDriver(page, "deeplink");
    await page.goto(`/business/${business.slug}/request`);
    await fillRequest(page);

    // Nothing has been sent yet — the driver's own device opens WhatsApp with
    // it. If they do not tap this, the business never hears about the request.
    const link = page.getByRole("link", { name: /open whatsapp/i });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", /^https:\/\/wa\.me\/447700900/);
    await expect(page.getByText(/from your own whatsapp/i)).toBeVisible();
  });

  test("a date in the past is refused", async ({ page }) => {
    const { business } = await seedBookableBusiness("Past");
    await signInAsDriver(page, "past");
    await page.goto(`/business/${business.slug}/request`);

    await page.getByLabel("Preferred date").fill("2020-01-01");
    await page.getByLabel("Preferred time").fill("10:30");
    await page.getByRole("button", { name: /send request/i }).click();

    await expect(page.getByText(/already passed|hasn't passed/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: /request sent/i })).toHaveCount(0);
  });

  test("the service list holds this business's services and no others", async ({ page }) => {
    const { business } = await seedBookableBusiness("Services");
    await signInAsDriver(page, "services");
    await page.goto(`/business/${business.slug}/request`);

    // A garage receiving a request for work they do not do is a wasted
    // conversation on both sides. `toHaveText` waits; `allTextContents` is a
    // synchronous snapshot and reads an empty select before the data lands.
    await expect(page.getByLabel("What do you need?").locator("option")).toHaveText([
      "Tyre replacement",
      "Brake check",
    ]);
  });

  test("the driver sees it in their own list, without a delivery state", async ({ page }) => {
    const { business } = await seedBookableBusiness("MyList");
    await signInAsDriver(page, "mylist");
    await page.goto(`/business/${business.slug}/request`);
    await fillRequest(page);

    await page.goto("/my-requests");
    await expect(page.getByText(business.name).first()).toBeVisible();
    await expect(page.getByText("New").first()).toBeVisible();
    // Telling a driver "delivered" invites them to conclude they are being
    // ignored; "failed" invites them to conclude the business is broken.
    await expect(page.getByText(/delivery not tracked|delivered/i)).toHaveCount(0);
  });
});

test.describe("Phase 5 · The business inbox", () => {
  test("an owner sees the request and can reach the customer from the row", async ({ page }) => {
    const { business, email, password } = await seedBookableBusiness("Inbox");
    const driver = await signInAsDriver(page, "inbox");
    await page.goto(`/business/${business.slug}/request`);
    await fillRequest(page);
    await page.evaluate(() => localStorage.clear());

    await signInAsOwner(page, email, password);
    await page.goto("/portal/requests");

    await expect(page.getByText("Driver inbox")).toBeVisible();
    await expect(page.getByText("Tyre replacement").first()).toBeVisible();

    /*
      The two things an owner actually does, on every row rather than one tap
      deeper — the difference between a two-hour reply and a two-day one.

      Scoped to `main`: the sidebar also has a WhatsApp destination, and an
      unscoped match resolves to that first.
    */
    const inbox = page.getByRole("main");
    await expect(inbox.getByRole("link", { name: /^call$/i }).first()).toHaveAttribute(
      "href",
      new RegExp(`^tel:\\+44${driver.phone.slice(1)}`),
    );
    await expect(inbox.getByRole("link", { name: /whatsapp/i }).first()).toHaveAttribute(
      "href",
      /^https:\/\/wa\.me\/44/,
    );
  });

  test("marking it contacted records the response time", async ({ page }) => {
    const { business, email, password } = await seedBookableBusiness("Timing");
    await signInAsDriver(page, "timing");
    await page.goto(`/business/${business.slug}/request`);
    await fillRequest(page);
    await page.evaluate(() => localStorage.clear());

    await signInAsOwner(page, email, password);
    await page.goto("/portal/requests");

    await page.getByRole("button", { name: /driver timing/i }).click();
    await page.getByRole("button", { name: /mark contacted/i }).click();

    await expect(page.getByText(/marked contacted/i)).toBeVisible();
    // The KPI PRD v1.1 asked for and specified no mechanism to produce.
    await expect(page.getByText(/replied in/i)).toBeVisible();
  });

  test("declining requires a reason the customer will read", async ({ page }) => {
    const { business, email, password } = await seedBookableBusiness("Decline");
    await signInAsDriver(page, "decline");
    await page.goto(`/business/${business.slug}/request`);
    await fillRequest(page);
    await page.evaluate(() => localStorage.clear());

    await signInAsOwner(page, email, password);
    await page.goto("/portal/requests");
    await page.getByRole("button", { name: /driver decline/i }).click();
    await page.getByRole("button", { name: /^decline$/i }).first().click();

    await expect(page.getByText(/the customer sees this/i)).toBeVisible();
    await page.getByLabel("Why?").fill("Fully booked that week — try us the following Monday.");
    await page.getByRole("dialog").or(page.locator(".ra-overlay")).getByRole("button", { name: /^decline$/i }).click();

    await expect(page.getByText(/marked declined/i)).toBeVisible();
  });

  test("a declined driver is told why", async ({ page }) => {
    const { business, email, password } = await seedBookableBusiness("Reason");
    await signInAsDriver(page, "reason");
    await page.goto(`/business/${business.slug}/request`);
    await fillRequest(page);

    // Decline through the API — the owner's side is covered above.
    const { ctx } = await adminContext();
    const list = await ctx.get(`${API}/booking-requests?limit=50`);
    const request = (await list.json()).data.find(
      (r: { business?: { id: string } }) => r.business?.id === business.id,
    );
    await ctx.patch(`${API}/booking-requests/${request.id}/status`, {
      data: { status: "declined", reason: "We don't fit that tyre size, sorry." },
    });
    await ctx.dispose();
    void email;
    void password;

    await page.goto("/my-requests");
    await expect(page.getByText("Declined").first()).toBeVisible();
    // The one thing a declined driver genuinely needs: what to do next.
    await expect(page.getByText(/don't fit that tyre size/i)).toBeVisible();
  });

  test("the inbox can be filtered", async ({ page }) => {
    const { business, email, password } = await seedBookableBusiness("Filter");
    await signInAsDriver(page, "filter");
    await page.goto(`/business/${business.slug}/request`);
    await fillRequest(page);
    await page.evaluate(() => localStorage.clear());

    await signInAsOwner(page, email, password);
    await page.goto("/portal/requests");

    await page.getByRole("button", { name: "New", exact: true }).click();
    await expect(page.getByText("Driver filter")).toBeVisible();

    await page.getByRole("button", { name: "Completed", exact: true }).click();
    await expect(page.getByText(/nothing here/i)).toBeVisible();
  });
});

test.describe("Phase 5 · The delivery log", () => {
  test("deep-link attempts read as untracked, never as delivered", async ({ page }) => {
    const { business } = await seedBookableBusiness("Untracked");
    await signInAsDriver(page, "untracked");
    await page.goto(`/business/${business.slug}/request`);
    await fillRequest(page);
    await page.evaluate(() => localStorage.clear());

    await signInAsAdmin(page);
    await page.goto("/admin/whatsapp-logs");

    // The whole of the ">98% delivery" measure, and the screen that has to be
    // honest about when it cannot answer.
    await expect(page.getByText("Delivery not tracked").first()).toBeVisible();
    await expect(page.getByText(/deep-link mode/i)).toBeVisible();
  });

  test("the delivery rate is blank rather than invented when nothing is trackable", async ({
    page,
  }) => {
    await signInAsAdmin(page);
    await page.goto("/admin/whatsapp-logs");

    const tile = page.locator(".ra-tile", { hasText: "Delivery rate" });
    await expect(tile).toBeVisible();
    // A rate computed from no data is not a rate. Showing "100%" here would be
    // the exact failure this screen exists to prevent. `exact`, because the
    // hint below it contains an em dash of its own.
    await expect(tile.getByText("—", { exact: true })).toBeVisible();
    await expect(tile.getByText("100%")).toHaveCount(0);
  });

  test("untracked attempts are counted apart from success and failure", async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto("/admin/whatsapp-logs");
    await expect(page.locator(".ra-tile", { hasText: "Not tracked" })).toBeVisible();
    await expect(page.locator(".ra-tile", { hasText: "Failed" })).toBeVisible();
  });

  test("a guest cannot read it", async ({ page }) => {
    await page.goto("/admin/whatsapp-logs");
    await expect(page).toHaveURL(/sign-in/);
  });
});

test.describe("Phase 5 · On a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("no booking route scrolls sideways", async ({ page }) => {
    const { business } = await seedBookableBusiness("MobileFlow");
    await signInAsDriver(page, "mobileflow");

    for (const route of [`/business/${business.slug}`, `/business/${business.slug}/request`, "/my-requests"]) {
      await page.goto(route);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }
  });

  test("the inbox does not scroll sideways and its controls are reachable", async ({ page }) => {
    const { business, email, password } = await seedBookableBusiness("MobileInbox");
    await signInAsDriver(page, "mobileinbox");
    await page.goto(`/business/${business.slug}/request`);
    await fillRequest(page);
    await page.evaluate(() => localStorage.clear());

    await signInAsOwner(page, email, password);
    await page.goto("/portal/requests");
    await expect(page.getByText("Driver mobileinbox")).toBeVisible();

    await expectNoHorizontalOverflow(page);
    await expectTouchTargets(page, "/portal/requests");
  });

  test("the request form's controls clear the touch floor", async ({ page }) => {
    const { business } = await seedBookableBusiness("MobileForm");
    await signInAsDriver(page, "mobileform");
    await page.goto(`/business/${business.slug}/request`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectTouchTargets(page, "request form");
  });
});

test.describe("Phase 5 · Language", () => {
  test("no screen in the loop implies a confirmed appointment", async ({ page }) => {
    const { business } = await seedBookableBusiness("Words");
    await signInAsDriver(page, "words");

    for (const route of [
      `/business/${business.slug}`,
      `/business/${business.slug}/request`,
      "/my-requests",
    ]) {
      await page.goto(route);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const body = await page.locator("body").innerText();
      expect(body, `${route} says "Booked"`).not.toMatch(/\bBooked\b/);
      expect(body, `${route} implies a confirmation`).not.toMatch(/confirmed appointment/i);
      expect(body, `${route} promises a slot`).not.toMatch(/your slot is|slot reserved/i);
    }
  });
});

test.describe("Phase 5 · Accessibility", () => {
  test("every field on the request form is labelled", async ({ page }) => {
    const { business } = await seedBookableBusiness("A11y");
    await page.goto(`/business/${business.slug}/request`);

    const unlabelled = await page.evaluate(() =>
      Array.from(document.querySelectorAll("input, textarea, select"))
        .filter((el) => {
          if (el.getAttribute("aria-label")) return false;
          if (el.getAttribute("aria-hidden") === "true") return false;
          const id = el.getAttribute("id");
          return !id || !document.querySelector(`label[for="${id}"]`);
        })
        .map((el) => el.outerHTML.slice(0, 90)),
    );
    expect(unlabelled, unlabelled.join("\n")).toEqual([]);
  });

  test("headings start at level one and do not skip", async ({ page }) => {
    const { business } = await seedBookableBusiness("Headings");
    await signInAsDriver(page, "headings");

    for (const route of [`/business/${business.slug}/request`, "/my-requests"]) {
      await page.goto(route);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const levels = await page.evaluate(() =>
        Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6"))
          .filter((h) => h.textContent?.trim())
          .map((h) => Number(h.tagName[1])),
      );
      expect(levels[0], route).toBe(1);
      for (let i = 1; i < levels.length; i++) {
        expect(levels[i] - levels[i - 1], `${route}: h${levels[i - 1]} → h${levels[i]}`).toBeLessThanOrEqual(1);
      }
    }
  });
});
