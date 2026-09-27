import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth, useClerk } from '@clerk/react';
import { useLocation } from 'wouter';

type AccessState = { userId: string | null; verified: boolean; loading: boolean; error: string };

/** The server checks a verified Google external account; email domains and browser flags do not grant access. */
export function useGoogleApiAccess(returnTo: '/my-agents' | '/api-keys') {
  const { userId, isLoaded, isSignedIn } = useAuth();
  const clerk = useClerk();
  const [, navigate] = useLocation();
  const [state, setState] = useState<AccessState>({ userId: null, verified: false, loading: true, error: '' });
  const requestId = useRef(0);

  const refresh = useCallback(async (): Promise<boolean> => {
    const request = ++requestId.current;
    if (!isLoaded || !isSignedIn || !userId) {
      setState({ userId: null, verified: false, loading: false, error: '' });
      return false;
    }
    setState({ userId, verified: false, loading: true, error: '' });
    try {
      const response = await fetch('/api/api-access/status', { credentials: 'include', cache: 'no-store' });
      if (!response.ok) throw new Error('Google verification is temporarily unavailable. Please try again.');
      const data = await response.json() as { googleVerified?: boolean };
      if (typeof data.googleVerified !== 'boolean') throw new Error('Google verification is temporarily unavailable. Please try again.');
      if (request === requestId.current) setState({ userId, verified: data.googleVerified, loading: false, error: '' });
      return request === requestId.current && data.googleVerified;
    } catch (error) {
      if (request === requestId.current) setState({ userId, verified: false, loading: false, error: error instanceof Error ? error.message : 'Google verification is temporarily unavailable.' });
      return false;
    }
  }, [isLoaded, isSignedIn, userId]);

  useEffect(() => {
    void refresh();
    const onFocus = () => { void refresh(); };
    window.addEventListener('focus', onFocus);
    return () => {
      requestId.current++;
      window.removeEventListener('focus', onFocus);
    };
  }, [refresh]);

  return {
    verified: Boolean(userId && state.userId === userId && !state.loading && state.verified),
    loading: !isLoaded || (isSignedIn && (state.userId !== userId || state.loading)),
    error: state.userId === userId ? state.error : '',
    refresh,
    openGoogleLink: () => {
      if (!isLoaded) return;
      if (!isSignedIn || !userId) {
        navigate(`/sign-in?redirect_url=${encodeURIComponent(returnTo)}`);
        return;
      }
      clerk.openUserProfile();
    },
  };
}

export const googleApiError = (status: number, code?: string) =>
  code === 'GOOGLE_VERIFICATION_REQUIRED' || status === 403
    ? 'Connect and verify a Google account in your profile, then try again.'
    : status === 503
      ? 'Google verification is temporarily unavailable. Please try again later.'
      : null;