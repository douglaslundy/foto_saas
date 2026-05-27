/**
 * Converts a string to kebab-case slug, removing accents and special chars.
 */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove diacritics
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')    // remove special chars
    .trim()
    .replace(/[\s-]+/g, '-')         // collapse spaces/hyphens
    .replace(/^-+|-+$/g, '')         // trim leading/trailing hyphens
}
