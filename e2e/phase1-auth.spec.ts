import { test, expect, request as pwRequest, type Page } from "@playwright/test";
import { API, expectNoHorizontalOverflow } from "./helpers";

/**
 * Phase 1 — identity, through the real interface.
 *
 * The API suite proves the rules; this proves the journey — that a driver can
 * get through the one wall in the public product, that a guest is never pushed
 * at it, and that the wall returns them to what they were doing.
 */

const TAG = `ui${Date.now().toString(36)}`;

/**
 * A phone number nobody owns.
 *
 * Ofcom reserves 07700 900000–900999 for testing, so a run against an
 * environment that does have WhatsApp credentials cannot message a real person.
 *
 * The block holds 1,000 numbers and a number belongs to one account for ever, so
 * a free one is found rather than assumed: fixed numbers passed on the first run
 * and failed on the second with a 409. The probe uses a throwaway email, because
 * a code request creates no account — 202 means unclaimed, 409 means taken.
 */
async function findFreePhone(): Promise<string> {
  const ctx = await pwRequest.newContext();
  try {
    for (let i = 0; i < 12; i++) {
      const candidate = `07700900${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`;
      const res = await ctx.post(`${API}/auth/otp/request`, {
        data: { email: `probe.${Math.random().toString(36).slice(2)}@e2e.test`, phone: candidate },
      });
      if (res.status() === 202) return candidate;
    }
    throw new Error(
      "No free number left in the 07700 900xxx test block — the test database needs clearing.",
    );
  } finally {
    await ctx.dispose();
  }
}

/** A brand-new driver identity, guaranteed unused. */
async function freshIdentity(slot: string) {
  return { email: `${TAG}.${slot}@e2e.test`, phone: await findFreePhone() };
}

/**
 * The codes shown on screen in development. They go to an inbox and a WhatsApp
 * number the test runner does not have, so the server echoes them outside
 * production — and refuses to in production. See auth.service.js.
 */
async function visibleCodes(page: Page): Promise<string[]> {
  const text = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".font-mono")).map((e) => e.textContent?.trim() ?? ""),
  );
  const digits = text.filter((c) => /^\d{6}$/.test(c));
  expect(
    digits.length,
    "development codes are not on the page — is OTP_ECHO off, or is this a production build?",
  ).toBeGreaterThanOrEqual(2);
  return digits;
}

async function signInAsDriver(page: Page, email: string, phone: string, name: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("WhatsApp number").fill(phone);
  await page.getByRole("button", { name: /send me a code/i }).click();

  await expect(page.getByRole("heading", { name: /enter your codes/i })).toBeVisible();
  const digits = await visibleCodes(page);

  const nameField = page.getByLabel("Your name");
  if (await nameField.isVisible().catch(() => false)) await nameField.fill(name);
  await page.getByLabel("Code from your email").fill(digits[0]);
  await page.getByLabel("Code from WhatsApp").fill(digits[1]);

  /**
   * Wait on the response, not on the page.
   *
   * Returning as soon as the button is clicked hands the caller a page whose
   * sign-in POST is still in flight; navigating then races it, and the failure
   * reads as a broken route guard. Polling `localStorage` was worse — the read
   * lands mid-navigation and the execution context is destroyed underneath it.
   */
  const signedIn = page.waitForResponse(
    (r) => r.url().includes("/auth/otp/verify") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: /^sign in$/i }).click();
  const response = await signedIn;
  // Read the body only when there is something to explain. A successful sign-in
  // navigates immediately, and the browser discards the body of a response it
  // has navigated away from — so eagerly reading it to build a failure message
  // is itself a failure.
  const status = response.status();
  const detail = status === 200 ? "" : await response.text().catch(() => "(body unavailable)");
  expect(status, `sign-in failed: ${detail}`).toBe(200);

  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"));
  await page.waitForLoadState("domcontentloaded");
}

