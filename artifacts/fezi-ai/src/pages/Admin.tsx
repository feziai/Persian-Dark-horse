import { useEffect, useRef, useState } from 'react';
import { useHealthCheck } from '@workspace/api-client-react';
import CommunityAdmin from '../components/community/CommunityAdmin';
import { AdminUserMail } from '../components/AdminUserMail';
import { AdminSupportInbox } from '../components/AdminSupportInbox';
import { AdminAiQuestions } from '../components/AdminAiQuestions';
import { AdminCodes } from '../components/AdminCodes';
import { useTranslation } from '../lib/i18n';
import { PageHeader, Card, Button, Input } from '../components/ui-parts';
import {
  Activity,
  AlertTriangle,
  Boxes,
  CheckCircle2,
  EyeOff,
  KeyRound,
  LoaderCircle,
  LogOut,
  RefreshCw,
  ServerCog,
  ShieldCheck,
  MessageSquare,
  Ticket,
  Users,
  Bot,
  WandSparkles,
  ThumbsDown,
  XCircle,
  Diamond,
} from 'lucide-react';

type AdminPayment = {
  id: string;
  workspaceId: string;
  planId: string;
  planName: string;
  currencyId: string;
  txId: string;
  createdAt: string;
  status: 'pending' | 'approved' | 'rejected';
};

type AdminTicket = {
  id: string;
  type: 'question' | 'collaboration' | 'payment' | 'technical';
  subject: string;
  message: string;
  contact: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  createdAt: string;
  updatedAt: string;
};

type AdminProvider = {
  id: string;
  name: string;
  configured: boolean;
  models: string[];
  capabilities: Record<string, boolean>;
};

type AdminOverview = {
  username: string;
  server: {
    status: string;
    environment: string;
    uptimeSeconds: number;
    nodeVersion: string;
  };
  providers: AdminProvider[];
  secretsPolicy: string;
};

type AdminWorkspace = {
  metrics: {
    users: number;
    conversations: number;
    messages: number;
    feedback: number;
    agents: number;
    openTickets: number;
    payments: number;
  };
  feedback: Array<{ id: string; conversationId: string; userId: string; agentId: string; message: string; rating: 'like' | 'dislike'; comment: string; submittedAt: string }>;
  activity: Array<{ id: string; userId: string; type: string; label: string; detail: string; createdAt: string }>;
  chats: Array<{ id: string; userId: string; agentId: string; title: string; createdAt: string; updatedAt: string; messages: Array<{ id: string; role: string; text: string; createdAt: string }> }>;
  agents: Array<{ id: string; ownerId: string; name: string; slug: string; status: string; visibility: string; apiEnabled: boolean; siteEnabled: boolean; usageCount: number; createdAt: string; updatedAt: string }>;
  traffic: { accountActivity: number; chatMessages: number; period: string };
  settings: { aiEnabled: boolean; theme: string; options: Record<string, string | boolean>; plugins: string[] };
};

type AdminRewardTask = {
  id: string;
  title: string;
  titleFa: string;
  description: string;
  descriptionFa: string;
  kind: string;
  rewardCredits: number;
  actionUrl: string | null;
  requiresManualReview: boolean;
  active: boolean;
  sortOrder: number;
};

type AdminRewardClaim = AdminRewardTask & {
  userId: string;
  claim: { id: string; status: string; proofUrl?: string | null; proofText?: string | null; createdAt: string } | null;
};

type AdminWorkspaceCreditRecipient = {
  userId: string;
  displayName: string;
  username: string | null;
  credits: number;
  creditsLimit: number;
};

const formatUptime = (seconds: number) => {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
};

