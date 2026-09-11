/**
 * Render one of the HTML documents in docs/ to a print-ready PDF.
 *
 * Chromium's own print pipeline, so the `@page` rules, page breaks and
 * `print-color-adjust` in the document are honoured exactly as written — the
 * document is the source, and this script has no opinions of its own.
 *
 *   node scripts/render-pdf.mjs ui-audit.html "RoadAxis-UI-Audit.pdf"
 */
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error('Usage: node scripts/render-pdf.mjs <input.html> "<Output.pdf>"');
  process.exit(1);
}

const docs = path.resolve("../docs");
const src = path.join(docs, input);
const dest = path.join(docs, output);

const browser = await chromium.launch();
const page = await browser.newPage();
// `file://` rather than a served URL, so the relative <img src> paths resolve
// against docs/ the same way they do when the document is opened by hand.
await page.goto(pathToFileURL(src).href, { waitUntil: "networkidle" });
// Screenshots are the bulk of these documents; a PDF with half of them missing
// is worse than no PDF.
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
await page.pdf({ path: dest, format: "A4", printBackground: true, preferCSSPageSize: true });
await browser.close();

console.log(`${output} written`);
