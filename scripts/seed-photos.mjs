/**
 * Put real photographs on the demo directory, for the client presentation.
 *
 * Empty photo slots are the single thing that makes a finished product look
 * unfinished in a screenshot: the search results become a grid of grey icons
 * and the profile page opens on a placeholder. Every other screen can be shown
 * with real data, so these should be too.
 *
 * The pictures are stock photographs from Unsplash, whose licence allows
 * commercial use without attribution. They stand in for photographs a garage
 * would upload itself, and the presentation says so on the page where they
 * first appear — a stock photo presented as a real customer's workshop is the
 * kind of thing that is noticed later rather than never.
 *
 * Matched to the trade: tyres for the tyre place, a recovery truck for the
 * recovery service, a valeting bay for the valeters. A generic engine bay on
 * all eight reads as a template.
 *
 * Only the eight demo listings. The owner's fixture in `console-shots.mjs`
 * deliberately keeps an empty gallery, because "your listing is 80% complete,
 * and the missing thing is a photo" is the whole point of the panel on the
 * portal dashboard.
 *
 * Skips any listing that already has photos, so it is safe to re-run.
 *
 *   node scripts/seed-photos.mjs
 */
import { request as pwRequest } from "@playwright/test";

const API = "http://localhost:5005/api";

/** 1400px wide, cropped to a landscape card, at a size a page of them can carry. */
const SIZED = "?w=1400&h=900&fit=crop&crop=entropy&q=72&fm=jpg";

/**
 * Listing name → its photographs, cover first.
 *
 * Keyed by a fragment of the name rather than an id, because the demo directory
 * is re-seeded with fresh ids whenever it is cleared.
 */
const SETS = [
  {
    match: /ancoats/i,
    photos: [
      "photo-1632733711679-529326f6db12", // working on an engine
      "photo-1487754180451-c456f719a1fc", // refilling oil in the engine bay
      "photo-1530046614490-89e6f776b83b", // tool chest
    ],
  },
  {
    match: /chorlton/i,
    photos: [
      "photo-1727893119356-1702fe921cf9", // bright repair workshop
      "photo-1606577924006-27d39b132ae2", // engine bay
      "photo-1637640125496-31852f042a60", // spanners in a box
    ],
  },
  {
    match: /deansgate/i,
    photos: [
      "photo-1645445522156-9ac06bc7a767", // tyre being worked on
      "photo-1675034743372-672c3c3f8377", // wall of tyres
      "photo-1593699199342-59b40e08f0ac", // wheel
    ],
  },
  {
    match: /m60|recovery/i,
    photos: [
      "photo-1686966933735-305bd8fe0a77", // car loaded onto a flatbed
      "photo-1730514784243-f0e7f09c9f50", // recovery truck towing
      "photo-1738101996177-13110d20a973", // driver beside the truck
    ],
  },
  {
    match: /stockport|electric/i,
    photos: [
      "photo-1486262715619-67b85e0b08d3", // engine
      "photo-1643700973089-baa86a1ab9ee", // working under the bonnet
      "photo-1570129476815-ba368ac77013", // tools
    ],
  },
  {
    match: /quick fit|northern quarter/i,
    photos: [
      "photo-1703103042709-9a2324b90038", // tyre in a garage
      "photo-1764015805414-df7de89d405b", // impact wrench on a wheel
      "photo-1615906655593-ad0386982a0f", // mechanic at the engine
    ],
  },
  {
    match: /salford|mobile tyre/i,
    photos: [
      "photo-1655198739321-edc210858ab5", // flat tyre at the roadside
      "photo-1686412537635-8d8d0d5d1bd5", // two fitters on a wheel
      "photo-1599474151460-d3439fa608a7", // carrying a tyre
    ],
  },
  {
    match: /trafford|valeting/i,
    photos: [
      "photo-1608506375591-b90e1f955e4b", // foam on a car in a bay
      "photo-1565689876697-e467b6c54da2", // wheel being washed
      "photo-1694678505383-676d78ea3b96", // washing by hand
    ],
  },
];

const admin = await (async () => {
  const ctx = await pwRequest.newContext();
  const res = await ctx.post(`${API}/auth/login`, {
    data: { email: "admin@roadaxis.online", password: "ChangeMe@2026" },
  });
  const data = (await res.json()).data;
  await ctx.dispose();
  return data;
})();

const ctx = await pwRequest.newContext({
  extraHTTPHeaders: { Authorization: `Bearer ${admin.accessToken}` },
});

const listings = (await (await fetch(`${API}/businesses?limit=50`)).json()).data;

for (const set of SETS) {
  const card = listings.find((b) => set.match.test(b.name));
  if (!card) {
    console.log("no listing matches", set.match);
    continue;
  }
  if (card.primaryPhotoUrl) {
    console.log("skip", card.name, "— already has photos");
    continue;
  }

  const photoIds = [];
  for (const id of set.photos) {
    const url = `https://images.unsplash.com/${id}${SIZED}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.log("  download failed", id, res.status);
      continue;
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    const up = await ctx.post(`${API}/media`, {
      multipart: {
        kind: "photo",
        folder: "businesses",
        file: { name: `${id}.jpg`, mimeType: "image/jpeg", buffer },
      },
    });
    if (!up.ok()) {
      console.log("  upload failed", id, up.status(), await up.text());
      continue;
    }
    photoIds.push((await up.json()).data.id);
  }

  if (!photoIds.length) {
    console.log("no photos uploaded for", card.name);
    continue;
  }

  const patched = await ctx.patch(`${API}/businesses/${card.id}`, { data: { photoIds } });
  console.log(patched.ok() ? "ok" : "FAILED", card.name, `— ${photoIds.length} photos`);
  if (!patched.ok()) console.log("  ", await patched.text());
}

await ctx.dispose();
