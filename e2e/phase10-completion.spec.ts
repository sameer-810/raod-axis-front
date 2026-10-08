import {
  test,
  expect,
  request as pwRequest,
  type APIRequestContext,
  type Page,
  type TestInfo,
} from "@playwright/test";
import { API, expectNoHorizontalOverflow, expectTouchTargets } from "./helpers";

/**
 * Phase 10 — completion.
 *
 * A requirement-by-requirement audit after Phase 9 found the product built and
 * not finished: a driver could not sign in without a WhatsApp service nobody
 * had connected, the Privacy and Terms links led nowhere, two administrative
 * actions existed only as API routes, and four of the PRD's own measures were
 * reported by nothing. This file is the proof that each of those now works
 * through the interface a person actually uses.
 */
const TAG = `p0${Date.now().toString(36).slice(-6)}`;

/**
 * A second API, identical but for one variable: no WhatsApp Cloud API, so a
 * driver signs in on the emailed code alone. `playwright.config.ts` starts it.
 */
const EMAIL_ONLY_API = process.env.E2E_EMAIL_ONLY_API || "http://localhost:5015";

/** The width the phone rules are stated at. Set explicitly, as Phase 7 does. */
const PHONE = { width: 390, height: 844 };

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

interface Session {
  accessToken: string;
  user: { id: string; name: string; email: string; role: string };
}

const fixture = {
  admin: null as Session | null,
  owner: null as Session | null,
  driver: null as Session | null,
  /** Owned, with a service and a WhatsApp number — a listing that can be asked. */
  business: { id: "", slug: "", name: "" },
  /** Left unclaimed, so the claim form and the badge have a target. */
  claimable: { id: "", slug: "", name: "" },
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function desktopOnly(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== "chromium", "Desktop-only: the phone gets cards");
}
function phoneOnly(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== "mobile", "Phone-only");
}

async function login(email: string, password: string): Promise<Session> {
  const ctx = await pwRequest.newContext();
  const res = await ctx.post(`${API}/auth/login`, { data: { email, password } });
  expect(res.ok(), `could not sign in as ${email}`).toBeTruthy();
  const data = (await res.json()).data;
  await ctx.dispose();
  return data;
}

const adminLogin = () =>
  login(
    process.env.E2E_ADMIN_EMAIL || "admin@roadaxis.online",
    process.env.E2E_ADMIN_PASSWORD || "ChangeMe@2026",
  );

function as(session: Session): Promise<APIRequestContext> {
  return pwRequest.newContext({
    extraHTTPHeaders: { Authorization: `Bearer ${session.accessToken}` },
  });
}

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

/** A driver, through the real two-code flow, as a token. */
async function newDriver(slot: string, name: string): Promise<Session & { phone: string }> {
  const ctx = await pwRequest.newContext();
  const email = `${TAG}.${slot}${Math.random().toString(36).slice(2, 6)}@e2e.test`;
  const phone = await freePhone();
  const start = await ctx.post(`${API}/auth/otp/request`, { data: { email, phone } });
  const challenge = (await start.json()).data;
  const verified = await ctx.post(`${API}/auth/otp/verify`, {
    data: {
      challengeId: challenge.challengeId,
      emailCode: challenge.devCodes.email,
      phoneCode: challenge.devCodes.phone,
      name,
    },
  });
  expect(verified.status(), await verified.text()).toBe(200);
  const session = (await verified.json()).data;
  await ctx.dispose();
  return { ...session, phone };
}

/** Put a session straight into storage. The sign-in screens have their own tests. */
async function signIn(page: Page, session: Session) {
  await page.goto("/");
  await page.evaluate((s) => localStorage.setItem("roadaxis_auth", JSON.stringify(s)), {
    accessToken: session.accessToken,
    user: session.user,
  });
}

/** The page's own heading is up, so its lazy chunk has rendered. */
async function settle(page: Page) {
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeAttached({ timeout: 20_000 });
  await page.waitForLoadState("networkidle").catch(() => undefined);
}

async function seedListing(admin: APIRequestContext, name: string, extra = {}) {
  const res = await admin.post(`${API}/businesses`, {
    data: {
      name,
      address: { line1: "1 Completion Way", city: "Manchester", postcode: "M1 1AA" },
      latitude: 53.47 + Math.random() * 0.02,
      longitude: -2.25 + Math.random() * 0.02,
      ...extra,
    },
  });
  expect(res.status(), await res.text()).toBe(201);
  return (await res.json()).data as { id: string; slug: string; name: string };
}

