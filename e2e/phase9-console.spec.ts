import { test, expect, request as pwRequest, type Page, type TestInfo } from "@playwright/test";
import { API, contrastOf, expectNoHorizontalOverflow, expectTouchTargets } from "./helpers";

/**
 * Phase 9 — the console is a tool, not a template.
 *
 * The public product was rebuilt in Phase 8; this is the authenticated half:
 * a command palette, tables with selection and bulk actions, row menus that
 * work from the keyboard, side panels that trap focus, and a density setting
 * that survives a reload. Every one of these is the difference between an
 * admin screen somebody tolerates and one they reach for.
 */
const TAG = `p9${Date.now().toString(36).slice(-6)}`;

/** The table, the sidebar and the breadcrumb do not exist below `md`. */
function desktopOnly(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== "chromium", "Desktop-only: the phone gets cards");
}

async function adminSession() {
  const ctx = await pwRequest.newContext();
  const res = await ctx.post(`${API}/auth/login`, {
    data: {
      email: process.env.E2E_ADMIN_EMAIL || "admin@roadaxis.online",
      password: process.env.E2E_ADMIN_PASSWORD || "ChangeMe@2026",
    },
  });
  expect(res.ok(), 'run "npm run seed:admin" in raod-axis-back').toBeTruthy();
  const data = (await res.json()).data;
  await ctx.dispose();
  return data as { accessToken: string; user: unknown };
}

async function signInAsAdmin(page: Page) {
  const session = await adminSession();
  await page.goto("/");
  await page.evaluate(
    (s) =>
      localStorage.setItem(
        "roadaxis_auth",
        JSON.stringify({ accessToken: s.accessToken, user: s.user }),
      ),
    session,
  );
}

/** The shell is a lazy chunk; a keystroke before it mounts goes nowhere. */
async function settle(page: Page) {
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({ timeout: 20_000 });
}

/**
 * Wait for every running animation to finish.
 *
 * Geometry measured mid-transition is not the geometry a finger meets: a panel
 * still sliding or scaling reports a fraction under its settled size, which is
 * how a 44px control gets recorded as 43.99 and fails a floor it clears.
 */
async function stillness(page: Page) {
  await page.waitForFunction(
    () => document.getAnimations().every((a) => a.playState !== "running"),
    undefined,
    { timeout: 5_000 },
  );
}

/**
 * Listings this test alone can select and suspend.
 *
 * The batch token is per call, not per file: several tests each seed their own,
 * and searching on a shared tag would put another test's rows in this one's
 * table — which is how a "select all" assertion counts four instead of two.
 */
async function seedListings(n: number) {
  const session = await adminSession();
  const ctx = await pwRequest.newContext({
    extraHTTPHeaders: { Authorization: `Bearer ${session.accessToken}` },
  });
  const batch = `${TAG}${Math.random().toString(36).slice(2, 6)}`;
  const names: string[] = [];
  for (let i = 0; i < n; i++) {
    const name = `${batch} Garage ${i + 1}`;
    const res = await ctx.post(`${API}/businesses`, {
      data: {
        name,
        address: { line1: `${i + 1} Console Way`, city: "Manchester", postcode: "M1 1AA" },
        latitude: 53.47 + Math.random() * 0.02,
        longitude: -2.24 + Math.random() * 0.02,
      },
    });
    expect(res.status()).toBe(201);
    names.push(name);
  }
  await ctx.dispose();
  return { batch, names };
}

test.describe("Phase 9 · The command palette", () => {
  test("opens on the keyboard, finds a page, and goes there", async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto("/admin/businesses");
    await settle(page);

    await page.keyboard.press("Control+k");
    const palette = page.getByRole("dialog", { name: /search and commands/i });
    await expect(palette).toBeVisible();
    // Focus lands in the input, so the next keystroke is the query.
    await expect(palette.getByRole("combobox")).toBeFocused();

    await page.keyboard.type("audit");
    await expect(palette.getByRole("option", { name: /audit log/i })).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/admin\/audit/);
    await expect(palette).toBeHidden();
  });

  test("finds a business by name for an administrator", async ({ page }) => {
    const { batch, names } = await seedListings(1);
    await signInAsAdmin(page);
    await page.goto("/admin/claims");
    await settle(page);
    await page.keyboard.press("Control+k");
    await page.keyboard.type(batch);
    await expect(page.getByRole("option", { name: new RegExp(names[0]) })).toBeVisible();
  });

  test("escape closes it and returns focus", async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto("/admin/businesses");
    await settle(page);
    const trigger = page.getByRole("button", { name: /search and commands/i }).last();
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog", { name: /search and commands/i })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: /search and commands/i })).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("a go-to sequence jumps without the palette", async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto("/admin/businesses");
    await settle(page);
    await page.keyboard.press("g");
    await page.keyboard.press("c");
    await expect(page).toHaveURL(/\/admin\/claims/);
  });
});

