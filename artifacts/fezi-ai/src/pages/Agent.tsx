import { useEffect, useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { useAuth } from '@clerk/react';
import { useListAgents, createChatConversation } from '@workspace/api-client-react';
import { useTranslation, useApiLocalization } from '../lib/i18n';
import { Button, Card } from '../components/ui-parts';
import { ArrowLeft, ArrowRight, MessageSquare, Zap, Target, BookOpen, Link as LinkIcon } from 'lucide-react';
import { AgentAvatar } from '../components/AgentAvatar';
import { SubscriptionBadge, SubscriptionPrompt } from '../components/SubscriptionPrompt';
import { requestGuestAccount } from '../lib/auth-gate';
import { AgentSocialLinks } from '../components/AgentSocialLinks';

export default function AgentPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { t, isRtl } = useTranslation();
  const { isSignedIn } = useAuth();
  const apiLocale = useApiLocalization();
  const { data: agents, isLoading } = useListAgents();
  const [hasPaidAccess, setHasPaidAccess] = useState(false);
  const [subscriptionPromptOpen, setSubscriptionPromptOpen] = useState(false);
  const [newChatPending, setNewChatPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/payments/status', { credentials: 'include' })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('billing status unavailable')))
      .then((data: { hasPaidAccess?: boolean }) => {
        if (!cancelled) setHasPaidAccess(Boolean(data.hasPaidAccess));
      })
      .catch(() => {
        if (!cancelled) setHasPaidAccess(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  
  const routeAgentId = id?.trim().toLowerCase();
  const agent = agents?.find(a => a.id.toLowerCase() === routeAgentId);
  const Arrow = isRtl ? ArrowRight : ArrowLeft;
  const gated = Boolean(agent && agent.status === 'locked' && agent.id !== 'monicah' && agent.id !== 'arta' && !hasPaidAccess);

  if (isLoading) return <div className="animate-pulse h-96 bg-surface rounded-3xl m-8"></div>;
  if (!agent) {
    return (
      <div className="mx-auto max-w-2xl rounded-3xl border border-border bg-surface p-8 text-center">
        <h1 className="text-xl font-semibold">{t('agent_not_found')}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t('agent_not_found_desc')}</p>
        <Button className="mt-6" onClick={() => setLocation('/')}>{t('agent_back')}</Button>
      </div>
    );
  }

  return (
    <div className="fade-up mx-auto max-w-4xl min-w-0">
      <button 
        onClick={() => setLocation('/')}
         className="mb-4 flex min-h-11 items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground tactile-button md:mb-8"
      >
        <Arrow size={16} /> {t('agent_back')}
      </button>

       <Card className="relative min-w-0 overflow-hidden p-4 sm:p-6 md:p-12">
        {/* Abstract background blur based on agent accent */}
        <div 
          className="absolute -end-20 -top-20 w-96 h-96 rounded-full opacity-10 blur-3xl pointer-events-none"
          style={{ backgroundColor: agent.accent || 'var(--gold)' }}
        ></div>

         <div className="relative z-10 grid min-w-0 gap-7 md:grid-cols-[1fr_300px] md:gap-12">
           <div className="min-w-0">
             <div className="mb-5 flex min-w-0 items-center gap-3 sm:gap-6 md:mb-8">
              <div 
                 className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-border text-3xl font-bold shadow-lg sm:h-20 sm:w-20 md:h-24 md:w-24"
                style={{ backgroundColor: `${agent.accent}15`, color: agent.accent, borderColor: `${agent.accent}30` }}
              >
                <AgentAvatar agentId={agent.id} name={agent.name} className="h-full w-full rounded-2xl" />
              </div>
              <div className="min-w-0">
                 <h1 className="break-words text-2xl font-bold tracking-tight sm:text-3xl md:text-5xl">{agent.name}</h1>
                 <p className="mt-2 break-words text-xs font-medium uppercase tracking-wider text-primary sm:text-sm sm:tracking-widest">
                  {apiLocale.getAgentSpecialty(agent)}
                </p>
                 {agent.status === 'locked' && gated && <SubscriptionBadge className="mt-3" />}
              </div>
            </div>

            <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
              {apiLocale.getAgentDescription(agent)}
            </p>

             <div className="mt-7 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:flex-wrap sm:items-center">
              <Button
                size="lg"
                 className="min-h-11 w-full sm:w-auto"
                 onClick={() => {
                   if (!isSignedIn) {
                     requestGuestAccount(isRtl ? 'برای ادامهٔ گفتگو، ابتدا حساب رایگان بسازید.' : 'Create a free account before continuing the conversation.');
                     return;
                   }
                   gated ? setSubscriptionPromptOpen(true) : setLocation(`/chat?agent=${encodeURIComponent(agent.id)}`);
                 }}
              >
                {gated ? <SubscriptionBadge /> : <MessageSquare size={18} />}
                {gated ? t('subscription_required_badge') : isRtl ? 'ادامه گفتگو' : 'Resume Chat'}
              </Button>
              <Button
                size="lg"
                variant="secondary"
                 className="min-h-11 w-full sm:w-auto"
                disabled={newChatPending}
                onClick={async () => {
                  if (!isSignedIn) {
                    requestGuestAccount(isRtl ? 'برای شروع گفت‌وگو، ابتدا حساب رایگان بسازید.' : 'Create a free account before starting a conversation.');
                    return;
                  }
                  if (gated) {
                    setSubscriptionPromptOpen(true);
                    return;
                  }
                  setNewChatPending(true);
                  try {
                    await createChatConversation({ agentId: agent.id });
                     setLocation(`/chat?agent=${encodeURIComponent(agent.id)}`);
                  } catch {
                    // Fallback to normal routing if creation fails
                    setLocation(`/${encodeURIComponent(agent.id)}`);
                  } finally {
                    setNewChatPending(false);
                  }
                }}
              >
                <MessageSquare size={18} />
                {isRtl ? 'گفتگوی جدید' : 'New Chat'}
              </Button>
              <Button
                variant="secondary"
                 size="lg"
                 className="min-h-11 w-full sm:w-auto"
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                }}
              >
                <LinkIcon size={18} /> {isRtl ? 'کپی لینک' : 'Copy Link'}
              </Button>
            </div>
          </div>

           <div className="min-w-0 space-y-8">
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2 mb-4">
                <Target size={16} className="text-primary" />
                {t('agent_matrix')}
              </h3>
              <div className="space-y-3 bg-background/50 p-5 rounded-2xl border border-border">
                {[
                  [t('agent_matrix_energy'), agent.personality?.energy || 5],
                  [t('agent_matrix_creativity'), agent.personality?.creativity || 5],
                  [t('agent_matrix_precision'), agent.personality?.precision || 5],
                  [t('agent_matrix_warmth'), agent.personality?.warmth || 5],
                ].map(([label, score]) => (
                  <div key={String(label)}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-mono text-primary" dir="ltr">{score}/10</span>
                    </div>
                    <div className="h-1.5 bg-surface rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${Number(score) * 10}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {agent.personality && (
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2 mb-4">
                  <BookOpen size={16} className="text-primary" />
                  {t('agent_philosophy')}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed italic bg-surface p-4 rounded-2xl border-s-2 border-primary">
                  "{isRtl ? agent.personality.philosophyFa : agent.personality.philosophyEn}"
                </p>
              </div>
            )}
          </div>
        </div>
      </Card>
      
      {agent.capabilityDetails && agent.capabilityDetails.length > 0 && (
        <Card className="mt-8 p-6 md:p-8">
          <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
            <Zap size={20} className="text-primary" />
            {t('agent_capabilities')}
          </h3>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            {agent.capabilityDetails.map((cap, i) => (
              <div key={cap.id || i} className="p-4 bg-background border border-border rounded-xl flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-primary shrink-0"></div>
                <span className="text-sm font-medium">{isRtl ? cap.fa : cap.en}</span>
              </div>
            ))}
          </div>
          {/* Capability-aware quick actions based on known IDs */}
          <div className="mt-8 flex flex-wrap gap-3">
             {agent.id === 'monicah' && (
              <>
                <Button variant="secondary" onClick={() => isSignedIn ? setLocation('/studio/image') : requestGuestAccount(isRtl ? 'برای ساخت تصویر، ابتدا حساب رایگان بسازید.' : 'Create a free account before generating an image.')}>
                  <Zap size={16} /> {isRtl ? 'استودیوی تصویر' : 'Image Studio'}
                </Button>
                <Button variant="secondary" onClick={() => isSignedIn ? setLocation('/studio/video') : requestGuestAccount(isRtl ? 'برای ساخت ویدیو، ابتدا حساب رایگان بسازید.' : 'Create a free account before generating a video.')}>
                  <Zap size={16} /> {isRtl ? 'استودیوی ویدیو' : 'Video Studio'}
                </Button>
                <Button variant="secondary" onClick={() => !isSignedIn ? requestGuestAccount(isRtl ? 'برای ساخت صدا، ابتدا حساب رایگان بسازید.' : 'Create a free account before generating audio.') : hasPaidAccess ? setLocation('/studio/voice') : setSubscriptionPromptOpen(true)}>
                  <Zap size={16} /> {isRtl ? 'استودیوی صدا' : 'Voice Studio'}
                  {!hasPaidAccess && <SubscriptionBadge className="ms-1" />}
                </Button>
              </>
            )}
            {agent.id === 'arta' && (
              <Button variant="secondary" onClick={() => !isSignedIn ? requestGuestAccount(isRtl ? 'برای اجرای کد، ابتدا حساب رایگان بسازید.' : 'Create a free account before running code.') : hasPaidAccess ? setLocation('/studio/code') : setSubscriptionPromptOpen(true)}>
                <Zap size={16} /> {isRtl ? 'استودیوی کدنویسی' : 'Code Studio'}
                  {!hasPaidAccess && <SubscriptionBadge className="ms-1" />}
              </Button>
            )}
          </div>
          <div className="mt-8 border-t border-border pt-6">
            <AgentSocialLinks
              links={agent.socialLinks}
              title={isRtl ? 'شبکه‌های اجتماعی' : 'Social media'}
            />
          </div>
        </Card>
      )}
      <SubscriptionPrompt open={subscriptionPromptOpen} onClose={() => setSubscriptionPromptOpen(false)} />
    </div>
  );
}