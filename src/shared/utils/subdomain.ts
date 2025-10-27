const RESERVED_SUBDOMAINS = new Set(["www", "app", "dev"]);

/**
 * Extract subdomain from hostname
 * Handles both dev and prod environments
 *
 * Examples:
 * - localhost → null
 * - whatthepack.today → null (no subdomain)
 * - dev.whatthepack.today → null (environment, not org)
 * - bunga-mawar.dev.whatthepack.today → "bunga-mawar" (org in dev)
 * - bunga-mawar.whatthepack.today → "bunga-mawar" (org in prod)
 */
export function getSubdomainFromHostname(hostname: string): string | null {
  const lowered = hostname.toLowerCase();

  if (lowered === "localhost" || lowered === "127.0.0.1") {
    return null;
  }

  if (lowered.endsWith(".localhost")) {
    const parts = lowered.split(".");
    if (parts.length >= 2) {
      return parts[0] === "www" ? null : parts[0];
    }
    return null;
  }

  // Platform root domains (no org subdomain)
  if (lowered === "whatthepack.today" || lowered === "dev.whatthepack.today") {
    return null;
  }

  const parts = lowered.split(".");

  if (parts.length >= 4) {
    // org-name.dev.whatthepack.today (4 parts) → "org-name"
    const subdomain = parts[0];
    if (!subdomain || RESERVED_SUBDOMAINS.has(subdomain)) {
      return null;
    }
    return subdomain;
  } else if (parts.length === 3) {
    // org-name.whatthepack.today (3 parts) → "org-name"
    const subdomain = parts[0];
    if (!subdomain || RESERVED_SUBDOMAINS.has(subdomain)) {
      return null;
    }
    return subdomain;
  }

  return null;
}

export function isTenantHostname(hostname: string): boolean {
  return getSubdomainFromHostname(hostname) !== null;
}

export function getCurrentSubdomain(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return getSubdomainFromHostname(window.location.hostname);
}

export function isReservedSubdomain(value: string): boolean {
  return RESERVED_SUBDOMAINS.has(value);
}

/**
 * Check if current environment is development
 * Returns true for localhost and *.dev.whatthepack.today
 */
export function isDevelopmentEnvironment(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const hostname = window.location.hostname;

  // Localhost is always development
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname.includes(".localhost")) {
    return true;
  }

  // Check if hostname contains ".dev.whatthepack.today"
  return hostname.includes(".dev.whatthepack.today") || hostname === "dev.whatthepack.today";
}

/**
 * Build organization URL for current environment
 * Automatically detects dev vs prod and builds correct URL
 *
 * Examples:
 * - Dev env + slug "bunga-mawar" → "https://bunga-mawar.dev.whatthepack.today"
 * - Prod env + slug "bunga-mawar" → "https://bunga-mawar.whatthepack.today"
 * - Localhost + slug "test" → "http://localhost:3000" (no redirect)
 */
export function buildOrgUrl(orgSlug: string, path: string = ""): string {
  const isDev = isDevelopmentEnvironment();
  const protocol = typeof window !== "undefined" ? window.location.protocol : "https:";

  // Remove leading slash from path if present
  const cleanPath = path.startsWith("/") ? path : `/${path}`;

  if (isDev) {
    // Development: org-slug.dev.whatthepack.today
    return `${protocol}//${orgSlug}.dev.whatthepack.today${cleanPath}`;
  } else {
    // Production: org-slug.whatthepack.today
    return `${protocol}//${orgSlug}.whatthepack.today${cleanPath}`;
  }
}
