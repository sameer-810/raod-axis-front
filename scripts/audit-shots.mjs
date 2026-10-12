/**
 * Screenshots of the public product for the client presentation.
 *
 * Seeds nothing. The public screens are the demo directory and nothing else, so
 * the search results in the document are the same garages `npm run seed:demo`
 * creates — eight in Manchester, eight in the UAE — with no test fixtures with
 * run tags in their names sitting in the middle of a page somebody is being
 * shown.
 *
 * Every screen is taken in a named country. Left to itself the site guesses
 * one from the clock of the machine it is on, and a document that changes with
 * where it was built is not one anybody can check.
 *
 * The authenticated screens are `console-shots.mjs`, which does seed.
 *
 *   node scripts/audit-shots.mjs        → ../docs/*.png
 */
import { execFileSync } from "node:child_process";
import { chromium } from "@playwright/test";

const API = "http://localhost:5005/api";
const WEB = "http://localhost:5175";
const OUT = "../docs";

/**
 * Sweep first, always.
 *
 * The public screens are the directory itself, so anything a test run left
 * behind is in the screenshot. Running the suite before taking these once put
 * 340 businesses called "p7mtwy3f8l Audit Motors" on the search page — the
 * whole document, past the first glance, made worthless.
 */
console.log("sweeping test data…");
execFileSync("npm", ["run", "clean:test-data"], {
  cwd: "../raod-axis-back",
  stdio: "inherit",
  shell: process.platform === "win32",
});

const directory = (await (await fetch(`${API}/businesses?limit=20&sort=rating`)).json()).data;
const featured =
  directory.find((b) => /deansgate/i.test(b.name)) ??
  directory.find((b) => b.reviewCount > 0) ??
  directory[0];
if (!featured) {
  console.error('No listings. Run "npm run seed:demo" in raod-axis-back first.');
  process.exit(1);
}

const browser = await chromium.launch();

async function shoot(path, out, { w = 1440, h = 900, theme = "light", market = "GB", after } = {}) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto(WEB + "/");
  await page.evaluate(
    ([t, m]) => {
      localStorage.setItem("roadaxis_theme", t);
      localStorage.setItem("roadaxis_market", m);
    },
    [theme, market],
  );
  await page.goto(WEB + path, { waitUntil: "networkidle" });
  if (after) await after(page);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT}/${out}` });
  await page.close();
  console.log("ok", out);
}

const NEAR = "/search?lat=53.4808&lng=-2.2426&radius=10000";

await shoot("/", "ui-home-real.png");
await shoot("/", "ui-home-laptop.png");
await shoot("/", "ui-home-dark.png", { theme: "dark" });
await shoot("/", "ui-home-phone.png", { w: 390, h: 844 });
await shoot(NEAR, "ui-search-real.png");
await shoot(NEAR, "ui-search-laptop.png");
await shoot(NEAR, "ui-search-map.png", {
  after: async (p) => {
    await p.getByRole("button", { name: "Map" }).click();
    await p.waitForTimeout(2500);
  },
});
await shoot(NEAR, "ui-search-tablet.png", { w: 834, h: 1112 });
await shoot(NEAR, "ui-search-phone.png", { w: 390, h: 844 });
await shoot("/categories", "ui-categories.png");
await shoot(`/business/${featured.slug}`, "ui-profile-laptop.png");
await shoot(`/business/${featured.slug}`, "b-profile-phone.png", { w: 390, h: 844 });
await shoot(`/business/${featured.slug}/request`, "b-request.png");
await shoot("/for-business", "ui-forbusiness.png");
await shoot(`/business/${featured.slug}/claim`, "b-claim.png");
await shoot("/register-business", "b-register.png");
await shoot("/privacy", "ui-privacy.png");
await shoot("/sign-in", "a-signin-laptop.png");
await shoot("/sign-in", "a-signin-phone.png", { w: 390, h: 844 });
await shoot("/staff/sign-in", "a-staff-laptop.png");

// ── The United Arab Emirates ────────────────────────────────────────────────
// The same screens on the other side of the country switch, where there are no
// postcodes, the money is dirhams and a phone number starts +971.
const uae = (
  await (
    await fetch(`${API}/businesses?limit=20&sort=rating`, { headers: { "X-Market": "AE" } })
  ).json()
).data;
const uaeFeatured = uae.find((b) => /al quoz/i.test(b.name)) ?? uae[0];

if (uaeFeatured) {
  const AE = { market: "AE" };
  await shoot("/", "uae-home.png", AE);
  await shoot("/", "uae-home-phone.png", { ...AE, w: 390, h: 844 });
  await shoot("/", "uae-switch.png", {
    ...AE,
    after: async (p) => {
      await p.getByRole("button", { name: /^Country:/ }).click();
      await p.waitForTimeout(300);
    },
  });
  await shoot("/search", "uae-search.png", AE);
  await shoot("/search", "uae-search-area.png", {
    ...AE,
    after: async (p) => {
      await p.getByLabel("City or area").fill("Dubai");
      await p.getByLabel("City or area").press("Enter");
      await p.getByRole("button", { name: /^10/ }).click();
      await p.waitForTimeout(1200);
    },
  });
  await shoot("/search", "uae-search-phone.png", { ...AE, w: 390, h: 844 });
  await shoot(`/business/${uaeFeatured.slug}`, "uae-profile.png", AE);
  await shoot("/sign-in", "uae-signin.png", AE);
  await shoot("/register-business", "uae-register.png", {
    ...AE,
    h: 1000,
    after: async (p) => {
      await p.getByLabel("Street address").fill("Al Khabaisi Street");
      await p.getByLabel("City or area").fill("Deira");
      await p.getByLabel("City or area").blur();
      await p.locator(".ra-picker .leaflet-container").waitFor();
      // The address and the map together, which is the part that differs.
      await p
        .getByRole("heading", { name: "Where you are" })
        .evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 90));
      await p.waitForTimeout(2500);
    },
  });
} else {
  console.log('No UAE listings. Run "npm run seed:demo" in raod-axis-back for the UAE screens.');
}

await browser.close();
