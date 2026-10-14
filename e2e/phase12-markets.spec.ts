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
 * Phase 12 — a second country, on the site.
 *
 * Phase 11 taught the server that a garage is in the United Kingdom or in the
 * United Arab Emirates and that the two differ in everything a form asks for.
 * This file is the proof that a person can tell: that the site says which
 * country it is showing, searches only that one, asks for an emirate where
 * there are no postcodes, reads a phone number the way that country writes it
 * and prices a job in the money of the garage that set the price.
 *
 * And that the United Kingdom side is exactly as it was — which the ten
 * earlier files, run unchanged, are the larger half of.
 */
const TAG = `p2${Date.now().toString(36).slice(-6)}`;

const PHONE = { width: 390, height: 844 };

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

interface Session {
  accessToken: string;
  user: { id: string; name: string; email: string; role: string };
}

/** Jumeirah, Dubai — the centre the server's own list gives for it. */
const JUMEIRAH = { latitude: 25.207, longitude: 55.2475 };
const MANCHESTER = { latitude: 53.4745, longitude: -2.2535 };

const fixture = {
  admin: null as Session | null,
  uae: { id: "", slug: "", name: `${TAG} Jumeirah Auto Works` },
  uk: { id: "", slug: "", name: `${TAG} Castlefield Motors` },
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function desktopOnly(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== "chromium", "Desktop-only: the console form");
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

/**
 * Browse as somebody who chose a country on an earlier visit. The header's own
 * switch has its own test; everything else starts from a settled choice.
 */
async function browse(page: Page, country: "AE" | "GB") {
  await page.addInitScript((code) => {
    window.localStorage.setItem("roadaxis_market", code);
  }, country);
}

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
}

/** A listing as the console holds it, found by name. */
async function listingNamed(name: string) {
  const admin = await as(fixture.admin!);
  const found = await admin.get(
    `${API}/businesses/admin?search=${encodeURIComponent(name)}&limit=5`,
  );
  const hit = (await found.json()).data.find((b: { name: string }) => b.name === name);
  expect(hit, `no listing called ${name}`).toBeTruthy();
  const full = await admin.get(`${API}/businesses/admin/${hit.id}`);
  const data = (await full.json()).data;
  await admin.dispose();
  return data;
}

test.beforeAll(async () => {
  fixture.admin = await adminLogin();
  const admin = await as(fixture.admin);

  const uae = await admin.post(`${API}/businesses`, {
    headers: { "X-Market": "AE" },
    data: {
      name: fixture.uae.name,
      description: "Servicing and repairs for all makes, off Al Wasl Road.",
      address: { line1: "Al Wasl Road", city: "Jumeirah", region: "Dubai" },
      // A few hundred metres off the centre, so it is "near Jumeirah" and not on it.
      latitude: JUMEIRAH.latitude + 0.003,
      longitude: JUMEIRAH.longitude + 0.003,
      phone: "04 345 6789",
      services: [{ name: "Oil change", priceFrom: 150 }],
    },
  });
  expect(uae.status(), await uae.text()).toBe(201);
  Object.assign(fixture.uae, (({ id, slug }) => ({ id, slug }))((await uae.json()).data));

  const uk = await admin.post(`${API}/businesses`, {
    data: {
      name: fixture.uk.name,
      description: "MOTs and servicing by the canal basin.",
      address: { line1: "12 Liverpool Road", city: "Manchester", postcode: "M3 4LZ" },
      ...MANCHESTER,
      services: [{ name: "MOT", priceFrom: 45 }],
    },
  });
  expect(uk.status(), await uk.text()).toBe(201);
  Object.assign(fixture.uk, (({ id, slug }) => ({ id, slug }))((await uk.json()).data));

  await admin.dispose();
});

