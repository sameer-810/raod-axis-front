/**
 * Final screenshots for the audit, from a swept directory plus a handful of
 * realistically named fixtures. Names start with "Shot…" so the sweeper's tag
 * pattern (^shot[a-z0-9]{5,}\s) still removes them afterwards.
 */
import { chromium, request as pwRequest } from "@playwright/test";

const API = "http://localhost:5005/api";
const WEB = "http://localhost:5175";
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

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

// The owner's listing: described, priced, open, no photo yet — so the
// dashboard checklist has one honest item left on it.
const created = await adminCtx.post(`${API}/businesses`, {
  data: {
    name: "Shotton Lane Garage",
    description:
      "Family-run garage on the edge of the Northern Quarter. MOTs, servicing and diagnostics since 2009. Courtesy car by arrangement.",
    address: { line1: "14 Shotton Lane", city: "Manchester", postcode: "M4 5JW" },
    latitude: 53.4839,
    longitude: -2.2325,
    services: [
      { name: "MOT", priceFrom: 45 },
      { name: "Full service", priceFrom: 120, description: "Oil, filters, 50-point check" },
      { name: "Diagnostics", priceFrom: 40 },
    ],
  },
});
const business = (await created.json()).data;
const ownerEmail = "shotton.owner@e2e.test";
await adminCtx.post(`${API}/auth/users`, {
  data: {
    name: "Priya Shah",
    email: ownerEmail,
    password: "OwnerSecret123",
    role: "business_owner",
  },
});
await adminCtx.post(`${API}/businesses/${business.id}/transfer`, {
  data: { email: ownerEmail, reason: "Audit screenshot fixture." },
});
await adminCtx.post(`${API}/businesses/${business.id}/whatsapp-numbers`, {
  data: { label: "Workshop", phone: "07700900" + String(Math.floor(Math.random() * 900) + 100) },
});

// Two claims in the queue, on unclaimed demo listings, from real-looking
// applicants. Filtered on claim status: a claim against a listing that already
// has an owner is refused, and an empty queue is not the picture wanted here.
const demo = (await (await fetch(`${API}/businesses?limit=20&sort=rating`)).json()).data.filter(
  (b) => b.claimStatus === "unclaimed" && !/^shot/i.test(b.name),
);
const bare = await pwRequest.newContext();
for (const [i, b] of demo.slice(0, 2).entries()) {
  const form = {
    contactName: ["Sarah Patel", "Tom Ellis"][i],
    contactEmail: ["shot.sarah@e2e.test", "shot.tom@e2e.test"][i],
    contactPhone: "07700900" + String(400 + i),
    contactRole: "Owner",
    message: "This is my garage — happy to send anything else you need.",
  };
  const res = await bare.post(`${API}/claims/business/${b.id}`, {
    multipart: {
      ...form,
      documents: { name: "business-licence.png", mimeType: "image/png", buffer: PNG },
    },
  });
  console.log("claim on", b.name, "→", res.status());
}
await bare.dispose();
await adminCtx.dispose();
const owner = await login(ownerEmail, "OwnerSecret123");

const deansgate = (await (await fetch(`${API}/businesses?limit=1&search=Deansgate`)).json())
  .data[0];
const browser = await chromium.launch();

async function shoot(session, path, out, w = 1440, h = 900, theme = "light", after) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto(WEB + "/");
  if (session) {
    await page.evaluate(
      (s) =>
        localStorage.setItem(
          "roadaxis_auth",
          JSON.stringify({ accessToken: s.accessToken, user: s.user }),
        ),
      session,
    );
  }
  await page.goto(WEB + path, { waitUntil: "networkidle" });
  if (theme === "dark") {
    await page
      .getByRole("button", { name: /switch to dark theme/i })
      .first()
      .click();
    await page.waitForTimeout(300);
  }
  if (after) await after(page);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `../docs/${out}` });
  await page.close();
  console.log("ok", out);
}

const NEAR = "/search?lat=53.4808&lng=-2.2426&radius=10000";
await shoot(null, "/", "a-home-laptop.png");
await shoot(null, "/", "ui-home-dark.png", 1440, 900, "dark");
await shoot(null, "/", "ui-home-phone.png", 390, 844);
await shoot(null, NEAR, "ui-search-real.png");
await shoot(null, NEAR, "ui-search-map.png", 1440, 900, "light", async (p) => {
  await p.getByRole("button", { name: "Map" }).click();
  await p.waitForTimeout(2500);
});
await shoot(null, NEAR, "ui-search-tablet.png", 834, 1112);
await shoot(null, NEAR, "ui-search-phone.png", 390, 844);
await shoot(null, `/business/${deansgate.slug}`, "ui-profile-laptop.png");
await shoot(null, `/business/${deansgate.slug}`, "b-profile-phone.png", 390, 844);
await shoot(null, `/business/${deansgate.slug}/request`, "b-request.png");
await shoot(null, "/sign-in", "a-signin-laptop.png");
await shoot(null, "/staff/sign-in", "a-staff-laptop.png");
await shoot(null, "/sign-in", "a-signin-phone.png", 390, 844);
await shoot(owner, "/portal", "c-portal.png");
await shoot(owner, "/portal/listing", "c-portal-listing.png");
await shoot(admin, "/admin/analytics", "b-admin-analytics.png");
await shoot(admin, "/admin/businesses", "b-admin-businesses.png");
await shoot(admin, "/admin/claims", "b-admin-claims.png");

await browser.close();
