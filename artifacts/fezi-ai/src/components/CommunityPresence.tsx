import { useEffect } from 'react';
import { useLocation } from 'wouter';

/** Anonymous session presence: no IP addresses, fingerprints, or URL queries. */
export function CommunityPresence() {
  const [location] = useLocation();
  useEffect(() => {
    let visitorId: string;
    try {
      visitorId = sessionStorage.getItem('fezi-visit-session') || crypto.randomUUID();
      sessionStorage.setItem('fezi-visit-session', visitorId);
    } catch { return; }
    const controller = new AbortController();
    const beat = () => {
      if (document.visibilityState !== 'visible') return;
      void fetch(`${import.meta.env.BASE_URL}api/community/visit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', signal: controller.signal,
        body: JSON.stringify({ visitorId, path: location.split('?')[0].slice(0, 200) }),
      }).catch(() => { /* Optional analytics must not interrupt navigation. */ });
    };
    beat();
    const timer = window.setInterval(beat, 60_000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [location]);
  return null;
}