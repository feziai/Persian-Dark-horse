import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import {
  AlertTriangle, Bot, BrainCircuit, Check, ChevronRight, Code2, Copy, CreditCard, Eye, FileText, Globe2,
  Edit2, ExternalLink, Info, KeyRound, Library, LoaderCircle, Lock, Plus, QrCode, RefreshCw, Save,
  Search, Sparkles, Trash2, Upload, Users, WandSparkles, X, type LucideIcon,
} from "lucide-react";
import { PageHeader, Card, Button, Input, Label, Textarea } from "../components/ui-parts";
import { useAuth } from "@clerk/react";
import { requestGuestAccount } from "../lib/auth-gate";
import customAgentMaker from "@/assets/custom-agent-maker.svg";
import createAgentPortal from "@/assets/create-agent-portal.png";
import { randomSuggestedName } from "../lib/suggested-names";
import { useTranslation } from "../lib/i18n";
import { AgentSocialLinks, type AgentSocialLink } from "../components/AgentSocialLinks";
import { characterAvatarOptions } from "../lib/avatar-options";
import { googleApiError, useGoogleApiAccess } from "../lib/use-google-api-access";

type CustomAgent = {
  id: string;
  name: string;
  slug: string;
  description: string;
  gender: string;
  avatarUrl?: string | null;
  category: string;
  tags: string[];
  capabilities: string[];
  tools: string[];
  socialLinks: AgentSocialLink[];
  visibility: "private" | "unlisted" | "public";
  status: string;
  apiEnabled: boolean;
  memoryEnabled: boolean;
  usageCount: number;
  createdAt: string;
  systemInstructions?: string;
  developerInstructions?: string;
  knowledgeText?: string;
  model?: string;
  personality?: Record<string, unknown>;
  connectedModels?: string[];
};

type AgentSiteTheme = "midnight" | "pearl" | "forest" | "sunset" | "ocean";

type AgentSite = {
  enabled: boolean;
  title: string;
  intro: string;
  theme: AgentSiteTheme;
  capabilities: string[];
  customDomain: string;
  domainStatus: string;
  publicUrl: string;
};

type SiteCapability = {
  id: string;
  label: string;
  purpose: string;
};

type AgentSiteStatus = {
  entitled?: boolean;
  hasEntitlement?: boolean;
  hasAccess?: boolean;
  eligible?: boolean;
  canUse?: boolean;
  active?: boolean;
  enabled?: boolean;
  product?: string;
  price?: number;
};

type PaymentCurrency = {
  id: string;
  label: string;
  ticker: string;
  network: string;
  address: string;
  logoKey: string;
  enabled: boolean;
};

type BuilderForm = {
  name: string;
  slug: string;
  description: string;
  gender: string;
  category: string;
  tags: string;
  avatarUrl: string;
  purpose: string;
  systemInstructions: string;
  developerInstructions: string;
  capabilities: string[];
  tools: string[];
  socialLinks: AgentSocialLink[];
  knowledgeText: string;
  memoryEnabled: boolean;
  apiEnabled: boolean;
  visibility: "private" | "unlisted" | "public";
  status: "draft" | "active";
  model: string;
  connectedModels: string[];
  personality: {
    tone: string;
    traits: string[];
    warmth: number;
    precision: number;
    creativity: number;
  };
};

const capabilityOptions = [
  ["chat", "AI Chat"], ["research", "Research"], ["coding", "Code generation"],
  ["image", "Image generation"], ["image-editing", "Image editing"], ["video", "Video creation"],
  ["voice", "Persian text-to-speech"], ["speech-to-text", "Speech-to-text"], ["embeddings", "Embeddings / RAG"],
  ["files", "File analysis"], ["business", "Business analysis"],
  ["marketing", "Marketing"], ["data", "Data analysis"], ["automation", "Automation"],
];

const toolOptions = ["Web Search", "Calculator", "File analysis", "External APIs", "Webhooks"];
const agentAppOptions = [
  "Claude Code", "Cline", "CodeGPT", "Codex", "Cursor", "DeepSeek Harness", "Descript", "Framer", "Freebuff", "Hello Minds",
  "Hermes Agent", "HighLevel", "ISEKAI ZERO", "Janitor AI", "Kilo Code", "Lemonade", "omp", "OpenClaw", "OpenHands", "pi",
];
const modelOptions = [
  ["openrouter/free", "Persian Dark Horse Free"],
  ["qwen/qwen3.8-27b", "Qwen 3.8"],
  ["deepseek-chat", "DeepSeek"],
  ["mistral-small-latest", "Mistral"],
  ["google/gemini-2.5-flash", "Gemini Flash"],
  ["claude-sonnet-5", "Claude Sonnet"],
] as const;
const traitOptions = ["Helpful", "Precise", "Creative", "Calm", "Direct", "Playful", "Formal", "Empathetic"];
const visibilityOptions: Array<[BuilderForm["visibility"], string, string, LucideIcon]> = [
  ["private", "Private", "Only you can access it.", Lock],
  ["unlisted", "Unlisted", "Not discoverable, but people with a link can use it.", KeyRound],
  ["public", "Public", "List it in Other Agents for the community.", Users],
];

const emptySite: AgentSite = {
  enabled: false,
  title: "",
  intro: "",
  theme: "midnight",
  capabilities: [],
  customDomain: "",
  domainStatus: "not_configured",
  publicUrl: "",
};

const siteThemes: Array<{ id: AgentSiteTheme; label: string; description: string; swatches: string[] }> = [
  { id: "midnight", label: "Midnight", description: "Quiet, editorial, and high contrast.", swatches: ["#12141f", "#e6b85c"] },
  { id: "pearl", label: "Pearl", description: "Airy surfaces with a warm, precise edge.", swatches: ["#f4efe6", "#25324a"] },
  { id: "forest", label: "Forest", description: "Grounded, thoughtful, and quietly confident.", swatches: ["#17251f", "#9ac5a3"] },
  { id: "sunset", label: "Sunset", description: "Warm energy for expressive Agents.", swatches: ["#3b2023", "#f0a36b"] },
  { id: "ocean", label: "Ocean", description: "Clear, expansive, and focused.", swatches: ["#122832", "#78c9d7"] },
];

const avatarChoices = characterAvatarOptions.map(({ id, label }) => ({
  id,
  label,
  url: `${import.meta.env.BASE_URL}agent-avatars/characters/${id}.webp`,
}));
const defaultAgentAvatar = avatarChoices.find((choice) => choice.id === "fezi-agent")!.url;

