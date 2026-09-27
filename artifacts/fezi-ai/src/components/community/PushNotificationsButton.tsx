import { useAuth } from '@clerk/react';
import { useEffect, useState } from 'react';

type Config = { enabled: boolean; publicKey: string | null };
const apiPath = '/api/community/push';

function decodeKey(value: string): Uint8Array<ArrayBuffer> {
  const decoded = atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4));
  const bytes = new Uint8Array(new ArrayBuffer(decoded.length));
  for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
  return bytes;
}

async function pushRequest(getToken: () => Promise<string | null>, body: object) {
  const token = await getToken();
  if (!token) throw new Error('Please sign in to change notification settings.');
  const response = await fetch(`${apiPath}/subscriptions`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(result?.error || 'Unable to update push notifications.');
  }
}

export function PushNotificationsButton() {
  const { isSignedIn, getToken } = useAuth();
  const [config, setConfig] = useState<Config | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const isRtl = typeof document !== 'undefined' && document.documentElement.dir === 'rtl';
  const capable = typeof window !== 'undefined' && window.isSecureContext &&
    'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const iosBrowser = typeof navigator !== 'undefined' &&
    /iP(hone|ad|od)/.test(navigator.userAgent) &&
    !('standalone' in navigator && (navigator as Navigator & { standalone?: boolean }).standalone);

  useEffect(() => {
    if (!isSignedIn || !capable) return;
    let live = true;
    fetch(`${apiPath}/config`, { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error('Unable to check push availability.');
        return res.json() as Promise<Config>;
      })
      .then((value) => { if (live) setConfig(value); })
      .catch(() => { if (live) setError('Unable to check push availability.'); });
    navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL)
      .then(async (registration) => {
        if (registration && live) setSubscribed(!!(await registration.pushManager.getSubscription()));
      }).catch(() => {});
    return () => { live = false; };
  }, [isSignedIn, capable]);

  async function enable() {
    setError('');
    if (!isSignedIn || subscribed || busy || !config?.enabled || !config.publicKey || !capable) return;
    setBusy(true);
    try {
      const base = import.meta.env.BASE_URL;
      const registration = await navigator.serviceWorker.register(`${base}fezi-push-sw.js`, { scope: base });
      if (!registration) throw new Error('Push service worker is unavailable.');
      // Only this click may cause a browser permission prompt; no background opt-in.
      const permission = Notification.permission === 'granted'
        ? 'granted' : await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('Notification permission was not granted.');
      const existing = await registration.pushManager.getSubscription();
      const subscription = existing ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeKey(config.publicKey),
      });
      try {
        const serialized = subscription.toJSON();
        await pushRequest(getToken, {
          endpoint: subscription.endpoint,
          keys: serialized.keys,
        });
      } catch (err) {
        if (!existing) await subscription.unsubscribe();
        throw err;
      }
      setSubscribed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Push notifications could not be updated.');
    } finally {
      setBusy(false);
    }
  }

  if (!isSignedIn) return null;
  return (
    <div className="flex flex-col gap-2">
      {subscribed ? (
        <p role="status" className="sr-only rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-2 text-sm text-green-500 md:not-sr-only">
          {isRtl ? 'اعلان‌های دستگاه روشن هستند' : 'Device notifications are on'}
        </p>
      ) : (
        <button type="button" onClick={() => void enable()}
          disabled={busy || !capable || !config?.enabled || iosBrowser}
          className="min-h-11 rounded-xl border border-border px-4 py-2 text-sm text-foreground disabled:opacity-50">
          {busy ? (isRtl ? 'لطفاً صبر کنید…' : 'Please wait…')
            : (isRtl ? 'روشن کردن اعلان‌های دستگاه' : 'Turn on device notifications')}
        </button>
      )}
      {iosBrowser && <p className="text-xs text-muted-foreground">
        {isRtl ? 'در iPhone یا iPad ابتدا از منوی اشتراک‌گذاری، برنامه را به صفحه اصلی اضافه و از آنجا باز کنید.' : 'On iPhone or iPad, first use Share → Add to Home Screen, then open the installed app to enable push.'}
      </p>}
      {!capable && !iosBrowser && <p className="text-xs text-muted-foreground">
        {isRtl ? 'اعلان‌های دستگاه در این مرورگر یا اتصال امن در دسترس نیست.' : 'Device notifications require a supported browser and secure connection.'}
      </p>}
      {config && !config.enabled && <p className="text-xs text-muted-foreground">
        {isRtl ? 'اعلان‌های دستگاه فعلاً در دسترس نیست.' : 'Device notifications are currently unavailable.'}
      </p>}
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  );
}