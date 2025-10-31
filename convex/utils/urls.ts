// convex/utils/urls.ts

export function getDomainSuffix(): string {
  const raw = process.env.APP_DOMAIN_SUFFIX;
  if (typeof raw === "string" && raw.trim()) {
    const v = raw.trim();
    return v.startsWith(".") ? v : `.${v}`;
  }
  // Default to production suffix
  return ".whatthepack.today";
}

export function buildOrgUrl(slug: string, path: string = "/"): string {
  const suffix = getDomainSuffix();
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `https://${slug}${suffix}${clean}`;
}