test.describe("Phase 9 · Tables", () => {
  test("selecting rows shows a bulk bar, and a bulk suspend takes both down", async ({
    page,
  }, testInfo) => {
    desktopOnly(testInfo);
    const { batch, names } = await seedListings(2);
    await signInAsAdmin(page);
    await page.goto("/admin/businesses");
    await settle(page);
    await page.getByLabel("Search listings").fill(batch);
    const table = page.getByRole("table", { name: "Businesses" });
    await expect(table.locator("tbody tr")).toHaveCount(2);

    await table.getByRole("checkbox", { name: /select all/i }).check();
    const bar = page.getByRole("region", { name: /selected rows/i });
    await expect(bar).toContainText("2 selected");

    await bar.getByRole("button", { name: /suspend/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText(/suspend 2 listings/i);
    await dialog.getByLabel("Reason").fill("Phase 9 bulk suspend");
    await dialog.getByRole("button", { name: /^suspend$/i }).click();

    await expect(page.getByText(/2 listings suspended/i)).toBeVisible();
    // Both rows now carry the state, not just the one that was acted on.
    await expect(table.getByText("Suspended")).toHaveCount(2);
    await expect(table.getByRole("row").filter({ hasText: names[0] })).toBeVisible();
  });

  test("a row's menu opens from the keyboard and offers only the real move", async ({
    page,
  }, testInfo) => {
    desktopOnly(testInfo);
    const { batch, names } = await seedListings(1);
    await signInAsAdmin(page);
    await page.goto("/admin/businesses");
    await settle(page);
    await page.getByLabel("Search listings").fill(batch);

    const trigger = page.getByRole("button", { name: new RegExp(`actions for ${names[0]}`, "i") });
    await trigger.focus();
    await page.keyboard.press("Enter");

    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible();
    // Opening the menu must not also open the record: the row is still here.
    await expect(page).toHaveURL(/\/admin\/businesses$/);
    // A live listing can be suspended, not restored — only the real move is offered.
    await expect(menu.getByRole("menuitem", { name: /suspend listing/i })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: /restore/i })).toHaveCount(0);

    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("arrow keys move between rows and Enter opens one", async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    const { batch, names } = await seedListings(2);
    await signInAsAdmin(page);
    await page.goto("/admin/businesses");
    await settle(page);
    await page.getByLabel("Search listings").fill(batch);

    const rows = page.getByRole("table", { name: "Businesses" }).locator("tbody tr");
    await expect(rows).toHaveCount(2);
    await rows.first().focus();
    await page.keyboard.press("ArrowDown");
    await expect(rows.nth(1)).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/admin\/businesses\/[a-f0-9]{24}/);
    await expect(page.getByRole("heading", { name: names[1] })).toBeVisible();
  });

  test("the density setting survives a reload", async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    await signInAsAdmin(page);
    await page.goto("/admin/businesses");
    await settle(page);
    const table = page.getByRole("table", { name: "Businesses" });

    await page.getByRole("button", { name: /^compact$/i }).click();
    await expect(table).toHaveAttribute("data-density", "compact");
    await page.reload();
    await expect(table).toHaveAttribute("data-density", "compact");
    await page.getByRole("button", { name: /^comfortable$/i }).click();
    await expect(table).toHaveAttribute("data-density", "comfortable");
  });

  test("active filters are named and can be cleared in one move", async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto("/admin/businesses");
    await settle(page);
    await page.getByLabel("Visibility").selectOption("suspended");
    await page.getByLabel("Ownership").selectOption("unclaimed");
    // A filtered list that looks unfiltered is how people misread data.
    await expect(page.getByRole("button", { name: /remove filter: visibility/i })).toBeVisible();
    await page.getByRole("button", { name: /clear all/i }).click();
    await expect(page.getByRole("button", { name: /remove filter/i })).toHaveCount(0);
    await expect(page.getByLabel("Visibility")).toHaveValue("");
  });
});

