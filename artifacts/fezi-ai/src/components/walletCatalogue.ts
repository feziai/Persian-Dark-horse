import { createElement, useEffect, useState } from 'react';

export type Eip1193Provider = {
  isMetaMask?: boolean;
  isCoinbaseWallet?: boolean;
  isTrust?: boolean;
  isRabby?: boolean;
  isExodus?: boolean;
  isRainbow?: boolean;
  isOkxWallet?: boolean;
  isOKExWallet?: boolean;
  isUniswapWallet?: boolean;
  isPhantom?: boolean;
  providers?: Eip1193Provider[];
  request: (input: { method: string; params?: unknown[] }) => Promise<unknown>;
};

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
    phantom?: { ethereum?: Eip1193Provider; solana?: unknown };
  }
}

export type WalletId = 'metamask' | 'trust' | 'coinbase' | 'phantom' | 'exodus' | 'rabby' | 'rainbow' | 'okx' | 'uniswap' | 'basepay' | 'tonkeeper' | 'cake' | 'tronlink' | 'browser';
type WalletDefinition = { id: WalletId; name: string; icon: string; install: string; evm: boolean; mobile?: (url: URL, chainId?: number) => string };

// Logos are served by the wallet makers (not generated lookalikes).
export const walletCatalogue: WalletDefinition[] = [
  { id: 'metamask', name: 'MetaMask', icon: 'https://metamask.io/favicon.ico', install: 'https://metamask.io/download/', evm: true, mobile: (url) => `https://metamask.app.link/dapp/${url.host}${url.pathname}${url.search}` },
  { id: 'trust', name: 'Trust Wallet', icon: 'https://trustwallet.com/favicon.ico', install: 'https://trustwallet.com/download', evm: true, mobile: (url, chainId) => `https://link.trustwallet.com/open_url?coin_id=${chainId === 56 ? 714 : chainId === 137 ? 966 : 60}&url=${encodeURIComponent(url.href)}` },
  { id: 'coinbase', name: 'Coinbase Wallet', icon: 'https://www.coinbase.com/favicon.ico', install: 'https://www.coinbase.com/wallet/downloads', evm: true, mobile: (url) => `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(url.href)}` },
  { id: 'phantom', name: 'Phantom', icon: 'https://phantom.app/_web_platform_assets/favicon-96x96.png', install: 'https://phantom.app/download', evm: true, mobile: (url) => `https://phantom.app/ul/browse/${encodeURIComponent(url.href)}` },
  { id: 'exodus', name: 'Exodus', icon: 'https://www.exodus.com/favicon.ico', install: 'https://www.exodus.com/web3-wallet/', evm: true },
  { id: 'rabby', name: 'Rabby Wallet', icon: 'https://raw.githubusercontent.com/RabbyHub/Rabby/master/_raw/images/icon-128.png', install: 'https://rabby.io/', evm: true },
  { id: 'rainbow', name: 'Rainbow', icon: 'https://rainbow.me/favicon.ico', install: 'https://rainbow.me/', evm: true },
  { id: 'okx', name: 'OKX Wallet', icon: 'https://www.okx.com/favicon.ico', install: 'https://www.okx.com/web3', evm: true },
  { id: 'uniswap', name: 'Uniswap Wallet', icon: 'https://uniswap.org/favicon.ico', install: 'https://wallet.uniswap.org/', evm: true },
  { id: 'basepay', name: 'Base Pay', icon: 'https://www.base.org/favicon.ico', install: 'https://docs.base.org/base-account/guides/accept-payments', evm: false },
  { id: 'tonkeeper', name: 'Tonkeeper', icon: 'https://tonkeeper.com/favicon.ico', install: 'https://tonkeeper.com/', evm: false },
  { id: 'cake', name: 'Cake Wallet', icon: 'https://cakewallet.com/assets/favi/favicon-32x32.png', install: 'https://cakewallet.com/', evm: false },
  { id: 'tronlink', name: 'TronLink', icon: 'https://www.tronlink.org/favicon.ico', install: 'https://www.tronlink.org/', evm: false },
  { id: 'browser', name: 'Browser Wallet', icon: 'https://ethereum.org/favicon.ico', install: 'https://ethereum.org/en/wallets/find-wallet/', evm: true },
];