// ════════════════════════════════════════════════════════════════════════════
test.describe("Phase 12 · Choosing a country", () => {
  test("the header says which country this is, and changes it", async ({ page }) => {
    await page.goto("/");
    await settle(page);

    const control = page.getByRole("button", { name: /^Country: United Kingdom/ });
    await expect(control).toBeVisible();
    await expect(page.getByText("Independent garages across the UK")).toBeVisible();

    await control.click();
    await page.getByRole("menuitem", { name: "United Arab Emirates" }).click();

    await expect(page.getByText("Independent garages across the UAE")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^Country: United Arab Emirates/ }),
    ).toBeVisible();
    // The place a driver types is a different kind of thing there.
    await expect(page.getByLabel("Where?")).toHaveAttribute("placeholder", "City or area");
  });

  test("the choice is still there on the next visit", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /^Country: United Kingdom/ }).click();
    await page.getByRole("menuitem", { name: "United Arab Emirates" }).click();
    await expect(page.getByText("Independent garages across the UAE")).toBeVisible();

    await page.reload();
    await settle(page);
    await expect(page.getByText("Independent garages across the UAE")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^Country: United Arab Emirates/ }),
    ).toBeVisible();
  });

  test("a link shared from the UAE side opens on the UAE side", async ({ page }) => {
    await page.goto(`/search?country=AE&q=${encodeURIComponent(TAG)}`);
    await settle(page);

    await expect(page.getByRole("link", { name: fixture.uae.name }).first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      page.getByRole("button", { name: /^Country: United Arab Emirates/ }),
    ).toBeVisible();
    // And stays a link that says so, after the page has tidied its own address.
    await expect(page).toHaveURL(/[?&]country=AE/);
  });

  test("an address from before there was a second country is unchanged", async ({ page }) => {
    await browse(page, "GB");
    await page.goto(`/search?q=${encodeURIComponent(TAG)}`);
    await expect(page.getByRole("link", { name: fixture.uk.name }).first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page).not.toHaveURL(/country=/);
  });
});

// ════════════════════════════════════════════════════════════════════════════
test.describe("Phase 12 · Each country's own directory", () => {
  test("the UAE side lists UAE garages and no others", async ({ page }) => {
    await browse(page, "AE");
    await page.goto(`/search?q=${encodeURIComponent(TAG)}`);

    await expect(page.getByRole("link", { name: fixture.uae.name }).first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole("link", { name: fixture.uk.name })).toHaveCount(0);
  });

  test("the UK side lists UK garages and no others", async ({ page }) => {
    await browse(page, "GB");
    await page.goto(`/search?q=${encodeURIComponent(TAG)}`);

    await expect(page.getByRole("link", { name: fixture.uk.name }).first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole("link", { name: fixture.uae.name })).toHaveCount(0);
  });

  test("with no postcodes, a driver searches around a named area", async ({ page }) => {
    await browse(page, "AE");
    await page.goto(`/search?q=${encodeURIComponent(TAG)}`);
    await settle(page);

    const place = page.getByLabel("City or area");
    await expect(place).toBeVisible();
    await expect(page.getByLabel("Town or postcode")).toHaveCount(0);

    await place.fill("jumeirah");
    await place.press("Enter");

    await expect(page.getByRole("button", { name: /of Jumeirah, Dubai/ })).toBeVisible();
    await expect(page.getByRole("link", { name: fixture.uae.name }).first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page).toHaveURL(/lat=25\.207/);
  });

  test("an area nobody has heard of says so, and the search carries on", async ({ page }) => {
    await browse(page, "AE");
    await page.goto("/search");
    await settle(page);

    await page.getByLabel("City or area").fill("zzzznotaplace");
    await page.getByLabel("City or area").press("Enter");
    await expect(page.getByRole("alert").filter({ hasText: /city or district/i })).toBeVisible();
  });

  test("a position in another country is not used to search this one", async ({
    page,
    context,
  }) => {
    await browse(page, "AE");
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: 53.4808, longitude: -2.2426 });
    await page.goto(`/search?q=${encodeURIComponent(TAG)}`);
    await settle(page);

    await page.getByRole("button", { name: /use my location/i }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: /doesn't seem to be in the UAE/ }),
    ).toBeVisible();
    await expect(page).not.toHaveURL(/lat=/);
  });

  test("a position inside the country is simply used", async ({ page, context }) => {
    await browse(page, "AE");
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation(JUMEIRAH);
    await page.goto(`/search?q=${encodeURIComponent(TAG)}`);
    await settle(page);

    await page.getByRole("button", { name: /use my location/i }).click();
    await expect(page).toHaveURL(/lat=25\.207/);
    await expect(page.getByRole("button", { name: /of your location/ })).toBeVisible();
  });
});

