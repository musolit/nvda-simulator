/**
 * Allowlist check: when ADMIN_EMAILS is set (comma-separated), only those
 * Google account emails may use the app, regardless of Supabase auth
 * succeeding. Leave ADMIN_EMAILS unset to allow any authenticated user
 * (not recommended for this personal finance app, but useful for local dev).
 */
export function isEmailAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  const allowlist = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (allowlist.length === 0) return true;
  return allowlist.includes(email.toLowerCase());
}
