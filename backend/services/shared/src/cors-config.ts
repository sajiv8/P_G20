/**
 * Which browser origins may call the API cross-origin.
 *
 * Every service previously used `origin: true`, which reflects back whatever
 * `Origin` header arrives — so any website could call the API from a visitor's
 * browser and read the response (D-06).
 *
 * The deployed app does not actually need CORS: the gateway serves the frontend
 * and proxies `/api/v1` on the same origin, so those calls are same-origin. The
 * allowlist exists for local development, where Vite runs on its own port, and
 * for any future first-party client hosted elsewhere.
 *
 * Override with CORS_ALLOWED_ORIGINS as a comma-separated list, e.g.
 *   CORS_ALLOWED_ORIGINS=https://rso.example.com,http://localhost:5173
 */
const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://rso.hnasiaexport.com',
];

export function getAllowedOrigins(): string[] {
  const configured = process.env.CORS_ALLOWED_ORIGINS;

  if (configured) {
    const origins = configured.split(',').map(origin => origin.trim()).filter(Boolean);
    if (origins.length > 0) return origins;
  }

  return DEFAULT_ALLOWED_ORIGINS;
}