test.describe("Phase 1 · Guests are never pushed at the wall", () => {
  test("the public product is browsable with no account", async ({ page }) => {
    await page.goto("/");
    // The single most damaging regression this product could ship: a discovery
    // marketplace that asks you to sign in before you can look.
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText(/sign in to continue/i)).toHaveCount(0);
  });

  test("a stale token does not lock a guest out", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() =>
      localStorage.setItem(
        "roadaxis_auth",
        JSON.stringify({ accessToken: "expired.rubbish.token", user: { role: "driver" } }),
      ),
    );
    await page.goto("/");
    // `optionalAuthenticate` treats an unusable token as no token, so a guest
    // with stale storage sees the site rather than a wall.
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});

test.describe("Phase 1 · Driver sign-in", () => {
  test("a new driver signs in and is asked for a name", async ({ page }) => {
    const { email, phone } = await freshIdentity("a");
    await signInAsDriver(page, email, phone, "E2E Driver A");

    // A driver lands back on the public product, not in the portal — they
    // signed in to do something, and it was not administration.
    await expect(page).toHaveURL(/\/$/);
    /**
     * Asserted on the destination rather than the wording: the header calls it
     * "My garages" and the tab bar calls it "Saved". Exactly one, and `:visible`
     * rather than `.first()`, because both links exist in the DOM at every width
     * — which also catches a breakpoint edit that leaves both on screen.
     */
    await expect(page.locator('a[href="/my-garages"]:visible')).toHaveCount(1);
  });

  test("a returning driver is not asked for a name again", async ({ page }) => {
    const { email, phone } = await freshIdentity("b");
    await signInAsDriver(page, email, phone, "E2E Driver B");
    await page.evaluate(() => localStorage.clear());

    await page.goto("/sign-in");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("WhatsApp number").fill(phone);
    await page.getByRole("button", { name: /send me a code/i }).click();

    await expect(page.getByRole("heading", { name: /enter your codes/i })).toBeVisible();
    await expect(page.getByLabel("Your name")).toHaveCount(0);
  });

  test("the intended destination survives signing in", async ({ page }) => {
    // Losing what someone was doing is how authentication friction turns into an
    // abandoned session, and the cost is worst on a phone — which is most of
    // this product.
    const { email, phone } = await freshIdentity("c");
    await page.goto("/sign-in?returnTo=%2Fportal");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("WhatsApp number").fill(phone);
    await page.getByRole("button", { name: /send me a code/i }).click();
    await expect(page.getByRole("heading", { name: /enter your codes/i })).toBeVisible();

    const digits = await visibleCodes(page);
    await page.getByLabel("Your name").fill("E2E Driver C");
    await page.getByLabel("Code from your email").fill(digits[0]);
    await page.getByLabel("Code from WhatsApp").fill(digits[1]);
    await page.getByRole("button", { name: /^sign in$/i }).click();

    // A driver is not allowed into the portal, so the guard sends them home
    // rather than back to a sign-in page they have already passed. A loop there
    // would be the worse failure.
    await expect(page).toHaveURL(/\/$/);
  });

  test("a wrong code is explained, not just refused", async ({ page }) => {
    const { email, phone } = await freshIdentity("d");
    await page.goto("/sign-in");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("WhatsApp number").fill(phone);
    await page.getByRole("button", { name: /send me a code/i }).click();
    await expect(page.getByRole("heading", { name: /enter your codes/i })).toBeVisible();

    await page.getByLabel("Your name").fill("E2E Driver D");
    await page.getByLabel("Code from your email").fill("000000");
    await page.getByLabel("Code from WhatsApp").fill("000000");
    await page.getByRole("button", { name: /^sign in$/i }).click();

    const error = page.getByRole("alert").filter({ hasText: /not correct|attempt/i });
    await expect(error).toBeVisible();
    // Saying how many attempts remain is the difference between "try again" and
    // "you have three goes before you start over".
    await expect(error).toContainText(/attempt/i);
  });

  test("the page says which channels a code actually reached", async ({ page }) => {
    const { email, phone } = await freshIdentity("e");
    await page.goto("/sign-in");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("WhatsApp number").fill(phone);
    await page.getByRole("button", { name: /send me a code/i }).click();

    // Without credentials the WhatsApp code cannot be delivered, and the page
    // must say so rather than tell someone to wait for a message that was never
    // sent.
    await expect(page.getByText(/sent to|couldn't send to/i).first()).toBeVisible();
  });

  test("both code fields are required", async ({ page }) => {
    const { email, phone } = await freshIdentity("f");
    await page.goto("/sign-in");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("WhatsApp number").fill(phone);
    await page.getByRole("button", { name: /send me a code/i }).click();
    await expect(page.getByRole("heading", { name: /enter your codes/i })).toBeVisible();

    await page.getByRole("button", { name: /^sign in$/i }).click();
    // One code is not enough: the phone is what a garage messages back, and an
    // unverified number puts a real business in touch with a stranger.
    await expect(page.getByText("Enter the code").first()).toBeVisible();
  });
});

test.describe("Phase 1 · Staff sign-in", () => {
  test("a business owner reaches the portal", async ({ page }) => {
    const ctx = await pwRequest.newContext();
    const adminLogin = await ctx.post(`${API}/auth/login`, {
      data: {
        email: process.env.E2E_ADMIN_EMAIL || "admin@roadaxis.online",
        password: process.env.E2E_ADMIN_PASSWORD || "ChangeMe@2026",
      },
    });
    expect(
      adminLogin.ok(),
      'no seeded administrator — run "npm run seed:admin" in raod-axis-back',
    ).toBeTruthy();
    const token = (await adminLogin.json()).data.accessToken;

    const email = `${TAG}.owner@e2e.test`;
    await ctx.post(`${API}/auth/users`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: "E2E Owner", email, password: "SuperSecret123", role: "business_owner" },
    });
    await ctx.dispose();

    await page.goto("/staff/sign-in");
    await page.locator("#email").fill(email);
    await page.locator("#password").fill("SuperSecret123");
    await page.getByRole("button", { name: /^sign in$/i }).click();

    await page.waitForURL(/\/portal/);
    // The greeting carries the identity. Asserted on the heading rather than on
    // a field somewhere in the body: the dashboard's content is owned by
    // whichever phase last rebuilt it, and this test is about having arrived as
    // the right person.
    await expect(page.getByRole("heading", { name: /welcome back, E2E/i })).toBeVisible();
  });

  test("a wrong password says so without saying whether the account exists", async ({ page }) => {
    await page.goto("/staff/sign-in");
    await page.locator("#email").fill(`${TAG}.nobody@e2e.test`);
    await page.locator("#password").fill("definitely-not-it");
    await page.getByRole("button", { name: /^sign in$/i }).click();

    const alert = page.getByRole("alert").filter({ hasText: /incorrect/i });
    await expect(alert).toBeVisible();
    // "No account with that email" tells an attacker which addresses are worth
    // attacking.
    await expect(alert).not.toContainText(/no account|not found|unknown/i);
  });

  test("the submit button is never disabled while typing", async ({ page }) => {
    await page.goto("/staff/sign-in");
    const submit = page.getByRole("button", { name: /^sign in$/i });

    // Pre-emptively disabling submit is a documented anti-pattern: the user
    // cannot tell which rule they failed, only that nothing happens.
    await expect(submit).toBeEnabled();
    await page.locator("#email").fill("not-an-email");
    await expect(submit).toBeEnabled();
    await page.locator("#password").fill("x");
    await expect(submit).toBeEnabled();

    await submit.click();
    await expect(page.getByText(/doesn't look like an email/i)).toBeVisible();
  });

  test("the password can be revealed", async ({ page }) => {
    await page.goto("/staff/sign-in");
    const field = page.locator("#password");
    await field.fill("SuperSecret123");
    await expect(field).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: /show password/i }).click();
    await expect(field).toHaveAttribute("type", "text");
  });
});

