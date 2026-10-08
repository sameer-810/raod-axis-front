import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests, one spec pair per delivery phase.
 *
 * These run against a REAL backend and database (whatever `raod-axis-back` is
 * pointed at), so every record they create is tagged with a run id and swept up
 * afterwards. A suite that leaves fixtures behind in a shared database gets
 * switched off within a month.
 *
 * Start both servers first:
 *   cd raod-axis-back  && npm start
 *   cd raod-axis-front && npm run dev
 */
const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:5175";

/**
 * A second API for Phase 10, identical to the first but for one variable: no
 * WhatsApp Cloud API, so a driver signs in on the emailed code alone. That is
 * the configuration the product launches in, and it has to be tested through
 * the real sign-in screen rather than assumed from the two-code one.
 *
 * Started here if nothing is listening on the port, reused if something is.
 * Same database as the first: whatever MONGODB_URI the shell or `.env` gives.
 */
const EMAIL_ONLY_PORT = process.env.E2E_EMAIL_ONLY_PORT || "5015";

export default defineConfig({
  webServer: {
    command: "node server.js",
    cwd: "../raod-axis-back",
    url: `http://localhost:${EMAIL_ONLY_PORT}/health`,
    reuseExistingServer: true,
    timeout: 60_000,
    env: { PORT: EMAIL_ONLY_PORT, OTP_REQUIRE_WHATSAPP: "false" },
  },
  testDir: "./e2e",
  // Serial. The suite shares one database, and parallel workers racing on the
  // same business or claim produce failures that are about the runner rather
  // than about the product.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 15_000,
    locale: "en-GB",
    timezoneId: "Europe/London",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    /**
     * A real phone profile, not a narrowed desktop window. The mobile rules in
     * DESIGN.md are about touch targets and safe areas, and a desktop browser
     * resized to 390px reports neither.
     */
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
