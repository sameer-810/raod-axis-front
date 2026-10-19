import { test, expect, request as pwRequest, type Page, type TestInfo } from "@playwright/test";
import { API, expectNoHorizontalOverflow, expectTouchTargets } from "./helpers";

/**
 * Phase 14 — "Continue with Google" (FR-AUT-07, DECISIONS.md D-039).
 *
 * Google itself cannot be driven from a test: its account chooser is a real
 * Google login. So the one script the page loads from Google is replaced by a
 * stand-in with the same interface, which answers with the development
 * server's stand-in token (accepted only with GOOGLE_TEST_TOKENS on, never in
 * production). Everything else — the page, the server, the database, the
 * WhatsApp code — is the real thing.
 */
const TAG = `p4${Date.now().toString(36).slice(-6)}`;

const GIS_STUB = `
  window.__googleRequests = [];
  window.google = { accounts: { oauth2: { initTokenClient: function (cfg) {
    return { requestAccessToken: function (overrides) {
      window.__googleRequests.push({ scope: cfg.scope, prompt: overrides && overrides.prompt });
      setTimeout(function () {
        var who = window.__googleIdentity;
        if (!who) { if (cfg.error_callback) cfg.error_callback({ type: "popup_closed" }); return; }
        var json = JSON.stringify(Object.assign({ aud: cfg.client_id }, who));
        var b64 = btoa(unescape(encodeURIComponent(json)))
          .replace(/\\+/g, "-").replace(/\\//g, "_").replace(/=+$/, "");
        cfg.callback({ access_token: "test-google:" + b64 });
      }, 50);
    } };
  } } } };
`;

/** Stand in for Google, as a given person — or as somebody who closes the window. */
async function asGoogle(page: Page, who: { email: string; name?: string } | null) {
  await page.route("https://accounts.google.com/gsi/client", (route) =>
    route.fulfill({ contentType: "application/javascript", body: GIS_STUB }),
  );
  await page.addInitScript((identity) => {
    (window as unknown as { __googleIdentity: unknown }).__googleIdentity = identity;
  }, who);
}

/** A number in Ofcom's test block that no account holds yet. See phase1-auth. */
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
    throw new Error("No free number left in the 07700 900xxx test block.");
  } finally {
    await ctx.dispose();
  }
}

function emailFor(testInfo: TestInfo, slot: string) {
  return `${TAG}.${testInfo.project.name}.${slot}@e2e.test`;
}

async function settle(page: Page) {
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({ timeout: 20_000 });
}

test.describe.serial("Phase 14 · Continue with Google", () => {
  test("the button is there, and nothing is fetched from Google until it is pressed", async ({
    page,
  }) => {
    const fromGoogle: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("accounts.google.com")) fromGoogle.push(r.url());
    });
    await asGoogle(page, null);
    await page.goto("/sign-in");
    await settle(page);

    const button = page.getByRole("button", { name: "Continue with Google" });
    await expect(button).toBeVisible();
    const box = await button.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    // The email form is still there for everyone without Google.
    await expect(page.getByLabel("Email address")).toBeVisible();
    expect(fromGoogle, "the page loaded Google's script before anybody asked").toHaveLength(0);
  });

  test("a new driver continues with Google, gives their number and proves it", async ({
    page,
  }, testInfo) => {
    const email = emailFor(testInfo, "new");
    await asGoogle(page, { email, name: "Gwen Google" });
    await page.goto("/sign-in");
    await settle(page);

    await page.getByRole("button", { name: "Continue with Google" }).click();

    // Google proved the address; the page asks for what Google does not know.
    await expect(page.getByRole("heading", { name: "One more thing" })).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();
    await expect(page.getByLabel("Your name")).toHaveValue("Gwen Google");
    const requested = await page.evaluate(
      () => (window as unknown as { __googleRequests: unknown[] }).__googleRequests,
    );
    // Name and email only, and always the account chooser.
    expect(requested).toEqual([{ scope: "openid email profile", prompt: "select_account" }]);

    await page.getByLabel("WhatsApp number").fill(await freePhone());
    await page.getByRole("button", { name: "Continue" }).click();

    // The WhatsApp code alone: there is no emailed code to wait for.
    await expect(page.getByRole("heading", { name: "Enter your code" })).toBeVisible();
    await expect(page.getByLabel("Code from your email")).toHaveCount(0);
    await expect(page.getByText(/sent a code to your WhatsApp/)).toBeVisible();
    const code = await page
      .locator(".font-mono")
      .filter({ hasText: /^\d{6}$/ })
      .first()
      .innerText();
    await page.getByLabel("Code from WhatsApp").fill(code);

    const signedIn = page.waitForResponse(
      (r) => r.url().includes("/auth/otp/verify") && r.request().method() === "POST",
    );
    await page.getByRole("button", { name: /^sign in$/i }).click();
    expect((await signedIn).status()).toBe(200);
    await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"));

    const session = await page.evaluate(() => JSON.parse(localStorage.getItem("roadaxis_auth")!));
    expect(session.user.name).toBe("Gwen Google");
    expect(session.user.email).toBe(email);
  });

  test("coming back, the same driver is signed straight in — to where they were going", async ({
    page,
  }, testInfo) => {
    await asGoogle(page, { email: emailFor(testInfo, "new"), name: "Gwen Google" });
    await page.goto("/sign-in?returnTo=%2Fmy-garages");
    await settle(page);

    await page.getByRole("button", { name: "Continue with Google" }).click();
    await page.waitForURL(/\/my-garages$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("closing Google's window changes nothing and says nothing", async ({ page }) => {
    await asGoogle(page, null);
    await page.goto("/sign-in");
    await settle(page);

    await page.getByRole("button", { name: "Continue with Google" }).click();
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeEnabled();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Sign in", exact: true })).toBeVisible();
  });

  test("a staff address is turned away, and told where to go", async ({ page }) => {
    await asGoogle(page, { email: "admin@roadaxis.online", name: "RoadAxis Admin" });
    await page.goto("/sign-in");
    await settle(page);

    await page.getByRole("button", { name: "Continue with Google" }).click();
    await expect(page.getByRole("alert")).toContainText(/staff sign-in/i);
    // Exactly once, not repeated under the email form as well.
    await expect(page.getByRole("alert")).toHaveCount(1);
  });

  test("the Privacy Policy says what Google tells RoadAxis", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.getByText("If you continue with Google.")).toBeVisible();
    await expect(page.getByText(/never\s+see your Google password/)).toBeVisible();
  });

  test("the number step works on a phone", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "Phone-only");
    await asGoogle(page, { email: emailFor(testInfo, "phone"), name: "Pat Phone" });
    await page.goto("/sign-in");
    await settle(page);
    await expectTouchTargets(page, "sign-in with Google");

    await page.getByRole("button", { name: "Continue with Google" }).click();
    await expect(page.getByRole("heading", { name: "One more thing" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectTouchTargets(page, "after Google");
    await expect(page.getByLabel("WhatsApp number")).toHaveCSS("font-size", "16px");
  });
});