const emptyForm: BuilderForm = {
  name: "", slug: "", description: "", gender: "unspecified", category: "General", tags: "",
  avatarUrl: defaultAgentAvatar, purpose: "", systemInstructions: "", developerInstructions: "",
  capabilities: ["AI Chat"], tools: [], knowledgeText: "", memoryEnabled: false, apiEnabled: false,
  socialLinks: [],
  visibility: "public", status: "draft", model: "qwen/qwen3.8-27b",
  connectedModels: ["qwen/qwen3.8-27b"],
  personality: { tone: "Balanced", traits: ["Helpful", "Precise"], warmth: 6, precision: 7, creativity: 6 },
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function normalizeSite(value: unknown): AgentSite {
  const payload = asRecord(value);
  const source = asRecord(payload.site ?? value);
  const theme = source.theme;
  const validTheme: AgentSiteTheme = theme === "pearl" || theme === "forest" || theme === "sunset" || theme === "ocean" ? theme : "midnight";
  return {
    enabled: source.enabled === true,
    title: typeof source.title === "string" ? source.title : "",
    intro: typeof source.intro === "string" ? source.intro : "",
    theme: validTheme,
    capabilities: Array.isArray(source.capabilities) ? source.capabilities.filter((item): item is string => typeof item === "string") : [],
    customDomain: typeof source.customDomain === "string" ? source.customDomain : "",
    domainStatus: typeof source.domainStatus === "string" ? source.domainStatus : "not_configured",
    publicUrl: typeof source.publicUrl === "string" ? source.publicUrl : "",
  };
}

function normalizeSiteCatalogue(value: unknown): SiteCapability[] {
  const payload = asRecord(value);
  const rows = Array.isArray(value) ? value : payload.catalogue ?? payload.capabilities ?? payload.items;
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((item): SiteCapability[] => {
    const row = asRecord(item);
    const id = typeof row.id === "string" ? row.id : typeof row.key === "string" ? row.key : typeof row.slug === "string" ? row.slug : "";
    const label = typeof row.label === "string" ? row.label : typeof row.name === "string" ? row.name : typeof row.title === "string" ? row.title : id;
    const purpose = typeof row.purpose === "string" ? row.purpose : typeof row.description === "string" ? row.description : "";
    return id && label ? [{ id, label, purpose }] : [];
  });
}

function normalizeSiteStatus(value: unknown): AgentSiteStatus {
  const payload = asRecord(value);
  const nestedStatus = payload.status;
  const source = nestedStatus && typeof nestedStatus === "object" ? asRecord(nestedStatus) : payload;
  const statusValue = typeof nestedStatus === "string" ? nestedStatus.toLowerCase() : typeof source.status === "string" ? source.status.toLowerCase() : "";
  const activeStatus = statusValue === "active" || statusValue === "enabled" || statusValue === "paid";
  return {
    entitled: typeof source.entitled === "boolean" ? source.entitled : undefined,
    hasEntitlement: typeof source.hasEntitlement === "boolean" ? source.hasEntitlement : undefined,
    hasAccess: typeof source.hasAccess === "boolean" ? source.hasAccess : undefined,
    eligible: typeof source.eligible === "boolean" ? source.eligible : undefined,
    canUse: typeof source.canUse === "boolean" ? source.canUse : undefined,
    active: typeof source.active === "boolean" ? source.active : activeStatus || undefined,
    enabled: typeof source.enabled === "boolean" ? source.enabled : undefined,
    product: typeof source.product === "string" ? source.product : undefined,
    price: typeof source.price === "number" ? source.price : undefined,
  };
}

export default function CustomAgentsPage() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const googleAccess = useGoogleApiAccess('/my-agents');
  const accountRef = useRef(userId);
  accountRef.current = userId;
  const { isRtl } = useTranslation();
  const [agents, setAgents] = useState<CustomAgent[]>([]);
  const [discover, setDiscover] = useState<CustomAgent[]>([]);
  const [limit, setLimit] = useState(3);
  const [used, setUsed] = useState(0);
  const [form, setForm] = useState<BuilderForm>(emptyForm);
  const [suggestedName, setSuggestedName] = useState(randomSuggestedName);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState("Identity");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [analysis, setAnalysis] = useState<{ detected: { label: string }[]; suggestedInstructions: string } | null>(null);
  const [newKey, setNewKey] = useState("");
  const newKeyOwner = useRef<string | null>(null);
  useEffect(() => { newKeyOwner.current = null; setNewKey(""); setError(""); }, [userId]);
  const [site, setSite] = useState<AgentSite>(emptySite);
  const [siteCatalogue, setSiteCatalogue] = useState<SiteCapability[]>([]);
  const [siteStatus, setSiteStatus] = useState<AgentSiteStatus | null>(null);
  const [siteSummaries, setSiteSummaries] = useState<Record<string, AgentSite>>({});
  const [siteLoading, setSiteLoading] = useState(true);
  const [siteStatusError, setSiteStatusError] = useState("");
  const [siteError, setSiteError] = useState("");
  const [siteNotice, setSiteNotice] = useState("");
  const [siteBusy, setSiteBusy] = useState("");
  const [siteCurrencies, setSiteCurrencies] = useState<PaymentCurrency[]>([]);
  const [siteCurrencyId, setSiteCurrencyId] = useState<string | null>(null);
  const [siteQuote, setSiteQuote] = useState<{ address?: string; warning?: string } | null>(null);
  const [siteTxId, setSiteTxId] = useState("");
  const [sitePaymentBusy, setSitePaymentBusy] = useState(false);

  const load = async () => {
    const [mineResponse, discoverResponse] = await Promise.all([
      fetch("/api/custom-agents", { credentials: "include" }),
      fetch("/api/custom-agents/discover", { credentials: "include" }),
    ]);
    if (mineResponse.ok) {
      const data = await mineResponse.json() as { agents: CustomAgent[]; limit: number; used: number };
      setAgents(data.agents);
      setLimit(data.limit);
      setUsed(data.used);
      void loadSiteSummaries(data.agents);
    }
    if (discoverResponse.ok) setDiscover((await discoverResponse.json() as { agents: CustomAgent[] }).agents);
  };

  const loadSiteSummaries = async (ownedAgents: CustomAgent[]) => {
    const entries = await Promise.all(ownedAgents.map(async (agent) => {
      try {
        const response = await fetch(`/api/custom-agents/${encodeURIComponent(agent.id)}/site`, { credentials: "include" });
        if (!response.ok) return [agent.id, emptySite] as const;
        return [agent.id, normalizeSite(await response.json())] as const;
      } catch {
        return [agent.id, emptySite] as const;
      }
    }));
    setSiteSummaries(Object.fromEntries(entries));
  };

  const loadSiteResources = async () => {
    setSiteLoading(true);
    setSiteStatusError("");
    try {
      const [catalogueResponse, statusResponse, currenciesResponse] = await Promise.all([
        fetch("/api/agent-sites/catalogue", { credentials: "include" }),
        fetch("/api/agent-sites/status", { credentials: "include" }),
        fetch("/api/currencies", { credentials: "include" }),
      ]);
      if (catalogueResponse.ok) {
        setSiteCatalogue(normalizeSiteCatalogue(await catalogueResponse.json()));
      } else {
        setSiteStatusError("The Agent-site catalogue could not be loaded.");
      }
      if (statusResponse.ok) {
        setSiteStatus(normalizeSiteStatus(await statusResponse.json()));
      } else {
        setSiteStatusError((current) => current || "Persian Dark Horse could not verify your Agent-site entitlement.");
      }
      if (currenciesResponse.ok) {
        const currencies = await currenciesResponse.json() as PaymentCurrency[];
        setSiteCurrencies(currencies.filter((currency) => currency.enabled));
      }
    } catch {
      setSiteStatusError("Persian Dark Horse could not connect to the Agent-site service. Try again.");
    } finally {
      setSiteLoading(false);
    }
  };

  const quoteSitePayment = async (currencyId: string) => {
    setSiteCurrencyId(currencyId);
    setSitePaymentBusy(true);
    setSiteError("");
    try {
      const response = await fetch("/api/payments/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ agentSite: true, currency: currencyId }),
      });
      const data = await response.json() as { address?: string; warning?: string; error?: string };
      if (!response.ok) throw new Error(data.error || "Website payment quote could not be loaded.");
      setSiteQuote(data);
    } catch (reason) {
      setSiteError(reason instanceof Error ? reason.message : "Website payment quote could not be loaded.");
    } finally {
      setSitePaymentBusy(false);
    }
  };

  const submitSitePayment = async () => {
    if (!siteCurrencyId || !siteTxId.trim()) return;
    setSitePaymentBusy(true);
    setSiteError("");
    try {
      const response = await fetch("/api/payments/txid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ agentSite: true, currency: siteCurrencyId, txId: siteTxId.trim() }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Website payment could not be submitted.");
      setSiteNotice("Website payment is pending admin verification. Settings will unlock after approval.");
      setSiteTxId("");
    } catch (reason) {
      setSiteError(reason instanceof Error ? reason.message : "Website payment could not be submitted.");
    } finally {
      setSitePaymentBusy(false);
    }
  };

  const loadSite = async (id: string) => {
    setSiteBusy("load");
    try {
      const response = await fetch(`/api/custom-agents/${encodeURIComponent(id)}/site`, { credentials: "include" });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        const nextSite = normalizeSite(data);
        setSite(nextSite);
        setSiteSummaries((current) => ({ ...current, [id]: nextSite }));
      } else {
        setSite(emptySite);
        setSiteError(asRecord(data).error as string || "The Agent-site settings could not be loaded.");
      }
    } catch {
      setSite(emptySite);
      setSiteError("The Agent-site settings could not be loaded.");
    } finally {
      setSiteBusy("");
    }
  };

  useEffect(() => {
    void load();
    void loadSiteResources();
    const params = new URLSearchParams(window.location.search);
    if (params.get("create") === "1") {
      if (!isSignedIn) {
        requestGuestAccount("Create a free Persian Dark Horse account before building your own Agent.");
        return;
      }
      setBuilderOpen(true);
      setEditingId(null);
      setForm(emptyForm);
      setSuggestedName(randomSuggestedName());
      setSite(emptySite);
      setActiveSection("Identity");
    }
  }, [isSignedIn]);

  const update = <K extends keyof BuilderForm>(key: K, value: BuilderForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const openCreateAgent = () => {
    if (!isSignedIn) {
      requestGuestAccount("Create a free Persian Dark Horse account before building your own Agent.");
      return;
    }
    setEditingId(null);
    setForm(emptyForm);
    setSuggestedName(randomSuggestedName());
    setSite(emptySite);
    setActiveSection("Identity");
    setBuilderOpen(true);
    setError("");
    setNotice("");
    setSiteError("");
    setSiteNotice("");
  };

  const scrollToDiscover = () => {
    document.getElementById("agent-discovery")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const analyzePurpose = async () => {
    if (!isSignedIn) {
      requestGuestAccount("Create a Persian Dark Horse account before analyzing an Agent brief.");
      return;
    }
    if (form.purpose.trim().length < 8) return;
    setBusy("analyze");
    setError("");
    try {
      const response = await fetch("/api/custom-agents/analyze", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: form.purpose }),
      });
      const data = await response.json() as { detected?: { label: string }[]; suggestedInstructions?: string };
      if (!response.ok) throw new Error(data.suggestedInstructions || "Analysis failed");
      setAnalysis({ detected: data.detected ?? [], suggestedInstructions: data.suggestedInstructions ?? "" });
      update("systemInstructions", data.suggestedInstructions ?? "");
      update("capabilities", data.detected?.map((item) => item.label) ?? ["AI Chat"]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not analyze the request.");
    } finally {
      setBusy("");
    }
  };

  const openEdit = async (id: string) => {
    setBusy(`edit:${id}`);
    setError("");
    setSiteError("");
    setSiteNotice("");
    try {
      const response = await fetch(`/api/custom-agents/${encodeURIComponent(id)}`, { credentials: "include" });
      const data = await response.json() as { agent?: CustomAgent; error?: string };
      if (!response.ok || !data.agent) throw new Error(data.error || "Agent could not be loaded.");
      const agent = data.agent;
      setEditingId(id);
      setForm({
        name: agent.name,
        slug: agent.slug,
        description: agent.description,
        gender: agent.gender,
        category: agent.category,
        tags: agent.tags.join(", "),
        avatarUrl: agent.avatarUrl || defaultAgentAvatar,
        purpose: "",
        systemInstructions: agent.systemInstructions || "",
        developerInstructions: agent.developerInstructions || "",
        capabilities: agent.capabilities,
        tools: agent.tools,
        socialLinks: agent.socialLinks ?? [],
        knowledgeText: agent.knowledgeText || "",
        memoryEnabled: agent.memoryEnabled,
        apiEnabled: agent.apiEnabled,
        visibility: agent.visibility,
        status: agent.status === "active" ? "active" : "draft",
        model: agent.model || emptyForm.model,
        connectedModels: agent.connectedModels?.length ? agent.connectedModels : [agent.model || emptyForm.model],
        personality: {
          tone: typeof agent.personality?.tone === "string" ? agent.personality.tone : "Balanced",
          traits: Array.isArray(agent.personality?.traits) ? agent.personality.traits.filter((item): item is string => typeof item === "string") : ["Helpful", "Precise"],
          warmth: typeof agent.personality?.warmth === "number" ? agent.personality.warmth : 6,
          precision: typeof agent.personality?.precision === "number" ? agent.personality.precision : 7,
          creativity: typeof agent.personality?.creativity === "number" ? agent.personality.creativity : 6,
        },
      });
      setActiveSection("Identity");
      setBuilderOpen(true);
      void loadSite(id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Agent could not be loaded.");
    } finally {
      setBusy("");
    }
  };

  const saveAgent = async (status: "draft" | "active") => {
    if (!form.name.trim()) {
      setError("Give your Agent a name first.");
      setActiveSection("Identity");
      return;
    }
    const socialLinks = form.socialLinks.filter((link) => link.label.trim() || link.url.trim());
    if (socialLinks.some((link) => !link.label.trim() || !/^https:\/\//i.test(link.url.trim()))) {
      setError("Each social link needs a label and a valid HTTPS URL.");
      setActiveSection("Capabilities");
      return;
    }
    setBusy("save");
    setError("");
    try {
      const response = await fetch(editingId ? `/api/custom-agents/${encodeURIComponent(editingId)}` : "/api/custom-agents", {
        method: editingId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...form,
          socialLinks: socialLinks.map((link) => ({ ...link, label: link.label.trim(), url: link.url.trim() })),
          personality: form.personality,
          status,
          tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
        }),
      });
      const data = await response.json() as { agent?: CustomAgent; error?: string };
      if (!response.ok) throw new Error(data.error || "Agent could not be saved.");
      const savedAgentId = data.agent?.id ?? editingId;
      setNotice(status === "active" ? "Agent published and saved to My Agents." : "Draft saved.");
      setEditingId(savedAgentId ?? null);
      setActiveSection("Website");
      setAnalysis(null);
      await load();
      if (savedAgentId) await loadSite(savedAgentId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Agent could not be saved.");
    } finally {
      setBusy("");
    }
  };

  const deleteAgent = async (id: string) => {
    if (!window.confirm("Delete this Agent and its configuration?")) return;
    setBusy(id);
    const response = await fetch(`/api/custom-agents/${encodeURIComponent(id)}`, { method: "DELETE", credentials: "include" });
    setBusy("");
    if (response.ok) {
      setNotice("Agent deleted.");
      await load();
    } else setError("Agent could not be deleted.");
  };

  const generateKey = async (id: string) => {
    setBusy(`key:${id}`);
    const owner = userId ?? null;
    try {
      if (!await googleAccess.refresh()) throw new Error("Connect and verify Google in your profile before creating any API key. If you just linked Google, try again.");
      if (accountRef.current !== owner) return;
      const response = await fetch(`/api/custom-agents/${encodeURIComponent(id)}/api-keys`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ name: "Website integration" }),
      });
      const data = await response.json() as { apiKey?: string; error?: string; code?: string };
      if (accountRef.current !== owner) return;
      if (response.ok && data.apiKey) { newKeyOwner.current = owner; setNewKey(data.apiKey); }
      else setError(googleApiError(response.status, data.code || data.error) || data.error || "API key could not be created.");
    } catch (error) {
      if (accountRef.current === owner) setError(error instanceof Error ? error.message : "API key could not be created.");
    } finally {
      if (accountRef.current === owner) setBusy("");
    }
  };

  const saveSite = async () => {
    if (!editingId) {
      setSiteError("Save the Agent first, then configure its website.");
      return;
    }
    setSiteBusy("save");
    setSiteError("");
    setSiteNotice("");
    try {
      const response = await fetch(`/api/custom-agents/${encodeURIComponent(editingId)}/site`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          enabled: site.enabled,
          title: site.title,
          intro: site.intro,
          theme: site.theme,
          capabilities: site.capabilities,
          customDomain: site.customDomain.trim(),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(asRecord(data).error as string || "Agent-site settings could not be saved.");
      const saved = normalizeSite(data);
      setSite(saved);
      setSiteSummaries((current) => ({ ...current, [editingId]: saved }));
      setSiteNotice("Website settings saved.");
    } catch (reason) {
      setSiteError(reason instanceof Error ? reason.message : "Agent-site settings could not be saved.");
    } finally {
      setSiteBusy("");
    }
  };

  const siteEntitled = Boolean(
    siteStatus?.entitled ??
    siteStatus?.hasEntitlement ??
    siteStatus?.hasAccess ??
    siteStatus?.eligible ??
    siteStatus?.canUse ??
    siteStatus?.active ??
    siteStatus?.enabled,
  );
  const sections = ["Identity", "Instructions", "Personality", "Capabilities", "Knowledge", "Tools & API", "Visibility", "Website", "Preview"];
  const previewTags = useMemo(() => form.tags.split(",").map((tag) => tag.trim()).filter(Boolean), [form.tags]);

  return (
    <div className="fade-up mx-auto max-w-6xl space-y-8">
      <PageHeader
        title="My Agents"
        description="Build a personal AI Agent, configure its personality and knowledge, then decide who can use it."
         action={!builderOpen && <Button onClick={openCreateAgent}><Plus size={16} /> Create New Agent</Button>}
      />

      {error && <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}
      {notice && <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{notice}</div>}

      {!builderOpen && (
        <section className="relative isolate overflow-hidden rounded-[2rem] border border-[#733cff]/45 bg-[#090615] shadow-[0_0_70px_rgba(95,35,255,0.16)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_72%_15%,rgba(61,91,255,0.25),transparent_34%),radial-gradient(circle_at_42%_100%,rgba(163,46,255,0.2),transparent_42%)]" />
          <div className="relative grid gap-0 lg:grid-cols-[minmax(300px,0.82fr)_1.18fr]">
            <button
              type="button"
              onClick={openCreateAgent}
              className="group relative aspect-square min-h-[350px] overflow-hidden text-start outline-none focus-visible:ring-2 focus-visible:ring-[#b65cff] focus-visible:ring-inset sm:min-h-[430px] lg:min-h-0"
              aria-label="Create Your Agent"
            >
              <img
                src={createAgentPortal}
                alt="Two anonymous AI characters in violet and blue light"
                className="absolute inset-0 h-full w-full object-cover object-[center_35%] opacity-90 transition duration-700 group-hover:scale-[1.03] group-hover:opacity-100"
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,2,17,0.04)_20%,rgba(7,3,20,0.18)_48%,rgba(7,3,20,0.96)_100%)]" />
              <div className="absolute inset-x-5 bottom-5 rounded-[1.5rem] border border-[#a45cff]/70 bg-[#0b0619]/90 p-5 shadow-[0_0_34px_rgba(135,48,255,0.32)] backdrop-blur-md transition group-hover:border-[#d09bff] sm:inset-x-7 sm:bottom-7 sm:p-6">
                <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-[#b65cff] bg-[#2b0c52]/90 text-[#dcb7ff] shadow-[0_0_24px_rgba(171,79,255,0.7)]">
                  <Plus size={24} strokeWidth={1.8} />
                </span>
                <span className="block text-2xl font-semibold tracking-tight text-white sm:text-3xl">Create Your Agent</span>
                <span className="mt-2 block text-xs font-medium uppercase tracking-[0.18em] text-[#c8a4ff]">Build a mind of your own</span>
              </div>
            </button>

            <div className="flex min-h-[350px] flex-col justify-center p-6 sm:p-9 lg:min-h-[430px] lg:p-12">
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-[#a978ff]">
                <span className="h-px w-8 bg-[#a978ff]" />
                Agent Gateway
              </div>
              <h2 className="mt-5 max-w-xl text-3xl font-bold leading-tight text-white sm:text-4xl">Create your own, or find the right Agent for every idea.</h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-[#bcb3ce] sm:text-base">
                Shape a private AI companion from the ground up, or explore a growing universe of public Agents built for work, creativity, research, and more.
              </p>
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={openCreateAgent}
                  className="group flex items-center gap-3 rounded-2xl border border-[#9d56ff]/60 bg-[#7f35e8]/20 px-4 py-4 text-start transition hover:border-[#d2a7ff] hover:bg-[#913fff]/30"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#a858ff] text-white shadow-[0_0_20px_rgba(168,88,255,0.45)]"><WandSparkles size={18} /></span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-white">Create Your Agent</span>
                    <span className="mt-1 block text-xs text-[#c7b9dc]">Start with your own idea</span>
                  </span>
                  <ChevronRight size={16} className="ms-auto shrink-0 text-[#d7b5ff] transition group-hover:translate-x-1" />
                </button>
                <button
                  type="button"
                  onClick={scrollToDiscover}
                  className="group flex items-center gap-3 rounded-2xl border border-[#4458c5]/70 bg-[#182053]/45 px-4 py-4 text-start transition hover:border-[#8c9bff] hover:bg-[#202b73]/65"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#3048c6] text-[#dbe1ff] shadow-[0_0_20px_rgba(62,92,255,0.42)]"><Library size={18} /></span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-white">Explore Thousands of Agents</span>
                    <span className="mt-1 block text-xs text-[#b8c0ed]">Choose one from the community</span>
                  </span>
                  <ChevronRight size={16} className="ms-auto shrink-0 text-[#b8c0ff] transition group-hover:translate-x-1" />
                </button>
              </div>
              <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[#8d83a6]">
                <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#b85cff] shadow-[0_0_10px_#b85cff]" />Private by default</span>
                <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#5679ff] shadow-[0_0_10px_#5679ff]" />Publish when ready</span>
              </div>
            </div>
          </div>
        </section>
      )}

       {builderOpen && (
        <Card className="border-primary/40 bg-surface/80 p-0 overflow-hidden">
          <div className="flex flex-col border-b border-border lg:flex-row">
            <div className="border-b border-border p-5 lg:w-56 lg:border-b-0 lg:border-e">
              <div className="mb-5 flex items-center gap-2 text-primary"><WandSparkles size={18} /><span className="font-semibold">Agent Builder</span></div>
              <div className="grid gap-1">
                {sections.map((section, index) => (
                  <button key={section} type="button" onClick={() => setActiveSection(section)} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-start text-sm ${activeSection === section ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-surface-hover"}`}>
                    <span className="flex h-6 w-6 items-center justify-center rounded-full border border-current text-[10px]">{index + 1}</span>{section}
                  </button>
                ))}
              </div>
              <div className="mt-6 rounded-2xl border border-border bg-background/60 p-3 text-xs leading-5 text-muted-foreground">
                <Save size={14} className="mb-2 text-primary" /> Drafts are saved to your Persian Dark Horse workspace when you save.
              </div>
            </div>

            <div className="min-w-0 flex-1 p-5 md:p-7">
              {activeSection === "Identity" && (
                <Section title="Identity" icon={<Bot size={18} />} description="Give your Agent a clear identity people can understand.">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Agent name">
                      <Input autoFocus value={form.name} onChange={(e) => update("name", e.target.value)} placeholder={isRtl ? `پیشنهاد: ${suggestedName}` : `Suggested: ${suggestedName}`} />
                      <p className="mt-1.5 text-xs text-muted-foreground">{isRtl ? `نام پیشنهادی — نام خودتان را انتخاب کنید یا از ${suggestedName} استفاده کنید.` : `Suggested name — choose your own or use ${suggestedName}.`}</p>
                    </Field>
                    <Field label="Username / slug"><Input value={form.slug} onChange={(e) => update("slug", e.target.value)} placeholder="telegram-builder" dir="ltr" /></Field>
                    <Field label="Category"><Input value={form.category} onChange={(e) => update("category", e.target.value)} placeholder="Programming, Business, Creative..." /></Field>
                    <Field label="Gender / voice identity">
                      <select value={form.gender} onChange={(e) => update("gender", e.target.value)} className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm">
                        <option value="unspecified">Not specified</option><option value="female">Female</option><option value="male">Male</option><option value="neutral">Neutral</option>
                      </select>
                    </Field>
                  </div>
                  <Field label="Short description"><Textarea value={form.description} onChange={(e) => update("description", e.target.value)} rows={3} placeholder="What is this Agent best at?" /></Field>
                  <Field label="Tags"><Input value={form.tags} onChange={(e) => update("tags", e.target.value)} placeholder="python, bots, automation" /></Field>
                  <div>
                    <Label>Avatars</Label>
                    <div className="grid grid-cols-2 gap-3 min-[420px]:grid-cols-3 sm:grid-cols-5">
                      <label className="flex aspect-square cursor-not-allowed flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 p-3 text-center text-xs text-primary">
                        <Upload size={20} />
                        <span>Upload avatar</span>
                        <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={() => setError("Permanent avatar uploads need managed App Storage, which is currently unavailable in this workspace. Choose a gallery avatar for now.")} />
                      </label>
                      {avatarChoices.map((choice) => <button type="button" key={choice.id} onClick={() => update("avatarUrl", choice.url)} aria-label={`Choose ${choice.label} Agent avatar`} aria-pressed={form.avatarUrl === choice.url} className={`min-w-0 overflow-hidden rounded-2xl border-2 p-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${form.avatarUrl === choice.url ? "border-primary" : "border-border"}`}><img src={choice.url} alt="" loading="lazy" className="aspect-square w-full rounded-xl object-cover" /><span className="mt-1 block truncate text-center text-xs text-muted-foreground">{choice.label}</span></button>)}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">Upload is shown first and will become permanent when managed App Storage is available. Gallery avatars are safe static assets.</p>
                  </div>
                </Section>
              )}

              {activeSection === "Instructions" && (
                <Section title="Natural language instructions" icon={<Sparkles size={18} />} description="Tell FEZI what the Agent should do. The builder detects a starting configuration for you.">
                  <Field label="What do you want your Agent to do?">
                    <Textarea value={form.purpose} onChange={(e) => update("purpose", e.target.value)} rows={7} placeholder="I want an Agent that creates Telegram bots, understands Python, explains code, and helps me debug and deploy..." />
                    <Button type="button" className="mt-3" onClick={() => void analyzePurpose()} disabled={busy === "analyze" || form.purpose.trim().length < 8}>{busy === "analyze" ? <LoaderCircle size={16} className="animate-spin" /> : <BrainCircuit size={16} />} Analyze request</Button>
                  </Field>
                  {analysis && <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4"><p className="mb-3 text-sm font-semibold">FEZI detected</p><div className="flex flex-wrap gap-2">{analysis.detected.map((item) => <span key={item.label} className="rounded-full border border-primary/30 px-3 py-1 text-xs text-primary"><Check size={12} className="me-1 inline" />{item.label}</span>)}</div></div>}
                  <Field label="System instructions"><Textarea value={form.systemInstructions} onChange={(e) => update("systemInstructions", e.target.value)} rows={7} placeholder="Describe the Agent's role, tone, boundaries, and how it should answer." /></Field>
                  <Field label="Developer instructions (advanced)"><Textarea value={form.developerInstructions} onChange={(e) => update("developerInstructions", e.target.value)} rows={5} placeholder="Optional technical behavior. Never put API keys or passwords here." /></Field>
                </Section>
              )}

              {activeSection === "Personality" && (
                <Section title="Personality and response style" icon={<Sparkles size={18} />} description="Choose how this Agent thinks, speaks, and treats the person chatting with it.">
                  <Field label="Response tone">
                    <select value={form.personality.tone} onChange={(e) => update("personality", { ...form.personality, tone: e.target.value })} className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm">
                      {["Balanced", "Warm and supportive", "Direct and concise", "Formal and expert", "Playful and energetic", "Persuasive and business-focused"].map((tone) => <option key={tone}>{tone}</option>)}
                    </select>
                  </Field>
                  <div>
                    <Label>Traits</Label>
                    <div className="mt-2 grid gap-3 sm:grid-cols-2">
                      {traitOptions.map((trait) => <label key={trait} className="flex cursor-pointer items-center gap-3 rounded-2xl border border-border bg-background/50 p-3 text-sm"><input type="checkbox" checked={form.personality.traits.includes(trait)} onChange={(e) => update("personality", { ...form.personality, traits: e.target.checked ? [...form.personality.traits, trait] : form.personality.traits.filter((item) => item !== trait) })} className="h-4 w-4 accent-primary" /><span>{trait}</span></label>)}
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    {([["warmth", "Warmth"], ["precision", "Precision"], ["creativity", "Creativity"]] as const).map(([key, label]) => <label key={key} className="space-y-2 rounded-2xl border border-border bg-background/50 p-4 text-sm"><span className="flex justify-between"><span>{label}</span><span className="font-mono text-primary">{form.personality[key]}/10</span></span><input type="range" min="1" max="10" value={form.personality[key]} onChange={(e) => update("personality", { ...form.personality, [key]: Number(e.target.value) })} className="w-full accent-primary" /></label>)}
                  </div>
                </Section>
              )}

              {activeSection === "Capabilities" && (
                <Section title="Capabilities" icon={<Sparkles size={18} />} description="Choose the jobs this Agent is allowed to discuss or perform. Backend checks remain authoritative.">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {capabilityOptions.map(([id, label]) => <label key={id} className="flex cursor-pointer items-center gap-3 rounded-2xl border border-border bg-background/50 p-4 hover:border-primary/50"><input type="checkbox" checked={form.capabilities.includes(label)} onChange={(e) => update("capabilities", e.target.checked ? [...form.capabilities, label] : form.capabilities.filter((item) => item !== label))} className="h-4 w-4 accent-primary" /><span className="text-sm">{label}</span></label>)}
                  </div>
                  <div className="mt-8 border-t border-border pt-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold">Social media and website</h3>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">Optional. Add secure links that people can open from this Agent’s profile.</p>
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={form.socialLinks.length >= 12}
                        data-testid="button-add-social-link"
                        onClick={() => update("socialLinks", [...form.socialLinks, { platform: "instagram", label: "", url: "" }])}
                      >
                        <Plus size={14} /> Add link
                      </Button>
                    </div>
                    <div className="mt-4 space-y-3">
                      {form.socialLinks.map((link, index) => (
                        <div key={index} className="grid gap-3 rounded-2xl border border-border bg-background/50 p-4 md:grid-cols-[150px_1fr_1.4fr_auto] md:items-end">
                          <Field label="Platform">
                            <select
                              value={link.platform}
                              data-testid={`select-social-platform-${index}`}
                              onChange={(event) => update("socialLinks", form.socialLinks.map((item, itemIndex) => itemIndex === index ? { ...item, platform: event.target.value as AgentSocialLink["platform"] } : item))}
                              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm"
                            >
                              {["instagram", "threads", "facebook", "x", "tiktok", "linkedin", "website", "other"].map((platform) => <option key={platform} value={platform}>{platform === "x" ? "X" : platform.charAt(0).toUpperCase() + platform.slice(1)}</option>)}
                            </select>
                          </Field>
                          <Field label="Label">
                            <Input
                              value={link.label}
                              dir="ltr"
                              maxLength={80}
                              data-testid={`input-social-label-${index}`}
                              placeholder="@username or Website"
                              onChange={(event) => update("socialLinks", form.socialLinks.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item))}
                            />
                          </Field>
                          <Field label="HTTPS URL">
                            <Input
                              value={link.url}
                              type="url"
                              dir="ltr"
                              data-testid={`input-social-url-${index}`}
                              placeholder="https://..."
                              onChange={(event) => update("socialLinks", form.socialLinks.map((item, itemIndex) => itemIndex === index ? { ...item, url: event.target.value } : item))}
                            />
                          </Field>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            data-testid={`button-remove-social-link-${index}`}
                            aria-label={`Remove social link ${index + 1}`}
                            onClick={() => update("socialLinks", form.socialLinks.filter((_, itemIndex) => itemIndex !== index))}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      ))}
                      {form.socialLinks.length === 0 && <p className="rounded-2xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">No social links added. This section will stay hidden on the Agent profile.</p>}
                    </div>
                  </div>
                </Section>
              )}

              {activeSection === "Knowledge" && (
                <Section title="Knowledge" icon={<FileText size={18} />} description="Paste trusted reference material or load a text/data file. Knowledge is isolated to this Agent.">
                  <Field label="Knowledge text / company data"><Textarea value={form.knowledgeText} onChange={(e) => update("knowledgeText", e.target.value)} rows={14} placeholder="Paste brand guidelines, product facts, policies, or reference notes here..." /></Field>
                  <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-4 text-sm"><Upload size={18} className="text-primary" /><span><strong>Import TXT, MD, CSV, or JSON</strong><span className="block text-xs text-muted-foreground">Text is extracted in your browser and stored as Agent knowledge.</span></span><input type="file" accept=".txt,.md,.csv,.json,text/plain,application/json" className="hidden" onChange={async (e) => { const file = e.target.files?.[0]; if (file) update("knowledgeText", await file.text()); }} /></label>
                </Section>
              )}

              {activeSection === "Tools & API" && (
                <Section title="Tools and API" icon={<Code2 size={18} />} description="Give the Agent only the tools it needs and optionally expose a server-side API.">
                  <div className="grid gap-3 sm:grid-cols-2">{toolOptions.map((tool) => <label key={tool} className="flex cursor-pointer items-center gap-3 rounded-2xl border border-border bg-background/50 p-4"><input type="checkbox" checked={form.tools.includes(tool)} onChange={(e) => update("tools", e.target.checked ? [...form.tools, tool] : form.tools.filter((item) => item !== tool))} className="h-4 w-4 accent-primary" /><span className="text-sm">{tool}</span></label>)}</div>
                  <div className="mt-6">
                    <h3 className="text-sm font-semibold">Persian Dark Horse Apps</h3>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">Choose which Apps this Agent may use. Only checked Apps are saved in the Agent configuration.</p>
                    <div className="mt-3 grid max-h-80 gap-2 overflow-y-auto rounded-2xl border border-border bg-background/30 p-3 sm:grid-cols-2">
                      {agentAppOptions.map((app) => {
                        const value = `app:${app}`;
                        return (
                          <label key={app} className="flex cursor-pointer items-center gap-3 rounded-xl border border-border/70 bg-background/60 p-3">
                            <input type="checkbox" checked={form.tools.includes(value)} onChange={(event) => update("tools", event.target.checked ? [...form.tools, value] : form.tools.filter((item) => item !== value))} className="h-4 w-4 accent-primary" />
                            <span className="text-xs font-medium">{app}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  <div className="mt-6 grid gap-3 md:grid-cols-2">
                    <Toggle label="Conversation memory" checked={form.memoryEnabled} onChange={(value) => update("memoryEnabled", value)} />
                    <Toggle label="Enable Agent API" checked={form.apiEnabled} onChange={(value) => update("apiEnabled", value)} />
                  </div>
                  <Field label="Mother AI / primary model"><Input value={form.model} onChange={(e) => update("model", e.target.value)} dir="ltr" placeholder="qwen/qwen3.8-27b" /></Field>
                  <div>
                    <Label>Connected AI models</Label>
                    <p className="mb-3 mt-1 text-xs text-muted-foreground">Select the models this Agent is allowed to use alongside its mother AI.</p>
                    <div className="grid gap-3 sm:grid-cols-2">{modelOptions.map(([id, label]) => <label key={id} className="flex cursor-pointer items-center gap-3 rounded-2xl border border-border bg-background/50 p-3 text-sm"><input type="checkbox" checked={form.connectedModels.includes(id)} onChange={(e) => update("connectedModels", e.target.checked ? [...form.connectedModels, id] : form.connectedModels.filter((item) => item !== id))} className="h-4 w-4 accent-primary" /><span>{label}</span><span className="ms-auto text-[10px] text-muted-foreground" dir="ltr">{id}</span></label>)}</div>
                  </div>
                </Section>
              )}

              {activeSection === "Visibility" && (
                <Section
                  title={isRtl ? "نمایان بودن" : "Visibility"}
                  icon={<Eye size={18} />}
                  description={isRtl
                    ? "انتخاب کنید این Agent فقط برای شما باشد، با پیوند به‌اشتراک گذاشته شود یا برای همه نمایش داده شود."
                    : "Choose whether this Agent is only yours, shareable by link, or listed for everyone."}
                >
                  <div className="grid gap-3">{visibilityOptions.map(([value, title, desc, Icon]) => {
                    const localizedTitle = isRtl
                      ? ({ private: "خصوصی", unlisted: "فقط با پیوند", public: "عمومی" } as const)[value]
                      : title;
                    const localizedDescription = isRtl
                      ? ({
                        private: "فقط شما می‌توانید به آن دسترسی داشته باشید.",
                        unlisted: "قابل کشف نیست، اما هرکسی که پیوند را داشته باشد می‌تواند از آن استفاده کند.",
                        public: "آن را برای جامعه در فهرست Agentهای دیگر قرار دهید.",
                      } as const)[value]
                      : desc;
                    return (
                      <button type="button" key={String(value)} onClick={() => update("visibility", value)} className={`flex items-start gap-4 rounded-2xl border p-4 text-start ${form.visibility === value ? "border-primary bg-primary/5" : "border-border"}`}>
                        <Icon size={19} className="mt-0.5 text-primary" />
                        <span><strong className="block text-sm">{localizedTitle}</strong><span className="mt-1 block text-xs text-muted-foreground">{localizedDescription}</span></span>
                      </button>
                    );
                  })}</div>
                  <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm leading-6">
                    <strong>{isRtl ? "پیش‌فرض: اشتراک با همه" : "Default: shared with everyone"}</strong>
                    <p className="text-xs text-muted-foreground">{isRtl
                      ? "Agent بعد از انتشار در فهرست Agentهای عمومی ذخیره می‌شود و تا وقتی خودت حذفش نکنی باقی می‌ماند. برای استفاده‌ی شخصی، گزینه‌ی «خصوصی» را انتخاب کن."
                      : "After publishing, the Agent appears in the public Agents list and stays there until you remove it. Choose Private for personal use."}</p>
                  </div>
                </Section>
              )}

               {activeSection === "Website" && (
                 <WebsiteSection
                   editingId={editingId}
                   site={site}
                   siteCatalogue={siteCatalogue}
                   siteEntitled={siteEntitled}
                   siteLoading={siteLoading || siteBusy === "load"}
                   siteStatusError={siteStatusError}
                   siteError={siteError}
                   siteNotice={siteNotice}
                   siteBusy={siteBusy}
                    siteCurrencies={siteCurrencies}
                    siteCurrencyId={siteCurrencyId}
                    siteQuote={siteQuote}
                    siteTxId={siteTxId}
                    sitePaymentBusy={sitePaymentBusy}
                   onRetry={() => void loadSiteResources()}
                   onChange={(next) => setSite((current) => ({ ...current, ...next }))}
                   onSave={() => void saveSite()}
                    onQuotePayment={(currencyId) => void quoteSitePayment(currencyId)}
                    onTxChange={setSiteTxId}
                    onSubmitPayment={() => void submitSitePayment()}
                 />
               )}

               {activeSection === "Preview" && (
                <Section title="Preview and publish" icon={<Eye size={18} />} description="Review the public information before saving this Agent. Private instructions and knowledge are never shown in discovery.">
                  <div className="rounded-3xl border border-border bg-background p-5"><div className="flex items-center gap-4"><img src={form.avatarUrl || customAgentMaker} alt="" className="h-16 w-16 rounded-2xl object-cover" /><div><h3 className="text-xl font-semibold">{form.name || "Unnamed Agent"}</h3><p className="text-sm text-primary">{form.category} · {form.visibility}</p></div></div><p className="mt-5 text-sm leading-6 text-muted-foreground">{form.description || "Add a description in Identity."}</p><div className="mt-4 flex flex-wrap gap-2">{previewTags.map((tag) => <span key={tag} className="rounded-full bg-surface px-3 py-1 text-xs">{tag}</span>)}</div><div className="mt-5 grid gap-3 text-xs text-muted-foreground sm:grid-cols-3"><span>Tone: {form.personality.tone}</span><span>Mother AI: {form.model}</span><span>Connected models: {form.connectedModels.length}</span></div></div>
                  <div className="mt-5 flex flex-wrap gap-3"><Button onClick={() => void saveAgent("draft")} disabled={busy === "save"}><Save size={16} /> Save Draft</Button><Button onClick={() => void saveAgent("active")} disabled={busy === "save"}><Globe2 size={16} /> Publish Agent</Button><Button variant="ghost" onClick={() => setBuilderOpen(false)}><X size={16} /> Cancel</Button></div>
                </Section>
              )}

              {activeSection !== "Preview" && <div className="mt-8 flex justify-end"><Button type="button" onClick={() => setActiveSection(sections[Math.min(sections.indexOf(activeSection) + 1, sections.length - 1)])}>Continue <ChevronRight size={16} /></Button></div>}
            </div>
          </div>
        </Card>
      )}

      <section id="agent-discovery" className="scroll-mt-6">
        <div className="mb-4 flex items-end justify-between"><div><h2 className="text-xl font-bold">Your Agents</h2><p className="mt-1 text-sm text-muted-foreground">{used} of {Number.isFinite(limit) ? limit : "unlimited"} Agent slots used</p></div><div className="h-2 w-32 overflow-hidden rounded-full bg-surface"><div className="h-full bg-primary" style={{ width: `${Number.isFinite(limit) ? Math.min(100, (used / limit) * 100) : 12}%` }} /></div></div>
         <Card className="mb-4 border-primary/30 bg-primary/5"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-semibold">Google verification required for API keys</h3><p className="mt-1 text-sm text-muted-foreground" data-testid="status-custom-agent-google">{googleAccess.loading ? "Checking your connected Google account…" : googleAccess.error || (googleAccess.verified ? "Google verified. API keys can be issued for eligible Agents." : "Connect and verify Google in your profile before creating any API key. A Gmail address alone is not sufficient.")}</p></div>{!googleAccess.verified && <div className="flex flex-wrap gap-2"><Button type="button" variant="secondary" className="min-h-11 shrink-0" onClick={googleAccess.openGoogleLink} disabled={!isLoaded} data-testid="button-custom-agent-link-google">{isSignedIn ? "Connect Google in profile" : "Sign in to connect Google"}</Button><Button type="button" variant="secondary" className="min-h-11" onClick={() => void googleAccess.refresh()} data-testid="button-custom-agent-refresh-google">Recheck status</Button></div>}</div></Card>
         {agents.length === 0 ? <Card className="border-dashed text-center"><Bot size={36} className="mx-auto mb-3 text-muted-foreground/40" /><p className="font-medium">No custom Agents yet</p><p className="mt-1 text-sm text-muted-foreground">Create one and make your idea usable.</p></Card> : <div className="grid gap-4 md:grid-cols-2">{agents.map((agent) => <AgentCard key={agent.id} agent={agent} site={siteSummaries[agent.id]} onEdit={() => void openEdit(agent.id)} onDelete={() => void deleteAgent(agent.id)} onKey={() => void generateKey(agent.id)} keyBusy={busy === `key:${agent.id}`} keyAllowed={googleAccess.verified} editBusy={busy === `edit:${agent.id}`} deleteBusy={busy === agent.id} />)}</div>}
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between"><div><h2 className="text-xl font-bold">Other Agents</h2><p className="mt-1 text-sm text-muted-foreground">Public Agents shared by the Persian Dark Horse community.</p></div><Search size={18} className="text-muted-foreground" /></div>
        {discover.length === 0 ? <Card className="border-dashed text-center"><Library size={34} className="mx-auto mb-3 text-muted-foreground/40" /><p className="text-sm text-muted-foreground">Public Agents will appear here.</p></Card> : <div className="grid gap-4 md:grid-cols-3">{discover.map((agent) => <Card key={agent.id} className="p-5"><div className="flex items-center gap-3"><img src={agent.avatarUrl || defaultAgentAvatar} alt="" className="h-11 w-11 rounded-xl object-cover" /><div className="min-w-0"><h3 className="truncate font-semibold">{agent.name}</h3><p className="text-xs text-muted-foreground">{agent.category}</p></div></div><p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{agent.description}</p>{agent.socialLinks.length > 0 && <div className="mt-4"><AgentSocialLinks links={agent.socialLinks} compact /></div>}<Link href={`/${encodeURIComponent(agent.slug || agent.id)}`} className="mt-4 inline-flex text-sm font-semibold text-primary">Try Agent <ChevronRight size={15} /></Link></Card>)}</div>}
      </section>

      {newKey && newKeyOwner.current === userId && <div className="fixed inset-x-4 bottom-5 z-50 mx-auto max-w-xl rounded-2xl border border-primary/50 bg-surface p-5 shadow-2xl"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><h3 className="font-semibold">Copy your Agent API key now</h3><p className="mt-1 text-xs text-muted-foreground">It will not be shown again.</p></div><button type="button" onClick={() => setNewKey("")} aria-label="Close API key" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"><X size={18} /></button></div><div className="mt-4 flex min-w-0 flex-col gap-2 sm:flex-row"><Input value={newKey} readOnly dir="ltr" className="min-w-0 w-full font-mono sm:flex-1" /><Button size="sm" className="min-h-11 w-full sm:w-auto" onClick={() => void navigator.clipboard?.writeText(newKey)}><Copy size={15} /> Copy</Button></div></div>}
    </div>
  );
}

function WebsiteSection({
  editingId,
  site,
  siteCatalogue,
  siteEntitled,
  siteLoading,
  siteStatusError,
  siteError,
  siteNotice,
  siteBusy,
  siteCurrencies,
  siteCurrencyId,
  siteQuote,
  siteTxId,
  sitePaymentBusy,
  onRetry,
  onChange,
  onSave,
  onQuotePayment,
  onTxChange,
  onSubmitPayment,
}: {
  editingId: string | null;
  site: AgentSite;
  siteCatalogue: SiteCapability[];
  siteEntitled: boolean;
  siteLoading: boolean;
  siteStatusError: string;
  siteError: string;
  siteNotice: string;
  siteBusy: string;
  siteCurrencies: PaymentCurrency[];
  siteCurrencyId: string | null;
  siteQuote: { address?: string; warning?: string } | null;
  siteTxId: string;
  sitePaymentBusy: boolean;
  onRetry: () => void;
  onChange: (next: Partial<AgentSite>) => void;
  onSave: () => void;
  onQuotePayment: (currencyId: string) => void;
  onTxChange: (value: string) => void;
  onSubmitPayment: () => void;
}) {
  if (!editingId) {
    return (
      <Section title="Agent website" icon={<Globe2 size={18} />} description="Give this Agent a polished public home on the web.">
        <div className="rounded-3xl border border-dashed border-primary/35 bg-primary/5 p-6">
          <div className="flex items-start gap-3">
            <Info size={18} className="mt-0.5 shrink-0 text-primary" />
            <div>
              <h3 className="font-semibold">Save your Agent before adding a website</h3>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">The website is attached to a saved Agent. Save this Agent as a draft or publish it, then come back here to configure the site.</p>
            </div>
          </div>
        </div>
      </Section>
    );
  }

  if (siteLoading) {
    return (
      <Section title="Agent website" icon={<Globe2 size={18} />} description="Loading your website entitlement and settings.">
        <div className="space-y-3">
          <div className="h-28 animate-pulse rounded-3xl bg-surface" />
          <div className="h-40 animate-pulse rounded-3xl bg-surface" />
          <div className="h-24 animate-pulse rounded-3xl bg-surface" />
        </div>
      </Section>
    );
  }

  if (siteStatusError && !siteStatusError.includes("catalogue")) {
    return (
      <Section title="Agent website" icon={<Globe2 size={18} />} description="Persian Dark Horse checks the website subscription before showing the editor.">
        <div className="rounded-3xl border border-red-500/30 bg-red-500/5 p-5">
          <p className="text-sm text-red-300">{siteStatusError}</p>
          <Button type="button" variant="secondary" size="sm" className="mt-4" onClick={onRetry}><RefreshCw size={14} /> Try again</Button>
        </div>
      </Section>
    );
  }

  if (!siteEntitled) {
    const selectedCurrency = siteCurrencies.find((currency) => currency.id === siteCurrencyId);
    const paymentAddress = siteQuote?.address || selectedCurrency?.address || "";
    return (
      <Section title="Agent website" icon={<Globe2 size={18} />} description="A focused public surface for your Agent, hosted by Persian Dark Horse.">
        <div className="overflow-hidden rounded-3xl border border-primary/35 bg-[radial-gradient(circle_at_top_right,rgba(229,185,90,0.18),transparent_48%),hsl(var(--background))] p-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-xl">
              <span className="inline-flex rounded-full border border-primary/35 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Agent-site</span>
              <h3 className="mt-4 text-2xl font-bold">A home for your Agent, outside the dashboard.</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Publish a branded page with your Agent’s voice, capabilities, and a direct way for visitors to start a conversation.</p>
            </div>
            <div className="shrink-0 rounded-2xl border border-primary/30 bg-background/70 px-4 py-3 text-left sm:text-right">
              <p className="text-2xl font-bold text-primary">$20<span className="text-xs font-medium text-muted-foreground"> / month</span></p>
              <p className="mt-1 text-[11px] text-muted-foreground">Purchased here, after saving the Agent</p>
            </div>
          </div>
          <div className="mt-6 border-t border-border/70 pt-5">
            <p className="text-sm font-semibold">Choose a crypto network</p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {siteCurrencies.map((currency) => <button type="button" key={currency.id} onClick={() => onQuotePayment(currency.id)} className={`rounded-xl border p-3 text-start transition-colors ${siteCurrencyId === currency.id ? "border-primary bg-primary/10" : "border-border bg-background/50 hover:border-primary/50"}`}><span className="text-xs font-semibold">{currency.label}</span><span className="mt-1 block text-[10px] text-muted-foreground">{currency.network}</span></button>)}
            </div>
            {siteCurrencyId && selectedCurrency && (
              <div className="mt-4 grid gap-5 md:grid-cols-[180px_1fr]">
                <div className="flex flex-col items-center gap-2">
                  {sitePaymentBusy && !paymentAddress ? <div className="flex h-[170px] w-[170px] items-center justify-center rounded-2xl border border-border bg-background"><LoaderCircle size={24} className="animate-spin text-primary" /></div> : paymentAddress ? <img src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=10&data=${encodeURIComponent(paymentAddress)}`} alt="Agent website payment QR code" className="h-[170px] w-[170px] rounded-2xl bg-white p-2" /> : <div className="flex h-[170px] w-[170px] items-center justify-center rounded-2xl border border-border bg-background text-center text-xs text-muted-foreground">Choose a network</div>}
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground"><QrCode size={13} /> Website payment QR</span>
                </div>
                <div className="space-y-3">
                  <div className="rounded-xl border border-primary/20 bg-background/60 p-4"><p className="text-xs text-muted-foreground">Send exactly</p><p className="mt-1 text-xl font-bold text-primary" dir="ltr">$20.00</p><p className="mt-1 break-all font-mono text-[10px] text-muted-foreground" dir="ltr">{paymentAddress}</p><p className="mt-2 text-xs text-amber-500">{siteQuote?.warning || "Use the selected network. Wrong-network transfers can be lost."}</p></div>
                  <div className="flex flex-col gap-2 sm:flex-row"><input value={siteTxId} onChange={(event) => onTxChange(event.target.value)} placeholder="Transaction hash / TXID" dir="ltr" className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-xs outline-none focus:border-primary" /><Button type="button" onClick={onSubmitPayment} disabled={!siteTxId.trim() || sitePaymentBusy}>{sitePaymentBusy ? <LoaderCircle size={15} className="animate-spin" /> : <CreditCard size={15} />}{sitePaymentBusy ? "Submitting…" : "Submit TXID"}</Button></div>
                  <p className="text-xs leading-5 text-muted-foreground">Payment remains pending until Admin verifies it. Website settings unlock only after approval.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </Section>
    );
  }

  return (
    <Section title="Agent website" icon={<Globe2 size={18} />} description="Shape the public surface visitors will see when they meet this Agent.">
      {siteError && <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{siteError}</div>}
      {siteNotice && <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{siteNotice}</div>}

      <div className="rounded-3xl border border-primary/25 bg-primary/5 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-semibold">Make this Agent available on the web</h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">Visitors can only reach the site when it is enabled and the Agent has been published.</p>
          </div>
          <Toggle label="Website enabled" checked={site.enabled} onChange={(enabled) => onChange({ enabled })} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Website title"><Input value={site.title} onChange={(event) => onChange({ title: event.target.value })} placeholder="e.g. Mira · Your Telegram co-pilot" /></Field>
        <div className="rounded-2xl border border-border bg-background/50 p-4 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground">Public URL</p>
          <p className="mt-2 break-all font-mono text-[11px] text-primary" dir="ltr">{site.publicUrl || "Generated after the site is enabled"}</p>
        </div>
      </div>
      <Field label="Introduction"><Textarea value={site.intro} onChange={(event) => onChange({ intro: event.target.value })} rows={4} placeholder="A short welcome that tells visitors who this Agent is and what it can help with." /></Field>

      <div>
        <Label>Visual direction</Label>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {siteThemes.map((theme) => (
            <button type="button" key={theme.id} onClick={() => onChange({ theme: theme.id })} className={`rounded-2xl border p-4 text-start transition-all ${site.theme === theme.id ? "border-primary bg-primary/10 shadow-[0_0_20px_rgba(229,185,90,0.12)]" : "border-border bg-background/50 hover:border-primary/50"}`}>
              <span className="flex items-center gap-2">
                <span className="flex -space-x-1" aria-hidden="true">{theme.swatches.map((swatch) => <span key={swatch} className="h-6 w-6 rounded-full border-2 border-background" style={{ backgroundColor: swatch }} />)}</span>
                <span className="text-sm font-semibold">{theme.label}</span>
                {site.theme === theme.id && <Check size={15} className="ms-auto text-primary" />}
              </span>
              <span className="mt-3 block text-xs leading-5 text-muted-foreground">{theme.description}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div><Label>Capabilities catalogue</Label><p className="text-xs text-muted-foreground">Show only the jobs this Agent is ready to take on.</p></div>
          <span className="text-xs font-mono text-primary">{site.capabilities.length} selected</span>
        </div>
        {siteCatalogue.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">
            {siteStatusError ? siteStatusError : "The capability catalogue is empty. Try again when the Agent-site catalogue is available."}
            <Button type="button" size="sm" variant="ghost" className="mt-3" onClick={onRetry}><RefreshCw size={14} /> Refresh catalogue</Button>
          </div>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {siteCatalogue.map((capability) => {
              const selected = site.capabilities.includes(capability.id);
              return <button type="button" key={capability.id} onClick={() => onChange({ capabilities: selected ? site.capabilities.filter((id) => id !== capability.id) : [...site.capabilities, capability.id] })} className={`flex items-start gap-3 rounded-2xl border p-4 text-start transition-all ${selected ? "border-primary/60 bg-primary/5" : "border-border bg-background/50 hover:border-primary/40"}`}><span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${selected ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{selected && <Check size={13} />}</span><span><strong className="block text-sm">{capability.label}</strong><span className="mt-1 block text-xs leading-5 text-muted-foreground">{capability.purpose || "A capability available to visitors on this Agent-site."}</span></span></button>;
            })}
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-border bg-background/50 p-5">
        <div className="flex items-start gap-3">
          <Globe2 size={18} className="mt-0.5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold">Custom domain</h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">Optional. Enter a domain you control; Persian Dark Horse will provide the next verification step after you save.</p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <Input value={site.customDomain} onChange={(event) => onChange({ customDomain: event.target.value })} placeholder="agent.yourdomain.com" dir="ltr" />
              <Button type="button" variant="secondary" onClick={onSave} disabled={siteBusy === "save"}>{siteBusy === "save" ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />} Save settings</Button>
            </div>
            {site.customDomain.trim() && <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-amber-300"><Info size={14} className="mt-0.5 shrink-0" />DNS and SSL are pending until Persian Dark Horse verifies this domain. This screen does not claim the custom domain is live.</p>}
            {site.domainStatus && site.domainStatus !== "not_configured" && <p className="mt-2 text-xs text-muted-foreground">Server-reported domain status: <span className="font-mono text-foreground">{site.domainStatus}</span>. Check again after making the requested DNS changes.</p>}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center">
        <Button type="button" onClick={onSave} disabled={siteBusy === "save"}>{siteBusy === "save" ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />} Save website</Button>
        <p className="text-xs text-muted-foreground">Changes are saved to this Agent-site only; they do not alter your Agent instructions.</p>
      </div>
    </Section>
  );
}

function Section({ title, description, icon, children }: { title: string; description: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <div className="space-y-5"><div className="flex items-start gap-3"><div className="rounded-xl bg-primary/10 p-2 text-primary">{icon}</div><div><h2 className="text-2xl font-bold">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{description}</p></div></div>{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-border bg-background/50 p-4 text-sm"><span>{label}</span><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-primary" /></label>;
}

function AgentCard({ agent, site, onEdit, onDelete, onKey, keyBusy, keyAllowed, editBusy, deleteBusy }: { agent: CustomAgent; site?: AgentSite; onEdit: () => void; onDelete: () => void; onKey: () => void; keyBusy: boolean; keyAllowed: boolean; editBusy: boolean; deleteBusy: boolean }) {
  return <Card className="p-5"><div className="flex items-start justify-between gap-4"><div className="flex min-w-0 items-center gap-3"><img src={agent.avatarUrl || defaultAgentAvatar} alt="" className="h-14 w-14 rounded-2xl object-cover" /><div className="min-w-0"><h3 className="truncate text-lg font-semibold">{agent.name}</h3><p className="text-xs text-primary">{agent.category} · {agent.visibility}</p></div></div><span className={`rounded-full px-2.5 py-1 text-[10px] uppercase ${agent.status === "active" ? "bg-emerald-500/15 text-emerald-400" : "bg-surface text-muted-foreground"}`}>{agent.status}</span></div><p className="mt-4 line-clamp-2 text-sm leading-6 text-muted-foreground">{agent.description || "No description yet."}</p><div className="mt-4 flex flex-wrap gap-2">{agent.capabilities.slice(0, 3).map((item) => <span key={item} className="rounded-full bg-surface px-2.5 py-1 text-[10px]">{item}</span>)}</div>{agent.socialLinks.length > 0 && <div className="mt-4"><AgentSocialLinks links={agent.socialLinks} compact /></div>}{site?.enabled && <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary"><span className="flex items-center gap-2"><Globe2 size={14} />Agent-site is enabled{site.publicUrl && <span className="ms-auto text-muted-foreground">Public</span>}</span></div>}<div className="mt-5 flex flex-wrap gap-2"><Link href={`/${encodeURIComponent(agent.slug || agent.id)}`}><Button size="sm"><Bot size={14} /> Chat</Button></Link>{site?.enabled && site.publicUrl && <a href={site.publicUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary/40 px-3 py-1.5 text-xs font-medium text-primary transition-all hover:bg-primary/10"><Globe2 size={14} /> Agent-site <ExternalLink size={13} /></a>}{site?.enabled && !site.publicUrl && <span className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-1.5 text-xs text-muted-foreground"><Globe2 size={14} /> Site URL pending</span>}<Button size="sm" variant="secondary" onClick={onEdit} disabled={editBusy}><Edit2 size={14} /> {editBusy ? "Loading..." : "Edit"}</Button><Button size="sm" variant="secondary" onClick={onKey} disabled={keyBusy || !keyAllowed}><KeyRound size={14} /> {keyBusy ? "Creating..." : keyAllowed ? "API key" : "Verify Google for API key"}</Button><Button size="sm" variant="danger" onClick={onDelete} disabled={deleteBusy}><Trash2 size={14} /></Button></div></Card>;
}