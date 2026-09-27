import { useState } from 'react';
import { Check, ExternalLink, LoaderCircle, ShieldCheck, WalletCards } from 'lucide-react';
import { Button } from './ui-parts';
import { useInjectedWallets, walletCatalogue, walletLink, WalletIcon } from './walletCatalogue';
import type { Eip1193Provider } from './walletCatalogue';

export type { Eip1193Provider } from './walletCatalogue';

type TronWebLike = {
  defaultAddress?: { base58?: string };
  transactionBuilder: {
    sendTrx: (recipient: string, amount: number, sender: string) => Promise<unknown>;
  };
  trx: {
    sign: (transaction: unknown) => Promise<unknown>;
    sendRawTransaction: (transaction: unknown) => Promise<{ result?: boolean; txid?: string }>;
  };
};

declare global {
  interface Window {
    tronLink?: { request: (input: { method: string }) => Promise<unknown> };
    tronWeb?: TronWebLike;
  }
}

type DirectWalletAsset = {
  kind: 'evm' | 'erc20' | 'tron';
  chainId?: number;
  decimals: number;
  tokenAddress?: `0x${string}`;
};

const directWalletAssets: Record<string, DirectWalletAsset> = {
  bnb: { kind: 'evm', chainId: 56, decimals: 18 },
  eth: { kind: 'evm', chainId: 1, decimals: 18 },
  polygon: { kind: 'evm', chainId: 137, decimals: 18 },
  'usdt-bep20': { kind: 'erc20', chainId: 56, decimals: 18, tokenAddress: '0x55d398326f99059fF775485246999027B3197955' },
  'usdt-erc20': { kind: 'erc20', chainId: 1, decimals: 6, tokenAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7' },
  'usdc-base': { kind: 'erc20', chainId: 8453, decimals: 6, tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
  'usdc-eth': { kind: 'erc20', chainId: 1, decimals: 6, tokenAddress: '0xA0b86991c6218b36c1d19d4a2e9Eb0cE3606eB48' },
  trx: { kind: 'tron', decimals: 6 },
};

function decimalToBaseUnitsRoundedUp(amount: string, decimals: number) {
  if (!/^\d+(?:\.\d+)?$/.test(amount)) throw new Error('Invalid payment amount');
  const [whole, fraction = ''] = amount.split('.');
  const keptFraction = fraction.slice(0, decimals).padEnd(decimals, '0');
  const discardedFraction = fraction.slice(decimals);
  const units = BigInt(`${whole}${keptFraction}`.replace(/^0+(?=\d)/, '') || '0');
  return discardedFraction.split('').some((digit) => digit !== '0') ? units + 1n : units;
}

function formatBaseUnits(amount: bigint, decimals: number) {
  if (decimals === 0) return amount.toString();
  const padded = amount.toString().padStart(decimals + 1, '0');
  const whole = padded.slice(0, -decimals);
  const fraction = padded.slice(-decimals).replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole;
}

function compactAddress(address: string) {
  return `${address.slice(0, 7)}…${address.slice(-5)}`;
}

function encodeErc20Transfer(recipient: string, amount: bigint) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(recipient)) throw new Error('Invalid payment recipient');
  const recipientWord = recipient.slice(2).toLowerCase().padStart(64, '0');
  const amountWord = amount.toString(16).padStart(64, '0');
  return `0xa9059cbb${recipientWord}${amountWord}`;
}

function tronLinkMobileHref() {
  const param = encodeURIComponent(JSON.stringify({
    action: 'open',
    protocol: 'TronLink',
    version: '1.0',
    url: window.location.href,
  }));
  return `tronlinkoutside://pull.activity?param=${param}`;
}

type WalletPaymentProps = {
  currencyId: string;
  ticker: string;
  recipient: string;
  amount: string | null;
  isRtl: boolean;
  disabled?: boolean;
  onTransactionSubmitted: (hash: string) => Promise<boolean>;
};

