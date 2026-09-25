// Resolves a possibly-relative avatar path (e.g. "/uploads/avatars/xxx.png")
// returned by the backend into an absolute URL the browser can load.
export function resolveAvatarUrl(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null;

  const cleanUrl = rawUrl.split('?')[0];
  if (!cleanUrl.startsWith('/uploads/')) {
    return rawUrl;
  }

  const apiBase = import.meta.env.VITE_API_URL || '/api/v1';
  if (apiBase.startsWith('/')) {
    return `${window.location.origin}${rawUrl}`;
  }
  try {
    const apiOrigin = new URL(apiBase).origin;
    return `${apiOrigin}${rawUrl}`;
  } catch {
    return `${window.location.origin}${rawUrl}`;
  }
}
