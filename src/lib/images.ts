/**
 * Catalog cards and the marquee only need a small poster. The seed writes a
 * "-sm" copy next to every generated image; anything else (uploads, replaced
 * artwork) is returned untouched.
 */
export function thumbnail(url: string) {
  return url.startsWith("/models/") && url.endsWith(".webp") ? url.replace(/\.webp$/, "-sm.webp") : url;
}
