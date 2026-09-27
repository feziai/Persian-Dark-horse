import { useState } from 'react';
import { BookOpen, CheckCircle2, CloudSun, Coins, ExternalLink, Globe2, Library, LoaderCircle, Search, Sparkles, TrendingUp } from 'lucide-react';
import { useTranslation } from '../lib/i18n';
import { Button, Card, Input, Label, PageHeader } from '../components/ui-parts';

type SearchMode = 'wikipedia' | 'open-library' | 'crossref';
type SearchResult = {
  title: string;
  snippet?: string;
  authors?: string[];
  year?: number | null;
  doi?: string;
  url: string;
  coverUrl?: string | null;
};

const publicApis = [
  { name: 'Wikipedia', category: 'Knowledge', description: 'Public encyclopedia search', icon: Globe2, color: '#8ab4ff' },
  { name: 'Open Library', category: 'Books', description: 'Books, authors and covers', icon: Library, color: '#e8b95b' },
  { name: 'Crossref', category: 'Research', description: 'Scholarly publication metadata', icon: BookOpen, color: '#7ed6a5' },
  { name: 'Open-Meteo', category: 'Weather', description: 'Current weather by coordinates', icon: CloudSun, color: '#76c8ff' },
  { name: 'Frankfurter', category: 'Currency', description: 'Public exchange rates', icon: TrendingUp, color: '#cb9cff' },
  { name: 'CoinGecko', category: 'Crypto', description: 'Public crypto prices', icon: Coins, color: '#f5a86b' },
];

