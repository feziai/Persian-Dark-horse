import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/react';
import { useQueryClient } from '@tanstack/react-query';
import { useListPlans, useListPaymentCurrencies, useGetPaymentQuote } from '@workspace/api-client-react';
import { useTranslation, useApiLocalization } from '../lib/i18n';
import { Card, Button } from '../components/ui-parts';
import { AlertTriangle, Bot, Boxes, Check, Copy, CreditCard, ExternalLink, Image as ImageIcon, LoaderCircle, Mic2, QrCode, Sparkles, X } from 'lucide-react';
import { Link } from 'wouter';
import { useLocalStore } from '../lib/store';
import { WalletPayment } from '../components/WalletPayment';
import { WalletConnectButton } from '../components/WalletConnectButton';
import { ReferralSection } from '../components/ReferralSection';
import { requestGuestAccount } from '../lib/auth-gate';
import { RedeemCodePurchase, PURCHASED_CODE_PATTERN, useRedeemPurchasedCode } from '../components/RedeemCodePurchase';
import { BrandLogo } from '../components/BrandLogo';
import type { Plan } from '@workspace/api-client-react';

const cryptoLogoColors: Record<string, string> = {
  binance: 'F3BA2F', bitcoin: 'F7931A', ethereum: '627EEA', tether: '26A17B',
  solana: '9945FF', tron: 'EF0027', ton: '0098EA', usdc: '2775CA',
  cardano: '0033AD', arbitrum: '28A0F0', dogecoin: 'C2A633', polygon: '8247E5',
  vechain: '15BDFF', ripple: '23292F', zcash: 'F4B728', monero: 'FF6600', 'bitcoin-cash': '0AC18E',
  dash: '008CE7', base: '0052FF',
};

const cryptoLogoSlugs: Record<string, string> = {
  binance: 'binance', bitcoin: 'bitcoin', ethereum: 'ethereum', tether: 'tether',
  solana: 'solana', ton: 'ton', cardano: 'cardano', dogecoin: 'dogecoin',
  polygon: 'polygon', ripple: 'xrp', zcash: 'zcash', monero: 'monero', 'bitcoin-cash': 'bitcoincash', dash: 'dash',
};

const coinGeckoIds: Record<string, string> = {
  BNB: 'binancecoin', BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', TRX: 'tron',
  USDT: 'tether', USDC: 'usd-coin', TON: 'the-open-network', ADA: 'cardano',
  ARB: 'arbitrum', DOGE: 'dogecoin', POL: 'matic-network', XRP: 'ripple',
  VET: 'vechain', ZEC: 'zcash', BCH: 'bitcoin-cash', DASH: 'dash', XMR: 'monero',
};

const agentDetails: Record<Plan['agentIds'][number], { name: string; nameFa: string; description: string; descriptionFa: string }> = {
  monicah: { name: 'Manika', nameFa: 'مانیکا', description: 'Visual direction, image generation, voice, and research.', descriptionFa: 'هدایت بصری، ساخت تصویر، صدا و تحقیق.' },
  arta: { name: 'ARTA', nameFa: 'ARTA', description: 'Entertainment, interactive ideas, image work, and research.', descriptionFa: 'سرگرمی، ایده‌های تعاملی، تصویر و تحقیق.' },
  arvin: { name: 'ARVIN', nameFa: 'ARVIN', description: 'Business analysis, growth strategy, research, and coding.', descriptionFa: 'تحلیل کسب‌وکار، استراتژی رشد، تحقیق و کدنویسی.' },
  negar: { name: 'NEGAR', nameFa: 'NEGAR', description: 'Software engineering, code generation, file analysis, and research.', descriptionFa: 'مهندسی نرم‌افزار، تولید کد، تحلیل فایل و تحقیق.' },
  fezi: { name: 'FEZI', nameFa: 'FEZI', description: 'All FEZI capabilities, full App access, and Agent handoff.', descriptionFa: 'تمام قابلیت‌های FEZI، دسترسی کامل به ابزارها و ارجاع بین Agentها.' },
};

const appDetails: Record<Plan['appIds'][number], { name: string; nameFa: string; description: string; descriptionFa: string; icon: typeof Boxes }> = {
  research: { name: 'Research Desk', nameFa: 'میز تحقیق', description: 'Research planning, synthesis, sources, and file workflows.', descriptionFa: 'برنامه‌ریزی تحقیق، ترکیب منابع و کار با فایل‌ها.', icon: Sparkles },
  code: { name: 'Coding Studio', nameFa: 'استودیوی کدنویسی', description: 'Coding, debugging, software delivery, and automation.', descriptionFa: 'کدنویسی، رفع اشکال، تحویل نرم‌افزار و اتوماسیون.', icon: Bot },
  voice: { name: 'Persian Voice', nameFa: 'صدای فارسی', description: 'Speech-to-text and Agent-specific voice playback.', descriptionFa: 'تبدیل گفتار به متن و پخش صدای اختصاصی Agent.', icon: Mic2 },
  image: { name: 'AI Image', nameFa: 'تصویر هوش مصنوعی', description: 'Image generation, editing, visual concepts, and analysis.', descriptionFa: 'ساخت و ویرایش تصویر، ایده‌های بصری و تحلیل تصویر.', icon: ImageIcon },
  claude: { name: 'Claude app', nameFa: 'اپ Claude', description: '', descriptionFa: '', icon: Bot },
  deepseek: { name: 'DeepSeek app', nameFa: 'اپ DeepSeek', description: '', descriptionFa: '', icon: Bot },
  gapgpt: { name: 'GapGPT app', nameFa: 'اپ GapGPT', description: '', descriptionFa: '', icon: Sparkles },
  openai: { name: 'OpenAI app', nameFa: 'اپ OpenAI', description: '', descriptionFa: '', icon: Sparkles },
  mistral: { name: 'Mistral app', nameFa: 'اپ Mistral', description: '', descriptionFa: '', icon: Bot },
};

