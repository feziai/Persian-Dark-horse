import { FormEvent, useEffect, useState } from "react";
import { useParams } from "wouter";
import { ArrowUpRight, Bot, LoaderCircle, Send } from "lucide-react";
import { AgentSocialLinks, type AgentSocialLink } from "../components/AgentSocialLinks";

type Site = {
  name: string;
  slug: string;
  description: string;
  avatarUrl?: string | null;
  title: string;
  intro: string;
  theme: "midnight" | "pearl" | "forest" | "sunset" | "ocean";
  capabilities: string[];
  socialLinks: AgentSocialLink[];
  publicUrl: string;
};

const themeClasses: Record<Site["theme"], { page: string; panel: string; accent: string }> = {
  midnight: { page: "bg-[#0d111c] text-[#f4f1e8]", panel: "border-white/10 bg-white/[0.05]", accent: "text-[#e4b85e]" },
  pearl: { page: "bg-[#f5f0e7] text-[#1f2937]", panel: "border-black/10 bg-white/70", accent: "text-[#384d72]" },
  forest: { page: "bg-[#102019] text-[#ecf4e8]", panel: "border-white/10 bg-white/[0.06]", accent: "text-[#9fc8a8]" },
  sunset: { page: "bg-[#321d22] text-[#fff1e6]", panel: "border-white/10 bg-white/[0.06]", accent: "text-[#f2ad79]" },
  ocean: { page: "bg-[#102831] text-[#eaf8fb]", panel: "border-white/10 bg-white/[0.06]", accent: "text-[#7ed2df]" },
};

export default function PublicAgentSite() {
  const { slug = "" } = useParams<{ slug: string }>();
  const [site, setSite] = useState<Site | null>(null);
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetch(`/api/agent-sites/${encodeURIComponent(slug)}`, { credentials: "omit" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "This Agent website is not available.");
        setSite(data.site as Site);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "This Agent website is not available."))
      .finally(() => setLoading(false));
  }, [slug]);

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
    if (!message.trim() || sending) return;
    setSending(true);
    setError("");
    try {
      const response = await fetch(`/api/agent-sites/${encodeURIComponent(slug)}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "omit",
        body: JSON.stringify({ message }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The Agent could not reply.");
      setReply(data.message || "");
      setMessage("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The Agent could not reply.");
    } finally {
      setSending(false);
    }
  };

  if (loading) return <main className="flex min-h-[100dvh] items-center justify-center bg-[#0d111c] text-[#e4b85e]"><LoaderCircle className="animate-spin" /></main>;
  if (!site) return <main className="flex min-h-[100dvh] items-center justify-center bg-[#0d111c] px-5 text-center text-[#f4f1e8]"><div><Bot className="mx-auto mb-4 text-[#e4b85e]" size={32} /><h1 className="text-2xl font-semibold">Agent website unavailable</h1><p className="mt-2 text-sm text-white/60">{error}</p></div></main>;

  const theme = themeClasses[site.theme] ?? themeClasses.midnight;
  return (
    <main className={`min-h-[100dvh] ${theme.page}`}>
      <div className="mx-auto grid min-h-[100dvh] max-w-5xl gap-6 px-5 py-6 md:px-8 md:py-10 lg:grid-cols-[.85fr_1.15fr] lg:items-center">
        <section>
          <div className="flex items-center gap-3">
            {site.avatarUrl ? <img src={site.avatarUrl} alt="" className="h-14 w-14 rounded-2xl object-cover" /> : <div className={`flex h-14 w-14 items-center justify-center rounded-2xl border ${theme.panel}`}><Bot size={24} /></div>}
            <div><p className={`text-xs font-semibold uppercase tracking-[0.24em] ${theme.accent}`}>Persian Dark Horse Agent</p><p className="mt-1 text-sm opacity-60">{site.name}</p></div>
          </div>
          <h1 className="mt-8 text-4xl font-bold leading-tight md:text-6xl">{site.title}</h1>
          <p className="mt-5 max-w-xl text-base leading-8 opacity-70">{site.intro}</p>
          <div className="mt-7 flex flex-wrap gap-2">{site.capabilities.map((capability) => <span key={capability} className={`rounded-full border px-3 py-1.5 text-xs ${theme.panel}`}>{capability}</span>)}</div>
          {site.socialLinks?.length > 0 && <div className="mt-7"><AgentSocialLinks links={site.socialLinks} title="Social media" /></div>}
          <a href="https://fezi.ai" className={`mt-8 inline-flex items-center gap-2 text-sm font-semibold ${theme.accent}`}>Built with Persian Dark Horse <ArrowUpRight size={15} /></a>
        </section>
        <section className={`rounded-[2rem] border p-4 shadow-2xl backdrop-blur md:p-6 ${theme.panel}`}>
          <div className="min-h-[360px] rounded-[1.4rem] border border-current/10 bg-black/10 p-4 md:p-5">
            {reply ? <div className="max-w-[90%] rounded-2xl rounded-es-sm bg-black/15 p-4 text-sm leading-7">{reply}</div> : <p className="text-sm opacity-50">Ask {site.name} anything within its purpose.</p>}
          </div>
          <form onSubmit={sendMessage} className="mt-4 flex gap-2">
            <input value={message} onChange={(event) => setMessage(event.target.value)} placeholder={`Message ${site.name}...`} className="min-w-0 flex-1 rounded-xl border border-current/15 bg-black/10 px-4 py-3 text-sm outline-none placeholder:opacity-50 focus:border-current/40" />
            <button type="submit" disabled={sending || !message.trim()} className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-current disabled:opacity-40 ${site.theme === "pearl" ? "text-white" : "text-[#111827]"}`} aria-label="Send message">{sending ? <LoaderCircle size={17} className="animate-spin" /> : <Send size={17} />}</button>
          </form>
          {error && <p className="mt-3 text-xs text-red-300">{error}</p>}
          <p className="mt-4 text-center text-[11px] opacity-45">Responses use the Agent owner's Persian Dark Horse Credits.</p>
        </section>
      </div>
    </main>
  );
}