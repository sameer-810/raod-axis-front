import { test, expect, request as pwRequest, type Page } from "@playwright/test";
import { expectNoHorizontalOverflow, expectTouchTargets } from "./helpers";

/**
 * Phase 21 — the driver sign-in to the client's design, and the console's
 * switches for each way in (DECISIONS.md D-046).
 *
 * The mobile number comes first; a code to it by WhatsApp or by text message is
 * the whole sign-in. Email and Google are still there. Which buttons appear is
 * the server's answer, and an administrator can switch any of them off.
 */
const API = process.env.E2E_API_URL || "http://localhost:5005/api";
const TAG = `ui${Date.now().toString(36)}`;

let admin: { accessToken: string; user: unknown };
let slug: string;

test.beforeAll(async () => {
  const ctx = await pwRequest.newContext();
  const res = await ctx.post(`${API}/auth/login`, {
    data: {
      email: process.env.E2E_ADMIN_EMAIL || "admin@roadaxis.online",
      password: process.env.E2E_ADMIN_PASSWORD || "ChangeMe@2026",
    },
  });
  expect(res.ok(), "could not sign in as the administrator").toBeTruthy();
  admin = (await res.json()).data;
  const list = await ctx.get(`${API}/businesses?limit=1`);
  slug = (await list.json()).data[0].slug;
  await ctx.dispose();
});

/** A mobile in the 07700 900xxx block nobody holds yet, asked of the server. */
async function freeMobile(): Promise<string> {
  const ctx = await pwRequest.newContext();
  try {
    for (let i = 0; i < 15; i++) {
      const candidate = `07700900${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`;
      const res = await ctx.post(`${API}/auth/otp/request`, {
        data: { email: `probe.${Math.random().toString(36).slice(2)}@e2e.test`, phone: candidate },
      });
      if (res.status() === 202) return candidate;
    }
  } finally {
    await ctx.dispose();
  }
  throw new Error("No free number left in the 07700 900xxx block.");
}

/** What the sign-in page is told, with some methods switched off. */
async function offering(page: Page, methods: Record<string, boolean>) {
  await page.route(/\/api\/auth\/providers$/, async (route) => {
    const res = await route.fetch();
    const body = await res.json();
    body.data.methods = { ...body.data.methods, ...methods };
    if (methods.google === false) body.data.google = null;
    await route.fulfill({ response: res, json: body });
  });
}

async function setMethod(method: string, enabled: boolean) {
  const ctx = await pwRequest.newContext();
  const res = await ctx.patch(`${API}/auth/sign-in-methods/${method}`, {
    data: { enabled },
    headers: { Authorization: `Bearer ${admin.accessToken}` },
  });
  await ctx.dispose();
  return res;
}

