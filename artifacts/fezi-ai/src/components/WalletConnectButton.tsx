import { useEffect, useState } from 'react';
import { Check, ExternalLink, LoaderCircle, WalletCards, X } from 'lucide-react';
import { useInjectedWallets, walletCatalogue, walletLink, WalletIcon } from './walletCatalogue';
import type { Eip1193Provider } from './walletCatalogue';

type WalletConnectButtonProps = {
  isRtl: boolean;
  compact?: boolean;
  placement?: 'below' | 'above';
};

const walletUpdatedEvent = 'fezi-wallet-updated';

export function WalletConnectButton({ isRtl, compact = false, placement = 'below' }: WalletConnectButtonProps) {
  const wallets = useInjectedWallets();
  const [open, setOpen] = useState(false);
  const [address, setAddress] = useState('');
  const [walletName, setWalletName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const syncWallet = (event?: Event) => {
      const detail = (event as CustomEvent<{ address?: string; name?: string }> | undefined)?.detail;
      const savedAddress = detail?.address ?? window.localStorage.getItem('fezi-wallet-address') ?? '';
      const savedWallet = detail?.name ?? window.localStorage.getItem('fezi-wallet-name') ?? '';
      setAddress(savedAddress);
      setWalletName(savedWallet);
    };
    syncWallet();
    window.addEventListener('storage', syncWallet);
    window.addEventListener(walletUpdatedEvent, syncWallet);
    return () => {
      window.removeEventListener('storage', syncWallet);
      window.removeEventListener(walletUpdatedEvent, syncWallet);
    };
  }, []);

  const connectEvm = async (wallet: { name: string; provider: Eip1193Provider }) => {
    setBusy(true);
    setError('');
    try {
      const accounts = await wallet.provider.request({ method: 'eth_requestAccounts' }) as string[];
      if (!accounts?.[0]) throw new Error(isRtl ? 'آدرس کیف پول دریافت نشد.' : 'No wallet address was returned.');
      setAddress(accounts[0]);
      setWalletName(wallet.name);
      window.localStorage.setItem('fezi-wallet-address', accounts[0]);
      window.localStorage.setItem('fezi-wallet-name', wallet.name);
      window.dispatchEvent(new CustomEvent(walletUpdatedEvent, { detail: { address: accounts[0], name: wallet.name } }));
      setOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : (isRtl ? 'اتصال کیف پول انجام نشد.' : 'Wallet connection failed.'));
    } finally {
      setBusy(false);
    }
  };

  const disconnect = () => {
    setAddress('');
    setWalletName('');
    window.localStorage.removeItem('fezi-wallet-address');
    window.localStorage.removeItem('fezi-wallet-name');
    window.dispatchEvent(new CustomEvent(walletUpdatedEvent, { detail: { address: '', name: '' } }));
  };

  return (
    <div className={`relative ${compact ? '' : 'w-full'}`}>
      <button
        type="button"
        data-testid={compact ? 'button-header-connect-wallet' : 'button-connect-wallet'}
        aria-label={isRtl ? 'اتصال کیف پول' : 'Connect wallet'}
        aria-expanded={open}
        title={isRtl ? 'اتصال کیف پول' : 'Connect wallet'}
        onClick={() => { setOpen((current) => !current); setError(''); }}
        className={compact
          ? `flex h-10 w-10 items-center justify-center rounded-xl border transition-colors ${address ? 'border-emerald-400/50 bg-emerald-400/10 text-emerald-400' : 'border-primary/30 bg-primary/10 text-primary hover:border-primary/60 hover:bg-primary/15'}`
          : 'flex min-h-14 w-full items-center justify-between gap-4 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3 text-start transition-colors hover:border-primary/60 hover:bg-primary/10'}
      >
        <span className="flex min-w-0 items-center gap-3">
          <WalletCards size={compact ? 19 : 21} className="shrink-0" />
          {!compact && (
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{isRtl ? 'اتصال کیف پول' : 'Connect Wallet'}</span>
              <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                {address ? `${walletName} · ${address.slice(0, 7)}…${address.slice(-5)}` : (isRtl ? 'افزودن کیف پول برای پرداخت سریع‌تر' : 'Add a wallet for faster payments')}
              </span>
            </span>
          )}
        </span>
        {!compact && (address ? <Check size={18} className="shrink-0 text-emerald-400" /> : <span className="text-xs font-semibold text-primary">{isRtl ? 'افزودن' : 'Add'}</span>)}
      </button>

      {open && (
        <div role="dialog" aria-label={isRtl ? 'انتخاب کیف پول' : 'Choose a wallet'} className={`absolute z-50 w-[min(19rem,calc(100vw-2rem))] rounded-2xl border border-border bg-surface p-3 shadow-2xl ${placement === 'above' ? 'bottom-full mb-2 left-1/2 -translate-x-1/2' : `top-full mt-2 ${compact ? 'end-0' : 'start-0'}`}`} dir={isRtl ? 'rtl' : 'ltr'}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">{isRtl ? 'افزودن کیف پول' : 'Add a wallet'}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">{isRtl ? 'فقط آدرس عمومی استفاده می‌شود.' : 'Only your public address is used.'}</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label={isRtl ? 'بستن' : 'Close'} className="rounded-lg p-1.5 text-muted-foreground hover:bg-surface-hover hover:text-foreground"><X size={15} /></button>
          </div>
          {address ? (
            <div className="space-y-2">
              <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/5 p-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400"><Check size={14} /> {walletName || (isRtl ? 'کیف پول متصل' : 'Wallet connected')}</p>
                <p className="mt-2 break-all font-mono text-[10px] text-muted-foreground" dir="ltr">{address}</p>
              </div>
              <button type="button" onClick={disconnect} className="w-full rounded-xl border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-surface-hover hover:text-foreground">{isRtl ? 'حذف کیف پول ذخیره‌شده' : 'Remove saved wallet'}</button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="max-h-[min(62vh,28rem)] space-y-2 overflow-y-auto">
                {walletCatalogue.filter((entry) => entry.id !== 'tronlink' && entry.id !== 'browser').map((entry) => {
                  const wallet = wallets.find((candidate) => candidate.name === entry.name);
                  return wallet ? (
                    <button key={entry.id} type="button" data-testid={`button-connect-${entry.id}`} disabled={busy} onClick={() => void connectEvm(wallet)} className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-border px-3 text-xs font-semibold hover:border-primary/50 hover:bg-surface-hover disabled:opacity-50">
                      <span className="flex items-center gap-2"><WalletIcon icon={wallet.icon} name={wallet.name} />{isRtl ? `اتصال به ${entry.name}` : `Connect ${entry.name}`}</span>
                      {busy ? <LoaderCircle size={14} className="animate-spin" /> : <Check size={14} className="text-primary" />}
                    </button>
                  ) : (
                    <a key={entry.id} data-testid={`link-install-${entry.id}`} href={walletLink(entry.id)} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center justify-between gap-2 rounded-xl border border-border px-3 text-xs font-semibold hover:border-primary/50 hover:bg-surface-hover">
                      <span className="flex items-center gap-2"><WalletIcon icon={entry.icon} name={entry.name} />{entry.name}</span>
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">{entry.id === 'basepay' || !entry.evm ? (isRtl ? 'اتصال مستقیم در دسترس نیست' : 'Direct connection unavailable') : (isRtl ? 'نصب / باز کردن' : 'Install / open')} <ExternalLink size={12} /></span>
                    </a>
                  );
                })}
                {wallets.filter((wallet) => !walletCatalogue.some((entry) => entry.id !== 'browser' && wallet.name === entry.name)).map((wallet) => (
                  <button key={wallet.id} type="button" disabled={busy} onClick={() => void connectEvm(wallet)} className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-border px-3 text-xs font-semibold hover:border-primary/50">
                    <WalletIcon icon={wallet.icon} name={wallet.name} />{wallet.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          {error && <p className="mt-2 break-words text-[11px] text-red-400">{error}</p>}
        </div>
      )}
    </div>
  );
}