test.describe("Phase 9 · Side panels and dialogs", () => {
  test("a row opens a drawer that takes focus and closes on Escape", async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    await signInAsAdmin(page);
    await page.goto("/admin/whatsapp-logs");
    await settle(page);
    // `tbody tr[tabindex]` rather than `tbody tr`: the skeleton placeholders are
    // rows too, and clicking one is a click on nothing.
    const rows = page.locator("tbody tr[tabindex]");
    await expect(page.getByRole("table", { name: /delivery attempts/i })).not.toHaveAttribute(
      "aria-busy",
      "true",
    );
    test.skip((await rows.count()) === 0, "No delivery attempts on this database yet");

    await rows.first().click();
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();
    const inside = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      return Boolean(dialog && document.activeElement && dialog.contains(document.activeElement));
    });
    expect(inside, "focus stayed outside the drawer").toBe(true);
    await expect(drawer.getByText(/what meta reported/i)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
  });

  test("a confirm dialog waits for its reason", async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    const { batch, names } = await seedListings(1);
    await signInAsAdmin(page);
    await page.goto("/admin/businesses");
    await settle(page);
    await page.getByLabel("Search listings").fill(batch);

    await page.getByRole("button", { name: new RegExp(`actions for ${names[0]}`, "i") }).click();
    await page.getByRole("menuitem", { name: /suspend listing/i }).click();

    const dialog = page.getByRole("dialog");
    const confirm = dialog.getByRole("button", { name: /^suspend$/i });
    // The owner reads this reason; it is not optional.
    await expect(confirm).toBeDisabled();
    await dialog.getByLabel("Reason").fill("Phase 9");
    await expect(confirm).toBeEnabled();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });
});

test.describe("Phase 9 · The shell", () => {
  test("the sidebar collapses to icons and remembers it", async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    await signInAsAdmin(page);
    await page.goto("/admin/businesses");
    await settle(page);
    await page.getByRole("button", { name: /collapse sidebar/i }).click();
    await expect(page.getByRole("button", { name: /expand sidebar/i })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: /expand sidebar/i })).toBeVisible();
    await page.getByRole("button", { name: /expand sidebar/i }).click();
    await expect(page.getByRole("button", { name: /collapse sidebar/i })).toBeVisible();
  });

  test("the account menu is where sign-out lives", async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    await signInAsAdmin(page);
    await page.goto("/admin/businesses");
    await settle(page);
    await page.getByRole("button", { name: /account menu/i }).click();
    const menu = page.getByRole("menu", { name: /account/i });
    await expect(menu.getByRole("menuitem", { name: /sign out/i })).toBeVisible();
    await menu.getByRole("menuitem", { name: /sign out/i }).click();
    // Out of the console, and carrying where they were so signing back in returns them.
    await expect(page).toHaveURL(/\/sign-in\?returnTo=/);
  });

  test("the breadcrumb names the section and the page", async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    await signInAsAdmin(page);
    await page.goto("/admin/businesses/import");
    await settle(page);
    const crumb = page.getByRole("navigation", { name: /breadcrumb/i });
    await expect(crumb).toContainText("Admin console");
    await expect(crumb).toContainText("Directory");
    // The longest matching path wins, or this reads "Businesses".
    await expect(crumb).toContainText("Import listings");
  });

  test("console surfaces meet AA in both themes", async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    await signInAsAdmin(page);
    for (const theme of ["light", "dark"] as const) {
      await page.goto("/admin/businesses");
      await page.evaluate((t) => localStorage.setItem("roadaxis_theme", t), theme);
      await page.reload();
      await settle(page);
      // The surfaces this phase introduced: a table header, the breadcrumb, a
      // sidebar row on the permanently-dark rail, and the page title.
      for (const sel of ["thead th", 'nav[aria-label="Breadcrumb"] li', ".ra-nav-item", "h1"]) {
        const ratio = await contrastOf(page, sel);
        expect(ratio, `${sel} in the ${theme} theme`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});

test.describe("Phase 9 · On a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the businesses list, its menus and the more sheet clear the floor", async ({ page }) => {
    await seedListings(1);
    await signInAsAdmin(page);
    await page.goto("/admin/businesses");
    await settle(page);
    await expectNoHorizontalOverflow(page);
    await expectTouchTargets(page, "admin businesses (phone)");

    await page.getByRole("button", { name: /^more$/i }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByRole("button", { name: /sign out/i })).toBeVisible();
    await stillness(page);
    await expectTouchTargets(page, "more sheet");
    await page.keyboard.press("Escape");
  });

  test("a row menu on a phone is a real target", async ({ page }) => {
    const { batch, names } = await seedListings(1);
    await signInAsAdmin(page);
    await page.goto("/admin/businesses");
    await settle(page);
    await page.getByLabel("Search listings").fill(batch);

    const trigger = page.getByRole("button", { name: new RegExp(`actions for ${names[0]}`, "i") });
    await expect(trigger).toBeVisible();
    const box = await trigger.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    await trigger.click();
    await expect(page.getByRole("menuitem", { name: /suspend listing/i })).toBeVisible();
  });
});
