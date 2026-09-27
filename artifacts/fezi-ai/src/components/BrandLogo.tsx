import { useState } from 'react';
import { Globe2 } from 'lucide-react';
import horseRoundLogo from '@/assets/persian-dark-horse-round-small.webp';

type BrandLogoProps = {
  name: string;
  id?: string;
  provider?: string;
  endpoint?: string;
  size?: number;
  className?: string;
};

// Downloaded brand marks live in public/brands so the selectors work without
// asking an unrelated favicon service about a visitor's MCP connections.
const assets = {
  adobe: 'adobe.ico',
  alibaba: 'alibaba.svg',
  anthropic: 'anthropic.svg',
  bytedance: 'bytedance.svg',
  canva: 'canva.ico',
  claude: 'claude.svg',
  cloudflare: 'cloudflare.svg',
  cursor: 'cursor.svg',
  deepseek: 'deepseek.svg',
  discord: 'discord.svg',
  elevenlabs: 'elevenlabs.svg',
  figma: 'figma.svg',
  framer: 'framer.svg',
  gemini: 'gemini.svg',
  github: 'github.svg',
  google: 'google.svg',
  hailuo: 'hailuo.ico',
  huggingface: 'huggingface.svg',
  kling: 'kling.ico',
  ltx: 'ltx.png',
  luma: 'luma.ico',
  meta: 'meta.svg',
  minimax: 'minimax.ico',
  mistral: 'mistral.svg',
  mongodb: 'mongodb.svg',
  n8n: 'n8n.svg',
  notion: 'notion.svg',
  openai: 'openai.svg',
  openrouter: 'openrouter.svg',
  perplexity: 'perplexity.svg',
  pika: 'pika.ico',
  pixverse: 'pixverse.svg',
  postgresql: 'postgresql.svg',
  runway: 'runway.png',
  seedance: 'seedance.ico',
  shopify: 'shopify.svg',
  slack: 'slack.ico',
  stripe: 'stripe.svg',
  supabase: 'supabase.svg',
  telegram: 'telegram.svg',
  vidu: 'vidu.svg',
  wan: 'wan.ico',
  x: 'x.svg',
  zapier: 'zapier.svg',
} as const;

type Brand = keyof typeof assets | 'fezi';

const brandRules: Array<[RegExp, Brand]> = [
  [/seedance/i, 'seedance'],
  [/claude/i, 'claude'],
  [/anthropic/i, 'anthropic'],
  [/chatgpt|openai|codex|dall[ -]?e|gpt[- ]?\d|gpt-image|sora[- ]?\d/i, 'openai'],
  [/gemini|nano[ -]?banana/i, 'gemini'],
  [/google|veo[- ]?\d/i, 'google'],
  [/deepseek/i, 'deepseek'],
  [/mistral/i, 'mistral'],
  [/qwen|alibaba/i, 'alibaba'],
  [/byte[ -]?dance/i, 'bytedance'],
  [/hailuo/i, 'hailuo'],
  [/minimax/i, 'minimax'],
  [/kling/i, 'kling'],
  [/\bwan[ -]?\d|^wan\b|\/wan\b/i, 'wan'],
  [/runway/i, 'runway'],
  [/pixverse/i, 'pixverse'],
  [/\bpika\b/i, 'pika'],
  [/\bvidu\b/i, 'vidu'],
  [/\bluma\b|dream[ -]?machine/i, 'luma'],
  [/\bltx\b/i, 'ltx'],
  [/elevenlabs/i, 'elevenlabs'],
  [/perplexity/i, 'perplexity'],
  [/hugging[ -]?face/i, 'huggingface'],
  [/notion/i, 'notion'],
  [/github/i, 'github'],
  [/slack/i, 'slack'],
  [/discord/i, 'discord'],
  [/figma/i, 'figma'],
  [/canva/i, 'canva'],
  [/adobe|firefly/i, 'adobe'],
  [/shopify/i, 'shopify'],
  [/stripe/i, 'stripe'],
  [/cursor/i, 'cursor'],
  [/framer/i, 'framer'],
  [/zapier/i, 'zapier'],
  [/\bn8n\b/i, 'n8n'],
  [/telegram/i, 'telegram'],
  [/cloudflare/i, 'cloudflare'],
  [/mongodb/i, 'mongodb'],
  [/postgres(?:ql)?/i, 'postgresql'],
  [/supabase/i, 'supabase'],
  [/\bmeta\b|llama|movie[ -]?gen/i, 'meta'],
  [/openrouter/i, 'openrouter'],
  [/\bfezi\b|gapgpt/i, 'fezi'],
];