/** File a claim against a listing, as an applicant with no account. */
async function fileClaim(businessId: string, contact: { name: string; email: string }) {
  const ctx = await pwRequest.newContext();
  const res = await ctx.post(`${API}/claims/business/${businessId}`, {
    multipart: {
      contactName: contact.name,
      contactEmail: contact.email,
      contactPhone: "07700900432",
      contactRole: "Owner",
      message: "This is my garage.",
      documents: { name: "licence.png", mimeType: "image/png", buffer: PNG },
    },
  });
  expect(res.status(), await res.text()).toBe(201);
  const claim = (await res.json()).data as { id: string };
  await ctx.dispose();
  return claim;
}

test.beforeAll(async () => {
  fixture.admin = await adminLogin();
  const admin = await as(fixture.admin);

  fixture.business = await seedListing(admin, `${TAG} Completion Motors`, {
    services: [{ name: "Full service", priceFrom: 120 }],
  });
  fixture.claimable = await seedListing(admin, `${TAG} Unclaimed Motors`);

  const ownerEmail = `${TAG}.owner@e2e.test`;
  await admin.post(`${API}/auth/users`, {
    data: {
      name: "Completion Owner",
      email: ownerEmail,
      password: "OwnerSecret123",
      role: "business_owner",
    },
  });
  await admin.post(`${API}/businesses/${fixture.business.id}/transfer`, {
    data: { email: ownerEmail, reason: "E2E fixture: an owner for the dashboard figures." },
  });
  await admin.post(`${API}/businesses/${fixture.business.id}/whatsapp-numbers`, {
    data: { label: "Workshop", phone: await freePhone() },
  });
  fixture.owner = await login(ownerEmail, "OwnerSecret123");

  // A driver with a request sent today, so "requests today" is not nought.
  fixture.driver = await newDriver("driver", "Completion Driver");
  const driver = await as(fixture.driver);
  const when = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
  const sent = await driver.post(`${API}/businesses/${fixture.business.id}/booking-requests`, {
    data: { serviceName: "Full service", preferredDate: when, preferredTime: "10:30" },
  });
  expect(sent.status(), await sent.text()).toBe(201);

  await driver.dispose();
  await admin.dispose();
});

// ── Privacy Policy and Terms ────────────────────────────────────────────────

test.describe("Phase 10 · The legal pages exist and can be reached", () => {
  test("the footer reaches both, at every width", async ({ page }) => {
    await page.goto("/");
    await settle(page);

    // It used to be hidden below `md` — on the phones most drivers use.
    const footer = page.getByRole("navigation", { name: "Footer" });
    await footer.getByRole("link", { name: "Privacy" }).click();
    await expect(page).toHaveURL(/\/privacy$/);
    await expect(page.getByRole("heading", { level: 1, name: "Privacy Policy" })).toBeVisible();

    // Each document links to the other.
    await page.getByRole("link", { name: "Terms of Use" }).click();
    await expect(page).toHaveURL(/\/terms$/);
    await expect(page.getByRole("heading", { level: 1, name: "Terms of Use" })).toBeVisible();
  });

  test("the policy prints the periods the server enforces", async ({ page, request }) => {
    const policy = (await (await request.get(`${API}/privacy/policy`)).json()).data;

    await page.goto("/privacy");
    await settle(page);

    // Read from the API, not typed into the page — so the promise and the job
    // that keeps it cannot drift apart.
    const row = (what: string) => page.getByRole("row", { name: new RegExp(what, "i") });
    await expect(row("Ownership documents")).toContainText(
      `${policy.retention.claimDocumentDays} days`,
    );
    await expect(row("Sign-in codes")).toContainText(
      `${policy.retention.signInCodeMinutes} minutes`,
    );
    await expect(row("booking request")).toContainText(
      policy.retention.bookingRequestMonths === 24 ? "2 years" : "months",
    );
    await expect(page.getByRole("link", { name: policy.contactEmail }).first()).toHaveAttribute(
      "href",
      `mailto:${policy.contactEmail}`,
    );

    // The two rights are buttons, and the policy says where.
    await expect(page.getByRole("link", { name: "your account" })).toHaveAttribute(
      "href",
      "/account",
    );
  });

  test("the terms say a request is not an appointment", async ({ page }) => {
    await page.goto("/terms");
    await settle(page);
    // The promise the whole interface is built around, in the place a dispute
    // would look for it.
    await expect(page.getByText(/confirmed appointment/i)).toBeVisible();
    await expect(page.getByText(/not an endorsement of the quality of the work/i)).toBeVisible();
  });

  for (const path of ["/privacy", "/terms"]) {
    test(`${path} is one readable document on a phone`, async ({ page }) => {
      await page.setViewportSize(PHONE);
      await page.goto(path);
      await settle(page);
      await expectNoHorizontalOverflow(page);
      await expectTouchTargets(page, path);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);

      // Heading levels never skip: a screen reader's outline is the contents.
      const levels = await page
        .locator("h1, h2, h3, h4")
        .evaluateAll((els) => els.map((el) => Number(el.tagName[1])));
      for (let i = 1; i < levels.length; i++) {
        expect(levels[i] - levels[i - 1], `${path} skips a heading level`).toBeLessThanOrEqual(1);
      }
    });
  }

  test("every form that takes details says what the button means", async ({ page }) => {
    const forms = [
      "/sign-in",
      `/business/${fixture.business.slug}/request`,
      `/business/${fixture.claimable.slug}/claim`,
      "/register-business",
    ];
    for (const path of forms) {
      await page.goto(path);
      await settle(page);
      const note = page.locator("[data-legal-note]");
      await expect(note, `${path} has no legal note`).toBeVisible();
      // New tab, so reading the policy does not throw away a half-filled form.
      for (const [name, href] of [
        ["Terms", "/terms"],
        ["Privacy Policy", "/privacy"],
      ]) {
        const link = note.getByRole("link", { name });
        await expect(link).toHaveAttribute("href", href);
        await expect(link).toHaveAttribute("target", "_blank");
      }
    }
  });
});

