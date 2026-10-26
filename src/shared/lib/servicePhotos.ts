/**
 * The picture on each service tile.
 *
 * The built-in pictures are the client's own category icons (26 October 2026):
 * twelve 3D illustrations, background cut out, square, in
 * `public/images/categories`. They replaced the stock photographs of October.
 * A photo uploaded in Console → Categories wins over either; a category with
 * neither shows its icon glyph.
 */
const ICONS = new Set([
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
  "wheels",
]);

export interface ServiceImage {
  src: string;
  /**
   * `photo` fills the frame (an uploaded photograph); `icon` sits whole on a
   * light plate, in both themes — the cut-outs carry soft shadows that read as
   * grey haloes on black.
   */
  kind: "photo" | "icon";
}

export function serviceImage(
  slug: string | null | undefined,
  uploaded?: string | null,
): ServiceImage | null {
  if (uploaded) return { src: uploaded, kind: "photo" };
  return slug && ICONS.has(slug) ? { src: `/images/categories/${slug}.webp`, kind: "icon" } : null;
}
