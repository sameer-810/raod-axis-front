/**
 * Screenshots of the console (Admin Console + Business Portal) for the client
 * presentation.
 *
 * Seeds an owner, three booking requests, two claims in the queue, and enough
 * reviews and saved garages that the dashboards show a product in use rather
 * than a column of zeros — then removes all of it.
 *
 * The fixtures carry **plausible names** rather than a run tag, because these
 * screenshots are put in front of a client and "shot94eq63 Ridgeway Lane
 * Garage" in the middle of a directory is not something to show anybody. They
 * are renamed to the tagged form after the last screenshot and swept, so an
 * interrupted run still leaves nothing behind that the sweeper cannot find.
 *
 * Reviews go only on the fixture garage, never on the demo directory: the demo
 * listings carry seeded ratings with no review records behind them, and the
 * sweeper recomputes a rating from surviving reviews — so one review on a demo
 * listing would wipe its rating the moment it was cleaned up.
 *
 *   node scripts/console-shots.mjs        → ../docs/console/*.png
 */
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { chromium, request as pwRequest } from "@playwright/test";

const API = "http://localhost:5005/api";
const WEB = "http://localhost:5175";
const OUT = "../docs/console";
/** The sweeper's tag: "shot" plus five characters, then a space. */
const RUN = `shot${Math.random().toString(36).slice(2, 8)}`;
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

/** The listings this script creates. Plain names — they end up in screenshots. */
const RIDGEWAY = "Ridgeway Lane Garage";
const CLAIMABLE = ["Hollinwood Autocentre", "Bexley Road Tyres"];

/**
 * Leftovers from a run that stopped before its own cleanup.
 *
 * Because the names above carry no run tag, the sweeper cannot recognise them
 * on its own — so they are tagged here and swept with the rest at the end.
 * Without this a killed run leaves a listing in the directory for ever, which
 * is how four copies of "Shotton Lane Garage" ended up in a client document.
 */
const all = (await (await fetch(`${API}/businesses?limit=100`)).json()).data;
for (const b of all.filter((x) => [RIDGEWAY, ...CLAIMABLE].includes(x.name))) {
  await adminCtx.patch(`${API}/businesses/${b.id}`, { data: { name: `${RUN} ${b.name}` } });
  console.log("tagged stale fixture:", b.name);
}

// ── The owner's business ─────────────────────────────────────────────────────
/** Everything created here, renamed to the sweepable form at the end. */
const fixtures = [];