// ── Your account ────────────────────────────────────────────────────────────

test.describe("Phase 10 · A person's own data", () => {
  test("the account page needs a session", async ({ page }) => {
    await page.goto("/account");
    await expect(page).toHaveURL(/\/sign-in\?returnTo=%2Faccount/);
  });

  test("a driver can find their account, take a copy and sign out", async ({ page }) => {
    const driver = await newDriver("copy", "Copy Driver");
    await signIn(page, driver);
    await page.goto("/");
    await settle(page);

    // A word with a pointer, an icon on a phone — one of them, never neither.
    await page.getByRole("link", { name: "Your account" }).click();
    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByText(driver.user.email)).toBeVisible();

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download my data" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe("roadaxis-my-data.json");
    const stream = await file.createReadStream();
    let body = "";
    for await (const chunk of stream) body += chunk.toString();
    const exported = JSON.parse(body);
    expect(exported.account.email).toBe(driver.user.email);
    expect(Array.isArray(exported.bookingRequests)).toBe(true);

    // The public side of the product had no way to sign out at all.
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/$/);
    expect(await page.evaluate(() => localStorage.getItem("roadaxis_auth"))).toBeNull();
  });

  test("deleting an account takes the word, and then takes everything", async ({
    page,
    request,
  }) => {
    const driver = await newDriver("leave", "Leaving Driver");
    await signIn(page, driver);
    await page.goto("/account");
    await settle(page);

    await page.getByRole("button", { name: "Delete my account" }).click();
    const dialog = page.getByRole("dialog", { name: /delete your account/i });
    await expect(dialog).toBeVisible();

    const confirm = dialog.getByRole("button", { name: "Delete for good" });
    await expect(confirm).toBeDisabled();
    // Lower case is a slip of the thumb; the word is asked for as written.
    await dialog.getByLabel(/type delete to confirm/i).fill("delete");
    await expect(confirm).toBeDisabled();
    await dialog.getByLabel(/type delete to confirm/i).fill("DELETE");
    await expect(confirm).toBeEnabled();
    await confirm.click();

    await expect(page).toHaveURL(/\/$/);
    expect(await page.evaluate(() => localStorage.getItem("roadaxis_auth"))).toBeNull();

    // And it is really gone, not just signed out.
    const me = await request.get(`${API}/auth/me`, {
      headers: { Authorization: `Bearer ${driver.accessToken}` },
    });
    expect(me.status()).toBe(401);
  });

  test("an administrator is not offered a way to delete themselves", async ({ page }) => {
    await signIn(page, fixture.admin!);
    await page.goto("/account");
    await settle(page);
    await expect(page.getByText(/removed by another administrator/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Delete my account" })).toHaveCount(0);
  });

  test("the account page passes the phone rules", async ({ page }) => {
    await page.setViewportSize(PHONE);
    await signIn(page, fixture.driver!);
    await page.goto("/account");
    await settle(page);
    await expectNoHorizontalOverflow(page);
    await expectTouchTargets(page, "/account");
  });
});

// ── Signing in before WhatsApp is connected ─────────────────────────────────