export default function AdminPage() {
  const { t, isRtl } = useTranslation();
  const { data: health, isLoading: healthLoading, refetch, isError: healthError } = useHealthCheck();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [adminName, setAdminName] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [providersLoading, setProvidersLoading] = useState(false);
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsError, setPaymentsError] = useState(false);
  const [paymentAction, setPaymentAction] = useState<string | null>(null);
  const [paymentNotice, setPaymentNotice] = useState('');
  const [workspace, setWorkspace] = useState<AdminWorkspace | null>(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [supportTickets, setSupportTickets] = useState<AdminTicket[]>([]);
  const [supportTicketTotal, setSupportTicketTotal] = useState(0);
  const [supportTicketOffset, setSupportTicketOffset] = useState(0);
  const [supportLoading, setSupportLoading] = useState(false);
  const [supportError, setSupportError] = useState(false);
  const [supportAction, setSupportAction] = useState<string | null>(null);
  const [supportNotice, setSupportNotice] = useState('');
  const [agentAction, setAgentAction] = useState<string | null>(null);
  const [adminPrompt, setAdminPrompt] = useState('');
  const [adminAgentReply, setAdminAgentReply] = useState('');
  const [adminAgentLoading, setAdminAgentLoading] = useState(false);
  const [siteSettings, setSiteSettings] = useState({ aiEnabled: true, theme: 'midnight', siteTitle: '', announcement: '', showSupport: true, pluginsText: '' });
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsNotice, setSettingsNotice] = useState('');
  const [rewardTasks, setRewardTasks] = useState<AdminRewardTask[]>([]);
  const [rewardClaims, setRewardClaims] = useState<AdminRewardClaim[]>([]);
  const [rewardLoading, setRewardLoading] = useState(false);
  const [rewardAction, setRewardAction] = useState<string | null>(null);
  const [rewardNotice, setRewardNotice] = useState('');
  const [newRewardTask, setNewRewardTask] = useState({ title: '', titleFa: '', description: '', descriptionFa: '', kind: 'action', rewardCredits: 100, actionUrl: '', requiresManualReview: false });
  const [creditRecipientInput, setCreditRecipientInput] = useState('');
  const [creditRecipient, setCreditRecipient] = useState<AdminWorkspaceCreditRecipient | null>(null);
  const [creditAmount, setCreditAmount] = useState('');
  const [creditConfirmed, setCreditConfirmed] = useState(false);
  const [creditLoading, setCreditLoading] = useState(false);
  const [creditNotice, setCreditNotice] = useState('');
  const [creditIdempotencyKey, setCreditIdempotencyKey] = useState('');
  const creditGrantInFlight = useRef(false);

  const loadWorkspace = async () => {
    setWorkspaceLoading(true);
    try {
      const response = await fetch('/api/admin/workspace', { credentials: 'include' });
      if (!response.ok) throw new Error('admin workspace unavailable');
      const data = await response.json() as AdminWorkspace;
      setWorkspace(data);
      setSiteSettings({
        aiEnabled: data.settings.aiEnabled,
        theme: data.settings.theme,
        siteTitle: typeof data.settings.options.siteTitle === 'string' ? data.settings.options.siteTitle : '',
        announcement: typeof data.settings.options.announcement === 'string' ? data.settings.options.announcement : '',
        showSupport: data.settings.options.showSupport !== false,
        pluginsText: data.settings.plugins.join('\n'),
      });
    } catch {
      setWorkspace(null);
    } finally {
      setWorkspaceLoading(false);
    }
  };

  const loadSupportTickets = async (offset = 0) => {
    setSupportLoading(true);
    setSupportError(false);
    try {
      const response = await fetch(`/api/admin/support/tickets?offset=${offset}`, { credentials: 'include' });
      if (!response.ok) throw new Error('support tickets unavailable');
      const data = await response.json() as { tickets?: AdminTicket[]; total?: number; offset?: number };
      setSupportTickets(data.tickets || []);
      setSupportTicketTotal(data.total || 0);
      setSupportTicketOffset(data.offset || 0);
    } catch {
      setSupportError(true);
    } finally {
      setSupportLoading(false);
    }
  };

  const lookupCreditRecipient = async (event: React.FormEvent) => {
    event.preventDefault();
    const recipient = creditRecipientInput.trim();
    if (!recipient) return;
    setCreditLoading(true);
    setCreditNotice('');
    setCreditRecipient(null);
    setCreditConfirmed(false);
    setCreditIdempotencyKey('');
    try {
      const response = await fetch('/api/admin/workspace-credits/recipient', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient }),
      });
      const data = await response.json() as { recipient?: AdminWorkspaceCreditRecipient; error?: string };
      if (!response.ok || !data.recipient) throw new Error(data.error || 'The exact recipient could not be found.');
      setCreditRecipient(data.recipient);
    } catch (error) {
      setCreditNotice(error instanceof Error ? error.message : 'Recipient lookup is temporarily unavailable.');
    } finally {
      setCreditLoading(false);
    }
  };

  const grantWorkspaceCredits = async (event: React.FormEvent) => {
    event.preventDefault();
    const amount = Number(creditAmount);
    if (creditGrantInFlight.current || !creditRecipient || !creditConfirmed || !Number.isSafeInteger(amount) || amount <= 0 || amount > 1_000_000) return;
    creditGrantInFlight.current = true;
    setCreditLoading(true);
    setCreditNotice('');
    const requestKey = creditIdempotencyKey || crypto.randomUUID();
    setCreditIdempotencyKey(requestKey);
    try {
      const response = await fetch('/api/admin/workspace-credits/grant', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: creditRecipientInput.trim(),
          targetUserId: creditRecipient.userId,
          amount,
          idempotencyKey: requestKey,
        }),
      });
      const data = await response.json() as {
        alreadyApplied?: boolean;
        credits?: number;
        creditsLimit?: number;
        error?: string;
      };
      if (!response.ok || typeof data.credits !== 'number' || typeof data.creditsLimit !== 'number') {
        throw new Error(data.error || 'The workspace Credits grant could not be completed.');
      }
      setCreditRecipient((current) => current ? { ...current, credits: data.credits!, creditsLimit: data.creditsLimit! } : current);
      setCreditNotice(data.alreadyApplied
        ? `This request was already applied. Current FEZI WORKSPACE balance: ${data.credits.toLocaleString()} Credits.`
        : `${amount.toLocaleString()} FEZI WORKSPACE Credits granted successfully. New balance: ${data.credits.toLocaleString()}.`);
      setCreditConfirmed(false);
      setCreditIdempotencyKey('');
    } catch (error) {
      setCreditNotice(error instanceof Error ? error.message : 'The grant could not be confirmed. Retry safely using the same request.');
    } finally {
      creditGrantInFlight.current = false;
      setCreditLoading(false);
    }
  };

  const updateSupportTicket = async (ticketId: string, status: AdminTicket['status']) => {
    setSupportAction(ticketId);
    setSupportError(false);
    setSupportNotice('');
    try {
      const response = await fetch(`/api/admin/support/tickets/${encodeURIComponent(ticketId)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error('support ticket update failed');
      const data = await response.json() as { ticket?: AdminTicket };
      if (!data.ticket) throw new Error('updated ticket missing');
      setSupportTickets((current) => current.map((ticket) => ticket.id === ticketId ? data.ticket! : ticket));
      setSupportNotice('Ticket status updated.');
      void loadWorkspace();
    } catch {
      setSupportNotice('Ticket status could not be updated. Please try again.');
      void loadSupportTickets(supportTicketOffset);
    } finally {
      setSupportAction(null);
    }
  };

  const loadAdminData = async () => {
    setProvidersLoading(true);
    try {
      const response = await fetch('/api/admin/overview', { credentials: 'include' });
      if (response.status === 401) {
        setAuthenticated(false);
        return;
      }
      if (!response.ok) throw new Error('overview unavailable');
      const data = await response.json() as AdminOverview;
      setOverview(data);
      setAdminName(data.username);
      setAuthenticated(true);
      void loadWorkspace();
      void loadSupportTickets();
      void loadPayments();
      void loadRewardTasks();
    } catch {
      setLoginError(t('guard_admin_load_error'));
    } finally {
      setProvidersLoading(false);
    }
  };

  useEffect(() => {
    void fetch('/api/admin/session', { credentials: 'include' })
      .then(async (response) => {
        const data = await response.json() as { authenticated?: boolean; username?: string };
        if (data.authenticated) {
          setAuthenticated(true);
          setAdminName(data.username || '');
          await loadAdminData();
        } else {
          setAuthenticated(false);
        }
      })
      .catch(() => setAuthenticated(false));
  }, []);

  const loadRewardTasks = async () => {
    setRewardLoading(true);
    try {
      const response = await fetch('/api/admin/reward-tasks', { credentials: 'include' });
      if (!response.ok) throw new Error('reward tasks unavailable');
      const data = await response.json() as { tasks: AdminRewardTask[]; claims: AdminRewardClaim[] };
      setRewardTasks(data.tasks);
      setRewardClaims(data.claims);
      setRewardNotice('');
    } catch {
      setRewardNotice('Reward task administration is unavailable.');
    } finally {
      setRewardLoading(false);
    }
  };

  const createRewardTask = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newRewardTask.title.trim()) return;
    setRewardAction('create');
    try {
      const response = await fetch('/api/admin/reward-tasks', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRewardTask),
      });
      if (!response.ok) throw new Error('create failed');
      setNewRewardTask({ title: '', titleFa: '', description: '', descriptionFa: '', kind: 'action', rewardCredits: 100, actionUrl: '', requiresManualReview: false });
      await loadRewardTasks();
    } catch {
      setRewardNotice('The reward task could not be created.');
    } finally {
      setRewardAction(null);
    }
  };

  const updateRewardTask = async (task: AdminRewardTask, changes: Partial<AdminRewardTask>) => {
    setRewardAction(task.id);
    try {
      const response = await fetch(`/api/admin/reward-tasks/${encodeURIComponent(task.id)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      });
      if (!response.ok) throw new Error('update failed');
      await loadRewardTasks();
    } catch {
      setRewardNotice('The reward task could not be updated.');
    } finally {
      setRewardAction(null);
    }
  };

  const deleteRewardTask = async (task: AdminRewardTask) => {
    if (!window.confirm(`Delete "${task.title}"? Existing claims will be kept for audit.`)) return;
    setRewardAction(`delete:${task.id}`);
    try {
      const response = await fetch(`/api/admin/reward-tasks/${encodeURIComponent(task.id)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('delete failed');
      await loadRewardTasks();
    } catch {
      setRewardNotice('The reward task could not be deleted.');
    } finally {
      setRewardAction(null);
    }
  };

  const reviewRewardClaim = async (claim: AdminRewardClaim, action: 'approve' | 'reject') => {
    if (!claim.claim) return;
    setRewardAction(claim.claim.id);
    try {
      const response = await fetch(`/api/admin/reward-tasks/${encodeURIComponent(claim.id)}/claims/${encodeURIComponent(claim.claim.id)}/${action}`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('review failed');
      await loadRewardTasks();
    } catch {
      setRewardNotice('The reward claim could not be reviewed.');
    } finally {
      setRewardAction(null);
    }
  };

  const login = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!username.trim() || !password) return;
    setLoginLoading(true);
    setLoginError('');
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await response.json() as { authenticated?: boolean; username?: string; error?: string };
      if (!response.ok || !data.authenticated) throw new Error(data.error || 'login failed');
      setPassword('');
      setAdminName(data.username || username.trim());
      setAuthenticated(true);
      await loadAdminData();
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : t('guard_admin_login_error'));
    } finally {
      setLoginLoading(false);
    }
  };

  const logout = async () => {
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' }).catch(() => undefined);
    setAuthenticated(false);
    setOverview(null);
    setPayments([]);
    setWorkspace(null);
    setSupportTickets([]);
    setSupportTicketTotal(0);
    setSupportTicketOffset(0);
  };

  const loadPayments = async () => {
    setPaymentsLoading(true);
    setPaymentsError(false);
    setPaymentNotice('');
    try {
      const response = await fetch('/api/admin/payments', { credentials: 'include' });
      if (!response.ok) throw new Error('payment list unavailable');
      const data = await response.json() as { payments?: AdminPayment[] };
      setPayments(data.payments || []);
    } catch {
      setPaymentsError(true);
    } finally {
      setPaymentsLoading(false);
    }
  };

  const updatePayment = async (paymentId: string, action: 'approve' | 'reject') => {
    setPaymentAction(paymentId);
    setPaymentsError(false);
    setPaymentNotice('');
    try {
      const response = await fetch(`/api/admin/payments/${encodeURIComponent(paymentId)}/${action}`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('payment update failed');
      setPaymentNotice(action === 'approve' ? t('guard_payment_approved_notice') : t('guard_payment_rejected_notice'));
      await loadPayments();
    } catch {
      setPaymentsError(true);
    } finally {
      setPaymentAction(null);
    }
  };

  const toggleAgent = async (agentId: string, enabled: boolean) => {
    setAgentAction(agentId);
    try {
      const response = await fetch(`/api/admin/agents/${encodeURIComponent(agentId)}/toggle`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      if (!response.ok) throw new Error('agent update failed');
      await loadWorkspace();
    } finally {
      setAgentAction(null);
    }
  };

  const askAdminAgent = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!adminPrompt.trim() || adminAgentLoading) return;
    setAdminAgentLoading(true);
    setAdminAgentReply('');
    try {
      const response = await fetch('/api/admin/agent', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: adminPrompt.trim() }),
      });
      const data = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(data.error || 'Admin Agent unavailable');
      setAdminAgentReply(data.message || '');
    } catch (error) {
      setAdminAgentReply(error instanceof Error ? error.message : 'Admin Agent unavailable');
    } finally {
      setAdminAgentLoading(false);
    }
  };

  const saveSiteSettings = async (event: React.FormEvent) => {
    event.preventDefault();
    setSettingsSaving(true);
    setSettingsNotice('');
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aiEnabled: siteSettings.aiEnabled,
          theme: siteSettings.theme,
          options: {
            siteTitle: siteSettings.siteTitle,
            announcement: siteSettings.announcement,
            showSupport: siteSettings.showSupport,
          },
          plugins: siteSettings.pluginsText.split('\n').map((plugin) => plugin.trim()).filter(Boolean),
        }),
      });
      if (!response.ok) throw new Error('settings update failed');
      setSettingsNotice('Settings saved.');
      await loadWorkspace();
    } catch {
      setSettingsNotice('Settings could not be saved.');
    } finally {
      setSettingsSaving(false);
    }
  };

  if (authenticated === null) {
    return <div className="flex min-h-[50vh] items-center justify-center"><LoaderCircle className="animate-spin text-primary" /></div>;
  }

  if (!authenticated) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md items-center justify-center">
        <Card className="w-full border-primary/20 p-6 shadow-xl shadow-black/10">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <ShieldCheck size={24} />
            </div>
            <div>
              <h1 className="text-xl font-semibold">{t('guard_login_title')}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{t('guard_login_desc')}</p>
            </div>
          </div>
          <form onSubmit={login} className="space-y-4">
            <label className="block text-sm font-medium">
              {t('guard_username')}
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
                dir="ltr"
              />
            </label>
            <label className="block text-sm font-medium">
              {t('guard_password')}
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
                dir="ltr"
              />
            </label>
            {loginError && <p className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-400">{loginError}</p>}
            <Button type="submit" className="w-full" disabled={!username.trim() || !password || loginLoading}>
              {loginLoading ? <LoaderCircle size={15} className="animate-spin" /> : <KeyRound size={15} />}
              {loginLoading ? t('guard_logging_in') : t('guard_login')}
            </Button>
          </form>
          <p className="mt-5 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
            <EyeOff size={14} className="mt-0.5 shrink-0" /> {t('guard_secret_notice')}
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="fade-up space-y-6">
      <CommunityAdmin />
      <PageHeader
        title={t('guard_title')}
        description={t('guard_desc')}
        action={(
          <Button type="button" size="sm" variant="secondary" onClick={logout}>
            <LogOut size={15} /> {t('guard_logout')}
          </Button>
        )}
      />

      <AdminUserMail isRtl={isRtl} />
      <AdminSupportInbox isRtl={isRtl} />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 xl:items-start">
        <AdminAiQuestions isRtl={isRtl} />
        <AdminCodes isRtl={isRtl} />
      </div>

      <Card className="border-primary/20">
        <div className="mb-4 flex items-center gap-2">
          <Diamond size={18} className="text-primary" />
          <div>
            <h2 className="font-semibold">Grant FEZI WORKSPACE Credits</h2>
            <p className="text-xs text-muted-foreground">Admin-only wallet adjustment. This is not an API Credits grant.</p>
          </div>
        </div>
        <form onSubmit={lookupCreditRecipient} className="flex flex-col gap-3 sm:flex-row">
          <label className="min-w-0 flex-1 text-xs font-medium">
            Exact email address or username
            <Input
              value={creditRecipientInput}
              onChange={(event) => {
                if (creditGrantInFlight.current) return;
                setCreditRecipientInput(event.target.value);
                setCreditRecipient(null);
                setCreditConfirmed(false);
                setCreditIdempotencyKey('');
                setCreditNotice('');
              }}
              autoComplete="off"
              disabled={creditLoading}
              maxLength={320}
              placeholder="name@example.com or PDHusernumber12345"
              className="mt-2 w-full"
              dir="ltr"
            />
          </label>
          <Button type="submit" className="self-end" disabled={!creditRecipientInput.trim() || creditLoading}>
            {creditLoading ? <LoaderCircle size={15} className="animate-spin" /> : <Users size={15} />}
            Search exact recipient
          </Button>
        </form>
        {creditNotice && (
          <p role="status" className={`mt-3 rounded-xl border p-3 text-sm ${creditNotice.includes('successfully') || creditNotice.includes('already applied') ? 'border-green-500/30 bg-green-500/5 text-green-400' : 'border-red-500/30 bg-red-500/5 text-red-400'}`}>
            {creditNotice}
          </p>
        )}
        {creditRecipient && (
          <form onSubmit={grantWorkspaceCredits} className="mt-4 space-y-4 rounded-xl border border-border bg-background p-4">
            <div>
              <p className="font-medium">{creditRecipient.displayName}</p>
              <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
                {creditRecipient.username ? `@${creditRecipient.username} · ` : ''}User {creditRecipient.userId}
              </p>
              <p className="mt-2 text-sm">
                Current FEZI WORKSPACE Credits: <strong>{creditRecipient.credits.toLocaleString()}</strong>
                <span className="text-muted-foreground"> / {creditRecipient.creditsLimit.toLocaleString()} limit</span>
              </p>
            </div>
            <label className="block max-w-xs text-xs font-medium">
              Positive integer amount (maximum 1,000,000)
              <Input
                type="number"
                min={1}
                max={1_000_000}
                step={1}
                required
                value={creditAmount}
                onChange={(event) => {
                  if (creditGrantInFlight.current) return;
                  setCreditAmount(event.target.value);
                  setCreditConfirmed(false);
                  setCreditIdempotencyKey('');
                  setCreditNotice('');
                }}
                className="mt-2 w-full"
                disabled={creditLoading}
              />
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={creditConfirmed}
                disabled={creditLoading}
                onChange={(event) => setCreditConfirmed(event.target.checked)}
                className="mt-1 h-4 w-4 accent-primary"
              />
              <span>
                Confirm adding {Number(creditAmount) > 0 ? Number(creditAmount).toLocaleString() : 'the entered amount'} FEZI WORKSPACE Credits to this exact account.
              </span>
            </label>
            <Button type="submit" disabled={!creditConfirmed || !Number.isSafeInteger(Number(creditAmount)) || Number(creditAmount) <= 0 || Number(creditAmount) > 1_000_000 || creditLoading}>
              {creditLoading ? <LoaderCircle size={15} className="animate-spin" /> : <Diamond size={15} />}
              Grant workspace Credits
            </Button>
          </form>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-primary/20 lg:col-span-2">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Activity size={18} className="text-primary" />
              <h2 className="font-semibold">{t('guard_status')}</h2>
            </div>
            <Button size="sm" variant="secondary" onClick={() => { void refetch(); void loadAdminData(); }}>
              <RefreshCw size={14} /> {t('guard_check')}
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-background p-4">
              <p className="text-xs text-muted-foreground">{t('guard_server_status')}</p>
              <p className={`mt-2 flex items-center gap-2 font-semibold ${healthError ? 'text-red-400' : 'text-green-400'}`}>
                {healthError ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
                {healthError ? t('guard_unhealthy') : t('guard_healthy')}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-background p-4">
              <p className="text-xs text-muted-foreground">{t('guard_environment')}</p>
              <p className="mt-2 font-mono text-sm">{overview?.server.environment || '—'}</p>
            </div>
            <div className="rounded-xl border border-border bg-background p-4">
              <p className="text-xs text-muted-foreground">{t('guard_uptime')}</p>
              <p className="mt-2 font-mono text-sm">{overview ? formatUptime(overview.server.uptimeSeconds) : healthLoading ? '…' : '—'}</p>
            </div>
          </div>
          <p className="mt-4 text-xs text-muted-foreground" dir="ltr">
            {t('guard_status_label')} {health?.status || overview?.server.status || 'ok'} · {overview?.server.nodeVersion || '—'}
          </p>
        </Card>
        <Card className="border-primary/20">
          <div className="flex items-center gap-2">
            <ServerCog size={18} className="text-primary" />
            <h2 className="font-semibold">{t('guard_admin_identity')}</h2>
          </div>
          <p className="mt-5 text-2xl font-semibold">{adminName || 'admin'}</p>
          <p className="mt-2 text-sm text-muted-foreground">{t('guard_admin_identity_desc')}</p>
        </Card>
      </div>

      <Card className="border-primary/20">
        <div className="mb-5 flex flex-col items-start gap-3 sm:flex-row sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 font-semibold"><Boxes size={18} className="text-primary" /> {t('guard_providers_title')}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t('guard_providers_desc')}</p>
          </div>
          {providersLoading && <LoaderCircle size={17} className="animate-spin text-primary" />}
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {overview?.providers.map((provider) => (
            <div key={provider.id} className="rounded-2xl border border-border bg-background p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{provider.name}</p>
                  <p className={`mt-1 text-xs ${provider.configured ? 'text-green-400' : 'text-muted-foreground'}`}>
                    {provider.configured ? t('guard_configured') : t('guard_not_configured')}
                  </p>
                </div>
                {provider.configured ? <CheckCircle2 size={17} className="text-green-400" /> : <XCircle size={17} className="text-muted-foreground" />}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {provider.models.map((model) => (
                  <span key={model} className="rounded-md bg-surface px-2 py-1 font-mono text-[10px] text-muted-foreground" dir="ltr">{model}</span>
                ))}
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground">
                {Object.entries(provider.capabilities).filter(([, enabled]) => enabled).map(([capability]) => capability).join(' · ') || t('guard_no_capabilities')}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-5 flex items-start gap-2 rounded-xl border border-border bg-surface/50 p-3 text-xs leading-5 text-muted-foreground">
          <EyeOff size={14} className="mt-0.5 shrink-0" /> {t('guard_secret_notice')}
        </p>
        {overview?.secretsPolicy && <p className="mt-2 text-[11px] text-muted-foreground">{overview.secretsPolicy}</p>}
      </Card>

      <Card className="border-primary/20">
        <div className="mb-4 flex items-center gap-2">
          <ServerCog size={18} className="text-primary" />
          <div>
            <h2 className="font-semibold">Site options, theme, and plugins</h2>
            <p className="text-xs text-muted-foreground">These values are stored server-side and are safe to expose only through the public settings response.</p>
          </div>
        </div>
        <form onSubmit={saveSiteSettings} className="grid gap-4 md:grid-cols-2">
          <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background p-3 text-sm">
            <span><span className="font-medium">AI features</span><span className="mt-1 block text-xs text-muted-foreground">Disable Chat while keeping the site available.</span></span>
            <input type="checkbox" checked={siteSettings.aiEnabled} onChange={(event) => setSiteSettings((current) => ({ ...current, aiEnabled: event.target.checked }))} className="h-4 w-4 accent-primary" />
          </label>
          <label className="rounded-xl border border-border bg-background p-3 text-sm">
            <span className="font-medium">Site theme</span>
            <select value={siteSettings.theme} onChange={(event) => setSiteSettings((current) => ({ ...current, theme: event.target.value }))} className="mt-2 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary">
              <option value="midnight">Midnight</option>
              <option value="pearl">Pearl</option>
              <option value="forest">Forest</option>
              <option value="sunset">Sunset</option>
              <option value="ocean">Ocean</option>
            </select>
          </label>
          <label className="rounded-xl border border-border bg-background p-3 text-sm">
            <span className="font-medium">Site title</span>
            <input value={siteSettings.siteTitle} onChange={(event) => setSiteSettings((current) => ({ ...current, siteTitle: event.target.value }))} maxLength={500} className="mt-2 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary" placeholder="Optional title" />
          </label>
          <label className="rounded-xl border border-border bg-background p-3 text-sm">
            <span className="font-medium">Announcement</span>
            <input value={siteSettings.announcement} onChange={(event) => setSiteSettings((current) => ({ ...current, announcement: event.target.value }))} maxLength={500} className="mt-2 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary" placeholder="Optional announcement" />
          </label>
          <label className="flex items-center gap-3 rounded-xl border border-border bg-background p-3 text-sm">
            <input type="checkbox" checked={siteSettings.showSupport} onChange={(event) => setSiteSettings((current) => ({ ...current, showSupport: event.target.checked }))} className="h-4 w-4 accent-primary" />
            <span><span className="font-medium">Show support entry</span><span className="mt-1 block text-xs text-muted-foreground">Keep support visible in the site navigation.</span></span>
          </label>
          <label className="rounded-xl border border-border bg-background p-3 text-sm">
            <span className="font-medium">Plugins</span>
            <textarea value={siteSettings.pluginsText} onChange={(event) => setSiteSettings((current) => ({ ...current, pluginsText: event.target.value }))} rows={3} className="mt-2 w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary" placeholder="One plugin identifier per line" />
          </label>
          <div className="flex items-center justify-end gap-3 md:col-span-2">
            {settingsNotice && <span className="text-xs text-muted-foreground">{settingsNotice}</span>}
            <Button type="submit" disabled={settingsSaving}>{settingsSaving ? <LoaderCircle size={15} className="animate-spin" /> : null}{settingsSaving ? 'Saving…' : 'Save site settings'}</Button>
          </div>
        </form>
      </Card>

      <Card className="border-primary/20">
        <div className="mb-5 flex flex-col items-start gap-3 sm:flex-row sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 font-semibold"><Diamond size={18} className="text-primary" /> Reward tasks and free credits</h2>
            <p className="mt-1 text-sm text-muted-foreground">Create, edit, pause, and review user-submitted reward tasks. Manual social posts are credited only after approval.</p>
          </div>
          <Button type="button" size="sm" className="min-h-11 w-full sm:w-auto" variant="secondary" onClick={() => void loadRewardTasks()} disabled={rewardLoading}><RefreshCw size={14} className={rewardLoading ? 'animate-spin' : ''} /> Refresh</Button>
        </div>
        {rewardNotice && <p className="mb-4 rounded-xl border border-amber-400/30 bg-amber-400/5 px-3 py-2 text-xs text-amber-200">{rewardNotice}</p>}
        <form onSubmit={createRewardTask} className="grid gap-3 rounded-2xl border border-border bg-background p-4 md:grid-cols-2">
          <p className="text-sm font-semibold md:col-span-2">Add a task</p>
          <Input value={newRewardTask.title} onChange={(event) => setNewRewardTask((current) => ({ ...current, title: event.target.value }))} placeholder="Title" maxLength={160} required />
          <Input value={newRewardTask.titleFa} onChange={(event) => setNewRewardTask((current) => ({ ...current, titleFa: event.target.value }))} placeholder="Persian title" maxLength={160} />
          <Input value={newRewardTask.description} onChange={(event) => setNewRewardTask((current) => ({ ...current, description: event.target.value }))} placeholder="Description" maxLength={2000} />
          <Input value={newRewardTask.descriptionFa} onChange={(event) => setNewRewardTask((current) => ({ ...current, descriptionFa: event.target.value }))} placeholder="Persian description" maxLength={2000} />
          <Input value={newRewardTask.actionUrl} onChange={(event) => setNewRewardTask((current) => ({ ...current, actionUrl: event.target.value }))} placeholder="Action URL (optional)" dir="ltr" maxLength={2000} />
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
            <Input type="number" min={0} max={100000} value={newRewardTask.rewardCredits} onChange={(event) => setNewRewardTask((current) => ({ ...current, rewardCredits: Number(event.target.value) }))} aria-label="Reward credits" className="min-w-0 w-full sm:flex-1" />
            <select value={newRewardTask.kind} onChange={(event) => setNewRewardTask((current) => ({ ...current, kind: event.target.value }))} className="min-h-11 min-w-0 w-full flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary sm:w-auto">
              <option value="action">Action</option><option value="link">Link</option><option value="share">Share</option><option value="app">App</option><option value="manual">Manual</option>
            </select>
          </div>
          <label className="flex min-h-11 items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={newRewardTask.requiresManualReview} onChange={(event) => setNewRewardTask((current) => ({ ...current, requiresManualReview: event.target.checked }))} className="h-5 w-5 accent-primary" /> Requires manual review</label>
          <div className="md:col-span-2"><Button type="submit" className="min-h-11 w-full sm:w-auto" disabled={rewardAction === 'create'}>{rewardAction === 'create' ? <LoaderCircle size={14} className="animate-spin" /> : null}Create task</Button></div>
        </form>

        <div className="mt-5 space-y-3">
          {rewardTasks.map((task) => (
            <div key={task.id} className={`rounded-2xl border p-4 ${task.active ? 'border-border bg-background' : 'border-border/50 bg-surface/40 opacity-70'}`}>
              <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_110px_auto]">
                <Input value={task.title} onChange={(event) => setRewardTasks((current) => current.map((item) => item.id === task.id ? { ...item, title: event.target.value } : item))} onBlur={() => void updateRewardTask(task, { title: task.title })} aria-label="Task title" />
                <Input value={task.titleFa} onChange={(event) => setRewardTasks((current) => current.map((item) => item.id === task.id ? { ...item, titleFa: event.target.value } : item))} onBlur={() => void updateRewardTask(task, { titleFa: task.titleFa })} aria-label="Persian task title" />
                <Input type="number" min={0} max={100000} value={task.rewardCredits} onChange={(event) => setRewardTasks((current) => current.map((item) => item.id === task.id ? { ...item, rewardCredits: Number(event.target.value) } : item))} onBlur={() => void updateRewardTask(task, { rewardCredits: task.rewardCredits })} aria-label="Task reward" />
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button type="button" size="sm" className="min-h-11 w-full sm:w-auto" variant={task.active ? 'secondary' : 'primary'} onClick={() => void updateRewardTask(task, { active: !task.active })} disabled={rewardAction === task.id}>{task.active ? 'Pause' : 'Enable'}</Button>
                  <Button type="button" size="sm" className="min-h-11 w-full sm:w-auto" variant="danger" onClick={() => void deleteRewardTask(task)} disabled={rewardAction === `delete:${task.id}`}>Delete</Button>
                </div>
              </div>
              <div className="mt-3 grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                <Input value={task.description} onChange={(event) => setRewardTasks((current) => current.map((item) => item.id === task.id ? { ...item, description: event.target.value } : item))} onBlur={() => void updateRewardTask(task, { description: task.description })} aria-label="Task description" />
                <Input value={task.actionUrl || ''} onChange={(event) => setRewardTasks((current) => current.map((item) => item.id === task.id ? { ...item, actionUrl: event.target.value } : item))} onBlur={() => void updateRewardTask(task, { actionUrl: task.actionUrl || '' })} aria-label="Task action URL" dir="ltr" />
                <label className="flex min-h-11 items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={task.requiresManualReview} onChange={(event) => void updateRewardTask(task, { requiresManualReview: event.target.checked })} className="h-5 w-5 accent-primary" /> Manual review</label>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground" dir="ltr">{task.id} · {task.kind} · {task.rewardCredits} credits</p>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <h3 className="text-sm font-semibold">Pending manual claims</h3>
          <div className="mt-3 space-y-3">
            {rewardClaims.filter((claim) => claim.claim?.status === 'pending').map((claim) => (
              <div key={claim.claim?.id} className="rounded-2xl border border-amber-400/30 bg-amber-400/5 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="font-semibold">{claim.title}</p><p className="mt-1 text-xs text-muted-foreground" dir="ltr">User {claim.userId} · {claim.claim ? new Date(claim.claim.createdAt).toLocaleString() : ''}</p></div>
                  <span className="rounded-full bg-amber-400/10 px-2.5 py-1 text-xs text-amber-200">+{claim.rewardCredits} credits</span>
                </div>
                {claim.claim?.proofUrl && <a href={claim.claim.proofUrl} target="_blank" rel="noreferrer" className="mt-3 block break-all text-xs text-primary underline" dir="ltr">{claim.claim.proofUrl}</a>}
                {claim.claim?.proofText && <p className="mt-2 text-xs leading-5 text-muted-foreground">{claim.claim.proofText}</p>}
                <div className="mt-3 flex flex-col gap-2 sm:flex-row"><Button type="button" size="sm" className="min-h-11 w-full sm:w-auto" onClick={() => void reviewRewardClaim(claim, 'approve')} disabled={rewardAction === claim.claim?.id}><CheckCircle2 size={14} />Approve and credit</Button><Button type="button" size="sm" className="min-h-11 w-full sm:w-auto" variant="secondary" onClick={() => void reviewRewardClaim(claim, 'reject')} disabled={rewardAction === claim.claim?.id}><XCircle size={14} />Reject</Button></div>
              </div>
            ))}
            {!rewardLoading && rewardClaims.every((claim) => claim.claim?.status !== 'pending') && <p className="rounded-xl border border-border bg-background p-3 text-xs text-muted-foreground">No pending manual claims.</p>}
          </div>
        </div>
      </Card>

      <Card className="border-primary/20">
        <div className="mb-5">
          <h2 className="font-semibold">{t('guard_payments_title')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('guard_payments_desc')}</p>
        </div>
        <Button type="button" size="sm" variant="secondary" onClick={loadPayments} disabled={paymentsLoading}>
          {paymentsLoading ? <LoaderCircle size={15} className="animate-spin" /> : null}
          {paymentsLoading ? t('guard_payment_loading') : t('guard_payment_load')}
        </Button>
        {paymentsError && <p className="mt-4 text-sm text-red-400">{t('guard_payment_error')}</p>}
        {paymentNotice && <p className="mt-4 text-sm text-green-400">{paymentNotice}</p>}
        <div className="mt-5 space-y-3">
          {!paymentsLoading && payments.length === 0 && (
            <p className="rounded-xl border border-border bg-background p-4 text-sm text-muted-foreground">{t('guard_payment_empty')}</p>
          )}
          {payments.map((payment) => (
            <div key={payment.id} className="rounded-2xl border border-border bg-background p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{payment.planName}</p>
                  <p className="mt-1 text-xs text-muted-foreground" dir="ltr">{payment.currencyId} · {new Date(payment.createdAt).toLocaleString()}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs ${payment.status === 'approved' ? 'bg-green-500/10 text-green-400' : payment.status === 'rejected' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'}`}>
                  {payment.status === 'approved' ? t('guard_payment_approved') : payment.status === 'rejected' ? t('guard_payment_rejected') : t('guard_payment_pending')}
                </span>
              </div>
              <p className="mt-3 break-all rounded-xl border border-border/70 bg-surface p-3 font-mono text-xs" dir="ltr">{payment.txId}</p>
              {payment.status === 'pending' && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" size="sm" onClick={() => updatePayment(payment.id, 'approve')} disabled={paymentAction === payment.id}>
                    {paymentAction === payment.id ? <LoaderCircle size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                    {t('guard_payment_approve')}
                  </Button>
                  <Button type="button" size="sm" variant="secondary" onClick={() => updatePayment(payment.id, 'reject')} disabled={paymentAction === payment.id}>
                    <XCircle size={14} /> {t('guard_payment_reject')}
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card className="border-primary/20">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-semibold"><Activity size={18} className="text-primary" /> Workspace overview</h2>
            <p className="mt-1 text-sm text-muted-foreground">Live server-side records for support, usage, conversations, feedback, and Agents.</p>
          </div>
          {workspaceLoading && <LoaderCircle size={17} className="animate-spin text-primary" />}
        </div>
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4 xl:grid-cols-7">
          {[
            ['Users', workspace?.metrics.users],
            ['Chats', workspace?.metrics.conversations],
            ['Messages', workspace?.metrics.messages],
            ['Feedback', workspace?.metrics.feedback],
            ['Agents', workspace?.metrics.agents],
            ['Open tickets', workspace?.metrics.openTickets],
            ['Payments', workspace?.metrics.payments],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-border bg-background p-3">
              <p className="text-[11px] text-muted-foreground">{label}</p>
              <p className="mt-1 text-xl font-semibold">{value ?? '—'}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-primary/20">
          <div className="mb-4 flex items-center gap-2">
            <Ticket size={18} className="text-primary" />
            <div>
              <h2 className="font-semibold">Support tickets</h2>
              <p className="text-xs text-muted-foreground">Review requests and keep their status up to date.</p>
            </div>
            {supportLoading && <LoaderCircle size={16} className="ml-auto animate-spin text-primary" />}
          </div>
          <div className="space-y-3">
            {supportError && <p className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-400">Support tickets could not be loaded. Refresh the page and try again.</p>}
            {supportNotice && <p className={`rounded-xl border p-3 text-xs ${supportNotice.startsWith('Ticket status could not') ? 'border-red-500/30 bg-red-500/5 text-red-400' : 'border-green-500/30 bg-green-500/5 text-green-400'}`}>{supportNotice}</p>}
            {!supportError && !supportLoading && !supportTickets.length && <p className="rounded-xl border border-border bg-background p-4 text-sm text-muted-foreground">No tickets found.</p>}
            {supportTickets.map((ticket) => (
              <div key={ticket.id} className="rounded-xl border border-border bg-background p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{ticket.subject}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{ticket.type} · {ticket.contact}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground" dir="ltr">{ticket.id} · received {new Date(ticket.createdAt).toLocaleString()}</p>
                  </div>
                  <select
                    value={ticket.status}
                    aria-label={`Change status for ticket ${ticket.id}`}
                    disabled={supportAction === ticket.id}
                    onChange={(event) => void updateSupportTicket(ticket.id, event.target.value as AdminTicket['status'])}
                    className="rounded-lg border border-border bg-background px-2 py-1 text-[10px] text-foreground disabled:opacity-50"
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{ticket.message}</p>
              </div>
            ))}
            {supportTicketTotal > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <p className="text-[11px] text-muted-foreground">
                  Showing {supportTicketOffset + 1}–{Math.min(supportTicketOffset + supportTickets.length, supportTicketTotal)} of {supportTicketTotal}
                </p>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="secondary" disabled={supportLoading || supportTicketOffset === 0} onClick={() => void loadSupportTickets(Math.max(0, supportTicketOffset - 25))}>Previous</Button>
                  <Button type="button" size="sm" variant="secondary" disabled={supportLoading || supportTicketOffset + supportTickets.length >= supportTicketTotal} onClick={() => void loadSupportTickets(supportTicketOffset + 25)}>Next</Button>
                </div>
              </div>
            )}
          </div>
        </Card>

        <Card className="border-primary/20">
          <div className="mb-4 flex items-center gap-2">
            <ThumbsDown size={18} className="text-primary" />
            <div>
              <h2 className="font-semibold">Chat feedback</h2>
              <p className="text-xs text-muted-foreground">Feedback is attached to the original answer and can be reviewed here.</p>
            </div>
          </div>
          <div className="space-y-3">
            {!workspace?.feedback.length && <p className="rounded-xl border border-border bg-background p-4 text-sm text-muted-foreground">No feedback submitted yet.</p>}
            {workspace?.feedback.slice(0, 12).map((item) => (
              <div key={item.id} className="rounded-xl border border-border bg-background p-3">
                <div className="flex items-start justify-between gap-3">
                  <p className={`text-xs font-semibold ${item.rating === 'dislike' ? 'text-red-400' : 'text-green-400'}`}>{item.rating}</p>
                  <span className="text-[10px] text-muted-foreground">{new Date(item.submittedAt).toLocaleString()}</span>
                </div>
                <p className="mt-2 text-xs leading-5">{item.message}</p>
                {item.comment && <p className="mt-2 rounded-lg bg-surface p-2 text-xs text-muted-foreground">{item.comment}</p>}
                <p className="mt-2 text-[10px] text-muted-foreground" dir="ltr">user {item.userId} · agent {item.agentId}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="border-primary/20">
        <div className="mb-4 flex items-center gap-2">
          <Bot size={18} className="text-primary" />
          <div>
            <h2 className="font-semibold">Created Agents</h2>
            <p className="text-xs text-muted-foreground">Enable or disable custom Agents from the server-authoritative status.</p>
          </div>
        </div>
        <div className="space-y-3">
          {!workspace?.agents.length && <p className="rounded-xl border border-border bg-background p-4 text-sm text-muted-foreground">No custom Agents found.</p>}
          {workspace?.agents.map((agent) => (
            <div key={agent.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background p-3">
              <div>
                <p className="font-medium">{agent.name}</p>
                <p className="mt-1 text-[11px] text-muted-foreground" dir="ltr">{agent.slug} · owner {agent.ownerId} · {agent.usageCount} uses</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-1 text-[10px] ${agent.status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-surface text-muted-foreground'}`}>{agent.status}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={agentAction === agent.id}
                  onClick={() => void toggleAgent(agent.id, agent.status !== 'active')}
                >
                  {agentAction === agent.id ? <LoaderCircle size={13} className="animate-spin" /> : null}
                  {agent.status === 'active' ? 'Disable' : 'Enable'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-primary/20">
          <div className="mb-4 flex items-center gap-2">
            <MessageSquare size={18} className="text-primary" />
            <div>
              <h2 className="font-semibold">Recent user chats</h2>
              <p className="text-xs text-muted-foreground">Recent conversation metadata and short message excerpts.</p>
            </div>
          </div>
          <div className="max-h-[30rem] space-y-3 overflow-y-auto pe-1">
            {!workspace?.chats.length && <p className="rounded-xl border border-border bg-background p-4 text-sm text-muted-foreground">No conversations found.</p>}
            {workspace?.chats.map((chat) => (
              <details key={chat.id} className="rounded-xl border border-border bg-background p-3">
                <summary className="cursor-pointer list-none">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{chat.title || 'Untitled chat'}</p>
                      <p className="mt-1 text-[10px] text-muted-foreground" dir="ltr">{chat.agentId} · user {chat.userId}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{new Date(chat.updatedAt).toLocaleString()}</span>
                  </div>
                </summary>
                <div className="mt-3 space-y-2 border-t border-border pt-3">
                  {chat.messages.map((message) => (
                    <p key={message.id} className={`rounded-lg p-2 text-xs leading-5 ${message.role === 'agent' ? 'bg-surface' : 'bg-primary/10'}`}>
                      <span className="me-1 font-semibold">{message.role}:</span>{message.text}
                    </p>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </Card>

        <Card className="border-primary/20">
          <div className="mb-4 flex items-center gap-2">
            <Users size={18} className="text-primary" />
            <div>
              <h2 className="font-semibold">Usage and site traffic</h2>
              <p className="text-xs text-muted-foreground">Current activity sample from the account and chat event records.</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-background p-4"><p className="text-xs text-muted-foreground">Activity records</p><p className="mt-2 text-2xl font-semibold">{workspace?.traffic.accountActivity ?? '—'}</p></div>
            <div className="rounded-xl border border-border bg-background p-4"><p className="text-xs text-muted-foreground">Chat messages</p><p className="mt-2 text-2xl font-semibold">{workspace?.traffic.chatMessages ?? '—'}</p></div>
          </div>
          <div className="mt-4 max-h-[20rem] space-y-2 overflow-y-auto">
            {workspace?.activity.slice(0, 20).map((item) => (
              <div key={item.id} className="rounded-lg border border-border bg-background p-3">
                <p className="text-xs font-medium">{item.label}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{item.detail}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="border-primary/20">
        <div className="mb-4 flex items-center gap-2">
          <WandSparkles size={18} className="text-primary" />
          <div>
            <h2 className="font-semibold">Admin Agent</h2>
            <p className="text-xs text-muted-foreground">Ask for a safe implementation plan or code direction. It does not change files automatically.</p>
          </div>
        </div>
        <form onSubmit={askAdminAgent} className="space-y-3">
          <textarea
            value={adminPrompt}
            onChange={(event) => setAdminPrompt(event.target.value)}
            rows={4}
            maxLength={12000}
            placeholder="Example: propose the steps to add a new site option for visitors..."
            className="w-full resize-y rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
          />
          <div className="flex justify-end">
            <Button type="submit" disabled={!adminPrompt.trim() || adminAgentLoading}>
              {adminAgentLoading ? <LoaderCircle size={15} className="animate-spin" /> : <WandSparkles size={15} />}
              {adminAgentLoading ? 'Thinking…' : 'Ask Admin Agent'}
            </Button>
          </div>
        </form>
        {adminAgentReply && <pre className="mt-4 max-h-[28rem] overflow-auto whitespace-pre-wrap rounded-xl border border-border bg-background p-4 text-xs leading-5">{adminAgentReply}</pre>}
      </Card>
    </div>
  );
}