const knownDomains: Array<[string, Brand]> = [
  ['openai.com', 'openai'],
  ['anthropic.com', 'claude'],
  ['claude.ai', 'claude'],
  ['google.com', 'google'],
  ['googleapis.com', 'google'],
  ['deepseek.com', 'deepseek'],
  ['seed.bytedance.com', 'seedance'],
  ['bytedance.com', 'bytedance'],
  ['klingai.com', 'kling'],
  ['wan.video', 'wan'],
  ['hailuoai.video', 'hailuo'],
  ['notion.so', 'notion'],
  ['notion.com', 'notion'],
  ['github.com', 'github'],
  ['openrouter.ai', 'openrouter'],
  ['slack.com', 'slack'],
  ['figma.com', 'figma'],
  ['canva.com', 'canva'],
  ['stripe.com', 'stripe'],
  ['shopify.com', 'shopify'],
];

function logoForBrand(brand: Brand) {
  return brand === 'fezi'
    ? horseRoundLogo
    : `${import.meta.env.BASE_URL}brands/${assets[brand]}`;
}

function websiteLogo(endpoint?: string): string | null {
  if (!endpoint) return null;
  try {
    const url = new URL(endpoint);
    const host = url.hostname.toLowerCase();
    // Never turn private, local, or non-HTTPS MCP endpoints into image requests.
    if (url.protocol !== 'https:' || (url.port && url.port !== '443') || url.username || url.password
      || !/^[a-z0-9.-]+$/.test(host) || !host.includes('.')
      || /(^|\.)localhost$|(^|\.)(local|lan|internal|test|invalid|example|onion)$/.test(host)
      || /^\d+(\.\d+){3}$/.test(host)) return null;

    const known = knownDomains.find(([domain]) => host === domain || host.endsWith(`.${domain}`));
    return known ? logoForBrand(known[1]) : `${url.origin}/favicon.ico`;
  } catch {
    return null;
  }
}

function namedLogo(name: string, id?: string, provider?: string) {
  if (/^(image|code|research|voice|gapgpt)$/i.test(id || '')
    || /^(AI Image|Coding Studio|Research Desk|Persian Voice)$/i.test(name)) {
    return horseRoundLogo;
  }
  // Model identity wins over a gateway such as OpenRouter or FEZI AI.
  const text = [id, name].filter(Boolean).join(' ');
  const direct = brandRules.find(([pattern]) => pattern.test(text));
  const fromProvider = brandRules.find(([pattern]) => pattern.test(provider || ''));
  return direct ? logoForBrand(direct[1]) : fromProvider ? logoForBrand(fromProvider[1]) : null;
}

export function BrandLogo({ name, id, provider, endpoint, size = 28, className = '' }: BrandLogoProps) {
  const source = endpoint ? websiteLogo(endpoint) : namedLogo(name, id, provider);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const dimension = Math.max(16, Math.min(size, 64));

  return (
    <span
      role="img"
      aria-label={source && failedSource !== source ? `${name} logo` : `${name} icon unavailable`}
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white text-slate-500 ${className}`}
      style={{ width: dimension, height: dimension }}
    >
      {source && failedSource !== source
        ? <img src={source} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-contain" onError={() => setFailedSource(source)} />
        : <Globe2 size={Math.round(dimension * 0.56)} aria-hidden="true" />}
    </span>
  );
}