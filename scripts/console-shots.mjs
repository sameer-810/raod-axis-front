/**
 * Screenshots of the console (Admin Console + Business Portal) for the audit.
 *
 * Seeds one realistic owner fixture and shoots every authenticated screen at
 * laptop, phone and dark. Fixture names start with "Shot…" so the sweeper's tag
 * pattern (^shot[a-z0-9]{5,}\s) removes them afterwards.
 *
 *   node scripts/console-shots.mjs          → ../docs/console/*.png
 */
import fs from "node:fs";
import { chromium, request as pwRequest } from "@playwright/test";

const API = "http://localhost:5005/api";
const WEB = "http://localhost:5175";
const OUT = "../docs/console";
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
fs.mkdirSync(OUT, { recursive: true });

async function login(email, password) {
  const ctx = await pwRequest.newContext();
  const res = await ctx.post(`${API}/auth/login`, { data: { email, password } });
  const data = (await res.json()).data;
  await ctx.dispose();
  return data;
}

const admin = await login("admin@roadaxis.online", "ChangeMe@2026");
const adminCtx = await pwRequest.newContext({
  extraHTTPHeaders: { Authorization: `Bearer ${admin.accessToken}` },
});

// ── The owner's business ─────────────────────────────────────────────────────
const created = await adminCtx.post(`${API}/businesses`, {
  data: {
    name: "Shotbridge Lane Garage",
    description:
      "Family-run garage on the edge of the Northern Quarter. MOTs, servicing and diagnostics since 2009. Courtesy car by arrangement.",
    address: { line1: "14 Shotbridge Lane", city: "Manchester", postcode: "M4 5JW" },
    latitude: 53.4839,
    longitude: -2.2325,
    services: [
      { name: "MOT", priceFrom: 45 },
      { name: "Full service", priceFrom: 120, description: "Oil, filters, 50-point check" },
      { name: "Diagnostics", priceFrom: 40 },
      { name: "Tyre replacement", priceFrom: 55, description: "Supply and fit, per tyre" },
    ],
    workingHours: [
      { day: 0, closed: true },
      ...[1, 2, 3, 4, 5].map((day) => ({ day, closed: false, open: "08:30", close: "17:30" })),
      { day: 6, closed: false, open: "09:00", close: "13:00" },
    ],
  },
});
const business = (await created.json()).data;
const ownerEmail = "shot.owner@e2e.test";
await adminCtx.post(`${API}/auth/users`, {
  data: {
    name: "Priya Shah",
    email: ownerEmail,
    password: "OwnerSecret123",
    role: "business_owner",
  },
});
await adminCtx.post(`${API}/businesses/${business.id}/transfer`, {
  data: { email: ownerEmail, reason: "Console screenshot fixture." },
});
await adminCtx.post(`${API}/businesses/${business.id}/whatsapp-numbers`, {
  data: { label: "Workshop", phone: "07700900" + String(Math.floor(Math.random() * 900) + 100) },
});
await adminCtx.post(`${API}/businesses/${business.id}/whatsapp-numbers`, {
  data: { label: "Recovery", phone: "07700900" + String(Math.floor(Math.random() * 900) + 100) },
});

// ── A driver, and two booking requests so the inbox has rows ────────────────
const bare = await pwRequest.newContext();
async function driverToken(email, phone, name) {
  const req = await bare.post(`${API}/auth/otp/request`, { data: { email, phone } });
  const { challengeId, devCodes } = (await req.json()).data;
  const ver = await bare.post(`${API}/auth/otp/verify`, {
    data: { challengeId, emailCode: devCodes.email, phoneCode: devCodes.phone, name },
  });
  return (await ver.json()).data.accessToken;
}
const drivers = [
  [
    "shot.tom@e2e.test",
    "07700900" + String(700 + Math.floor(Math.random() * 90)),
    "Tom Ellis",
    "MOT",
    "Front tyre is down to the wire — can you do both while it's in?",
  ],
  [
    "shot.amy@e2e.test",
    "07700900" + String(800 + Math.floor(Math.random() * 90)),
    "Amy Okafor",
    "Diagnostics",
    "Engine light came on yesterday. Happy to leave it with you.",
  ],
];
for (const [email, phone, name, service, notes] of drivers) {
  try {
    const token = await driverToken(email, phone, name);
    const dctx = await pwRequest.newContext({
      extraHTTPHeaders: { Authorization: `Bearer ${token}` },
    });
    const date = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
    const r = await dctx.post(`${API}/businesses/${business.id}/booking-requests`, {
      data: { serviceName: service, preferredDate: date, preferredTime: "09:30", notes },
    });
    console.log("request", name, "→", r.status());
    await dctx.dispose();
  } catch (e) {
    console.log("driver fixture skipped:", e.message);
  }
}

