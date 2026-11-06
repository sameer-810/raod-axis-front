/**
 * Records the product walkthrough: a driver finds a garage and requests a
 * booking, the garage's owner answers it, and the RoadAxis team's console.
 *
 * Runs against the local servers on the DEVELOPMENT database only — it creates
 * one demo garage, an owner and a driver. Listings cannot be deleted through
 * the API, so the garage is suspended at the end and printed for removal; the
 * accounts are on @e2e.test, so `npm run clean:test-data` removes them.
 * Never point it at the live API.
 *
 *   node scripts/record-walkthrough.mjs <out-dir>   → <out-dir>/walkthrough.webm
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const API = "http://localhost:5005/api";
const WEB = "http://localhost:5175";
const OUT = path.resolve(process.argv[2] ?? "walkthrough");
const SIZE = { width: 1280, height: 800 };
const GARAGE = "Ashton Road Garage";
fs.mkdirSync(OUT, { recursive: true });

const health = await (await fetch("http://localhost:5005/health")).json();
if (health.data?.env === "production") throw new Error("Refusing to record against production.");

const json = async (res) => {
  const body = await res.json();
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(body)}`);
  return body.data;
};
const call = (method, url, token, body) =>
  fetch(`${API}${url}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  }).then(json);

/** A number in Ofcom's drama block that no account holds yet. */
async function freePhone() {
  for (let i = 0; i < 20; i++) {
    const phone = `07700900${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`;
    const res = await fetch(`${API}/auth/otp/request`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: `probe.${Date.now()}${i}@e2e.test`, phone }),
    });
    if (res.status === 202) return phone;
  }
  throw new Error("No free test number");
}

// ── The demo garage ──────────────────────────────────────────────────────────
const admin = await call("POST", "/auth/login", null, {
  email: "admin@roadaxis.online",
  password: "ChangeMe@2026",
});
const A = admin.accessToken;
const categories = await call("GET", "/categories");
const cat = (slug) => categories.find((c) => c.slug === slug)?.id;

// A real workshop photograph, borrowed from a demo listing.
const demo = (await (await fetch(`${API}/businesses?limit=20&sort=rating`)).json()).data;
const photoUrl =
  demo.find((b) => /deansgate/i.test(b.name))?.primaryPhotoUrl ?? demo[0]?.primaryPhotoUrl;
const media = [];
if (photoUrl) {
  const bytes = Buffer.from(await (await fetch(photoUrl)).arrayBuffer());
  const form = new FormData();
  form.append("kind", "photo");
  form.append("file", new Blob([bytes], { type: "image/jpeg" }), "workshop.jpg");
  const up = await fetch(`${API}/media`, {
    method: "POST",
    headers: { Authorization: `Bearer ${A}` },
    body: form,
  });
  if (up.ok) media.push((await up.json()).data.id);
}

const week = [0, 1, 2, 3, 4, 5, 6].map((day) =>
  day === 0
    ? { day, closed: true }
    : day === 6
      ? { day, closed: false, open: "09:00", close: "14:00" }
      : { day, closed: false, open: "08:00", close: "18:00" },
);
const garage = await call("POST", "/businesses", A, {
  name: GARAGE,
  description:
    "Family-run workshop off Ashton Old Road. Tyres fitted while you wait, brakes, and full services with a courtesy check.",
  categoryIds: [cat("tyres"), cat("brakes"), cat("oil-servicing")].filter(Boolean),
  address: { line1: "48 Ashton Old Road", city: "Manchester", postcode: "M12 6LP" },
  latitude: 53.4752,
  longitude: -2.2203,
  phone: "0161 496 0812",
  services: [
    { name: "Tyre replacement", priceFrom: 55 },
    { name: "Brake check", priceFrom: 40 },
    { name: "Full service", priceFrom: 149 },
  ],
  workingHours: week,
  ...(media.length ? { photoIds: media } : {}),
});
const ownerEmail = "walkthrough.owner@e2e.test";
const ownerPassword = "WalkthroughOwner123";
await call("POST", "/auth/users", A, {
  name: "Sam Patel",
  email: ownerEmail,
  password: ownerPassword,
  role: "business_owner",
}).catch(() => undefined);
await call("POST", `/businesses/${garage.id}/transfer`, A, {
  email: ownerEmail,
  reason: "Walkthrough: the garage's owner.",
});
const owner = await call("POST", "/auth/login", null, {
  email: ownerEmail,
  password: ownerPassword,
});
await call("POST", `/businesses/${garage.id}/whatsapp-numbers`, owner.accessToken, {
  label: "Workshop",
  phone: await freePhone(),
});
const driverPhone = await freePhone();

