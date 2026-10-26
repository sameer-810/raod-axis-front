import { test, expect, request as pwRequest, type Page } from "@playwright/test";
import { API } from "./helpers";

/**
 * Phase 16 — a photograph for every service (DECISIONS.md D-041).
 *
 * The live site showed two blank tiles: services added in the console after
 * launch, which the site had no photograph for. An administrator can now give
 * any service its own picture, and "Wheels" has one built in.
 */
const TAG = `p6${Date.now().toString(36).slice(-6)}`;

interface Session {
  accessToken: string;
  user: { id: string; name: string; email: string; role: string };
}

let admin: Session;

async function adminApi() {
  return pwRequest.newContext({
    extraHTTPHeaders: { Authorization: `Bearer ${admin.accessToken}` },
  });
}

async function signIn(page: Page) {
  await page.goto("/");
  await page.evaluate((s) => localStorage.setItem("roadaxis_auth", JSON.stringify(s)), {
    accessToken: admin.accessToken,
    user: admin.user,
  });
}

/** The tile's picture on the home page, found by the service's name. */
function tilePhoto(page: Page, name: string) {
  return page.getByRole("link", { name: new RegExp(`^${name}`) }).locator("img");
}

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
  await ctx.dispose();
});

test.describe("Phase 16 · A photograph for every service", () => {
  test("an administrator gives a new service its picture, and the home page shows it", async ({
    page,
  }, testInfo) => {
    const name = `${TAG}${testInfo.project.name.slice(0, 1)} Windscreens`;
    const api = await adminApi();
    const created = (await (await api.post(`${API}/categories`, { data: { name } })).json()).data;

    try {
      // Before: a service the site has no photograph for shows its icon.
      await page.goto("/");
      await expect(page.getByRole("link", { name: new RegExp(`^${name}`) })).toBeVisible();
      await expect(tilePhoto(page, name)).toHaveCount(0);

      await signIn(page);
      await page.goto("/admin/categories");
      // Both layouts are in the page — a table on a desktop, cards on a phone.
      await page
        .getByRole("button", { name: `Actions for ${name}` })
        .filter({ visible: true })
        .click();
      const chooser = page.waitForEvent("filechooser");
      await page.getByRole("menuitem", { name: /^add photo$/i }).click();
      await (await chooser).setFiles("public/images/promo-car.webp");
      await expect(page.getByText(`Photo added to ${name}`)).toBeVisible({ timeout: 30_000 });

      // The menu now offers to change or remove it.
      await page
        .getByRole("button", { name: `Actions for ${name}` })
        .filter({ visible: true })
        .click();
      await expect(page.getByRole("menuitem", { name: /^change photo$/i })).toBeVisible();
      await page.keyboard.press("Escape");

      // After: the tile on the site carries the uploaded picture.
      await page.goto("/");
      const photo = tilePhoto(page, name);
      await expect(photo).toHaveCount(1);
      const src = await photo.getAttribute("src");
      expect(src, "the uploaded file, not the site's own").not.toContain("/images/categories/");
      expect(src).toMatch(/^https?:\/\//);

      // And it can be taken away again: back to the icon.
      await page.goto("/admin/categories");
      await page
        .getByRole("button", { name: `Actions for ${name}` })
        .filter({ visible: true })
        .click();
      await page.getByRole("menuitem", { name: /^remove photo$/i }).click();
      await expect(page.getByText(`Photo removed from ${name}`)).toBeVisible();
      await page.goto("/");
      await expect(page.getByRole("link", { name: new RegExp(`^${name}`) })).toBeVisible();
      await expect(tilePhoto(page, name)).toHaveCount(0);
    } finally {
      await api.delete(`${API}/categories/${created.id}`);
      await api.dispose();
    }
  });

  test("“Wheels” has a photograph without anyone uploading one", async ({ page }) => {
    test.skip(test.info().project.name !== "chromium", "One run is enough: no layout involved");
    const api = await adminApi();
    const all = (await (await api.get(`${API}/categories/all`)).json()).data ?? [];
    const existing = (all as Array<{ slug: string; isActive: boolean }>).find(
      (c) => c.slug === "wheels",
    );
    test.skip(existing?.isActive === false, "Wheels is hidden on this database");
    const made = existing
      ? null
      : (await (await api.post(`${API}/categories`, { data: { name: "Wheels" } })).json()).data;

    try {
      await page.goto("/");
      const photo = page.locator('a[href*="category=wheels"] img');
      await expect(photo).toHaveCount(1);
      // The built-in one unless the client has since uploaded their own.
      await expect(photo).toHaveAttribute("src", /wheels\.webp|^https?:\/\//);
      await photo.scrollIntoViewIfNeeded();
      const loaded = await photo.evaluate((img: HTMLImageElement) =>
        img.decode().then(
          () => img.naturalWidth,
          () => 0,
        ),
      );
      expect(loaded, "the picture actually loads").toBeGreaterThan(0);
    } finally {
      if (made) await api.delete(`${API}/categories/${made.id}`);
      await api.dispose();
    }
  });
});