// ════════════════════════════════════════════════════════════════════════════
test.describe("Phase 12 · A garage's page", () => {
  test("a UAE garage is priced in dirhams and placed in its emirate", async ({ page }) => {
    await browse(page, "AE");
    await page.goto(`/business/${fixture.uae.slug}`);
    await settle(page);

    await expect(page.getByText("AED 150.00")).toBeVisible();
    await expect(page.getByText(/Al Wasl Road, Jumeirah, Dubai/)).toBeVisible();

    const data = await page.locator('script[type="application/ld+json"]').first().textContent();
    expect(data).toContain('"addressCountry":"AE"');
    expect(data).toContain('"addressRegion":"Dubai"');
  });

  test("and is still in dirhams when read from the UK side", async ({ page }) => {
    // The currency belongs to the garage, not to whoever is looking.
    await browse(page, "GB");
    await page.goto(`/business/${fixture.uae.slug}`);
    await settle(page);
    await expect(page.getByText("AED 150.00")).toBeVisible();
  });

  test("a UK garage is priced in pounds, as before", async ({ page }) => {
    await browse(page, "GB");
    await page.goto(`/business/${fixture.uk.slug}`);
    await settle(page);
    await expect(page.getByText("£45.00")).toBeVisible();
    await expect(page.getByText(/12 Liverpool Road, Manchester, M3 4LZ/)).toBeVisible();
  });
});

// ════════════════════════════════════════════════════════════════════════════
test.describe("Phase 12 · A driver signing in from the UAE", () => {
  test("a number typed the local way is a UAE number", async ({ page }) => {
    await browse(page, "AE");
    await page.goto("/sign-in");

    const phone = page.getByLabel("WhatsApp number");
    await expect(phone).toHaveAttribute("placeholder", "050 123 4567");
    // The country the number will be read in is on the screen, not implied.
    await expect(page.getByText("+971", { exact: true })).toBeVisible();
    await expect(page.getByText(/Outside the UAE\? Start with \+/)).toBeVisible();

    const local = `050 ${String(Math.floor(Math.random() * 9_000_000) + 1_000_000)}`;
    await page.getByLabel("Email address").fill(`${TAG}.driver${Date.now() % 10000}@e2e.test`);
    await phone.fill(local);

    const [sent, answered] = await Promise.all([
      page.waitForRequest((r) => r.url().includes("/auth/otp/request")),
      page.waitForResponse((r) => r.url().includes("/auth/otp/request")),
      page.getByRole("button", { name: "Send me a code" }).click(),
    ]);
    expect(sent.headers()["x-market"]).toBe("AE");
    expect(answered.status()).toBe(202);

    const challenge = (await answered.json()).data;
    await page.getByLabel("Your name").fill("Dubai Driver");
    await page.getByLabel("Code from your email").fill(challenge.devCodes.email);
    if (challenge.devCodes.phone) {
      await page.getByLabel("Code from WhatsApp").fill(challenge.devCodes.phone);
    }
    await page.locator("form").getByRole("button", { name: "Sign in" }).click();
    await expect(page).not.toHaveURL(/sign-in/, { timeout: 20_000 });

    await page.goto("/account");
    await settle(page);
    const digits = local.replace(/\D/g, "").slice(1);
    await expect(page.getByText(`+971${digits}`)).toBeVisible();
  });

  test("the UK side shows the UK's dial code and example", async ({ page }) => {
    await browse(page, "GB");
    await page.goto("/sign-in");
    await expect(page.getByLabel("WhatsApp number")).toHaveAttribute("placeholder", "07700 900123");
    await expect(page.getByText("+44", { exact: true })).toBeVisible();
  });
});