// ── Recording ────────────────────────────────────────────────────────────────
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: SIZE,
  recordVideo: { dir: OUT, size: SIZE },
  geolocation: { latitude: 53.4808, longitude: -2.2426 },
  permissions: ["geolocation"],
});
// A caption bar that survives navigation: the text lives in sessionStorage.
await context.addInitScript(() => {
  const draw = () => {
    const text = sessionStorage.getItem("wt-cap");
    let bar = document.getElementById("wt-cap");
    if (!text) return bar?.remove();
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "wt-cap";
      Object.assign(bar.style, {
        position: "fixed",
        left: "24px",
        bottom: "24px",
        zIndex: "2147483647",
        maxWidth: "620px",
        padding: "12px 16px",
        borderRadius: "12px",
        background: "rgba(17,17,19,0.92)",
        color: "#fff",
        font: "500 16px/1.4 Barlow, Arial, sans-serif",
        boxShadow: "0 8px 24px rgba(0,0,0,.25)",
        pointerEvents: "none",
      });
      document.documentElement.appendChild(bar);
    }
    bar.innerHTML = text;
  };
  window.__wtDraw = draw;
  document.addEventListener("DOMContentLoaded", draw);
  setInterval(draw, 400);
});
const page = await context.newPage();
const started = Date.now();
/** Each caption and when it appeared, for the chapter list. */
const chapters = [];
const pause = (ms) => page.waitForTimeout(ms);
async function caption(step, text) {
  chapters.push({ at: (Date.now() - started) / 1000, step, text });
  await page.evaluate(
    ([s, t]) => {
      sessionStorage.setItem("wt-cap", `<b style="color:#FF5A52">${s}</b>&nbsp; ${t}`);
      window.__wtDraw?.();
    },
    [step, text],
  );
}
async function glide(y) {
  await page.evaluate((top) => window.scrollTo({ top, behavior: "smooth" }), y);
  await pause(1400);
}
async function goto(url) {
  await page.goto(WEB + url, { waitUntil: "networkidle" });
  await pause(600);
}

await page.goto(WEB + "/");
await page.evaluate(() => {
  localStorage.setItem("roadaxis_theme", "light");
  localStorage.setItem("roadaxis_market", "GB");
});
await goto("/");

// 1 · Home
await caption("1 · Home", "A driver lands on the search: what, where, and four quick filters.");
await pause(3500);
await glide(420);
await caption("1 · Home", "Every service has its own picture. Tap one to search for it.");
await pause(3000);
await glide(1150);
await caption(
  "1 · Home",
  "The banner, then the best-rated garages, each with WhatsApp and Directions.",
);
await pause(3200);
await glide(0);

// 2 · Search
await caption("2 · Search", "“Near me” uses the phone’s location, asked for only on this tap.");
await pause(1800);
// The first tap asks for the position; once it is known, the tap searches.
for (let i = 0; i < 4 && !page.url().includes("/search"); i++) {
  await page.getByRole("button", { name: "Near me", exact: true }).click();
  await pause(1200);
}
await page.waitForURL(/\/search\?/);
await pause(2200);
await caption(
  "2 · Search",
  "Nearest first, with no distance limit unless the driver chooses one. Filters sit on the left.",
);
await pause(3600);
await page.locator("aside").getByRole("button", { name: "5.0 km" }).click();
await pause(2200);
await page.locator("aside").getByRole("button", { name: "Any" }).click();
await pause(1500);
await caption("2 · Search", "The same results on a map.");
await page.getByRole("group", { name: "View" }).getByRole("button", { name: "Map" }).click();
await pause(4200);
await page.getByRole("group", { name: "View" }).getByRole("button", { name: "List" }).click();
await pause(1500);