// ── Two claims in the queue ─────────────────────────────────────────────────
const demo = (await (await fetch(`${API}/businesses?limit=20&sort=rating`)).json()).data.filter(
  (b) => b.claimStatus === "unclaimed" && !/^shot/i.test(b.name),
);
for (const [i, b] of demo.slice(0, 2).entries()) {
  const res = await bare.post(`${API}/claims/business/${b.id}`, {
    multipart: {
      contactName: ["Sarah Patel", "Dev Kapoor"][i],
      contactEmail: ["shot.sarah@e2e.test", "shot.dev@e2e.test"][i],
      contactPhone: "07700900" + String(400 + i),
      contactRole: "Owner",
      message: "This is my garage — happy to send anything else you need.",
      documents: { name: "business-licence.png", mimeType: "image/png", buffer: PNG },
    },
  });
  console.log("claim on", b.name, "→", res.status());
}
await bare.dispose();
await adminCtx.dispose();
const owner = await login(ownerEmail, "OwnerSecret123");

// ── Shoot ───────────────────────────────────────────────────────────────────
const browser = await chromium.launch();

async function shoot(session, path, out, { w = 1440, h = 900, theme = "light", after } = {}) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto(WEB + "/");
  if (theme === "dark") await page.evaluate(() => localStorage.setItem("roadaxis_theme", "dark"));
  else await page.evaluate(() => localStorage.setItem("roadaxis_theme", "light"));
  await page.evaluate(
    (s) =>
      localStorage.setItem(
        "roadaxis_auth",
        JSON.stringify({ accessToken: s.accessToken, user: s.user }),
      ),
    session,
  );
  await page.goto(WEB + path, { waitUntil: "networkidle" });
  if (after) await after(page);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/${out}` });
  await page.close();
  console.log("ok", out);
}

await shoot(admin, "/admin/businesses", "admin-businesses.png");
await shoot(admin, "/admin/businesses", "admin-businesses-dark.png", { theme: "dark" });
await shoot(admin, "/admin/businesses", "admin-businesses-palette.png", {
  after: async (p) => {
    await p.keyboard.press("Control+k");
    await p.keyboard.type("ana");
    await p.waitForTimeout(400);
  },
});
await shoot(admin, "/admin/businesses", "admin-businesses-selected.png", {
  after: async (p) => {
    const boxes = p.getByRole("checkbox", { name: /select row/i });
    await boxes.nth(0).check();
    await boxes.nth(2).check();
    await p
      .getByRole("button", { name: /actions for/i })
      .first()
      .click();
    await p.waitForTimeout(300);
  },
});
await shoot(admin, "/admin/businesses", "admin-businesses-phone.png", { w: 390, h: 844 });
await shoot(admin, "/admin/claims", "admin-claims.png");
await shoot(admin, "/admin/reviews", "admin-reviews.png");
await shoot(admin, "/admin/whatsapp-logs", "admin-logs.png");
await shoot(admin, "/admin/whatsapp-logs", "admin-logs-drawer.png", {
  after: async (p) => {
    const row = p.locator("tbody tr").first();
    if (await row.count()) await row.click();
    await p.waitForTimeout(400);
  },
});
await shoot(admin, "/admin/audit", "admin-audit.png");
await shoot(admin, "/admin/categories", "admin-categories.png");
await shoot(admin, "/admin/businesses/import", "admin-import.png");
await shoot(admin, "/admin/analytics", "admin-analytics.png");
await shoot(admin, `/admin/businesses/${business.id}`, "admin-edit.png");
await shoot(owner, "/portal", "portal.png");
await shoot(owner, "/portal", "portal-dark.png", { theme: "dark" });
await shoot(owner, "/portal", "portal-phone.png", { w: 390, h: 844 });
await shoot(owner, "/portal/requests", "portal-requests.png", {
  after: async (p) => {
    await p
      .getByRole("button", { name: /tom ellis/i })
      .first()
      .click()
      .catch(() => undefined);
    await p.waitForTimeout(300);
  },
});
await shoot(owner, "/portal/requests", "portal-requests-phone.png", { w: 390, h: 844 });
await shoot(owner, "/portal/whatsapp", "portal-whatsapp.png");
await shoot(owner, "/portal/performance", "portal-performance.png");
await shoot(owner, "/portal/listing", "portal-listing.png");
await shoot(owner, "/portal/listing", "portal-listing-phone.png", { w: 390, h: 844 });

await browser.close();