test.describe("Phase 21 · Signing in with the mobile number", () => {
  test("from a booking, the page says why and keeps the booking", async ({ page }) => {
    await page.goto(`/sign-in?returnTo=${encodeURIComponent(`/business/${slug}/request`)}`);
    await expect(
      page.getByRole("heading", { name: "Verify your mobile number to continue" }),
    ).toBeVisible();
    await expect(page.getByText("One quick step to continue your booking request.")).toBeVisible();
    await expect(
      page.getByText("Your booking details will be saved while you verify."),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to booking" })).toHaveAttribute(
      "href",
      `/business/${slug}/request`,
    );
  });

  test("on its own, it is a plain sign-in", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(
      page.getByRole("heading", { name: "Sign in with your mobile number" }),
    ).toBeVisible();
    await expect(page.getByText(/booking details will be saved/)).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Back to booking" })).toHaveCount(0);
    // Every way in, in the design's order.
    await expect(page.getByText("Send code by:")).toBeVisible();
    for (const name of [
      /send code by whatsapp/i,
      /send code by sms/i,
      /^email$/i,
      /continue with google/i,
    ]) {
      await expect(page.getByRole("button", { name })).toBeVisible();
    }
  });

  test("a new driver signs up by text message, with no email at all", async ({ page }) => {
    const phone = await freeMobile();
    await page.goto("/sign-in");

    // Nothing typed: the page says so instead of sending.
    await page.getByRole("button", { name: /send code by sms/i }).click();
    await expect(page.getByText("Enter your mobile number")).toBeVisible();

    await page.getByLabel("Mobile number").fill(phone);
    const asked = page.waitForResponse((r) => r.url().includes("/auth/otp/request"));
    await page.getByRole("button", { name: /send code by sms/i }).click();
    const sent = await asked;
    expect(sent.request().postDataJSON()).toEqual({
      channel: "sms",
      phone: `+44${phone.slice(1)}`,
    });

    await expect(page.getByRole("heading", { name: "Enter your code", exact: true })).toBeVisible();
    await expect(page.getByText(/texted a code to your phone/)).toBeVisible();
    await expect(page.getByLabel("Code from your email")).toHaveCount(0);
    const code = (await sent.json()).data.devCodes.phone as string;

    await page.getByLabel("Your name").fill(`${TAG} Text Driver`);
    await page.getByLabel("Code from your text message").fill(code);
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"));

    await page.goto("/account");
    await expect(page.getByText(`+44${phone.slice(1)}`)).toBeVisible();
    const session = await page.evaluate(() => JSON.parse(localStorage.getItem("roadaxis_auth")!));
    expect(session.user.email).toBeNull();
  });

  test("the country picker lists the open countries and changes the example", async ({ page }) => {
    await page.goto("/sign-in");
    const picker = page.getByRole("button", { name: /country code/i });
    await expect(picker).toHaveAttribute("aria-expanded", "false");
    await picker.click();
    const list = page.getByRole("listbox", { name: "Country code" });
    await expect(list.getByRole("option")).toHaveText(["UK +44", "UAE +971"]);
    await list.getByRole("option", { name: "UAE +971" }).click();
    await expect(list).toHaveCount(0);
    await expect(page.getByLabel("Mobile number")).toHaveAttribute("placeholder", "50 123 4567");

    // And by keyboard: arrow to open, arrow to move, Enter to choose.
    await picker.focus();
    await page.keyboard.press("ArrowDown");
    await expect(list).toBeVisible();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(page.getByLabel("Mobile number")).toHaveAttribute("placeholder", "7700 900123");
    await expect(picker).toBeFocused();
  });

  test("only the methods on offer are drawn", async ({ page }) => {
    await offering(page, { sms: false, email: false, google: false });
    await page.goto("/sign-in");
    // One way left: no choice to make, and the button says where the code goes.
    await expect(page.getByRole("button", { name: "Send code by WhatsApp" })).toBeVisible();
    await expect(page.getByText("Send code by:")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /sms/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^email$/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /google/i })).toHaveCount(0);
  });

  test("it works on a phone", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "Phone-only");
    await page.goto(`/sign-in?returnTo=${encodeURIComponent(`/business/${slug}/request`)}`);
    await expect(page.getByLabel("Mobile number")).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectTouchTargets(page, "driver sign-in");
    // The number is in the first screenful, as in the design.
    const box = await page.getByLabel("Mobile number").boundingBox();
    expect(box!.y + box!.height).toBeLessThan(page.viewportSize()!.height);
    await expect(page.getByLabel("Mobile number")).toHaveCSS("font-size", "16px");
  });
});

test.describe("Phase 21 · Console → Sign-in methods", () => {
  test.afterAll(async () => {
    for (const m of ["whatsapp", "sms", "email", "google"]) await setMethod(m, true);
  });

  test("an administrator switches SMS off, and the sign-in page follows", async ({
    page,
    browser,
  }) => {
    await page.goto("/");
    await page.evaluate((s) => localStorage.setItem("roadaxis_auth", JSON.stringify(s)), {
      accessToken: admin.accessToken,
      user: admin.user,
    });
    await page.goto("/admin/sign-in");
    await expect(page.getByRole("heading", { name: "Sign-in methods" })).toBeVisible();
    const rows = page.getByRole("list", { name: "Sign-in methods" }).getByRole("listitem");
    await expect(rows).toHaveCount(4);
    await expect(page.getByTestId("state-sms")).toContainText("Shown on the sign-in page");

    await page.getByRole("checkbox", { name: /switch off text message/i }).click();
    await expect(page.getByTestId("state-sms")).toHaveText("Switched off: drivers don't see it.");

    // A driver arriving now, in a fresh browser.
    const driver = await browser.newPage();
    await driver.goto("/sign-in");
    await expect(driver.getByRole("button", { name: "Send code by WhatsApp" })).toBeVisible();
    await expect(driver.getByRole("button", { name: /sms/i })).toHaveCount(0);
    await driver.close();

    await page.getByRole("checkbox", { name: /switch on text message/i }).click();
    await expect(page.getByTestId("state-sms")).toContainText("Shown on the sign-in page");
  });
});
