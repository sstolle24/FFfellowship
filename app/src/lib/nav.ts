/** Exact page, or a page below it ("/app/sponsor" is not active on "/app/sponsor-desk"). */
export function isActive(path: string, href: string) {
  if (href === "/app" || href === "/leader") return path === href;
  return path === href || path.startsWith(`${href}/`);
}