export type DiscoveredWallet = { id: string; name: string; icon: string; provider: Eip1193Provider };
type Eip6963Detail = { info?: { uuid?: string; name?: string; icon?: string; rdns?: string }; provider?: Eip1193Provider };

function identify(provider: Eip1193Provider): WalletId {
  if (provider.isRabby) return 'rabby';
  if (provider.isCoinbaseWallet) return 'coinbase';
  if (provider.isTrust) return 'trust';
  if (provider.isRainbow) return 'rainbow';
  if (provider.isOkxWallet || provider.isOKExWallet) return 'okx';
  if (provider.isUniswapWallet) return 'uniswap';
  if (provider.isPhantom) return 'phantom';
  if (provider.isExodus) return 'exodus';
  if (provider.isMetaMask) return 'metamask';
  return 'browser';
}

export function useInjectedWallets() {
  const [wallets, setWallets] = useState<DiscoveredWallet[]>([]);
  useEffect(() => {
    const seen = new Map<Eip1193Provider, DiscoveredWallet>();
    const publish = () => setWallets(Array.from(seen.values()));
    const add = (provider: Eip1193Provider | undefined, info?: Eip6963Detail['info']) => {
      if (!provider || typeof provider.request !== 'function') return;
      const rdns = info?.rdns?.toLowerCase() || '';
      const announcedName = info?.name?.toLowerCase() || '';
      const matched = walletCatalogue.find((item) => item.evm && item.id !== 'browser' &&
        (rdns.includes(item.id) || announcedName === item.name.toLowerCase() ||
          (item.id === 'coinbase' && rdns.includes('coinbase')) ||
          (item.id === 'okx' && rdns.includes('okx'))));
      const definition = matched || walletCatalogue.find((item) => item.id ===
        (provider === window.phantom?.ethereum ? 'phantom' : identify(provider)))!;
      // Unknown extensions may advertise their own raster EIP-6963 logo; never render SVG/HTML.
      const icon = definition.id === 'browser' && info?.icon && info.icon.length < 100_000 &&
        /^data:image\/(?:png|webp|jpeg);base64,[A-Za-z0-9+/=]+$/i.test(info.icon) ? info.icon : definition.icon;
      const wallet = { id: info?.uuid || definition.id, name: matched?.name || (definition.id === 'browser' ? info?.name || definition.name : definition.name), icon, provider };
      if (!seen.has(provider) || info) { seen.set(provider, wallet); publish(); }
    };
    const announce = (event: Event) => {
      const detail = (event as CustomEvent<Eip6963Detail>).detail;
      add(detail?.provider, detail?.info);
    };
    window.addEventListener('eip6963:announceProvider', announce);
    window.dispatchEvent(new Event('eip6963:requestProvider'));
    const timer = window.setTimeout(() => {
      const ethereum = window.ethereum;
      (ethereum?.providers?.length ? ethereum.providers : [ethereum]).forEach((provider) => add(provider));
      add(window.phantom?.ethereum);
    }, 150);
    return () => { window.clearTimeout(timer); window.removeEventListener('eip6963:announceProvider', announce); };
  }, []);
  return wallets;
}

export function WalletIcon({ icon, name }: { icon: string; name: string }) {
  return createElement('img', { src: icon, alt: '', 'aria-hidden': true, loading: 'lazy', referrerPolicy: 'no-referrer', className: 'h-6 w-6 shrink-0 rounded-md object-contain', title: name });
}

export function walletLink(id: WalletId, chainId?: number) {
  const wallet = walletCatalogue.find((item) => item.id === id)!;
  return wallet.mobile && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    ? wallet.mobile(new URL(window.location.href), chainId) : wallet.install;
}