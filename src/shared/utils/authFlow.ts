const KEY = "wtp_auth_login_inflight";

export function canTriggerLogin(maxAgeMs: number = 120000): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return true;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return true;
    return Date.now() - ts > maxAgeMs;
  } catch {
    return true;
  }
}

export function markLoginStarted(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(KEY, String(Date.now()));
  } catch {}
}

export function clearLoginMarker(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {}
}