// ════════════════════════════════════════════════════════════════════════════
test.describe("Phase 12 · An owner adding a garage", () => {
  test("in the UAE the form asks for an emirate, not a postcode", async ({ page }) => {
    await browse(page, "AE");
    await page.goto("/register-business");
    await settle(page);

    await expect(page.getByLabel("Country", { exact: true })).toHaveValue("AE");
    await expect(page.getByLabel("Emirate", { exact: true })).toBeVisible();
    await expect(page.getByLabel("City or area")).toBeVisible();
    await expect(page.getByLabel("Postcode", { exact: true })).toHaveCount(0);
    await expect(page.getByText(/There are no postcodes in the UAE/)).toBeVisible();
  });

  test("in the UK it is the form it always was, and can be changed", async ({ page }) => {
    await browse(page, "GB");
    await page.goto("/register-business");
    await settle(page);

    await expect(page.getByLabel("Country", { exact: true })).toHaveValue("GB");
    await expect(page.getByLabel("Postcode", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Emirate", { exact: true })).toHaveCount(0);

    // A garage in Dubai whose owner arrived on the UK side.
    await page.getByLabel("Country", { exact: true }).selectOption("AE");
    await expect(page.getByLabel("Emirate", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Postcode", { exact: true })).toHaveCount(0);
  });

  test("an area that is not known does not place the garage by guesswork", async ({ page }) => {
    await browse(page, "AE");
    await page.goto("/register-business");
    await settle(page);

    await page.getByLabel("Business name").fill(`${TAG} Nowhere Garage`);
    await page.getByLabel("Street address").fill("Street 1");
    await page.getByLabel("Emirate", { exact: true }).selectOption("Dubai");
    await page.getByLabel("City or area").fill("Nowhereville");
    await page.getByLabel("City or area").blur();
    await expect(page.getByText(/We don't have "Nowhereville" on our list/)).toBeVisible();

    await page.getByLabel("Your name").fill("E2E Applicant");
    await page.getByLabel("Your email").fill(`${TAG}.nowhere@e2e.test`);
    await page.getByLabel("Your phone").fill("050 222 3344");
    await page
      .locator('input[type="file"]')
      .setInputFiles([{ name: "licence.png", mimeType: "image/png", buffer: PNG }]);
    await page.getByRole("button", { name: "Send application" }).click();

    await expect(
      page.getByRole("alert").filter({ hasText: /We need to place your business on the map/ }),
    ).toBeVisible();
  });

  test("an owner standing in the workshop can use the phone in their hand", async ({
    page,
    context,
  }) => {
    await browse(page, "AE");
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: 25.13072, longitude: 55.22541 });
    await page.goto("/register-business");
    await settle(page);

    await page.getByRole("button", { name: "Use my current location" }).click();
    await expect(page.getByText(/Placed where you are now/)).toBeVisible();
    await expect(page.locator(".ra-picker .leaflet-marker-icon")).toHaveCount(1, {
      timeout: 20_000,
    });

    // The numbers themselves are there for anyone who cannot use a map.
    await page.getByText("Map coordinates").click();
    await expect(page.getByLabel("Latitude")).toHaveValue("25.13072");
    await expect(page.getByLabel("Longitude")).toHaveValue("55.22541");
  });

  test("a phone that is plainly somewhere else is not taken at its word", async ({
    page,
    context,
  }) => {
    await browse(page, "AE");
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: 53.4808, longitude: -2.2426 });
    await page.goto("/register-business");
    await settle(page);

    await page.getByRole("button", { name: "Use my current location" }).click();
    await expect(page.getByText(/doesn't seem to be in the UAE/)).toBeVisible();
    await expect(page.locator(".ra-picker .leaflet-marker-icon")).toHaveCount(0);
  });

  test("a named area places the pin, the map moves it, and the garage is registered", async ({
    page,
  }) => {
    await browse(page, "AE");
    await page.goto("/register-business");
    await settle(page);

    const name = `${TAG} Karama Car Clinic`;
    await page.getByLabel("Business name").fill(name);
    await page.getByLabel("Street address").fill("18B Street");
    await page.getByLabel("City or area").fill("Al Karama");
    await page.getByLabel("City or area").blur();

    await expect(page.getByText(/Placed in the middle of Al Karama, Dubai/)).toBeVisible();
    // The emirate follows from the area, so it is not asked for twice.
    await expect(page.getByLabel("Emirate", { exact: true })).toHaveValue("Dubai");

    // The owner shows us the door: a tap on the map moves the pin.
    const map = page.locator(".ra-picker .leaflet-container");
    await expect(map).toBeVisible({ timeout: 20_000 });
    await expect(page.locator(".ra-picker .leaflet-marker-icon")).toHaveCount(1);
    await map.scrollIntoViewIfNeeded();
    await map.click({ position: { x: 60, y: 60 } });
    await expect(page.getByText(/Pin placed/)).toBeVisible();

    await page.getByLabel("Business phone").fill("04 222 3344");
    await page.getByLabel("Your name").fill("E2E Applicant");
    await page.getByLabel("Your email").fill(`${TAG}.karama@e2e.test`);
    await page.getByLabel("Your phone").fill("050 222 3344");
    await page.getByLabel("Your role").fill("Owner");
    await page
      .locator('input[type="file"]')
      .setInputFiles([{ name: "licence.png", mimeType: "image/png", buffer: PNG }]);

    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/claims/register")),
      page.getByRole("button", { name: "Send application" }).click(),
    ]);
    expect(response.status(), await response.text()).toBe(201);
    await expect(page.getByRole("heading", { name: /application received/i })).toBeVisible();

    const listing = await listingNamed(name);
    expect(listing.address.country).toBe("AE");
    expect(listing.address.region).toBe("Dubai");
    expect(listing.address.postcode).toBeNull();
    expect(listing.timezone).toBe("Asia/Dubai");
    expect(listing.currency).toBe("AED");
    // A Dubai landline, read as one although nobody typed a country code.
    expect(listing.phone).toBe("+97142223344");
    // Near Al Karama, and not exactly on its centre: the pin was moved.
    expect(Math.abs(listing.coordinates.latitude - 25.2482)).toBeLessThan(0.05);
    expect(listing.coordinates.latitude).not.toBe(25.2482);
  });
});

// ════════════════════════════════════════════════════════════════════════════
test.describe("Phase 12 · The console, for a UAE listing", () => {
  test("a new listing can be put in the UAE, priced in dirhams", async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    await signIn(page, fixture.admin!);
    await page.goto("/admin/businesses/new");
    await settle(page);

    await page.getByLabel("Country", { exact: true }).selectOption("AE");
    await expect(page.getByLabel("Emirate", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Postcode", { exact: true })).toHaveCount(0);

    const name = `${TAG} Majaz Motor Care`;
    await page.getByLabel("Business name").fill(name);
    await page.getByLabel("Street address").fill("Corniche Street");
    await page.getByLabel("City or area").fill("Al Majaz");
    await page.getByLabel("City or area").blur();
    await expect(page.getByText(/Placed in the middle of Al Majaz, Sharjah/)).toBeVisible();
    await expect(page.getByLabel("Emirate", { exact: true })).toHaveValue("Sharjah");

    await page.getByRole("button", { name: "Add a service" }).click();
    await page.getByLabel("Service 1 name").fill("AC service");
    await page.getByLabel("Service 1 price from").fill("220");
    // The mark in front of the price is the listing's currency.
    await expect(page.locator("#services").getByText("AED", { exact: true })).toBeVisible();

    await page.getByLabel("Phone", { exact: true }).fill("06 555 1234");

    const [response] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().endsWith("/businesses") && r.request().method() === "POST",
      ),
      page.getByRole("button", { name: "Create listing" }).click(),
    ]);
    expect(response.status(), await response.text()).toBe(201);

    const listing = await listingNamed(name);
    expect(listing.address.country).toBe("AE");
    expect(listing.address.region).toBe("Sharjah");
    expect(listing.currency).toBe("AED");
    expect(listing.phone).toBe("+97165551234");
    expect(listing.timezone).toBe("Asia/Dubai");
  });

  test("an existing listing cannot be moved to another country", async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    await signIn(page, fixture.admin!);
    await page.goto(`/admin/businesses/${fixture.uae.id}`);
    await settle(page);

    await expect(page.getByLabel("Street address")).toHaveValue("Al Wasl Road");
    // Said, and not offered as a choice.
    await expect(page.getByLabel("Country", { exact: true })).toHaveCount(0);
    await expect(page.locator("#where").getByText("United Arab Emirates")).toBeVisible();
    await expect(page.getByLabel("Emirate", { exact: true })).toHaveValue("Dubai");

    // A number added from the UK side of the console is still the garage's.
    await page.getByRole("button", { name: "Add a number" }).click();
    await expect(page.locator("#whatsapp").getByLabel("WhatsApp number")).toHaveAttribute(
      "placeholder",
      "050 123 4567",
    );
  });

  test("a number added from the edit page is saved, as the garage's own", async ({ page }) => {
    await signIn(page, fixture.admin!);
    await page.goto(`/admin/businesses/${fixture.uae.id}`);
    await settle(page);

    // Typed the way a Dubai owner says it.
    const local = `050${Date.now().toString().slice(-7)}`;
    await page.getByRole("button", { name: "Add a number" }).click();
    await page.getByLabel("What is this number for?").fill("Workshop");
    await page.locator("#whatsapp").getByRole("textbox", { name: "WhatsApp number" }).fill(local);
    await page.getByRole("button", { name: "Add number" }).click();

    // Saved in place. The panel's form once sat inside the listing's own form,
    // and the browser answered its button by submitting the page: a reload and
    // nothing kept — the first thing the client reported from the live site.
    await expect(page.locator("#whatsapp").getByText("Workshop")).toBeVisible();
    expect(page.url()).not.toContain("?");

    const admin = await as(fixture.admin!);
    const list = await admin.get(`${API}/businesses/${fixture.uae.id}/whatsapp-numbers`);
    expect((await list.json()).data.map((n: { phone: string }) => n.phone)).toContain(
      `+971${local.slice(1)}`,
    );
    await admin.dispose();
  });
});