const modelDetails: Record<Plan['modelIds'][number], { name: string; description: string; descriptionFa: string; logo: string }> = {
  'openrouter/free': { name: 'Free routed chat', description: 'OpenRouter free route; the underlying model may vary.', descriptionFa: 'مسیر رایگان OpenRouter؛ مدل پایه ممکن است تغییر کند.', logo: 'openrouter' },
  'deepseek-chat': { name: 'DeepSeek Chat', description: 'Chat model', descriptionFa: 'مدل گفتگو', logo: 'deepseek' },
  'gapgpt-qwen-3.6': { name: 'Qwen 3.6', description: 'Via GapGPT', descriptionFa: 'از طریق GapGPT', logo: 'qwen' },
  'gpt-5.6-luna': { name: 'Persian Dark Horse premium route · Luna', description: 'Premium Persian Dark Horse route; underlying model is not specified.', descriptionFa: 'مسیر پریمیوم Persian Dark Horse؛ مدل پایه مشخص نشده است.', logo: 'fezi' },
  'gpt-5.6-sol': { name: 'Persian Dark Horse premium route · Sol', description: 'Premium Persian Dark Horse route; underlying model is not specified.', descriptionFa: 'مسیر پریمیوم Persian Dark Horse؛ مدل پایه مشخص نشده است.', logo: 'fezi' },
  'gapgpt-gemma-26b-a4b': { name: 'Gemma 26B', description: 'Via GapGPT', descriptionFa: 'از طریق GapGPT', logo: 'google' },
  'gapgpt/z-image': { name: 'Z-Image', description: 'Image route via GapGPT', descriptionFa: 'مسیر تصویر از طریق GapGPT', logo: 'fezi' },
};

const horsePlanIds = new Set(['free', 'rider', 'swift-rider', 'horse-runner', 'lone-rider', 'sovereign']);
const horseColors: Record<string, string> = {
  free: '#858b91', rider: '#b67852', 'swift-rider': '#659a9c',
  'horse-runner': '#a179ad', 'lone-rider': '#a06a63', sovereign: '#b39755',
};

type BillingSubscriptionSummary = {
  planId: string;
  status: 'active' | 'expired';
  activatedAt: string;
  expiresAt?: string | null;
  planName?: string;
  planNameFa?: string;
};

type BillingStatusResponse = {
  subscription?: BillingSubscriptionSummary | null;
};

function displayApp(id: Plan['appIds'][number], isRtl: boolean) {
  const detail = appDetails[id];
  return detail ? { ...detail, label: isRtl ? detail.nameFa : detail.name } : { name: id, nameFa: id, label: id, description: id, descriptionFa: id, icon: Boxes };
}

function displayAgent(id: Plan['agentIds'][number], isRtl: boolean) {
  const detail = agentDetails[id];
  return detail ? { ...detail, label: isRtl ? detail.nameFa : detail.name, descriptionLabel: isRtl ? detail.descriptionFa : detail.description } : { name: id, nameFa: id, label: id, description: id, descriptionFa: id, descriptionLabel: id };
}

function displayModel(id: Plan['modelIds'][number], isRtl: boolean) {
  const detail = modelDetails[id];
  return detail ? { ...detail, descriptionLabel: isRtl ? detail.descriptionFa : detail.description } : { name: id, description: id, descriptionFa: id, descriptionLabel: id, logo: 'fezi' };
}

function planFeatureDetailsForDisplay(plan: Plan, isRtl: boolean) {
  if (!isRtl) return plan.featureDetails;
  return [
    `${plan.credits.toLocaleString('en-US')} اعتبار شامل`,
    `${plan.customAgentLimit} جایگاه Agent سفارشی`,
    `${plan.appIds.length} ابزار فضای کاری`,
    `${plan.agentIds.length} Agent داخلی`,
    plan.cadence === 'lifetime'
      ? 'دسترسی مادام‌العمر'
      : plan.cadence === 'month'
        ? 'دسترسی ۳۰ روزه از زمان تأیید پرداخت'
        : 'دسترسی رایگان مداوم',
  ];
}

function CryptoLogo({ logoKey, ticker, large = false }: { logoKey: string; ticker: string; large?: boolean }) {
  const color = cryptoLogoColors[logoKey] || 'D4AF37';
  const logoSlug = cryptoLogoSlugs[logoKey];
  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold text-white ${large ? 'h-20 w-20 text-lg' : 'h-11 w-11 text-[10px]'}`}
      style={{ backgroundColor: `#${color}` }}
    >
      <span className="relative z-0">{ticker}</span>
      {logoSlug && <img src={`https://cdn.simpleicons.org/${logoSlug}/${color}`} alt={`${ticker} logo`} className="absolute inset-0 z-10 h-full w-full bg-white/95 p-2 object-contain" />}
    </div>
  );
}

