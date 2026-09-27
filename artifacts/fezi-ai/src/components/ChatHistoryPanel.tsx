import { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, MessageSquare, AlertCircle, RefreshCw, LogIn, Clock } from 'lucide-react';
import { useListChatConversations, getListChatConversationsQueryKey } from '@workspace/api-client-react';
import { useAuth } from '@clerk/react';
import { requestGuestAccount } from '../lib/auth-gate';

export interface ChatHistoryPanelProps {
  open: boolean;
  onClose: () => void;
  onSelect: (conversationId: string, agentId: string, appId?: string) => void;
  activeConversationId?: string | null;
  isSignedIn: boolean;
  agents: Array<{ id: string; name: string }>;
  isRtl: boolean;
  appId?: string | null;
}

export function ChatHistoryPanel({
  open,
  onClose,
  onSelect,
  activeConversationId,
  isSignedIn,
  agents,
  isRtl,
  appId,
}: ChatHistoryPanelProps) {
  const { userId } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  
  const { data, isLoading, isError, refetch } = useListChatConversations({
    query: {
      enabled: open && isSignedIn && !!userId,
      queryKey: [...getListChatConversationsQueryKey(), userId],
    }
  });

  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.querySelector<HTMLInputElement>('input')?.focus();
    return () => previousFocus?.focus();
  }, [open]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose();
      }
      if (e.key === 'Tab' && open && panelRef.current) {
        const controls = Array.from(panelRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)'));
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [open]);

  const conversations = (data?.conversations || []).filter((conversation) =>
    !appId || conversation.agentId === `app:${appId}`);

  const filteredConversations = useMemo(() => {
    if (!searchTerm.trim()) return conversations;
    const term = searchTerm.toLowerCase();
    return conversations.filter(c => 
      (c.title || '').toLowerCase().includes(term) || 
      (agents.find(a => a.id === c.agentId)?.name || '').toLowerCase().includes(term)
    );
  }, [conversations, searchTerm, agents]);

  if (!open || typeof document === 'undefined') return null;

  const getAgentName = (agentId: string) => {
    if (agentId.startsWith('app:')) {
      return ({ claude: 'Claude', deepseek: 'DeepSeek', gapgpt: 'Persian Dark Horse', openai: 'OpenAI', mistral: 'Mistral' } as Record<string, string>)[agentId.slice(4)] || agentId;
    }
    return agents.find(a => a.id === agentId)?.name || (isRtl ? 'دستیار ناشناس' : 'Unknown Agent');
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) {
        return new Intl.DateTimeFormat(isRtl ? 'fa-IR' : 'en-US', {
          hour: '2-digit',
          minute: '2-digit'
        }).format(date);
      } else if (diffDays < 7) {
        return new Intl.DateTimeFormat(isRtl ? 'fa-IR' : 'en-US', {
          weekday: 'short'
        }).format(date);
      } else {
        return new Intl.DateTimeFormat(isRtl ? 'fa-IR' : 'en-US', {
          month: 'short',
          day: 'numeric'
        }).format(date);
      }
    } catch {
      return '';
    }
  };

  return createPortal(
    <div 
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label={isRtl ? 'تاریخچه گفتگوها' : 'Chat history'}
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div 
        className="absolute inset-0 bg-background/80 backdrop-blur-sm transition-opacity" 
        aria-hidden="true" 
        onClick={onClose}
      />
      
      <div 
        ref={panelRef}
        className={`absolute inset-y-0 ${isRtl ? 'right-0 border-l' : 'left-0 border-r'} flex w-full sm:max-w-sm flex-col border-border bg-surface shadow-2xl transition-transform fade-up`}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-4">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            {isRtl ? 'تاریخچه گفتگوها' : 'Chat History'}
          </h2>
          <button 
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-muted-foreground tactile-button hover:bg-surface-hover hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            aria-label={isRtl ? 'بستن تاریخچه' : 'Close history'}
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {!isSignedIn ? (
            <div className="flex h-full flex-col items-center justify-center p-6 text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <LogIn size={24} />
              </div>
              <h3 className="mb-2 text-lg font-medium text-foreground">
                {isRtl ? 'وارد شوید' : 'Sign In Required'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {isRtl 
                  ? 'برای مشاهده تاریخچه گفتگوهای خود باید وارد حساب کاربری شوید.' 
                  : 'Please sign in to view your chat history.'}
              </p>
               <button
                 type="button"
                 onClick={() => {
                   onClose();
                   requestGuestAccount(isRtl ? 'برای دیدن و نگهداری تاریخچه گفتگوها وارد شوید.' : 'Sign in to view and keep your chat history.');
                 }}
                 className="mt-5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
               >
                 {isRtl ? 'ورود یا ساخت حساب' : 'Sign in or create account'}
               </button>
            </div>
          ) : isError ? (
            <div className="flex h-full flex-col items-center justify-center p-6 text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-500">
                <AlertCircle size={24} />
              </div>
              <h3 className="mb-2 text-lg font-medium text-foreground">
                {isRtl ? 'خطا در دریافت اطلاعات' : 'Error Loading History'}
              </h3>
              <p className="mb-6 text-sm text-muted-foreground">
                {isRtl 
                  ? 'متاسفانه در دریافت تاریخچه گفتگوها مشکلی پیش آمد.' 
                  : 'We encountered an error while loading your chat history.'}
              </p>
              <button
                type="button"
                onClick={() => refetch()}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground tactile-button hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
              >
                <RefreshCw size={16} />
                {isRtl ? 'تلاش مجدد' : 'Try Again'}
              </button>
            </div>
          ) : (
            <div className="flex flex-col p-4">
              <div className="relative mb-4">
                <div className={`pointer-events-none absolute inset-y-0 flex items-center text-muted-foreground ${isRtl ? 'right-0 pr-3' : 'left-0 pl-3'}`}>
                  <Search size={16} />
                </div>
                <input
                  type="text"
                  placeholder={isRtl ? 'جستجو در گفتگوها...' : 'Search conversations...'}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`w-full rounded-xl border border-border bg-background py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary ${isRtl ? 'pl-4 pr-10' : 'pl-10 pr-4'}`}
                />
              </div>

              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="flex flex-col gap-2 rounded-xl border border-border bg-background/50 p-4 opacity-70">
                      <div className="h-4 w-3/4 animate-pulse rounded bg-border"></div>
                      <div className="flex items-center justify-between">
                        <div className="h-3 w-1/3 animate-pulse rounded bg-border"></div>
                        <div className="h-3 w-1/4 animate-pulse rounded bg-border"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="mt-10 flex flex-col items-center justify-center text-center">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-hover text-muted-foreground">
                    <MessageSquare size={24} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {searchTerm 
                      ? (isRtl ? 'نتیجه‌ای یافت نشد.' : 'No conversations found.')
                      : (isRtl ? 'تاریخچه گفتگوها خالی است.' : 'Your chat history is empty.')}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredConversations.map(conv => {
                    const isSelected = activeConversationId === conv.id;
                    const agentName = getAgentName(conv.agentId);
                    
                    return (
                      <button
                        key={conv.id}
                        type="button"
                        onClick={() => {
                          onSelect(conv.id, conv.agentId, conv.agentId.startsWith('app:') ? conv.agentId.slice(4) : undefined);
                        }}
                        className={`flex w-full flex-col gap-1.5 rounded-xl border p-3 text-start transition-all tactile-button ${
                          isSelected 
                            ? 'border-primary/50 bg-primary/10' 
                            : 'border-transparent bg-background hover:border-border hover:bg-surface-hover'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className={`line-clamp-1 text-sm font-medium ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                            {conv.title || (isRtl ? 'گفتگوی جدید' : 'New Conversation')}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="truncate rounded-md bg-surface-hover px-1.5 py-0.5 font-medium">
                            {agentName}
                          </span>
                          <span className="flex shrink-0 items-center gap-1">
                            <Clock size={12} />
                            {formatDate(conv.updatedAt || conv.createdAt)}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
