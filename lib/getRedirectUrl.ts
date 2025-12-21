// Builds the OAuth/email redirect URL, preferring an explicit site URL over window.origin.
export const getRedirectUrl = (path = '/auth/callback') => {
  const envUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : null);

  const base =
    envUrl || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');

  return `${base.replace(/\/$/, '')}${path}`;
};