export default function FreeAPIsPage() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<SearchMode>('wikipedia');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [weather, setWeather] = useState<any>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState(false);
  const [latitude, setLatitude] = useState('35.6892');
  const [longitude, setLongitude] = useState('51.3890');
  const [from, setFrom] = useState('USD');
  const [to, setTo] = useState('EUR');
  const [exchange, setExchange] = useState<any>(null);
  const [cryptoIds, setCryptoIds] = useState('bitcoin,ethereum');
  const [crypto, setCrypto] = useState<Record<string, { usd?: number }>>({});

  const search = async (event: React.FormEvent) => {
    event.preventDefault();
    if (query.trim().length < 2) return;
    setSearching(true);
    setSearchError(false);
    try {
      const response = await fetch(`/api/free-apis/${mode}?q=${encodeURIComponent(query.trim())}`);
      if (!response.ok) throw new Error('Search failed');
      const payload = await response.json() as { results?: SearchResult[] };
      setResults(payload.results || []);
    } catch {
      setResults([]);
      setSearchError(true);
    } finally {
      setSearching(false);
    }
  };

  const loadWeather = async () => {
    setWeatherLoading(true);
    setWeatherError(false);
    try {
      const response = await fetch(`/api/free-apis/weather?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}`);
      if (!response.ok) throw new Error('Weather failed');
      const payload = await response.json() as { data?: { current?: Record<string, number | string> } };
      setWeather(payload.data?.current || null);
    } catch {
      setWeather(null);
      setWeatherError(true);
    } finally {
      setWeatherLoading(false);
    }
  };

  const loadExchange = async () => {
    try {
      const response = await fetch(`/api/free-apis/currency?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
      if (!response.ok) throw new Error('Currency failed');
      const payload = await response.json() as { data?: { amount?: number; base?: string; rates?: Record<string, number> } };
      setExchange(payload.data || null);
    } catch {
      setExchange(null);
    }
  };

  const loadCrypto = async () => {
    try {
      const response = await fetch(`/api/free-apis/crypto?ids=${encodeURIComponent(cryptoIds)}`);
      if (!response.ok) throw new Error('Crypto failed');
      setCrypto(await response.json().then((payload: { data?: Record<string, { usd?: number }> }) => payload.data || {}));
    } catch {
      setCrypto({});
    }
  };

  return (
    <div className="fade-up mx-auto max-w-6xl space-y-8">
      <PageHeader title={t('free_apis_title')} description={t('free_apis_desc')} />

      <Card className="border-primary/25 bg-primary/5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 shrink-0 text-primary" size={20} />
          <p className="text-sm leading-6 text-muted-foreground">{t('free_apis_note')}</p>
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <Search size={18} className="text-primary" />
          <h2 className="font-semibold">{t('free_apis_search_title')}</h2>
        </div>
        <form onSubmit={search} className="mt-5 flex flex-col gap-3 md:flex-row">
          <select value={mode} onChange={(event) => setMode(event.target.value as SearchMode)} className="min-h-11 w-full min-w-0 rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary md:w-auto">
            <option value="wikipedia">Wikipedia</option>
            <option value="open-library">Open Library</option>
            <option value="crossref">Crossref</option>
          </select>
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('free_apis_search_placeholder')} className="min-w-0 flex-1" />
          <Button type="submit" className="min-h-11 w-full md:w-auto" disabled={searching || query.trim().length < 2}>
            {searching ? <LoaderCircle size={16} className="animate-spin" /> : <Search size={16} />}
            {searching ? t('free_apis_searching') : t('free_apis_search')}
          </Button>
        </form>
        {searchError && <p className="mt-3 text-xs text-red-400">{t('free_apis_error')}</p>}
        {results.length > 0 ? (
          <div className="mt-5 grid gap-3">
            {results.map((result, index) => (
              <div key={`${result.title}-${index}`} className="rounded-2xl border border-border bg-background/40 p-4">
                <div className="flex items-start gap-3">
                  {result.coverUrl && <img src={result.coverUrl} alt="" className="h-14 w-10 rounded object-cover" />}
                  <div className="min-w-0 flex-1">
                    <a href={result.url} target="_blank" rel="noreferrer" className="inline-flex max-w-full flex-wrap items-center gap-1 break-words font-semibold hover:text-primary">
                      {result.title} <ExternalLink size={13} />
                    </a>
                    {result.authors && <p className="mt-1 text-xs text-primary">{result.authors.join(', ')}</p>}
                    {result.year && <p className="mt-1 text-xs text-muted-foreground">{result.year}</p>}
                    {result.snippet && <p className="mt-2 text-sm leading-6 text-muted-foreground">{result.snippet}</p>}
                    {result.doi && <p className="mt-2 break-all text-[11px] text-muted-foreground" dir="ltr">DOI: {result.doi}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : query && !searching && <p className="mt-5 text-sm text-muted-foreground">{t('free_apis_no_results')}</p>}
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <div className="flex items-center gap-2"><CloudSun size={18} className="text-primary" /><h2 className="font-semibold">{t('free_apis_weather_title')}</h2></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div><Label>{t('free_apis_latitude')}</Label><Input value={latitude} onChange={(event) => setLatitude(event.target.value)} dir="ltr" className="text-start" /></div>
            <div><Label>{t('free_apis_longitude')}</Label><Input value={longitude} onChange={(event) => setLongitude(event.target.value)} dir="ltr" className="text-start" /></div>
          </div>
          <Button type="button" className="mt-4 min-h-11 w-full sm:w-auto" onClick={loadWeather} disabled={weatherLoading}>
            {weatherLoading ? <LoaderCircle size={16} className="animate-spin" /> : <CloudSun size={16} />}
            {weatherLoading ? t('free_apis_weather_loading') : t('free_apis_weather')}
          </Button>
          {weather && <div className="mt-4 rounded-xl bg-background p-3 text-sm"><strong>{weather.temperature_2m}°</strong> · {weather.relative_humidity_2m}% humidity · {weather.wind_speed_10m} km/h wind</div>}
          {weatherError && <p className="mt-3 text-xs text-red-400">{t('free_apis_error')}</p>}
        </Card>

        <Card>
          <div className="flex items-center gap-2"><TrendingUp size={18} className="text-primary" /><h2 className="font-semibold">{t('free_apis_currency_title')}</h2></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div><Label>{t('free_apis_from')}</Label><Input value={from} onChange={(event) => setFrom(event.target.value.toUpperCase())} maxLength={3} dir="ltr" className="text-start uppercase" /></div>
            <div><Label>{t('free_apis_to')}</Label><Input value={to} onChange={(event) => setTo(event.target.value.toUpperCase())} maxLength={3} dir="ltr" className="text-start uppercase" /></div>
          </div>
          <Button type="button" className="mt-4 min-h-11 w-full sm:w-auto" onClick={loadExchange}><TrendingUp size={16} /> {t('free_apis_convert')}</Button>
          {exchange?.rates && <div className="mt-4 rounded-xl bg-background p-3 text-sm" dir="ltr">1 {exchange.base} = {exchange.rates[to]} {to}</div>}
        </Card>

        <Card>
          <div className="flex items-center gap-2"><Coins size={18} className="text-primary" /><h2 className="font-semibold">{t('free_apis_crypto_title')}</h2></div>
          <Label className="mt-5">{t('free_apis_crypto_ids')}</Label>
          <Input value={cryptoIds} onChange={(event) => setCryptoIds(event.target.value)} dir="ltr" className="text-start" />
          <Button type="button" className="mt-4 min-h-11 w-full sm:w-auto" onClick={loadCrypto}><Coins size={16} /> {t('free_apis_crypto_load')}</Button>
          {Object.keys(crypto).length > 0 && <div className="mt-4 space-y-2">{Object.entries(crypto).map(([id, quote]) => <div key={id} className="flex flex-wrap justify-between gap-2 rounded-xl bg-background p-3 text-sm" dir="ltr"><span className="min-w-0 break-all">{id}</span><strong>${quote.usd?.toLocaleString() || '—'}</strong></div>)}</div>}
        </Card>
      </div>

      <section>
        <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold"><Sparkles size={18} className="text-primary" />{t('free_apis_catalog')}</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {publicApis.map((api) => {
            const Icon = api.icon;
            return <Card key={api.name} className="transition-all hover:-translate-y-1 hover:border-primary/40">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-background" style={{ color: api.color }}><Icon size={21} /></div>
                <div><h3 className="font-semibold">{api.name}</h3><p className="mt-1 text-xs text-muted-foreground">{api.description}</p></div>
              </div>
              <p className="mt-4 text-[11px] font-medium text-primary">{t('free_apis_no_auth')} · {api.category}</p>
            </Card>;
          })}
        </div>
      </section>
    </div>
  );
}