test.describe("Phase 10 · Sign-in works without the WhatsApp service", () => {
  test("a driver signs in with the emailed code alone", async ({ page }) => {
    // Same web app, pointed at the API that has no Cloud API credentials —
    // which is the configuration the product launches in.
    await page.route(/localhost:5005\/api\//, (route) =>
      route.continue({
        url: route.request().url().replace("localhost:5005", new URL(EMAIL_ONLY_API).host),
      }),
    );

    const email = `${TAG}.onecode${Math.random().toString(36).slice(2, 6)}@e2e.test`;
    const phone = await freePhone();

    await page.goto("/sign-in");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("WhatsApp number").fill(phone);
    await page.getByRole("button", { name: /send me a code/i }).click();

    // One code, and the page says one — singular, with no second field and no
    // line about a WhatsApp message that was never sent.
    await expect(page.getByRole("heading", { name: "Enter your code", exact: true })).toBeVisible();
    await expect(page.getByLabel("Code from your email")).toBeVisible();
    await expect(page.getByLabel("Code from WhatsApp")).toHaveCount(0);
    await expect(page.getByText(new RegExp(`to ${phone.replace(/\s/g, "")}`))).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Send a new code" })).toBeVisible();

    const digits = (
      await page.evaluate(() =>
        Array.from(document.querySelectorAll(".font-mono")).map((e) => e.textContent?.trim() ?? ""),
      )
    ).filter((c) => /^\d{6}$/.test(c));
    expect(digits, "one code is shown in development, not two").toHaveLength(1);

    await page.getByLabel("Your name").fill("One Code Driver");
    await page.getByLabel("Code from your email").fill(digits[0]);
    const verified = page.waitForResponse(
      (r) => r.url().includes("/auth/otp/verify") && r.request().method() === "POST",
    );
    await page.getByRole("button", { name: /^sign in$/i }).click();
    expect((await verified).status(), "sign-in with one code failed").toBe(200);

    await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"));
    await expect(page.getByRole("link", { name: "Your account" })).toBeVisible();
  });
});

// ── The administrator's console ─────────────────────────────────────────────

