/**
 * A photograph for each service, by category slug.
 *
 * Real photographs of the work, from Unsplash (free for commercial use, no
 * attribution required), cropped square and kept in `public/images/services`
 * so a tile never waits on a third party. A category the list does not know —
 * one added in the console next month — falls back to its icon, never to a
 * stranger's photo.
 *
 * Sources, for the record (images.unsplash.com/<id>):
 *   tyres            photo-1655198739321-edc210858ab5
 *   batteries        photo-1597766347634-277bf2c89c32
 *   oil-servicing    photo-1487754180451-c456f719a1fc
 *   brakes           photo-1770834807387-820280f8270b
 *   mechanic         photo-1615906655593-ad0386982a0f
 *   recovery         photo-1730514784243-f0e7f09c9f50
 *   car-wash         photo-1608506375591-b90e1f955e4b
 *   wheel-alignment  photo-1593699199342-59b40e08f0ac
 *   air-conditioning photo-1775848365860-be55fa16c090
 *   engine           photo-1486262715619-67b85e0b08d3
 *   mobile-service   photo-1686412537635-8d8d0d5d1bd5
 *   promo banner     photo-1747770641554-a1c16ad4821e (mirrored)
 */
const PHOTOS = new Set([
  "tyres",
  "batteries",
  "oil-servicing",
  "brakes",
  "mechanic",
  "recovery",
  "car-wash",
  "wheel-alignment",
  "air-conditioning",
  "engine",
  "mobile-service",
]);

export function servicePhoto(slug: string | null | undefined): string | null {
  return slug && PHOTOS.has(slug) ? `/images/services/${slug}.webp` : null;
}