export function WalletPayment({
  currencyId,
  ticker,
  recipient,
  amount,
  isRtl,
  disabled = false,
  onTransactionSubmitted,
}: WalletPaymentProps) {
  const asset = directWalletAssets[currencyId];
  const wallets = useInjectedWallets();
  const [provider, setProvider] = useState<Eip1193Provider | null>(null);
  const [account, setAccount] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [submittedHash, setSubmittedHash] = useState('');
  const [registrationComplete, setRegistrationComplete] = useState(false);

  if (!asset) return null;
  const paymentUnits = amount ? decimalToBaseUnitsRoundedUp(amount, asset.decimals) : null;
  const walletAmount = paymentUnits === null ? null : formatBaseUnits(paymentUnits, asset.decimals);

  const connectEvm = async (wallet: (typeof wallets)[number]) => {
    setBusy(true);
    setError('');
    setStatus('');
    try {
      const accounts = await wallet.provider.request({ method: 'eth_requestAccounts' }) as string[];
      if (!accounts?.[0]) throw new Error('No wallet account was returned');
      setProvider(wallet.provider);
      setAccount(accounts[0]);
      setStatus(isRtl ? `${wallet.name} متصل شد.` : `${wallet.name} connected.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : (isRtl ? 'اتصال کیف پول انجام نشد.' : 'Wallet connection failed.'));
    } finally {
      setBusy(false);
    }
  };

  const connectTron = async () => {
    setBusy(true);
    setError('');
    setStatus('');
    try {
      if (!window.tronLink) throw new Error(isRtl ? 'TronLink پیدا نشد.' : 'TronLink was not found.');
      await window.tronLink.request({ method: 'tron_requestAccounts' });
      const address = window.tronWeb?.defaultAddress?.base58;
      if (!address) throw new Error(isRtl ? 'آدرس TRON در دسترس نیست.' : 'TRON address is unavailable.');
      setAccount(address);
      setStatus(isRtl ? 'TronLink متصل شد.' : 'TronLink connected.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : (isRtl ? 'اتصال TronLink انجام نشد.' : 'TronLink connection failed.'));
    } finally {
      setBusy(false);
    }
  };

  const pay = async () => {
    if (!paymentUnits || !account || submittedHash) return;
    setBusy(true);
    setError('');
    setStatus(isRtl ? 'در انتظار تأیید شما در کیف پول…' : 'Waiting for your approval in the wallet…');
    try {
      let hash = '';
      if (asset.kind === 'evm' || asset.kind === 'erc20') {
        if (!provider || !asset.chainId) throw new Error('Wallet is not connected');
        const chainHex = `0x${asset.chainId.toString(16)}`;
        try {
          await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: chainHex }] });
        } catch {
          throw new Error(isRtl ? 'شبکه موردنظر را در کیف پول فعال کنید.' : 'Switch to the required network in your wallet.');
        }
        const baseUnits = paymentUnits;
        const transaction = asset.kind === 'erc20'
          ? {
              from: account,
              to: asset.tokenAddress,
              value: '0x0',
              data: encodeErc20Transfer(recipient, baseUnits),
            }
          : {
              from: account,
              to: recipient,
              value: `0x${baseUnits.toString(16)}`,
            };
        hash = await provider.request({ method: 'eth_sendTransaction', params: [transaction] }) as string;
      } else {
        const tronWeb = window.tronWeb;
        if (!tronWeb) throw new Error(isRtl ? 'TronLink در دسترس نیست.' : 'TronLink is unavailable.');
        const baseUnits = paymentUnits;
        if (baseUnits > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('TRX amount is too large');
        const unsigned = await tronWeb.transactionBuilder.sendTrx(recipient, Number(baseUnits), account);
        const signed = await tronWeb.trx.sign(unsigned);
        const result = await tronWeb.trx.sendRawTransaction(signed);
        if (!result.result || !result.txid) throw new Error(isRtl ? 'ارسال TRX ناموفق بود.' : 'TRX transfer failed.');
        hash = result.txid;
      }
      if (!hash) throw new Error(isRtl ? 'شناسه تراکنش دریافت نشد.' : 'No transaction hash was returned.');
      setSubmittedHash(hash);
      setStatus(isRtl ? 'تراکنش در شبکه ارسال شد؛ در حال ثبت برای بررسی…' : 'Transaction sent on-chain; submitting it for review…');
      const registered = await onTransactionSubmitted(hash);
      setRegistrationComplete(registered);
      setStatus(registered
        ? (isRtl ? 'تراکنش ثبت شد و منتظر بررسی است.' : 'Transaction submitted and pending review.')
        : (isRtl ? 'تراکنش ارسال شده اما ثبت سروری ناموفق بود. فقط ثبت همان Hash را دوباره امتحان کنید.' : 'The transfer was sent, but server registration failed. Retry only the same hash below.'));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : (isRtl ? 'پرداخت انجام نشد.' : 'Payment failed.'));
      setStatus('');
    } finally {
      setBusy(false);
    }
  };

  const retryRegistration = async () => {
    if (!submittedHash) return;
    setBusy(true);
    setError('');
    const registered = await onTransactionSubmitted(submittedHash);
    setRegistrationComplete(registered);
    setStatus(registered
      ? (isRtl ? 'تراکنش ثبت شد و منتظر بررسی است.' : 'Transaction submitted and pending review.')
      : (isRtl ? 'ثبت سروری هنوز انجام نشد؛ خود تراکنش را دوباره ارسال نکنید.' : 'Registration still failed; do not send the transaction again.'));
    setBusy(false);
  };

  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4" data-testid="section-wallet-payment">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary"><WalletCards size={19} /></span>
        <div>
          <h3 className="text-sm font-semibold">{isRtl ? 'پرداخت مستقیم با کیف پول' : 'Pay directly with a wallet'}</h3>
          <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
            {isRtl ? 'هر پرداخت فقط بعد از تأیید شما در کیف پول ارسال می‌شود.' : 'Every payment is sent only after you approve it in your wallet.'}
          </p>
        </div>
      </div>

      {!account ? (
        <div className="mt-4 space-y-2">
          {(asset.kind === 'evm' || asset.kind === 'erc20') && <div className="grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2">
            {walletCatalogue.filter((entry) => entry.id !== 'tronlink' && entry.id !== 'browser').map((entry) => {
              const wallet = wallets.find((candidate) => candidate.name === entry.name);
              return wallet ? <button key={entry.id} type="button" data-testid={`button-connect-${entry.id}`} disabled={busy} onClick={() => void connectEvm(wallet)} className="flex min-h-11 items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 text-xs font-semibold hover:border-primary/50 disabled:opacity-50">
                <span className="flex items-center gap-2"><WalletIcon icon={wallet.icon} name={wallet.name} />{isRtl ? `اتصال به ${entry.name}` : `Connect ${entry.name}`}</span>
                {busy ? <LoaderCircle size={15} className="animate-spin" /> : <Check size={15} className="text-primary" />}
              </button> : <a key={entry.id} data-testid={`link-open-${entry.id}`} href={walletLink(entry.id, asset.chainId)} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 text-xs font-semibold hover:border-primary/50">
                <span className="flex items-center gap-2"><WalletIcon icon={entry.icon} name={entry.name} />{entry.name}</span>
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">{entry.evm ? (isRtl ? 'نصب / باز کردن' : 'Install / open') : (isRtl ? 'پرداخت مستقیم در دسترس نیست' : 'Direct pay unavailable')} <ExternalLink size={12} /></span>
              </a>;
            })}
            {wallets.filter((wallet) => !walletCatalogue.some((entry) => entry.id !== 'browser' && wallet.name === entry.name)).map((wallet) => (
              <button key={wallet.id} type="button" disabled={busy} onClick={() => void connectEvm(wallet)} className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-background px-3 text-xs font-semibold"><WalletIcon icon={wallet.icon} name={wallet.name} />{wallet.name}</button>
            ))}
          </div>}
          {asset.kind === 'tron' && (
            <>
              <button type="button" data-testid="button-connect-tronlink" disabled={busy || !window.tronLink} onClick={() => void connectTron()} className="flex min-h-11 w-full items-center justify-between rounded-xl border border-border bg-background px-3 text-xs font-semibold hover:border-primary/50 hover:bg-surface-hover disabled:opacity-50">
                <span className="flex items-center gap-2"><WalletIcon icon={walletCatalogue.find((item) => item.id === 'tronlink')!.icon} name="TronLink" />{isRtl ? 'اتصال به TronLink' : 'Connect TronLink'}</span>
                {busy ? <LoaderCircle size={15} className="animate-spin" /> : <WalletCards size={15} className="text-primary" />}
              </button>
              {!window.tronLink && (
                <a href={/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ? tronLinkMobileHref() : 'https://www.tronlink.org/'} data-testid="link-open-tronlink-mobile" className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-3 text-xs font-semibold hover:border-primary/50">
                  {isRtl ? 'TronLink در دسترس نیست — نصب / باز کردن' : 'TronLink unavailable — install / open'} <ExternalLink size={13} />
                </a>
              )}
            </>
          )}
          {asset.kind === 'tron' && <a href="https://cakewallet.com/" target="_blank" rel="noopener noreferrer" data-testid="link-open-cake-wallet" className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-background px-3 text-xs font-semibold"><WalletIcon icon={walletCatalogue.find((item) => item.id === 'cake')!.icon} name="Cake Wallet" />Cake Wallet — {isRtl ? 'اتصال مستقیم در دسترس نیست' : 'Direct connection unavailable'} <ExternalLink size={13} /></a>}
          <p className="text-[11px] leading-5 text-muted-foreground">{isRtl ? 'فقط کیف پول‌های شناسایی‌شده را می‌توان اینجا متصل کرد. Base Pay، Tonkeeper و Cake Wallet به پرداخت خودکار این صفحه متصل نیستند؛ برای پرداخت دستی ارز و شبکهٔ دقیق فاکتور را بررسی و سپس هش را ثبت کنید.' : 'Only detected wallets can connect here. Base Pay, Tonkeeper and Cake Wallet are not connected to this automatic flow; for manual payment match the exact currency and network, then submit the hash.'}</p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/70 p-3 text-xs">
            <span className="flex items-center gap-1.5 text-emerald-400"><Check size={14} /> {isRtl ? 'متصل' : 'Connected'}</span>
            <span className="font-mono text-muted-foreground" dir="ltr">{compactAddress(account)}</span>
          </div>
          <div className="rounded-xl border border-border/70 bg-background/50 p-3 text-xs">
            <p className="text-muted-foreground">{isRtl ? 'مبلغی که در کیف پول می‌بینید' : 'Amount shown in your wallet'}</p>
            <p className="mt-1 font-bold text-primary" dir="ltr">{walletAmount ? `${walletAmount} ${ticker}` : '—'}</p>
          </div>
          {!submittedHash && <Button type="button" data-testid="button-pay-with-wallet" className="w-full" disabled={disabled || busy || !paymentUnits} onClick={() => void pay()}>
            {busy ? <LoaderCircle size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
            {busy ? (isRtl ? 'در حال انجام…' : 'Processing…') : (isRtl ? 'تأیید و پرداخت در کیف پول' : 'Approve and pay in wallet')}
          </Button>}
        </div>
      )}
      {submittedHash && (
        <div className="mt-3 space-y-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
          <p className="text-[11px] font-semibold text-emerald-400">{isRtl ? 'تراکنش روی شبکه ارسال شده است' : 'Transaction sent on-chain'}</p>
          <p className="break-all font-mono text-[10px] text-muted-foreground" dir="ltr">{submittedHash}</p>
          {!registrationComplete && (
            <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => void retryRegistration()}>
              {busy && <LoaderCircle size={14} className="animate-spin" />}
              {isRtl ? 'ثبت دوباره همین Hash' : 'Retry this hash registration'}
            </Button>
          )}
        </div>
      )}
      {status && <p className="mt-3 text-xs text-emerald-400">{status}</p>}
      {error && <p className="mt-3 break-words text-xs text-red-400">{error}</p>}
    </div>
  );
}