test.describe("Phase 1 · Route guards", () => {
  test("the portal is unreachable without a session", async ({ page }) => {
    await page.goto("/portal");
    await expect(page).toHaveURL(/\/sign-in\?returnTo=%2Fportal/);
  });

  test("a driver is sent home from the portal, not into a loop", async ({ page }) => {
    const { email, phone } = await freshIdentity("g");
    await signInAsDriver(page, email, phone, "E2E Driver G");

    await page.goto("/portal");
    // Bouncing a signed-in driver to a sign-in page they have already passed is
    // an infinite loop. Home is the honest answer.
    await expect(page).toHaveURL(/\/$/);
  });

  test("clearing the session locks the portal again", async ({ page }) => {
    const { email, phone } = await freshIdentity("h");
    await signInAsDriver(page, email, phone, "E2E Driver H");
    await page.evaluate(() => localStorage.removeItem("roadaxis_auth"));
    await page.goto("/portal");
    await expect(page).toHaveURL(/\/sign-in/);
  });
});

test.describe("Phase 1 · Sign-in on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("neither sign-in screen scrolls sideways", async ({ page }) => {
    for (const route of ["/sign-in", "/staff/sign-in"]) {
      await page.goto(route);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }
  });

  test("the code step fits without sideways scroll", async ({ page }) => {
    const { email, phone } = await freshIdentity("i");
    await page.goto("/sign-in");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("WhatsApp number").fill(phone);
    await page.getByRole("button", { name: /send me a code/i }).click();
    await expect(page.getByRole("heading", { name: /enter your codes/i })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("code fields bring up the number pad and do not zoom iOS", async ({ page }) => {
    const { email, phone } = await freshIdentity("j");
    await page.goto("/sign-in");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("WhatsApp number").fill(phone);
    await page.getByRole("button", { name: /send me a code/i }).click();
    await expect(page.getByRole("heading", { name: /enter your codes/i })).toBeVisible();

    const field = page.getByLabel("Code from WhatsApp");
    await expect(field).toHaveAttribute("inputmode", "numeric");
    // Only one field may claim one-time-code, or the platform's autofill has two
    // candidates and picks arbitrarily.
    await expect(field).toHaveAttribute("autocomplete", "one-time-code");
    await expect(page.getByLabel("Code from your email")).toHaveAttribute("autocomplete", "off");

    // Below 16px iOS zooms the page on focus and leaves it zoomed.
    const size = await field.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(size).toBeGreaterThanOrEqual(16);
  });

  test("every standalone control clears the touch floor", async ({ page }) => {
    for (const route of ["/sign-in", "/staff/sign-in"]) {
      await page.goto(route);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const small = await page.evaluate(() =>
        Array.from(document.querySelectorAll("button, a[href], input"))
          .filter((el) => {
            const r = el.getBoundingClientRect();
            if (r.width === 0 && r.height === 0) return false;
            /**
             * A link inside a sentence is exempt — WCAG's own exception, 2.5.8,
             * which excludes targets "in a sentence or block of text". Inline
             * text links only; a standalone anchor gets no relief.
             */
            if (el.tagName === "A" && getComputedStyle(el).display === "inline") return false;
            return r.height < 40 || r.width < 40;
          })
          .map(
            (el) =>
              `${el.tagName.toLowerCase()} "${el.textContent?.trim().slice(0, 24)}" ${Math.round(
                el.getBoundingClientRect().height,
              )}px`,
          ),
      );
      expect(small, `${route} has controls below the touch floor:\n${small.join("\n")}`).toEqual(
        [],
      );
    }
  });
});

test.describe("Phase 1 · Form accessibility", () => {
  test("every field is labelled and errors are announced", async ({ page }) => {
    await page.goto("/staff/sign-in");
    await page.getByRole("button", { name: /^sign in$/i }).click();

    const email = page.locator("#email");
    await expect(email).toHaveAttribute("aria-invalid", "true");
    const describedBy = await email.getAttribute("aria-describedby");
    expect(describedBy, "the error is not associated with its field").toBeTruthy();
    // Colour alone is not an error message to somebody who cannot see it.
    await expect(page.locator(`#${describedBy}`)).toHaveAttribute("role", "alert");
  });

  test("an unlabelled input does not exist on either sign-in screen", async ({ page }) => {
    for (const route of ["/sign-in", "/staff/sign-in"]) {
      await page.goto(route);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const unlabelled = await page.evaluate(() =>
        Array.from(document.querySelectorAll("input"))
          .filter((el) => {
            if (el.getAttribute("aria-label")) return false;
            const id = el.getAttribute("id");
            return !id || !document.querySelector(`label[for="${id}"]`);
          })
          .map((el) => el.outerHTML.slice(0, 80)),
      );
      expect(unlabelled, `${route}: ${unlabelled.join("\n")}`).toEqual([]);
    }
  });
});