// 3 · A garage
await caption(
  "3 · A garage",
  "Open a garage: photos, services with prices, today’s hours, reviews.",
);
await page.getByRole("link", { name: GARAGE }).first().click();
await page.waitForURL(/\/business\//);
await pause(3500);
await glide(500);
await pause(1500);
await glide(0);

// 4 · Request a booking
await caption("4 · Request a booking", "No account is needed until the very end.");
await page
  .getByRole("link", { name: /request a booking/i })
  .first()
  .click();
await page.waitForURL(/\/request/);
await pause(3200);
await page.getByLabel("What do you need?").selectOption("Full service");
await pause(900);
await caption(
  "4 · Request a booking",
  "A day from the next fortnight, then an hour — or the whole night as one slot.",
);
await page.locator("button[aria-pressed][aria-label]").nth(2).click();
await pause(1100);
await glide(420);
await page.getByRole("button", { name: "10 AM - 11 AM" }).click();
await pause(1400);
await page
  .getByLabel(/anything they should know/i)
  .pressSequentially("Ford Focus 2018, front pads squealing.", {
    delay: 35,
  });
await pause(900);
await caption(
  "4 · Request a booking",
  "Sending asks the driver to sign in — and keeps what they typed.",
);
await page.getByRole("button", { name: /send booking request/i }).click();
await page.waitForURL(/sign-in/);
await pause(2500);

// 5 · Sign in
await caption("5 · Sign in", "No password: a code to the email address, and one to WhatsApp.");
await page.getByLabel("Email address").pressSequentially("alex.morgan@e2e.test", { delay: 30 });
await page.getByLabel("WhatsApp number").pressSequentially(driverPhone, { delay: 30 });
await pause(700);
await page.getByRole("button", { name: /send me a code/i }).click();
await page.getByRole("heading", { name: /enter your codes/i }).waitFor();
await caption(
  "5 · Sign in",
  "On this development server the codes are shown on screen; live, they arrive by email and WhatsApp.",
);
await pause(3000);
const digits = (
  await page.evaluate(() =>
    Array.from(document.querySelectorAll(".font-mono")).map((e) => e.textContent?.trim() ?? ""),
  )
).filter((c) => /^\d{6}$/.test(c));
const name = page.getByLabel("Your name");
if (await name.isVisible().catch(() => false))
  await name.pressSequentially("Alex Morgan", { delay: 30 });
await page.getByLabel("Code from your email").pressSequentially(digits[0], { delay: 40 });
await page.getByLabel("Code from WhatsApp").pressSequentially(digits[1], { delay: 40 });
await pause(600);
await page.getByRole("button", { name: /^sign in$/i }).click();
await page.waitForURL(/\/request/);
await pause(1500);
await caption("5 · Sign in", "Back on the form, exactly as it was left.");
await pause(2600);
await page.getByRole("button", { name: "10 AM - 11 AM" }).click();
await page.getByRole("button", { name: /send booking request/i }).click();
await page.getByRole("heading", { name: /request sent/i }).waitFor();
await caption(
  "6 · Request sent",
  "A reference, and one tap to send it to the garage from the driver’s own WhatsApp.",
);
await pause(4200);
await goto("/my-requests");
await caption("6 · Request sent", "The driver can follow every request from My requests.");
await pause(3200);

// 7 · The garage
await page.evaluate(() => localStorage.removeItem("roadaxis_auth"));
await goto("/staff/sign-in");
await caption("7 · The garage", "The owner signs in to the business portal.");
await page.locator("#email").pressSequentially(ownerEmail, { delay: 25 });
await page.locator("#password").pressSequentially(ownerPassword, { delay: 25 });
await page.getByRole("button", { name: /^sign in$/i }).click();
await page.waitForURL(/\/portal/);
await page.getByText(GARAGE).first().waitFor();
await pause(1200);
await caption(
  "7 · The garage",
  "The dashboard: can customers reach me, who has asked, how am I doing.",
);
await pause(4000);
await goto("/portal/requests");
await page.getByText("Alex Morgan").first().waitFor();
await caption(
  "7 · The garage",
  "The inbox. Call or WhatsApp the customer, then record what happened.",
);
await pause(2500);
await page.getByText("Alex Morgan").first().click();
await pause(2500);
const contacted = page.getByRole("button", { name: /mark contacted/i }).first();
if (await contacted.isVisible().catch(() => false)) {
  await contacted.click();
  await pause(2500);
}

// 8 · The RoadAxis team
await page.evaluate(() => localStorage.removeItem("roadaxis_auth"));
await goto("/staff/sign-in");
await page.locator("#email").fill("admin@roadaxis.online");
await page.locator("#password").fill("ChangeMe@2026");
await page.getByRole("button", { name: /^sign in$/i }).click();
await page.waitForURL(/\/admin/);
await pause(1000);
await caption("8 · The console", "RoadAxis’s own team starts the day on what needs a decision.");
await pause(4000);
await goto("/admin/businesses");
await caption(
  "8 · The console",
  "Every listing in both countries: live, draft or suspended, and who owns it.",
);
await pause(4000);
await goto("/admin/countries");
await caption("8 · The console", "The UK and the UAE are opened or paused here, with no deploy.");
await pause(4000);
await goto("/admin/analytics");
await caption(
  "8 · The console",
  "Analytics for every measure in the specification, split by country.",
);
await pause(4000);
await goto("/admin/audit");
await caption("8 · The console", "And a record nobody can edit of every change, with who made it.");
await pause(4000);
await page.evaluate(() => sessionStorage.removeItem("wt-cap"));
await goto("/");
await caption("RoadAxis", "rx.fiveminfotech.com");
await pause(2500);

const video = page.video();
await context.close();
await browser.close();
const raw = await video.path();
const final = path.join(OUT, "walkthrough.webm");
fs.renameSync(raw, final);
console.log("video", final);
fs.writeFileSync(path.join(OUT, "chapters.json"), JSON.stringify(chapters, null, 2));

// Out of the public directory straight away; remove it from the development
// database by id if it should not stay there at all.
await call("PATCH", `/businesses/${garage.id}/status`, A, {
  status: "suspended",
  reason: "Walkthrough recording finished.",
}).catch((err) => console.log("could not suspend:", err.message));
console.log("garage", garage.id);