const created = await adminCtx.post(`${API}/businesses`, {
  data: {
    name: RIDGEWAY,
    description:
      "Family-run garage on the edge of the Northern Quarter. MOTs, servicing and diagnostics since 2009. Courtesy car by arrangement.",
    address: { line1: "14 Ridgeway Lane", city: "Manchester", postcode: "M4 5JW" },
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
fixtures.push(business);
const ownerEmail = `${RUN}.owner@e2e.test`;
await adminCtx.post(`${API}/auth/users`, {
  data: {
    name: "Priya Shah",
    email: ownerEmail,
    password: "OwnerSecret123",
    role: "business_owner",
  },
});
await adminCtx.post(`${API}/businesses/${business.id}/transfer`, {
  // Written into the audit log, which is one of the screens captured below, so
  // it has to read like a real administrator's note.
  data: { email: ownerEmail, reason: "Ownership confirmed by phone with the applicant." },
});
const phone = () => `07700900${String(Math.floor(Math.random() * 900) + 100)}`;
await adminCtx.post(`${API}/businesses/${business.id}/whatsapp-numbers`, {
  data: { label: "Workshop", phone: phone() },
});
await adminCtx.post(`${API}/businesses/${business.id}/whatsapp-numbers`, {
  data: { label: "Recovery", phone: phone() },
});

// ── Drivers, requests, reviews and saved garages ────────────────────────────
const bare = await pwRequest.newContext();

/** A signed-in driver. Fresh identity per run, or the code limiter refuses. */
async function driver(slug, name) {
  const email = `${RUN}.${slug}@e2e.test`;
  const req = await bare.post(`${API}/auth/otp/request`, { data: { email, phone: phone() } });
  const body = (await req.json()).data;
  if (!body?.challengeId) throw new Error(`no challenge for ${slug}`);
  const ver = await bare.post(`${API}/auth/otp/verify`, {
    data: {
      challengeId: body.challengeId,
      emailCode: body.devCodes.email,
      phoneCode: body.devCodes.phone,
      name,
    },
  });
  const token = (await ver.json()).data.accessToken;
  return pwRequest.newContext({ extraHTTPHeaders: { Authorization: `Bearer ${token}` } });
}

const date = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
const PEOPLE = [
  [
    "tom",
    "Tom Ellis",
    "MOT",
    "09:30",
    "Front tyre is down to the wire — can you do both while it's in?",
    5,
    "Booked me in the same morning and rang when it was ready. No fuss.",
  ],
  [
    "amy",
    "Amy Okafor",
    "Diagnostics",
    "11:00",
    "Engine light came on yesterday. Happy to leave it with you.",
    4,
    "Found the fault in an hour and talked me through it properly.",
  ],
  ["raj", "Raj Mehta", "Full service", "14:30", null, 5, null],
];

/** Demo listings for the drivers to save — saving leaves no mark on the record. */
const demo = (await (await fetch(`${API}/businesses?limit=8&sort=rating`)).json()).data.filter(
  (b) => b.id !== business.id,
);

for (const [slug, name, service, time, notes, rating, text] of PEOPLE) {
  try {
    const ctx = await driver(slug, name);
    const r = await ctx.post(`${API}/businesses/${business.id}/booking-requests`, {
      data: {
        serviceName: service,
        preferredDate: date,
        preferredTime: time,
        ...(notes ? { notes } : {}),
      },
    });
    console.log("request", name, "→", r.status());
    if (text) {
      await ctx.post(`${API}/businesses/${business.id}/reviews`, { data: { rating, text } });
    }
    for (const b of demo.slice(0, 3)) await ctx.put(`${API}/favourites/${b.id}`);
    await ctx.dispose();
  } catch (e) {
    console.log(`driver ${slug} skipped:`, e.message);
  }
}

// ── Two claims in the queue ─────────────────────────────────────────────────
/**
 * Against listings this script creates, never the demo directory: a claim
 * leaves its target "pending", and the demo listings are fixture data the test
 * suite depends on being unclaimed.
 */
const claimable = [];
for (const [i, name] of CLAIMABLE.entries()) {
  const res = await adminCtx.post(`${API}/businesses`, {
    data: {
      name,
      description: "Independent garage. MOTs, servicing and tyres.",
      address: { line1: `${10 + i} Bexley Road`, city: "Manchester", postcode: "M4 6BF" },
      latitude: 53.481 + i * 0.004,
      longitude: -2.236 - i * 0.004,
    },
  });
  const listing = (await res.json()).data;
  claimable.push(listing);
  fixtures.push(listing);
}

/**
 * The applicant's email is on screen in the claims queue, so it has to read
 * like a garage owner's address rather than a test account. Safe to do: these
 * claims are swept by the listing they are filed against, not by their email.
 */
for (const [i, b] of claimable.entries()) {
  const res = await bare.post(`${API}/claims/business/${b.id}`, {
    multipart: {
      contactName: ["Sarah Patel", "Dev Kapoor"][i],
      contactEmail: ["sarah@hollinwoodautocentre.co.uk", "dev@bexleyroadtyres.co.uk"][i],
      contactPhone: `0770090040${i}`,
      contactRole: "Owner",
      message: "This is my garage — happy to send anything else you need.",
      documents: { name: "business-licence.png", mimeType: "image/png", buffer: PNG },
    },
  });
  console.log("claim on", b.name, "→", res.status());
}
await bare.dispose();

// ── Profile views ───────────────────────────────────────────────────────────
/**
 * A view is counted once per visitor per day, and a visitor is the caller's
 * address plus user agent — so a different agent string is a different person
 * as far as the counter is concerned.
 *
 * Without this the "most viewed" board ranks every listing at zero views, which
 * in a document put in front of a client reads as a broken screen rather than a
 * quiet week. The spread is uneven on purpose: a leaderboard where everything
 * ties tells the reader nothing about what the board is for.
 */
const AGENTS = Array.from({ length: 40 }, (_, i) => `RoadAxisDemo/${i} (visitor ${i})`);
const viewable = [...(await (await fetch(`${API}/businesses?limit=20&sort=rating`)).json()).data];
for (const [i, b] of viewable.entries()) {
  const count = Math.max(3, 34 - i * 4 + (i % 3) * 5);
  for (const ua of AGENTS.slice(0, count)) {
    await fetch(`${API}/businesses/${b.slug}`, { headers: { "User-Agent": ua } });
  }
  console.log("views", b.name, "→", count);
}

const owner = await login(ownerEmail, "OwnerSecret123");

// ── Shoot ───────────────────────────────────────────────────────────────────
const browser = await chromium.launch();

async function shoot(session, path, out, { w = 1440, h = 900, theme = "light", after } = {}) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto(WEB + "/");
  await page.evaluate((t) => localStorage.setItem("roadaxis_theme", t), theme);
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
    await p.waitForTimeout(350);
  },
});
await shoot(admin, "/admin/businesses", "admin-businesses-phone.png", { w: 390, h: 844 });
await shoot(admin, "/admin/claims", "admin-claims.png");
await shoot(admin, "/admin/reviews", "admin-reviews.png");
await shoot(admin, "/admin/whatsapp-logs", "admin-logs.png");
await shoot(admin, "/admin/whatsapp-logs", "admin-logs-drawer.png", {
  after: async (p) => {
    const row = p.locator("tbody tr[tabindex]").first();
    if (await row.count()) await row.click();
    await p.waitForTimeout(450);
  },
});
await shoot(admin, "/admin/audit", "admin-audit.png");
await shoot(admin, "/admin/categories", "admin-categories.png");
await shoot(admin, "/admin/businesses/import", "admin-import.png");
await shoot(admin, "/admin/analytics", "admin-analytics.png", { h: 1050 });
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
    await p.waitForTimeout(350);
  },
});
await shoot(owner, "/portal/requests", "portal-requests-phone.png", { w: 390, h: 844 });
await shoot(owner, "/portal/whatsapp", "portal-whatsapp.png");
await shoot(owner, "/portal/performance", "portal-performance.png");
await shoot(owner, "/portal/listing", "portal-listing.png");
await shoot(owner, "/portal/listing", "portal-listing-phone.png", { w: 390, h: 844 });

await browser.close();

// ── Clean up after itself ───────────────────────────────────────────────────
// The screenshots are taken, so the names can become the tagged form the
// sweeper recognises. Renaming rather than deleting keeps this to endpoints the
// product already has.
for (const b of fixtures) {
  await adminCtx.patch(`${API}/businesses/${b.id}`, { data: { name: `${RUN} ${b.name}` } });
}
await adminCtx.dispose();

console.log("\nsweeping fixtures…");
execFileSync("npm", ["run", "clean:test-data"], {
  cwd: "../raod-axis-back",
  stdio: "inherit",
  shell: process.platform === "win32",
});
