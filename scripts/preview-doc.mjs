/**
 * Screenshot each printed page of one of the docs/ HTML documents, so the
 * finished PDF can be checked without a PDF renderer to hand.
 *
 *   node scripts/preview-doc.mjs ui-presentation.html
 *   → ../docs/.preview/page-01.png …
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const [input] = process.argv.slice(2);
if (!input) {
  console.error("Usage: node scripts/preview-doc.mjs <input.html>");
  process.exit(1);
}

const docs = path.resolve("../docs");
const out = path.join(docs, ".preview");
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

// A4 at 96dpi, minus the document's own 15/13mm margins.
const PAGE = { width: 794, height: 1123 };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: PAGE, deviceScaleFactor: 1 });
await page.emulateMedia({ media: "print" });
await page.goto(pathToFileURL(path.join(docs, input)).href, { waitUntil: "networkidle" });
await page.evaluate(async () => {
  await Promise.all(
    Array.from(document.images)
      .filter((img) => !img.complete)
      .map(
        (img) =>
          new Promise((done) => {
            img.addEventListener("load", done, { once: true });
            img.addEventListener("error", done, { once: true });
          }),
      ),
  );
  await document.fonts.ready;
});

const total = await page.evaluate(() => document.documentElement.scrollHeight);
const pages = Math.ceil(total / 1123);
for (let i = 0; i < pages; i++) {
  await page.evaluate((y) => window.scrollTo(0, y), i * 1123);
  await page.waitForTimeout(120);
  await page.screenshot({ path: path.join(out, `page-${String(i + 1).padStart(2, "0")}.png`) });
}
await browser.close();
console.log(`${pages} preview pages in docs/.preview`);
