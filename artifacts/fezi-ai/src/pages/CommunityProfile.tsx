import { useCallback, useEffect, useState } from 'react';
import { Link, useRoute } from 'wouter';
import { Ban, ExternalLink, Flag, Link2, Mail, Pencil, Plus, Sparkles, Trash2, UserRoundX } from 'lucide-react';
import { requestGuestAccount } from '../lib/auth-gate';
import {
  formatCount, linkLabel, safeHref, useCommunityApi, useCommunityCopy, useCommunityViewer, type Creation, type Profile,
} from '../lib/community';
import { CommunityHeader } from '../components/community/CommunityHeader';
import { FeedList } from '../components/community/FeedList';
import { CommunityAvatar, EmptyState, ErrorState, PillButton, ProBadge, Sheet } from '../components/community/primitives';
import { ReportSheet } from '../components/community/ReportSheet';
import { useFeed } from '../components/community/useFeed';
import { useToast } from '../hooks/use-toast';
import { cn } from '../lib/utils';

function EditProfileSheet({ open, onClose, profile, onSaved }: { open: boolean; onClose: () => void; profile: Profile; onSaved: (p: Profile) => void }) {
  const { c } = useCommunityCopy();
  const api = useCommunityApi();
  const [bio, setBio] = useState(profile.bio);
  const [links, setLinks] = useState<string[]>(profile.links.length ? profile.links : ['']);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setBio(profile.bio); setLinks(profile.links.length ? profile.links : ['']); setError(''); } }, [open, profile]);

  const save = async () => {
    const clean = links.map((l) => l.trim()).filter(Boolean);
    if (clean.some((l) => !/^https:\/\//i.test(l) || !safeHref(l))) { setError(c.linkInvalid); return; }
    setBusy(true); setError('');
    try {
      const res = await api<{ profile: Profile }>('/community/profile', { method: 'PATCH', body: JSON.stringify({ bio: bio.trim(), links: clean }) });
      onSaved(res.profile); onClose();
    } catch (e) { setError(e instanceof Error ? e.message : c.errorLoad); } finally { setBusy(false); }
  };

  return (
    <Sheet open={open} onClose={onClose} title={c.editProfile}>
      <p className="mb-4 rounded-xl bg-primary/5 px-3 py-2 text-xs text-muted-foreground">{c.avatarNote} <Link href="/settings" className="font-semibold text-primary underline-offset-2 hover:underline">Settings</Link></p>
      <label className="block text-sm font-medium">{c.bio}
        <textarea value={bio} onChange={(e) => setBio(e.target.value.slice(0, 280))} rows={4} dir="auto" className="mt-1 w-full rounded-xl border border-border bg-background p-3 font-normal outline-none focus:border-primary" data-testid="input-bio" />
        <span className="block text-end text-xs text-muted-foreground tabular-nums">{bio.length}/280</span>
      </label>
      <fieldset className="mt-2 space-y-2">
        <legend className="mb-1 text-sm font-medium">{c.links}</legend>
        {links.map((l, i) => (
          <div key={i} className="flex gap-2">
            <input value={l} onChange={(e) => setLinks((cur) => cur.map((x, j) => (j === i ? e.target.value : x)))} placeholder="https://" dir="ltr" inputMode="url" aria-label={`${c.links} ${i + 1}`}
              className="min-h-11 flex-1 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary" data-testid={`input-link-${i}`} />
            <button type="button" onClick={() => setLinks((cur) => cur.filter((_, j) => j !== i))} aria-label={c.delete} className="flex h-11 w-11 items-center justify-center rounded-xl border border-border hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
        {links.length < 5 && <PillButton variant="outline" onClick={() => setLinks((cur) => [...cur, ''])} testId="button-add-link"><Plus className="h-4 w-4" />{c.addLink}</PillButton>}
      </fieldset>
      {error && <p role="alert" className="mt-3 text-sm text-red-500">{error}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <PillButton variant="outline" onClick={onClose}>{c.cancel}</PillButton>
        <PillButton variant="gold" onClick={() => void save()} disabled={busy} testId="button-save-profile">{c.save}</PillButton>
      </div>
    </Sheet>
  );
}

function CreationsStrip({ creations }: { creations: Creation[] }) {
  const { c } = useCommunityCopy();
  if (!creations.length) return <p className="px-4 py-6 text-center text-sm text-muted-foreground">{c.noCreations}</p>;
  return (
    <div className="flex snap-x gap-3 overflow-x-auto px-4 pb-4">
      {creations.map((cr) => {
        const href = safeHref(cr.url); const img = safeHref(cr.imageUrl);
        const inner = (
          <>
            <div className="aspect-[4/3] w-full overflow-hidden rounded-xl bg-surface-hover">{img ? <img src={img} alt="" loading="lazy" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-primary"><Sparkles className="h-6 w-6" /></div>}</div>
            <span className="mt-2 flex items-center gap-1 truncate text-sm font-medium" dir="auto">{cr.name}{href && <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />}</span>
          </>
        );
        return href ? (
          <a key={cr.id} href={href} target="_blank" rel="noopener noreferrer" className="w-44 shrink-0 snap-start rounded-2xl border border-border p-2 hover:border-primary/50" data-testid={`link-creation-${cr.id}`}>{inner}</a>
        ) : <div key={cr.id} className="w-44 shrink-0 snap-start rounded-2xl border border-border p-2">{inner}</div>;
      })}
    </div>
  );
}

export default function CommunityProfile() {
  const [, params] = useRoute('/community/profile/:id');
  const rawId = params?.id ? decodeURIComponent(params.id) : 'me';
  const { c, lang, isRtl } = useCommunityCopy();
  const api = useCommunityApi();
  const viewer = useCommunityViewer();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [creations, setCreations] = useState<Creation[]>([]);
  const [error, setError] = useState('');
  const [status, setStatus] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [section, setSection] = useState<'posts' | 'creations'>('posts');
  const needsSignIn = rawId === 'me' && viewer.isLoaded && !viewer.isSignedIn;

  const load = useCallback(async () => {
    if (needsSignIn) return;
    setError(''); setStatus(0);
    try {
      const res = await api<{ profile: Profile; creations: Creation[] }>(`/community/profiles/${encodeURIComponent(rawId)}`);
      setProfile(res.profile); setCreations(res.creations ?? []);
    } catch (e) { setError(e instanceof Error ? e.message : c.errorLoad); setStatus((e as { status?: number }).status ?? 0); }
  }, [api, rawId, needsSignIn, c.errorLoad]);
  useEffect(() => { setProfile(null); void load(); }, [load, viewer.userId]);

  const own = !!profile && profile.id === viewer.userId;
  const feed = useFeed({ authorId: profile?.id, enabled: !!profile && !profile.isBlocked, pollMs: 60000 });

  const act = async (fn: () => Promise<void>) => {
    if (!viewer.isSignedIn) { requestGuestAccount('community'); return; }
    setBusy(true);
    try { await fn(); } catch (e) { toast({ title: e instanceof Error ? e.message : c.errorLoad, variant: 'destructive' }); } finally { setBusy(false); }
  };
  const toggleFollow = () => act(async () => {
    if (!profile) return;
    const res = await api<{ following: boolean }>(`/community/profiles/${encodeURIComponent(profile.id)}/follow`, { method: 'PUT', body: JSON.stringify({ following: !profile.isFollowing }) });
    setProfile((p) => (p ? { ...p, isFollowing: res.following, followerCount: Math.max(0, p.followerCount + (res.following === p.isFollowing ? 0 : res.following ? 1 : -1)) } : p));
  });
  const toggleBlock = () => act(async () => {
    if (!profile) return;
    const res = await api<{ blocked: boolean }>(`/community/profiles/${encodeURIComponent(profile.id)}/block`, { method: 'PUT', body: JSON.stringify({ blocked: !profile.isBlocked }) });
    setProfile((p) => (p ? { ...p, isBlocked: res.blocked, isFollowing: res.blocked ? false : p.isFollowing } : p));
    setBlockOpen(false); toast({ title: res.blocked ? c.blocked : c.unblocked });
  });

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="mx-auto min-h-[100dvh] w-full max-w-2xl border-border/60 bg-background md:border-x">
      <CommunityHeader title={profile?.name || c.community} back="/community" />
      {needsSignIn ? (
        <EmptyState icon={<Mail className="h-6 w-6" />} title={c.signInToPost}><PillButton variant="gold" onClick={() => requestGuestAccount('community')}>{c.signIn}</PillButton></EmptyState>
      ) : error ? (
        <ErrorState message={status === 404 ? c.profileNotFound : `${c.errorLoad} ${error}`} onRetry={status === 404 ? undefined : () => void load()} />
      ) : !profile ? (
        <div className="space-y-3 p-5" aria-busy="true"><div className="pulse-soft h-24 w-24 rounded-full bg-surface-hover" /><div className="pulse-soft h-4 w-40 rounded bg-surface-hover" /><div className="pulse-soft h-3 w-64 rounded bg-surface-hover" /></div>
      ) : (
        <>
          <section className="relative">
            <div className="h-28 bg-[radial-gradient(120%_140%_at_20%_0%,hsl(var(--primary)/.35),transparent_60%),linear-gradient(135deg,hsl(var(--surface)),hsl(var(--background)))] sm:h-36" />
            <div className="px-4 pb-4">
              <div className="-mt-12 flex items-end justify-between gap-3">
                <div className="rounded-full ring-4 ring-background"><CommunityAvatar profile={profile} size={96} /></div>
                <div className="flex flex-wrap justify-end gap-2 pb-1">
                  {own ? (
                    <PillButton variant="outline" onClick={() => setEditOpen(true)} testId="button-edit-profile"><Pencil className="h-4 w-4" />{c.editProfile}</PillButton>
                  ) : profile.isBlocked ? (
                    <PillButton variant="outline" onClick={() => void toggleBlock()} disabled={busy} testId="button-unblock"><UserRoundX className="h-4 w-4" />{c.unblock}</PillButton>
                  ) : (
                    <>
                      <Link href={`/community/messages/${encodeURIComponent(profile.id)}`} onClick={(e) => { if (!viewer.isSignedIn) { e.preventDefault(); requestGuestAccount('community'); } }}
                        aria-label={c.message} className="flex h-11 w-11 items-center justify-center rounded-full border border-border hover:bg-surface-hover" data-testid="link-message-profile"><Mail className="h-4 w-4" /></Link>
                      <button type="button" aria-label={c.report} onClick={() => (viewer.isSignedIn ? setReportOpen(true) : requestGuestAccount('community'))} className="flex h-11 w-11 items-center justify-center rounded-full border border-border hover:bg-surface-hover" data-testid="button-report-profile"><Flag className="h-4 w-4" /></button>
                      <button type="button" aria-label={c.block} onClick={() => (viewer.isSignedIn ? setBlockOpen(true) : requestGuestAccount('community'))} className="flex h-11 w-11 items-center justify-center rounded-full border border-border hover:bg-surface-hover hover:text-red-500" data-testid="button-block-profile"><Ban className="h-4 w-4" /></button>
                      <PillButton variant={profile.isFollowing ? 'outline' : 'gold'} onClick={() => void toggleFollow()} disabled={busy} aria-pressed={profile.isFollowing} testId="button-follow">
                        {profile.isFollowing ? c.unfollow : c.follow}
                      </PillButton>
                    </>
                  )}
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1.5">
                <h2 className="text-xl font-bold tracking-tight" data-testid="text-profile-name">{profile.name}</h2>
                <ProBadge verified={profile.verified} />
              </div>
              {profile.username && <p className="mt-1 text-sm font-medium text-primary" dir="ltr" data-testid="text-profile-username">@{profile.username}</p>}
              {profile.bio && <p className="mt-2 whitespace-pre-wrap break-words text-[15px] leading-relaxed" dir="auto" data-testid="text-profile-bio">{profile.bio}</p>}
              {profile.links.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                  {profile.links.map((l) => { const h = safeHref(l); return h ? (
                    <li key={l}><a href={h} target="_blank" rel="noopener noreferrer nofollow ugc me" className="inline-flex min-h-8 items-center gap-1 text-sm text-primary hover:underline" dir="ltr"><Link2 className="h-3.5 w-3.5" />{linkLabel(h)}</a></li>
                  ) : null; })}
                </ul>
              )}
              <div className="mt-3 flex gap-4 text-sm">
                <span><strong className="tabular-nums">{formatCount(profile.followingCount, lang)}</strong> <span className="text-muted-foreground">{c.followingCount}</span></span>
                <span data-testid="text-follower-count"><strong className="tabular-nums">{formatCount(profile.followerCount, lang)}</strong> <span className="text-muted-foreground">{c.followers}</span></span>
              </div>
            </div>
          </section>
          {profile.isBlocked ? (
            <EmptyState icon={<Ban className="h-6 w-6" />} title={c.blockedProfile} />
          ) : (
            <>
              <div role="tablist" className="flex border-b border-border">
                {(['posts', 'creations'] as const).map((s) => (
                  <button key={s} role="tab" type="button" aria-selected={section === s} onClick={() => setSection(s)}
                    className={cn('relative min-h-12 flex-1 text-sm font-semibold', section === s ? 'text-foreground' : 'text-muted-foreground')} data-testid={`tab-profile-${s}`}>
                    {s === 'posts' ? c.posts : c.creations}
                    <span className={cn('absolute bottom-0 left-1/2 h-[3px] w-12 -translate-x-1/2 rounded-full bg-primary', section === s ? 'opacity-100' : 'opacity-0')} />
                  </button>
                ))}
              </div>
              {section === 'posts' ? <FeedList feed={feed} empty={c.noPosts} emptyIcon={<Sparkles className="h-6 w-6" />} /> : <div className="pt-4"><CreationsStrip creations={creations} /></div>}
            </>
          )}
          {own && <EditProfileSheet open={editOpen} onClose={() => setEditOpen(false)} profile={profile} onSaved={setProfile} />}
          <ReportSheet open={reportOpen} onClose={() => setReportOpen(false)} userId={profile.id} />
          <Sheet open={blockOpen} onClose={() => setBlockOpen(false)} title={`${c.block} ${profile.name}`}>
            <p className="text-sm text-muted-foreground">{c.blockConfirm}</p>
            <div className="mt-5 flex justify-end gap-2">
              <PillButton variant="outline" onClick={() => setBlockOpen(false)}>{c.cancel}</PillButton>
              <PillButton variant="danger" onClick={() => void toggleBlock()} disabled={busy} testId="button-confirm-block-profile">{c.block}</PillButton>
            </div>
          </Sheet>
        </>
      )}
    </div>
  );
}