test.describe("Phase 10 · The console opens on an overview", () => {
  test("an administrator signing in lands on it", async ({ page }) => {
    await page.goto("/staff/sign-in");
    await page.locator("#email").fill(process.env.E2E_ADMIN_EMAIL || "admin@roadaxis.online");
    await page.locator("#password").fill(process.env.E2E_ADMIN_PASSWORD || "ChangeMe@2026");
    await page.getByRole("button", { name: /^sign in$/i }).click();

    // It used to be the owner's portal, which could only tell an administrator
    // that they manage no listing.
    await page.waitForURL(/\/admin$/);
    await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeAttached();
  });

  test("it shows the four figures FR-ADM-01 names, and what just happened", async ({ page }) => {
    await signIn(page, fixture.admin!);
    await page.goto("/admin");
    await settle(page);

    // Inside the stat strip: "Businesses" is also the name of a menu item,
    // which is in the page and hidden on a phone.
    for (const label of ["Businesses", "Unclaimed", "Claims waiting", "Requests today"]) {
      await expect(page.locator(".ra-tile p", { hasText: new RegExp(`^${label}$`) })).toBeVisible();
    }

    // The fixtures above created listings and transferred one; that is activity.
    const feed = page.getByRole("list", { name: "Recent activity" });
    await expect(feed.getByRole("listitem").first()).toBeVisible();
    await page
      .getByRole("link", { name: /audit log/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/admin\/audit$/);
  });

  test("a claim in the queue is on the overview, one click from the decision", async ({ page }) => {
    await fileClaim(fixture.claimable.id, {
      name: `${TAG} Waiting Applicant`,
      email: `${TAG}.waiting@e2e.test`,
    });

    await signIn(page, fixture.admin!);
    await page.goto("/admin");
    await settle(page);

    const waiting = page.getByRole("link", { name: /ownership claims? to review/i });
    await expect(waiting).toBeVisible();
    await waiting.click();
    await expect(page).toHaveURL(/\/admin\/claims$/);
  });

  test("the overview and the accounts screen pass the phone rules", async ({ page }) => {
    await page.setViewportSize(PHONE);
    await signIn(page, fixture.admin!);
    for (const path of ["/admin", "/admin/users"]) {
      await page.goto(path);
      await settle(page);
      await page.waitForLoadState("networkidle").catch(() => undefined);
      await expectNoHorizontalOverflow(page);
      await expectTouchTargets(page, path);
    }
  });

  test("the menu's Overview is the console's, and Accounts is in it", async ({
    page,
  }, testInfo) => {
    desktopOnly(testInfo);
    await signIn(page, fixture.admin!);
    await page.goto("/admin/businesses");
    await settle(page);

    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(nav.getByRole("link", { name: "Overview" })).toHaveAttribute("href", "/admin");
    await nav.getByRole("link", { name: "Accounts" }).click();
    await expect(page).toHaveURL(/\/admin\/users$/);

    const crumbs = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(crumbs).toContainText("Administration");
    await expect(crumbs.locator('[aria-current="page"]')).toHaveText("Accounts");
  });
});

test.describe("Phase 10 · Accounts — FR-ADM-06 has a screen", () => {
  /** A staff account this test alone will act on. */
  async function seedAccount(label: string) {
    const admin = await as(fixture.admin!);
    const name = `${TAG} ${label} ${Math.random().toString(36).slice(2, 6)}`;
    const email = `${TAG}.${label.toLowerCase()}${Math.random().toString(36).slice(2, 6)}@e2e.test`;
    const res = await admin.post(`${API}/auth/users`, {
      data: { name, email, password: "TargetSecret123", role: "business_owner" },
    });
    expect(res.status(), await res.text()).toBe(201);
    await admin.dispose();
    return { name, email };
  }

  async function openAccounts(page: Page, search: string) {
    await signIn(page, fixture.admin!);
    await page.goto("/admin/users");
    await settle(page);
    await page.getByRole("searchbox", { name: "Search accounts" }).fill(search);
    await page.waitForLoadState("networkidle").catch(() => undefined);
  }

  test("switch an account off with a reason, and back on", async ({ page, request }) => {
    const target = await seedAccount("Switch");
    await openAccounts(page, target.email);

    await page.getByRole("button", { name: `Actions for ${target.name}` }).click();
    await page.getByRole("menuitem", { name: "Switch off account" }).click();

    const dialog = page.getByRole("dialog", { name: new RegExp(`switch off ${target.name}`, "i") });
    const confirm = dialog.getByRole("button", { name: "Switch off" });
    // A reason is required: this is the record somebody reads months later.
    await expect(confirm).toBeDisabled();
    await dialog.getByLabel("Reason").fill("Claimed a garage they do not own.");
    await confirm.click();

    // The badge on the row — not the same words in the filter's own options.
    const badge = page.locator("span", { hasText: /^Switched off$/ });
    await expect(badge.first()).toBeVisible();
    // It is the server that refuses them, not the screen.
    const refused = await request.post(`${API}/auth/login`, {
      data: { email: target.email, password: "TargetSecret123" },
    });
    expect(refused.status()).toBe(403);

    await page.getByRole("button", { name: `Actions for ${target.name}` }).click();
    await page.getByRole("menuitem", { name: "Switch back on" }).click();
    await expect(badge).toHaveCount(0);
    const allowed = await request.post(`${API}/auth/login`, {
      data: { email: target.email, password: "TargetSecret123" },
    });
    expect(allowed.status()).toBe(200);
  });

  test("erase an account on request, for good", async ({ page, request }) => {
    const target = await seedAccount("Erase");
    await openAccounts(page, target.email);

    await page.getByRole("button", { name: `Actions for ${target.name}` }).click();
    await page.getByRole("menuitem", { name: "Erase on request" }).click();

    const dialog = page.getByRole("dialog", { name: /for good/i });
    await expect(dialog).toContainText(/cannot be undone/i);
    await dialog.getByLabel(/why is this account being erased/i).fill("Deletion request by email.");
    await dialog.getByRole("button", { name: "Erase account" }).click();

    await expect(page.getByText("No accounts match")).toBeVisible();
    const gone = await request.post(`${API}/auth/login`, {
      data: { email: target.email, password: "TargetSecret123" },
    });
    expect(gone.status()).toBe(401);
  });

  test("your own row offers nothing", async ({ page }) => {
    await openAccounts(page, fixture.admin!.user.email);
    // Locking yourself out is a support ticket; the last administrator doing
    // it leaves nobody who can undo it.
    await expect(page.getByText("You", { exact: true }).first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: `Actions for ${fixture.admin!.user.name}` }),
    ).toHaveCount(0);
  });

  test("an administrator can add a member of staff", async ({ page, request }) => {
    await signIn(page, fixture.admin!);
    await page.goto("/admin/users");
    await settle(page);

    const name = `${TAG} New Staff ${Math.random().toString(36).slice(2, 6)}`;
    const email = `${TAG}.staff${Math.random().toString(36).slice(2, 6)}@e2e.test`;

    // The header button with a pointer, the floating one on a phone.
    await page.getByRole("button", { name: "Add staff account" }).click();
    const dialog = page.getByRole("dialog", { name: /add a staff account/i });
    const create = dialog.getByRole("button", { name: "Create account" });
    await expect(create).toBeDisabled();
    await dialog.getByLabel("Name").fill(name);
    await dialog.getByLabel("Email").fill(email);
    await dialog.getByLabel("Password").fill("short");
    // The same ten-character rule the server applies.
    await expect(create).toBeDisabled();
    await dialog.getByLabel("Password").fill("StaffSecret123");
    await create.click();
    await expect(dialog).toBeHidden();

    const signedIn = await request.post(`${API}/auth/login`, {
      data: { email, password: "StaffSecret123" },
    });
    expect(signedIn.status()).toBe(200);
    expect((await signedIn.json()).data.user.role).toBe("admin");
  });
});