export default function BillingPage() {
  const { isSignedIn, getToken } = useAuth();
  const { t } = useTranslation();
  const apiLocale = useApiLocalization();
  const { data: plans, isLoading: plansLoading } = useListPlans();
  const { data: currencies, isLoading: currenciesLoading } = useListPaymentCurrencies();
  const quote = useGetPaymentQuote();
  const { addPaymentRecord, appSettings } = useLocalStore();
  const isRtl = appSettings.language === 'fa';
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [selectedCurrency, setSelectedCurrency] = useState<string | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [txId, setTxId] = useState('');
  const [paymentSaved, setPaymentSaved] = useState(false);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState(false);
  const [paymentStatusMessage, setPaymentStatusMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [redeemCode, setRedeemCode] = useState('');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [redeemMessage, setRedeemMessage] = useState('');
  const [redeemSuccess, setRedeemSuccess] = useState(false);
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [buyCodeOpen, setBuyCodeOpen] = useState(false);
  const redeemPurchased = useRedeemPurchasedCode();
  const queryClient = useQueryClient();
  const cryptoSectionRef = useRef<HTMLElement>(null);
  const plansSectionRef = useRef<HTMLElement>(null);
  const [billingSubscription, setBillingSubscription] = useState<BillingSubscriptionSummary | null>(null);
  const [billingStatusLoading, setBillingStatusLoading] = useState(false);
  const [billingStatusError, setBillingStatusError] = useState(false);
  const [billingStatusRetry, setBillingStatusRetry] = useState(0);

  const displayPlans = (plans ?? []).filter((plan) => plan.cadence === 'month' || plan.cadence === 'lifetime' || plan.cadence === 'forever');
  const payablePlans = displayPlans.filter((plan) => plan.price > 0);
  const activeCurrencies = currencies?.filter((currency) => currency.enabled) || [];
  const selectedPlanData = displayPlans.find((plan) => plan.id === selectedPlan);
  const selectedCurrencyData = activeCurrencies.find((currency) => currency.id === selectedCurrency);
  const paymentAddress = quote.data?.address || selectedCurrencyData?.address || '';
  const qrUrl = quote.data?.address ? `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=12&data=${encodeURIComponent(quote.data.address)}` : '';

  useEffect(() => {
    let cancelled = false;
    if (!isSignedIn) {
      setBillingSubscription(null);
      setBillingStatusLoading(false);
      setBillingStatusError(false);
      return;
    }
    setBillingStatusLoading(true);
    setBillingStatusError(false);
    fetch('/api/payments/status', { credentials: 'include' })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('billing status unavailable')))
      .then((data: BillingStatusResponse) => {
        if (!cancelled) setBillingSubscription(data.subscription ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setBillingSubscription(null);
          setBillingStatusError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setBillingStatusLoading(false);
      });
    return () => { cancelled = true; };
  }, [isSignedIn, billingStatusRetry]);

  useEffect(() => {
    if (!selectedPlan && payablePlans[0]) setSelectedPlan(payablePlans[0].id);
  }, [payablePlans, selectedPlan]);

  useEffect(() => {
    const coinId = selectedCurrencyData ? coinGeckoIds[selectedCurrencyData.ticker] : undefined;
    if (!coinId) {
      setLivePrice(null);
      setPriceLoading(false);
      return;
    }
    let cancelled = false;
    setPriceLoading(true);
    fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`)
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('price unavailable')))
      .then((data) => { if (!cancelled) setLivePrice(typeof data[coinId]?.usd === 'number' ? data[coinId].usd : null); })
      .catch(() => { if (!cancelled) setLivePrice(null); })
      .finally(() => { if (!cancelled) setPriceLoading(false); });
    return () => { cancelled = true; };
  }, [selectedCurrencyData?.ticker]);

  const choosePlan = (planId: string) => {
    setSelectedPlan(planId);
    setSelectedCurrency(null);
    setPaymentSaved(false);
    setPaymentError(false);
    setPaymentStatusMessage('');
    quote.reset();
    setPaymentOpen(false);
  };

  const buyPlan = (planId: string) => {
    choosePlan(planId);
    window.requestAnimationFrame(() => cryptoSectionRef.current?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      block: 'start',
    }));
  };

  const renewSubscription = () => {
    const previousPlan = displayPlans.find((plan) => plan.id === billingSubscription?.planId && plan.price > 0);
    const renewalPlan = previousPlan || payablePlans[0];
    if (renewalPlan) {
      buyPlan(renewalPlan.id);
      return;
    }
    plansSectionRef.current?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      block: 'start',
    });
  };

  const chooseCurrency = (currencyId: string) => {
    if (!selectedPlanData || selectedPlanData.price <= 0) return;
    if (!isSignedIn) {
      requestGuestAccount(isRtl ? 'برای خرید اشتراک، ابتدا حساب رایگان بسازید.' : 'Create a free account before purchasing a subscription.');
      return;
    }
    if (!selectedPlan) return;
    setSelectedCurrency(currencyId);
    setPaymentSaved(false);
    setPaymentError(false);
    setCopied(false);
    quote.reset();
    setPaymentOpen(true);
    quote.mutate({ data: { planId: selectedPlan, currency: currencyId, ...(redeemCode.trim() ? { redeemCode: redeemCode.trim() } : {}) } as never });
  };

  const applyRedeemCode = async () => {
    if (redeemLoading || !redeemCode.trim()) return;
    if (!isSignedIn) {
      requestGuestAccount(isRtl ? 'برای استفاده از کد تخفیف، ابتدا حساب رایگان بسازید.' : 'Create a free account before using a redeem code.');
      return;
    }
    setRedeemMessage('');
    setRedeemSuccess(false);
    setRedeemLoading(true);
    const trimmed = redeemCode.trim();
    try {
    if (PURCHASED_CODE_PATTERN.test(trimmed)) {
      setDiscountPercent(0);
      try {
        const result = await redeemPurchased(trimmed);
        setRedeemSuccess(true);
        setRedeemCode('');
        setRedeemMessage(isRtl ? `${result.creditsAdded.toLocaleString('en-US')} اعتبار به حساب شما اضافه شد. موجودی: ${result.credits.toLocaleString('en-US')}` : `${result.creditsAdded.toLocaleString('en-US')} credits added. Balance: ${result.credits.toLocaleString('en-US')}`);
      } catch (error) {
        setRedeemMessage(error instanceof Error ? error.message : (isRtl ? 'کد معتبر نیست.' : 'Code is not valid.'));
      }
      return;
    }
    const token = await getToken();
    const authHeaders = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    const response = await fetch('/api/payments/redeem-code', {
      method: 'POST',
      credentials: 'include',
      headers: authHeaders,
      body: JSON.stringify({ code: redeemCode }),
    });
    const data = await response.json() as { valid?: boolean; discountPercent?: number; error?: string };
    if (!response.ok || !data.valid) {
      setDiscountPercent(0);
      const giftResponse = await fetch('/api/payments/admin-codes/redeem', {
        method: 'POST',
        credentials: 'include',
        headers: authHeaders,
        body: JSON.stringify({ code: trimmed }),
      });
      const gift = await giftResponse.json() as { kind?: string; value?: number; planId?: string; expiresAt?: string; error?: string };
      if (!giftResponse.ok || !gift.kind) {
        setRedeemMessage(gift.error || data.error || (isRtl ? 'کد معتبر نیست.' : 'Code is not valid.'));
        return;
      }
      setRedeemSuccess(true);
      setRedeemCode('');
      await queryClient.invalidateQueries();
      if (gift.kind === 'membership') setBillingStatusRetry((retry) => retry + 1);
      setRedeemMessage(gift.kind === 'credits'
        ? (isRtl ? `${gift.value?.toLocaleString('en-US')} اعتبار به حساب شما اضافه شد.` : `${gift.value?.toLocaleString('en-US')} credits added to your account.`)
        : (isRtl ? `عضویت ${gift.planId} تا ${new Date(gift.expiresAt || '').toLocaleDateString('fa-IR')} فعال شد.` : `${gift.planId} membership activated until ${new Date(gift.expiresAt || '').toLocaleDateString()}.`));
      return;
    }
    setDiscountPercent(data.discountPercent ?? 0);
    setRedeemMessage(isRtl ? `${data.discountPercent}% تخفیف اعمال شد.` : `${data.discountPercent}% discount applied.`);
    } catch {
      setRedeemMessage(isRtl ? 'اتصال ناموفق بود. دوباره تلاش کنید.' : 'Unable to redeem right now. Please try again.');
    } finally {
      setRedeemLoading(false);
    }
  };

  const submitPaymentHash = async (paymentHash: string) => {
    if (!isSignedIn) {
      requestGuestAccount(isRtl ? 'برای ثبت پرداخت، ابتدا حساب رایگان بسازید.' : 'Create a free account before submitting a payment.');
      return false;
    }
    if (!paymentHash.trim() || !selectedPlan || !selectedCurrency) return false;
    setPaymentSubmitting(true);
    setPaymentError(false);
    setPaymentStatusMessage('');
    try {
      const response = await fetch('/api/payments/txid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ planId: selectedPlan, currency: selectedCurrency, txId: paymentHash.trim(), redeemCode: redeemCode.trim() || undefined }),
      });
       const result = await response.json() as { error?: string; message?: string; autoVerified?: boolean; payment?: { id?: string; status?: 'pending' | 'approved' | 'rejected' } };
       if (!response.ok) throw new Error(result.error || 'TXID submission failed');
      addPaymentRecord({
        id: result.payment?.id || crypto.randomUUID(),
        planId: selectedPlan,
        currencyId: selectedCurrency,
        txId: paymentHash.trim(),
        createdAt: new Date().toISOString(),
        status: result.payment?.status || 'pending',
      });
      setPaymentSaved(true);
       setPaymentStatusMessage(result.autoVerified
         ? (isRtl ? 'پرداخت تأیید شد و حساب شما همان لحظه شارژ شد.' : 'Payment verified and your account was credited instantly.')
         : (result.message || (isRtl ? 'هش تراکنش دریافت شد و در صف بررسی است.' : 'Transaction hash received and queued for verification.')));
      setTxId('');
      return true;
     } catch (error) {
      setPaymentError(true);
       setPaymentStatusMessage(error instanceof Error ? error.message : (isRtl ? 'ثبت پرداخت انجام نشد.' : 'Payment submission failed.'));
      return false;
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const recordPayment = async () => {
    await submitPaymentHash(txId);
  };

  const copyAddress = async () => {
    if (!paymentAddress) return;
    await navigator.clipboard?.writeText(paymentAddress);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const effectivePlanPrice = selectedPlanData ? selectedPlanData.price * (1 - discountPercent / 100) : 0;
  // Quote amount is USD, not units of the selected cryptocurrency.
  const quotedUsd = Number(quote.data?.amount);
  const cryptoAmount = quote.data && Number.isFinite(quotedUsd) && quotedUsd > 0 && livePrice && livePrice > 0 ? quotedUsd / livePrice : null;
  const formattedCryptoAmount = cryptoAmount === null ? null : cryptoAmount < 0.000001 ? cryptoAmount.toExponential(6) : cryptoAmount.toFixed(8).replace(/\.?0+$/, '');
  const paymentCryptoAmount = formattedCryptoAmount;
  const billingPlan = billingSubscription ? displayPlans.find((plan) => plan.id === billingSubscription.planId) : undefined;
  const billingPlanName = billingSubscription
    ? billingPlan
      ? apiLocale.getPlanName(billingPlan)
      : (isRtl ? billingSubscription.planNameFa : billingSubscription.planName) || billingSubscription.planId
    : '';
  const formattedSubscriptionExpiry = billingSubscription?.expiresAt
    ? (() => {
      const expiry = new Date(billingSubscription.expiresAt);
      return Number.isNaN(expiry.getTime())
        ? null
        : new Intl.DateTimeFormat(isRtl ? 'fa-IR' : 'en-US', { dateStyle: 'long' }).format(expiry);
    })()
    : null;

  if (plansLoading || currenciesLoading) return <div className="mx-auto max-w-6xl space-y-5 p-4" aria-label={isRtl ? 'در حال بارگذاری پلن‌ها' : 'Loading plans'}><div className="h-28 animate-pulse rounded-3xl bg-surface" /><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((item) => <div key={item} className="h-96 animate-pulse rounded-3xl bg-surface" />)}</div></div>;

  if (!plans || !currencies) return <Card className="mx-auto max-w-xl border-border p-8 text-center"><AlertTriangle className="mx-auto mb-3 text-primary" /><h2 className="text-lg font-semibold">{isRtl ? 'نمایش پلن‌ها ممکن نشد' : 'Plans could not be loaded'}</h2><p className="mt-2 text-sm text-muted-foreground">{isRtl ? 'اتصال خود را بررسی کنید و دوباره تلاش کنید.' : 'Check your connection and try again.'}</p><Button className="mt-5" type="button" onClick={() => window.location.reload()}>{isRtl ? 'تلاش دوباره' : 'Try again'}</Button></Card>;

  return (
    <div className="fade-up mx-auto max-w-6xl min-w-0 space-y-8 pb-12 md:space-y-10 [&_a:focus-visible]:outline-2 [&_a:focus-visible]:outline-offset-4 [&_a:focus-visible]:outline-primary [&_button:focus-visible]:outline-2 [&_button:focus-visible]:outline-offset-4 [&_button:focus-visible]:outline-primary">
      <div className="relative overflow-hidden rounded-[1.75rem] border border-primary/25 bg-surface px-5 py-8 sm:px-9 sm:py-10">
        <div className="pointer-events-none absolute -end-20 -top-28 h-64 w-64 rounded-full border border-primary/15 sm:h-96 sm:w-96" aria-hidden="true" />
        <div className="pointer-events-none absolute -end-6 -top-10 h-48 w-48 rounded-full border border-primary/10 sm:h-72 sm:w-72" aria-hidden="true" />
        <div className="relative">
          <p className="text-[11px] font-semibold uppercase tracking-tight text-primary">Persian Dark Horse / {isRtl ? 'مجموعه پلن‌ها' : 'THE COLLECTION'}</p>
          <h1 className="mt-4 max-w-2xl text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-5xl">{isRtl ? 'اسب خود را انتخاب کنید.' : 'Choose your horse.'}</h1>
          <p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">{isRtl ? 'هر اسب یک پلن واقعی است. قیمت، اعتبار و دسترسی‌های هر پلن را مقایسه کنید؛ سپس روش پرداخت را انتخاب کنید.' : 'Each horse represents a real plan. Compare its price, credits and access, then choose how to pay.'}</p>
          <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-4 text-xs text-muted-foreground">
            <span>{isRtl ? '۶ پلن برای مقایسه' : '6 plans to compare'}</span>
            <span>{isRtl ? 'قیمت‌گذاری به دلار آمریکا' : 'Prices in USD'}</span>
            <span>{isRtl ? 'پرداخت با رمزارز' : 'Crypto checkout'}</span>
          </div>
        </div>
      </div>

      {isSignedIn && (billingStatusLoading
        ? <Card className="flex items-center gap-3 border-border" data-testid="status-subscription-loading" aria-live="polite"><LoaderCircle size={17} className="animate-spin text-primary" /><p className="text-sm text-muted-foreground">{isRtl ? 'در حال بررسی وضعیت اشتراک…' : 'Checking your subscription status…'}</p></Card>
        : billingStatusError
          ? <div role="alert" aria-live="assertive"><Card className="flex flex-col gap-3 border-amber-500/40 bg-amber-500/5 sm:flex-row sm:items-center sm:justify-between" data-testid="status-subscription-error"><p className="text-sm text-muted-foreground">{isRtl ? 'وضعیت اشتراک تأیید نشد. برای نمایش دسترسی فعلی دوباره تلاش کنید.' : 'We could not confirm your subscription status. Try again to check your current access.'}</p><Button type="button" data-testid="button-retry-subscription-status" onClick={() => setBillingStatusRetry((retry) => retry + 1)}>{isRtl ? 'تلاش دوباره' : 'Try again'}</Button></Card></div>
          : billingSubscription?.status === 'active'
            ? <div role="status" aria-live="polite"><Card className="border-emerald-500/35 bg-emerald-500/5" data-testid="status-subscription-active">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-500">{isRtl ? 'اشتراک فعال' : 'ACTIVE SUBSCRIPTION'}</p>
              <h2 className="mt-1 text-lg font-semibold text-foreground">{billingPlanName}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{billingSubscription.expiresAt
                ? formattedSubscriptionExpiry
                  ? (isRtl ? `دسترسی تا ${formattedSubscriptionExpiry} فعال است.` : `Access is active through ${formattedSubscriptionExpiry}.`)
                  : (isRtl ? 'تاریخ انقضا در دسترس نیست.' : 'The expiration date is unavailable.')
                : (isRtl ? 'این اشتراک تاریخ انقضا ندارد.' : 'This subscription has no expiration date.')}</p>
            </Card></div>
            : billingSubscription?.status === 'expired'
              ? <div role="status" aria-live="polite"><Card className="flex flex-col gap-4 border-amber-500/40 bg-amber-500/5 sm:flex-row sm:items-center sm:justify-between" data-testid="status-subscription-expired">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-500">{isRtl ? 'اشتراک منقضی شده' : 'SUBSCRIPTION EXPIRED'}</p>
                  <h2 className="mt-1 text-lg font-semibold text-foreground">{billingPlanName}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{isRtl
                    ? `دسترسی اشتراک فعال نیست.${formattedSubscriptionExpiry ? ` تاریخ انقضا: ${formattedSubscriptionExpiry}.` : ''}`
                    : `Subscription access is no longer active.${formattedSubscriptionExpiry ? ` Expired on ${formattedSubscriptionExpiry}.` : ''}`}</p>
                </div>
                <Button type="button" data-testid="button-renew-subscription" onClick={renewSubscription} className="shrink-0">{isRtl ? 'تمدید اشتراک' : 'Renew subscription'}</Button>
              </Card></div>
              : null)}

      <section ref={plansSectionRef}>
          {isSignedIn && (
            <div className="mb-5">
              <WalletConnectButton isRtl={isRtl} />
            </div>
          )}
          <div className="mb-5 flex flex-col items-start gap-3 sm:flex-row sm:items-end sm:justify-between">
           <div className="min-w-0">
             <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">01 / {isRtl ? 'انتخاب' : 'SELECT'}</p>
             <h2 className="mt-2 text-2xl font-semibold">{isRtl ? 'پلن‌ها را مقایسه کنید' : 'Meet the collection'}</h2>
             <p className="mt-1 text-sm text-muted-foreground">{isRtl ? 'برای دیدن جزئیات، تصویر هر اسب را انتخاب کنید. پلن رایگان نیازی به خرید ندارد.' : 'Select a horse to see its exact access. The Free plan requires no purchase.'}</p>
          </div>
        </div>
         <p className="mb-4 text-xs leading-5 text-muted-foreground">{isRtl ? 'نام‌های روی برخی تصویرها نام هنری مجموعه هستند؛ نام، قیمت و دسترسی رسمی هر پلن در زیر تصویر آمده است.' : 'Some banner labels are artwork nicknames. The actual plan name, price, and access are shown below each image.'}</p>
         <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
          {displayPlans.map((plan) => {
            const active = selectedPlan === plan.id;
             const art = horsePlanIds.has(plan.id) ? `${import.meta.env.BASE_URL}plans/${plan.id}.webp` : null;
             return (
               <article key={plan.id} data-testid={`card-plan-${plan.id}`} className={`group flex min-w-0 flex-col overflow-hidden rounded-[1.5rem] border bg-surface transition-colors motion-safe:transition-transform motion-safe:duration-300 lg:motion-safe:hover:-translate-y-1 ${active ? 'border-primary ring-1 ring-primary/50' : 'border-border hover:border-primary/50'}`}>
                 <button type="button" data-testid={`button-select-plan-${plan.id}`} aria-label={isRtl ? `نمایش جزئیات پلن ${apiLocale.getPlanName(plan)}` : `View ${apiLocale.getPlanName(plan)} plan details`} aria-pressed={active} onClick={() => choosePlan(plan.id)} className="block w-full overflow-hidden bg-surface text-start">
                   {art ? <img src={art} alt="" loading="lazy" className="block h-auto w-full" /> : <span className="flex min-h-40 items-center justify-center text-4xl font-semibold text-muted-foreground">{apiLocale.getPlanName(plan)}</span>}
                 </button>
                 <div className="flex min-h-[245px] flex-col p-5">
                   <div className="flex items-start justify-between gap-3">
                     <div><p className="text-[10px] font-bold uppercase tracking-[0.17em]" style={{ color: horseColors[plan.id] || 'hsl(var(--primary))' }}>{plan.featured ? (isRtl ? 'پلن ویژه' : 'FEATURED PLAN') : (isRtl ? 'پلن اشتراک' : 'SUBSCRIPTION PLAN')}</p><h3 className="mt-1 text-xl font-semibold text-foreground">{apiLocale.getPlanName(plan)}</h3></div>
                     {active && <span className="rounded-full bg-primary/15 p-1.5 text-primary"><Check size={17} /></span>}
                   </div>
                   <div className="mt-3 flex items-baseline gap-1.5" dir="ltr"><strong className="text-[2rem] font-semibold leading-none tracking-tight text-foreground">${plan.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong><span className="text-xs text-muted-foreground">/ {apiLocale.getPlanCadence(plan)}</span></div>
                   <div className="mt-4 flex flex-wrap gap-1.5 text-[11px]">
                     <span className="rounded-md border border-border bg-background px-2 py-1 text-foreground"><b dir="ltr">{plan.credits.toLocaleString()}</b> {isRtl ? 'اعتبار' : 'credits'}</span>
                     <span className="rounded-md border border-border bg-background px-2 py-1 text-foreground">{plan.agentIds.length} {isRtl ? 'Agent آماده' : 'built-in Agents'}</span>
                     <span className="rounded-md border border-border bg-background px-2 py-1 text-foreground">{plan.customAgentLimit} {isRtl ? 'Agent سفارشی' : 'custom Agents'}</span>
                   </div>
                   <div className="mt-auto pt-5">
                     {plan.price > 0
                       ? <button type="button" data-testid={`button-buy-plan-${plan.id}`} onClick={() => buyPlan(plan.id)} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/85">{isRtl ? 'انتخاب و خرید' : 'Select & buy'} <span aria-hidden="true">→</span></button>
                       : <p className="flex min-h-11 items-center justify-center rounded-xl border border-border bg-background px-3 text-center text-xs font-semibold text-muted-foreground">{isRtl ? 'رایگان · بدون نیاز به خرید' : 'Free · no purchase needed'}</p>}
                   </div>
                 </div>
               </article>
            );
          })}
        </div>

        <Card className="mt-5 border-primary/30 bg-primary/5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-xl">
              <p className="text-sm font-semibold">{isRtl ? 'کد تخفیف' : 'Redeem code'}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{isRtl ? 'کد خود را وارد کنید تا تخفیف قبل از پرداخت اعمال شود.' : 'Enter your code to apply its discount before payment.'}</p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:flex-row lg:max-w-xl">
              <input value={redeemCode} onChange={(event) => { setRedeemCode(event.target.value.toUpperCase()); setDiscountPercent(0); setRedeemMessage(''); }} placeholder={isRtl ? 'کد تخفیف یا ردیم کد' : 'Redeem code'} dir="ltr" className="min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-background px-4 text-sm outline-none focus:border-primary" />
              <Button type="button" onClick={() => void applyRedeemCode()} disabled={!redeemCode.trim() || redeemLoading}>{redeemLoading ? (isRtl ? 'در حال بررسی…' : 'Checking…') : (isRtl ? 'اعمال کد' : 'Apply code')}</Button>
              <Link href="/support?topic=redeem-code" onClick={(event) => { event.preventDefault(); if (!isSignedIn) { requestGuestAccount(isRtl ? 'برای خرید کد، ابتدا حساب رایگان بسازید.' : 'Create a free account before buying a code.'); return; } setBuyCodeOpen(true); }} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-primary/40 px-4 text-sm font-semibold text-primary hover:bg-primary/10">{isRtl ? 'خرید ردیم کد' : 'Buy a redeem code'}</Link>
            </div>
          </div>
          <RedeemCodePurchase open={buyCodeOpen} onOpenChange={setBuyCodeOpen} isRtl={isRtl} />
          {redeemMessage && <p role="status" className={`mt-3 text-xs ${discountPercent || redeemSuccess ? 'text-emerald-400' : 'text-red-400'}`}>{redeemMessage}</p>}
        </Card>

        {selectedPlanData && (
          <Card className="mt-5 border-primary/30 bg-surface" data-testid={`plan-access-details-${selectedPlanData.id}`}>
            <div className="flex flex-col gap-3 border-b border-border/70 pb-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">02 / {isRtl ? 'جزئیات دسترسی' : 'ACCESS DETAILS'}</p>
                <h3 className="mt-1 text-2xl font-semibold">{apiLocale.getPlanName(selectedPlanData)}</h3>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{isRtl ? 'این دسترسی‌ها از شناسه‌های همین پلن دریافت شده‌اند.' : 'Access shown here comes from this plan’s listed IDs.'}</p>
              </div>
                 <span className="shrink-0 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
                   {isRtl ? `${selectedPlanData.customAgentLimit} Agent سفارشی` : `${selectedPlanData.customAgentLimit} custom Agents`}
                 </span>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-3">
              <div className="rounded-2xl border border-border/70 bg-background/35 p-4">
                <div className="flex items-center gap-2"><Bot size={17} className="text-primary" /><h4 className="text-sm font-semibold">{isRtl ? 'Agentهای در دسترس' : 'Available Agents'}</h4></div>
                <p className="mt-1 text-xs text-muted-foreground">{isRtl ? 'Agentهای آماده ثبت‌شده در این پلن' : 'Built-in Agents listed for this plan'}</p>
                  <div className="mt-3 space-y-2 md:max-h-72 md:overflow-y-auto md:pe-1">
                  {selectedPlanData.agentIds.length === 0 && <p className="text-xs text-muted-foreground">{isRtl ? 'Agent آماده‌ای ثبت نشده است.' : 'No built-in Agents listed.'}</p>}
                  {selectedPlanData.agentIds.map((id) => {
                    const agent = displayAgent(id, isRtl);
                    return <div key={id} className="rounded-xl border border-border/60 bg-surface/60 p-3"><p className="text-xs font-bold text-foreground">{agent.label}</p></div>;
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-border/70 bg-background/35 p-4">
                <div className="flex items-center gap-2"><Boxes size={17} className="text-primary" /><h4 className="text-sm font-semibold">{isRtl ? 'ابزارها و استودیوها' : 'Tools & Studios'}</h4></div>
                <p className="mt-1 text-xs text-muted-foreground">{isRtl ? 'بر اساس شناسه‌های ابزار این پلن' : 'Listed by this plan’s app IDs'}</p>
                  <div className="mt-3 space-y-2 md:max-h-72 md:overflow-y-auto md:pe-1">
                  {selectedPlanData.appIds.length === 0 && <p className="text-xs text-muted-foreground">{isRtl ? 'ابزاری ثبت نشده است.' : 'No apps listed.'}</p>}
                  {selectedPlanData.appIds.map((id) => {
                    const app = displayApp(id, isRtl);
                    const Icon = app.icon;
                   return <div key={id} className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-surface/60 p-3"><Icon size={15} className="shrink-0 text-primary" /><p className="text-xs font-semibold">{app.label}</p></div>;
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-border/70 bg-background/35 p-4">
                <div className="flex items-center gap-2"><Sparkles size={17} className="shrink-0 text-primary" /><h4 className="text-sm font-semibold">{isRtl ? 'مسیرهای مدل این پلن' : 'Model routes in this plan'}</h4></div>
                <p className="mt-1 text-xs text-muted-foreground">{isRtl ? 'فقط مدل‌های ثبت‌شده در این پلن' : 'Only the model IDs listed for this plan'}</p>
                  <div className="mt-3 space-y-2 md:max-h-72 md:overflow-y-auto md:pe-1">
                  {selectedPlanData.modelIds.length === 0 && <p className="text-xs text-muted-foreground">{isRtl ? 'مسیر مدلی ثبت نشده است.' : 'No model routes listed.'}</p>}
                  {selectedPlanData.modelIds.map((id) => {
                    const model = displayModel(id, isRtl);
                    return <div key={id} className="flex items-center gap-3 rounded-xl border border-border/60 bg-surface/60 p-3"><BrandLogo name={model.logo} size={32} /><div className="min-w-0"><p className="text-xs font-semibold" dir="auto">{model.name}</p><code className="mt-1 block break-all text-[10px] text-muted-foreground" dir="ltr">{id}</code><p className="mt-1 text-[11px] leading-5 text-muted-foreground">{model.descriptionLabel}</p></div></div>;
                  })}
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-border bg-background/50 p-4">
                <h4 className="text-sm font-semibold">{isRtl ? 'خلاصهٔ پلن' : 'Plan summary'}</h4>
                <ul className="mt-2 space-y-1.5 text-xs leading-5 text-muted-foreground">
                  {planFeatureDetailsForDisplay(selectedPlanData, isRtl).map((detail) => <li key={detail}>• {detail}</li>)}
                </ul>
              </div>
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-4" data-testid={`plan-credit-policy-${selectedPlanData.id}`}>
                <h4 className="text-sm font-semibold">{isRtl ? 'سیاست اعتبار' : 'Credit policy'}</h4>
                <p className="mt-2 text-xs leading-5 text-foreground">
                  <strong>{selectedPlanData.credits.toLocaleString()} {isRtl ? 'اعتبار به‌ازای هر خرید تأییدشده' : 'credits per approved purchase'}</strong>
                </p>
                <ul className="mt-2 space-y-1.5 text-xs leading-5 text-muted-foreground">
                  {selectedPlanData.creditPolicy.grantTrigger === 'payment_approval' && <li>{isRtl ? 'اعتبار پس از تأیید پرداخت اضافه می‌شود.' : 'Credits are granted when payment is approved.'}</li>}
                  {selectedPlanData.creditPolicy.activePaidPlanBalance === 'add' && <li>{isRtl ? 'با اشتراک پولی فعال، اعتبار خرید به مانده اضافه می‌شود.' : 'With an active paid plan, the purchase adds to the existing balance.'}</li>}
                  {selectedPlanData.creditPolicy.noActivePaidPlanBalance === 'replace' && <li>{isRtl ? 'بدون اشتراک پولی فعال، مانده با اعتبار این پلن جایگزین می‌شود.' : 'Without an active paid plan, the balance is replaced with this plan’s credits.'}</li>}
                  {!selectedPlanData.creditPolicy.automaticRefresh && <li>{isRtl ? 'اعتبار به‌صورت خودکار تمدید نمی‌شود.' : 'Credits do not refresh automatically.'}</li>}
                </ul>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-border bg-background/50 px-4 py-3 text-xs leading-6 text-muted-foreground">
              {isRtl ? 'نام‌های کاتالوگ تصویر و ویدیو به‌تنهایی دسترسی این پلن را ثابت نمی‌کنند. پیش‌نمایش حرکت ویدیو با فریم‌های کلیدی FFmpeg ساخته می‌شود، نه تولید ویدیوی بومی. دسترسی Agent API جداگانه خریداری می‌شود.' : 'Image and video catalog names alone do not establish plan access. Video motion preview uses FFmpeg keyframes, not native video generation. Agent API access is purchased separately.'}
            </div>
          </Card>
        )}
      </section>

      <section ref={cryptoSectionRef} className="scroll-mt-20">
        <div className="mb-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">03 / {isRtl ? 'پرداخت' : 'CHECKOUT'}</p>
          <h2 className="mt-2 text-2xl font-semibold">{isRtl ? 'ارز پرداخت را انتخاب کنید' : 'Choose a cryptocurrency'}</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{isRtl ? `پلن انتخابی: ${selectedPlanData ? apiLocale.getPlanName(selectedPlanData) : '—'}. ${selectedPlanData?.price === 0 ? 'پلن رایگان نیازی به پرداخت ندارد. برای خرید، یک پلن پولی انتخاب کنید.' : 'شبکه و آدرس را پیش از انتقال بررسی کنید. دسترسی پس از تأیید پرداخت فعال می‌شود.'}` : `Selected plan: ${selectedPlanData ? apiLocale.getPlanName(selectedPlanData) : '—'}. ${selectedPlanData?.price === 0 ? 'The Free plan needs no payment. Select a paid plan to check out.' : 'Check the network and address before sending. Access activates after payment verification.'}`}</p>
        </div>
        {activeCurrencies.length === 0 && <p className="rounded-xl border border-border bg-surface p-5 text-sm text-muted-foreground">{isRtl ? 'در حال حاضر ارز پرداختی در دسترس نیست.' : 'No payment currencies are available right now.'}</p>}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {activeCurrencies.map((currency) => {
            const active = selectedCurrency === currency.id;
             return <button key={currency.id} data-testid={`button-currency-${currency.id}`} type="button" aria-pressed={active} disabled={!selectedPlanData || selectedPlanData.price <= 0} onClick={() => chooseCurrency(currency.id)} className={`flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border p-3 text-center transition-colors hover:border-primary/60 disabled:cursor-not-allowed disabled:opacity-50 ${active ? 'border-primary bg-primary/10' : 'border-border bg-surface'}`}><CryptoLogo logoKey={currency.logoKey} ticker={currency.ticker} /><span className="line-clamp-2 text-xs font-semibold">{currency.label}</span><span className="text-[10px] uppercase tracking-wider text-muted-foreground">{currency.network}</span></button>;
          })}
        </div>
      </section>

      <Card className="flex flex-col gap-4 border-primary/30 bg-primary/5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold">{isRtl ? 'اعتبار API جدا از اشتراک است' : 'API Credits are separate from your subscription'}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{isRtl ? 'برای اتصال Agentها به سایت‌ها و اپلیکیشن‌های دیگر، بسته API تهیه کنید.' : 'Buy API Credit packs for connecting Agents to websites and external applications.'}</p>
        </div>
        <Link
          href="/api-keys"
          onClick={(event) => {
            if (!isSignedIn) {
              event.preventDefault();
              requestGuestAccount(isRtl ? 'برای خرید اعتبار API، ابتدا حساب رایگان بسازید.' : 'Create a free account before buying API Credits.');
            }
          }}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-primary/40 px-4 py-2.5 text-sm font-semibold text-primary hover:bg-primary/10"
        >
          Buy API Credits <ExternalLink size={14} />
        </Link>
      </Card>

      <ReferralSection />

      {(quote.isError || paymentError) && !paymentOpen && <Card className="border-red-500/50 bg-red-500/5 text-sm text-red-400">{t('bill_quote_error')}</Card>}

      {paymentOpen && selectedCurrencyData && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:p-4" role="dialog" aria-modal="true" aria-label={t('bill_qr_title')}>
           <div className="relative max-h-[calc(100dvh-1rem-env(safe-area-inset-bottom))] w-full min-w-0 max-w-2xl overflow-x-hidden overflow-y-auto overscroll-contain rounded-2xl border border-primary/30 bg-background p-4 shadow-2xl sm:max-h-[92dvh] sm:rounded-3xl sm:p-5 md:p-7">
            <button type="button" onClick={() => setPaymentOpen(false)} aria-label={t('bill_close')} className="absolute end-3 top-3 flex min-h-11 min-w-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-hover hover:text-foreground sm:end-4 sm:top-4"><X size={19} /></button>
            <div className="flex items-center gap-3 pe-10"><CryptoLogo logoKey={selectedCurrencyData.logoKey} ticker={selectedCurrencyData.ticker} large /><div><h2 className="text-xl font-bold">{selectedCurrencyData.label}</h2><p className="mt-1 text-xs text-muted-foreground">{selectedCurrencyData.network}</p></div></div>
             <div className="mt-5">
               <WalletPayment
                 key={selectedCurrencyData.id}
                 currencyId={selectedCurrencyData.id}
                 ticker={selectedCurrencyData.ticker}
                 recipient={paymentAddress}
                 amount={paymentCryptoAmount}
                 isRtl={isRtl}
                 disabled={paymentSubmitting || quote.isPending || quote.isError || !quote.data || !paymentCryptoAmount}
                 onTransactionSubmitted={submitPaymentHash}
               />
             </div>
            {quote.isError && <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-foreground"><span>{isRtl ? 'پیش‌فاکتور دریافت نشد. تا آماده‌شدن آن وجهی ارسال نکنید.' : 'The payment quote failed. Do not send funds until it is ready.'}</span><Button type="button" variant="secondary" onClick={() => selectedPlan && selectedCurrency && quote.mutate({ data: { planId: selectedPlan, currency: selectedCurrency, ...(redeemCode.trim() ? { redeemCode: redeemCode.trim() } : {}) } as never })}>{isRtl ? 'تلاش دوباره' : 'Retry quote'}</Button></div>}
            <div className="mt-6 grid gap-6 md:grid-cols-[220px_1fr]">
              <div className="flex flex-col items-center gap-3">
                {quote.isPending ? <div className="h-[220px] w-[220px] animate-pulse rounded-2xl border border-border bg-surface" aria-label={isRtl ? 'در حال آماده‌سازی پیش‌فاکتور' : 'Preparing quote'} /> : qrUrl ? <img src={qrUrl} alt={`${selectedCurrencyData.label} payment QR code`} className="h-[220px] w-[220px] rounded-2xl bg-white p-2" /> : <div className="flex h-[220px] w-[220px] items-center justify-center rounded-2xl border border-border bg-surface text-center text-xs text-muted-foreground">{isRtl ? 'کد پرداخت پس از دریافت پیش‌فاکتور نمایش داده می‌شود.' : 'Payment QR appears when the quote is ready.'}</div>}
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><QrCode size={14} /> {t('bill_qr_title')}</span>
              </div>
              <div className="space-y-4">
                {selectedPlanData && <div className="rounded-xl border border-primary/20 bg-primary/5 p-4"><p className="text-xs text-muted-foreground">{t('bill_send')}</p><div className="mt-2 grid grid-cols-2 gap-2"><div className="rounded-lg border border-border/70 bg-background/60 p-3"><p className="text-[10px] text-muted-foreground">{t('bill_usd_value')}</p><p className="mt-1 text-lg font-bold text-primary" dir="ltr">${quote.data ? Number(quote.data.amount).toFixed(2) : effectivePlanPrice.toFixed(2)}</p></div><div className="rounded-lg border border-border/70 bg-background/60 p-3"><p className="text-[10px] text-muted-foreground">{t('bill_crypto_value')}</p><p className="mt-1 break-all text-lg font-bold text-primary" dir="ltr">{quote.isPending ? '…' : paymentCryptoAmount ? `${paymentCryptoAmount} ${selectedCurrencyData.ticker}` : '—'}</p></div></div><p className="mt-2 text-xs text-muted-foreground">{quote.data ? paymentCryptoAmount ? (isRtl ? 'مقدار رمزارز برآوردی بر پایه نرخ لحظه‌ای است؛ ارزش دلاری پیش‌فاکتور سرور ملاک است.' : 'Crypto amount is an estimate from the live rate; the server quote sets the USD value.') : t('bill_price_unavailable') : priceLoading ? t('bill_price_loading') : livePrice ? (isRtl ? `برآورد با نرخ لحظه‌ای: $${livePrice.toLocaleString()}؛ تا صدور پیش‌فاکتور پرداخت نکنید.` : `Live-rate estimate: $${livePrice.toLocaleString()}; wait for the quote before sending.`) : t('bill_price_unavailable')}</p><p className="mt-1 text-xs text-muted-foreground">{apiLocale.getPlanName(selectedPlanData)}</p></div>}
                <div><p className="mb-2 text-xs font-semibold">{t('bill_payment_address')}</p><p className="break-all rounded-xl border border-border bg-surface p-3 text-start font-mono text-[11px] leading-5" dir="ltr">{quote.data?.address || (isRtl ? 'در انتظار پیش‌فاکتور' : 'Waiting for quote')}</p><Button type="button" size="sm" variant="secondary" onClick={copyAddress} disabled={!quote.data?.address} className="mt-2">{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? t('bill_copied') : t('bill_copy_address')}</Button></div>
                <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 p-3 text-xs text-amber-500"><AlertTriangle size={14} className="mt-0.5 shrink-0" /><p>{apiLocale.getPaymentWarning(quote.data?.warning)}</p></div>
              </div>
            </div>
             <div className="mt-6 space-y-4">
               <div className="space-y-4 rounded-2xl border border-primary/20 bg-primary/5 p-4"><div><h3 className="text-sm font-semibold">{t('bill_payment_next')}</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">{t('bill_payment_auto')}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{t('bill_payment_options')}</p></div><div className="flex flex-col gap-2 sm:flex-row"><input value={txId} onChange={(event) => setTxId(event.target.value)} placeholder={t('bill_txid_placeholder')} dir="ltr" className="min-w-0 flex-1 rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary" /><Button type="button" onClick={recordPayment} disabled={!txId.trim() || !selectedPlan || paymentSubmitting}>{paymentSubmitting ? <LoaderCircle className="animate-spin" size={16} /> : <CreditCard size={16} />}{paymentSubmitting ? t('bill_txid_sending') : t('bill_txid_submit')}</Button></div>{paymentSaved && <p className="flex items-center gap-1.5 text-xs text-green-400"><Check size={14} /> {paymentStatusMessage || t('bill_txid_saved')}</p>}{paymentError && <p className="text-xs text-red-400">{paymentStatusMessage || t('bill_txid_error')}</p>}<Link href="/support" onClick={() => setPaymentOpen(false)} className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline">{t('bill_support_prompt')} <ExternalLink size={13} /></Link></div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}