// ════════════════════════════════════════════════════════════════════════════
test.describe("Phase 12 · The legal pages", () => {
  test("in the UAE the policy names the UAE's law and regulator", async ({ page }) => {
    await browse(page, "AE");
    await page.goto("/privacy");
    await settle(page);

    await expect(page.getByText(/Federal Decree-Law No\. 45 of 2021/).first()).toBeVisible();
    await expect(page.getByText(/complain to the UAE Data Office/)).toBeVisible();
  });

  test("in the UK it names the ICO, as before", async ({ page }) => {
    await browse(page, "GB");
    await page.goto("/privacy");
    await settle(page);

    await expect(page.getByText(/complain to the Information Commissioner/)).toBeVisible();
    await expect(page.getByRole("link", { name: "ico.org.uk" })).toBeVisible();
    // Both countries are named to both readers.
    await expect(page.getByText(/offered in the United Kingdom and the United Arab/)).toBeVisible();
  });
});

// ════════════════════════════════════════════════════════════════════════════
test.describe("Phase 12 · The UAE side on a phone", () => {
  test.use({ viewport: PHONE });

  for (const [label, path] of [
    ["home", "/"],
    ["search", "/search"],
    ["sign-in", "/sign-in"],
    ["add your business", "/register-business"],
  ] as const) {
    test(`${label}: nothing scrolls sideways and every control is a real target`, async ({
      page,
    }) => {
      await browse(page, "AE");
      await page.goto(path);
      await settle(page);
      if (path === "/register-business") {
        // With the map on the page, which is where a small control would hide.
        await expect(page.locator(".ra-picker .leaflet-container")).toBeVisible({
          timeout: 20_000,
        });
      }
      await expectNoHorizontalOverflow(page);
      await expectTouchTargets(page, `${label} (UAE)`);
    });
  }
});