test.describe("Phase 10 · Ownership — FR-ONB-10 has a screen", () => {
  test("a listing is transferred from its own page, and an unsent link is handed over", async ({
    page,
  }) => {
    const admin = await as(fixture.admin!);
    const listing = await seedListing(admin, `${TAG} Transfer Garage`);
    await admin.dispose();

    await signIn(page, fixture.admin!);
    await page.goto(`/admin/businesses/${listing.id}`);
    await settle(page);

    const card = page.locator("#ownership");
    await expect(card).toContainText(/nobody has claimed this listing/i);
    await card.getByRole("button", { name: "Transfer ownership" }).click();

    const dialog = page.getByRole("dialog", { name: /transfer/i });
    const submit = dialog.getByRole("button", { name: "Transfer", exact: true });
    const email = `${TAG}.newowner${Math.random().toString(36).slice(2, 6)}@e2e.test`;
    await dialog.getByLabel(/new owner.s email/i).fill(email);
    await dialog.getByLabel("Reason").fill("too short");
    // "Why does somebody else control this garage's page" needs a real answer.
    await expect(submit).toBeDisabled();
    await dialog.getByLabel("Reason").fill("Business sold. New owner confirmed by phone.");
    await submit.click();

    /**
     * This machine has no mail server, so the set-password email did not go.
     * Without this dialog the transfer would look finished and the new owner
     * would be locked out with nobody aware of it.
     */
    const unsent = page.getByRole("dialog", { name: /could not be sent/i });
    await expect(unsent).toBeVisible();
    await expect(unsent.getByLabel("Set-password link")).toHaveValue(/\/accept-invite\?token=/);
    await unsent.getByRole("button", { name: "Done" }).click();

    await expect(card).toContainText(email);
  });

  test("approving a claim with no mail server hands over the link too", async ({ page }) => {
    const admin = await as(fixture.admin!);
    const listing = await seedListing(admin, `${TAG} Approve Garage`);
    await admin.dispose();
    const applicant = {
      name: `${TAG} Approve Applicant`,
      email: `${TAG}.approve${Math.random().toString(36).slice(2, 6)}@e2e.test`,
    };
    await fileClaim(listing.id, applicant);

    await signIn(page, fixture.admin!);
    await page.goto("/admin/claims");
    await settle(page);
    await page.getByRole("searchbox").fill(applicant.email);
    await page
      .getByRole("button", { name: new RegExp(listing.name) })
      .first()
      .click();
    await page.getByRole("button", { name: "Approve", exact: true }).click();

    const unsent = page.getByRole("dialog", { name: /could not be sent/i });
    await expect(unsent).toBeVisible();
    await expect(unsent).toContainText(applicant.email);
    await expect(unsent.getByLabel("Set-password link")).toHaveValue(/\/accept-invite\?token=/);
  });
});

// ── Dashboards ──────────────────────────────────────────────────────────────

test.describe("Phase 10 · The figures the specification names", () => {
  test("an owner sees today's requests and open requests — FR-BIZ-06", async ({ page }) => {
    await signIn(page, fixture.owner!);
    await page.goto("/portal");
    await settle(page);

    const today = page.locator(".ra-tile", { hasText: "Requests today" });
    const open = page.locator(".ra-tile", { hasText: "Open requests" });
    await expect(today).toBeVisible();
    await expect(open).toBeVisible();
    // The fixture driver sent one this morning, and nobody has answered it.
    await expect(today.locator("p.font-mono")).toHaveText("1");
    await expect(open.locator("p.font-mono")).toHaveText("1");
    await expect(open).toContainText(/1 has had no reply yet/i);
  });

  test("analytics reports the onboarding measures and what messages cost", async ({ page }) => {
    await signIn(page, fixture.admin!);
    await page.goto("/admin/analytics");
    await settle(page);

    await expect(page.getByRole("heading", { name: "Bringing garages on board" })).toBeVisible();
    for (const label of [
      "Time to claim",
      "Claims approved",
      "Claimed in 30 days",
      "Using both numbers",
      "Repeat drivers",
      "Billable messages",
      "Cost per request",
    ]) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }
    // Nothing is sent by RoadAxis in deep-link mode, and the screen says so
    // rather than printing a confident £0.00.
    await expect(page.getByText(/nothing is billed/i)).toBeVisible();

    // FR-ADM-07: "most viewed" follows the period control now.
    const board = page.locator("section", { hasText: "Most viewed" }).last();
    await expect(board).toContainText("Last 30 days");
    await page.getByRole("button", { name: "7 days" }).click();
    await expect(board).toContainText("Last 7 days");
  });
});

