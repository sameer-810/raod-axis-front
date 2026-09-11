/**
 * Screenshots of the public product for the client presentation.
 *
 * Seeds nothing. The public screens are the demo directory and nothing else, so
 * the search results in the document are the same eleven Manchester garages
 * `npm run seed:demo` creates — no test fixtures with run tags in their names
 * sitting in the middle of a page somebody is being shown.
 *
 * The authenticated screens are `console-shots.mjs`, which does seed.
 *
 *   node scripts/audit-shots.mjs        → ../docs/*.png
 */
import { chromium } from "@playwright/test";

const API = "http://localhost:5005/api";
const WEB = "http://localhost:5175";
const OUT = "../docs";

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

async function shoot(path, out, { w = 1440, h = 900, theme = "light", after } = {}) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto(WEB + "/");
  await page.evaluate((t) => localStorage.setItem("roadaxis_theme", t), theme);
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
await shoot("/sign-in", "a-signin-laptop.png");
await shoot("/sign-in", "a-signin-phone.png", { w: 390, h: 844 });
await shoot("/staff/sign-in", "a-staff-laptop.png");

await browser.close();