// ── The smaller gaps ────────────────────────────────────────────────────────

test.describe("Phase 10 · Small things the specification asked for by name", () => {
  test("an unclaimed listing says so on its own page — FR-PRO-05", async ({ page }) => {
    const admin = await as(fixture.admin!);
    const listing = await seedListing(admin, `${TAG} Badge Garage`);
    await admin.dispose();

    await page.goto(`/business/${listing.slug}`);
    await settle(page);
    // The word, beside the action — the page used to carry only the action.
    const invitation = page.locator("header", { hasText: "Claim Your Business" });
    await expect(invitation.getByText("Unclaimed", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Claim Your Business" })).toBeVisible();
  });

  test("list or map is part of the link — FR-DIS-09", async ({ page }) => {
    await page.goto("/search");
    await settle(page);

    const view = page.getByRole("group", { name: "View" });
    await view.getByRole("button", { name: "Map" }).click();
    await expect(page).toHaveURL(/[?&]view=map/);

    // A link to the map opens the map.
    await page.reload();
    await settle(page);
    await expect(
      page.getByRole("group", { name: "View" }).getByRole("button", { name: "Map" }),
    ).toHaveAttribute("aria-pressed", "true");

    // And Back is the way out of it, like every other piece of search state.
    await page.goBack();
    await expect(page).not.toHaveURL(/view=map/);
    await expect(
      page.getByRole("group", { name: "View" }).getByRole("button", { name: "List", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");

    // A filter change keeps the view, because it is the same search.
    await page.goto("/search?view=map");
    await settle(page);
    await page
      .getByPlaceholder(/a garage name/i)
      .first()
      .fill("tyres");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/q=tyres/);
    await expect(page).toHaveURL(/view=map/);
  });

  test("every public page has its own title, and private ones ask not to be indexed", async ({
    page,
  }) => {
    const titled: Array<[string, RegExp]> = [
      ["/sign-in", /^Sign in · RoadAxis$/],
      ["/staff/sign-in", /^Business sign-in · RoadAxis$/],
      ["/register-business", /^Add your garage · RoadAxis$/],
      [`/business/${fixture.claimable.slug}/claim`, /^Claim .+ · RoadAxis$/],
      ["/privacy", /^Privacy Policy · RoadAxis$/],
      ["/terms", /^Terms of Use · RoadAxis$/],
    ];
    for (const [path, title] of titled) {
      await page.goto(path);
      await settle(page);
      await expect(page, path).toHaveTitle(title);
      await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
      await expect(page.locator('meta[name="description"]')).toHaveCount(1);
    }

    // A one-time credential, a form, and an address that does not exist.
    for (const path of [
      "/accept-invite?token=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      `/business/${fixture.business.slug}/request`,
      "/this-page-does-not-exist",
    ]) {
      await page.goto(path);
      await expect(page.locator('meta[name="robots"][content="noindex"]'), path).toHaveCount(1);
    }
  });

  test("an administrator on a phone has Overview in the tab bar", async ({ page }, testInfo) => {
    phoneOnly(testInfo);
    await signIn(page, fixture.admin!);
    await page.goto("/admin/businesses");
    await settle(page);
    const bar = page.getByRole("navigation", { name: "Main" }).last();
    await bar.getByRole("link", { name: "Overview" }).click();
    await expect(page).toHaveURL(/\/admin$/);
  });
});

// ── Passwords ───────────────────────────────────────────────────────────────

test.describe("Phase 10 · Staff passwords — FR-AUT-06", () => {
  /** A member of staff with a known password, and their session. */
  async function seedStaff(label: string) {
    const admin = await as(fixture.admin!);
    const name = `${TAG} ${label} ${Math.random().toString(36).slice(2, 6)}`;
    const email = `${TAG}.${label.toLowerCase()}${Math.random().toString(36).slice(2, 6)}@e2e.test`;
    const res = await admin.post(`${API}/auth/users`, {
      data: { name, email, password: "FirstSecret123", role: "business_owner" },
    });
    expect(res.status(), await res.text()).toBe(201);
    await admin.dispose();
    return { name, email, session: await login(email, "FirstSecret123") };
  }

  test("a member of staff changes their own password and stays signed in", async ({
    page,
    request,
  }) => {
    const staff = await seedStaff("Changer");
    await signIn(page, staff.session);
    await page.goto("/account");
    await settle(page);

    const card = page.locator("section", { hasText: "Change password" }).last();
    const submit = card.getByRole("button", { name: "Change password" });

    // The button is never disabled; what is wrong is said, in the field.
    await card.getByLabel("Current password").fill("FirstSecret123");
    await card.getByLabel("New password").fill("short");
    await submit.click();
    await expect(card.getByText("Use at least 10 characters")).toBeVisible();

    await card.getByLabel("Current password").fill("not-my-password");
    await card.getByLabel("New password").fill("SecondSecret123");
    await submit.click();
    await expect(card.getByText(/not your current password/i)).toBeVisible();

    // The old session has to be visibly older than the change for the last
    // assertion to mean anything: sessions are dated in whole seconds.
    await page.waitForTimeout(2100);
    await card.getByLabel("Current password").fill("FirstSecret123");
    await submit.click();
    await expect(page.getByText(/password changed/i)).toBeVisible();

    // Still here, still signed in — on a new session.
    await expect(page).toHaveURL(/\/account$/);
    const stored = await page.evaluate(() => localStorage.getItem("roadaxis_auth"));
    const token = JSON.parse(stored ?? "{}").accessToken as string;
    expect(token).toBeTruthy();
    expect(token).not.toBe(staff.session.accessToken);

    const withOld = await request.post(`${API}/auth/login`, {
      data: { email: staff.email, password: "FirstSecret123" },
    });
    expect(withOld.status()).toBe(401);
    // And whoever else was signed in with the old one is not any more.
    const oldSession = await request.get(`${API}/auth/me`, {
      headers: { Authorization: `Bearer ${staff.session.accessToken}` },
    });
    expect(oldSession.status()).toBe(401);
    const newSession = await request.get(`${API}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(newSession.status()).toBe(200);
  });

  test("a driver is offered no password controls", async ({ page }) => {
    await signIn(page, fixture.driver!);
    await page.goto("/account");
    await settle(page);
    // A driver signs in with a code. There is no password to change.
    await expect(page.getByRole("heading", { name: "Change password" })).toHaveCount(0);
  });

  test("the console's account menu leads to it", async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    await signIn(page, fixture.admin!);
    await page.goto("/admin");
    await settle(page);
    await page.getByRole("button", { name: /account menu/i }).click();
    await page
      .getByRole("menu", { name: /account/i })
      .getByRole("menuitem", { name: "Account and password" })
      .click();
    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByRole("heading", { name: "Change password" })).toBeVisible();
  });

  test("on a phone it is in the More sheet", async ({ page }, testInfo) => {
    phoneOnly(testInfo);
    await signIn(page, fixture.admin!);
    await page.goto("/admin");
    await settle(page);
    await page.getByRole("button", { name: /more/i }).click();
    await page.getByRole("link", { name: "Account and password" }).click();
    await expect(page).toHaveURL(/\/account$/);
  });

  test("an administrator sends a password link, and is handed it when the email does not go", async ({
    page,
    request,
  }) => {
    const staff = await seedStaff("Forgot");
    await signIn(page, fixture.admin!);
    await page.goto("/admin/users");
    await settle(page);
    await page.getByRole("searchbox", { name: "Search accounts" }).fill(staff.email);
    await page.waitForLoadState("networkidle").catch(() => undefined);

    await page.getByRole("button", { name: `Actions for ${staff.name}` }).click();
    await page.getByRole("menuitem", { name: "Send password link" }).click();

    // No mail server on this machine: the link is shown, or nobody has it.
    const unsent = page.getByRole("dialog", { name: /could not be sent/i });
    await expect(unsent).toBeVisible();
    await expect(unsent).toContainText(staff.email);
    const link = await unsent.getByLabel("Set-password link").inputValue();
    expect(link).toMatch(/\/accept-invite\?token=/);

    // And it is a working link, not a decoration.
    const token = new URL(link).searchParams.get("token");
    const reset = await request.post(`${API}/auth/invite/accept`, {
      data: { token, password: "ThirdSecret12345" },
    });
    expect(reset.status()).toBe(200);
  });

  test("a driver's row offers no password link", async ({ page }) => {
    await signIn(page, fixture.admin!);
    await page.goto("/admin/users");
    await settle(page);
    await page.getByRole("searchbox", { name: "Search accounts" }).fill(fixture.driver!.user.email);
    await page.waitForLoadState("networkidle").catch(() => undefined);
    await page.getByRole("button", { name: `Actions for ${fixture.driver!.user.name}` }).click();
    await expect(page.getByRole("menuitem", { name: "Switch off account" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Send password link" })).toHaveCount(0);
  });
});
