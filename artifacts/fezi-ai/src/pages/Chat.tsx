import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@clerk/react';
import { Link, useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { createChatConversation, getChatHistory, getListChatConversationsQueryKey, sendChat, useListAgents, useSynthesizeSpeech, useTranscribeVoice, type ChatHistory } from '@workspace/api-client-react';
import { useTranslation, useApiLocalization } from '../lib/i18n';
import { Card, Button } from '../components/ui-parts';
import { Brain, Send, Volume2, Square, LoaderCircle, Plus, Paperclip, Mic, X, FileText, Grid2X2, MoreVertical, Check, Copy, Share2, Image as ImageIcon, Download, WandSparkles, Video, Server, ChevronRight, Lock, ThumbsUp, ThumbsDown, Gamepad2, Play, History } from 'lucide-react';
import { AgentAvatar } from '../components/AgentAvatar';
import { ChatHistoryPanel } from '../components/ChatHistoryPanel';
import { ChatModelPicker, type ChatModelCatalog } from '../components/ChatModelPicker';
import { BrandLogo } from '../components/BrandLogo';
import { useLocalStore } from '../lib/store';
import { SubscriptionBadge, SubscriptionPrompt } from '../components/SubscriptionPrompt';
import customAgentMaker from '@/assets/custom-agent-maker.svg';
import { useAccount } from '../lib/account';
import { StudioLogo, studioMeta, type StudioId } from '../components/StudioLogo';
import { requestGuestAccount } from '../lib/auth-gate';
import { capabilityCommand, skillDisplayText, splitSkillDisplay, type ChatSkill } from '../lib/chat-skill-command';
import { ImagePromptCodePicker } from '../components/ImagePromptCodePicker';
import { buildImagePrompt } from '../lib/image-prompt-codes';
import { attachedChatUnavailableMessage, fileAnalysisUnavailableMessage } from '../lib/chat-continuation';

type AttachedFile = {
  name: string;
  content?: string;
  size: number;
  mimeType: string;
  kind: 'text' | 'image' | 'audio' | 'video' | 'file';
  dataUrl?: string;
  sourceFile?: File;
  voiceDraft?: boolean;
};
const MAX_CHAT_ATTACHMENT_BYTES = 8 * 1024 * 1024;
const analysisMimeTypes = new Set([
  'image/png', 'image/jpeg', 'image/webp', 'image/gif',
  'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/wav',
  'audio/webm', 'audio/ogg', 'audio/aac',
  'video/mp4', 'video/webm', 'video/quicktime', 'application/pdf',
]);
const textFileExtensions = /\.(txt|md|csv|json|js|ts|tsx|jsx|py|html|css|xml)$/i;
type StoredVoiceDraft = {
  blob: Blob;
  name: string;
  mimeType: string;
  kind: 'recording' | 'upload';
  transcript: string;
  savedAt: number;
};
type ChatLine = {
  role: 'user' | 'agent';
  text: string;
  messageId?: string;
  agentId?: string;
  credits?: number;
  attachments?: string[];
  image?: { dataUrl: string; prompt: string };
  video?: { dataUrl: string; prompt: string };
  media?: ChatMedia;
  subscriptionRequired?: boolean;
  feedback?: 'like' | 'dislike';
};
type ChatMedia = {
  type: 'image' | 'video';
  url: string;
  mimeType: string;
  model: string;
  isPreview: boolean;
  prompt: string;
};

// Media URLs are provided by the server (including protected same-origin URLs).
// Reject unsafe schemes before placing a URL in an image, video, or link.
function safeMediaUrl(url: string): string | null {
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : null;
  } catch {
    return null;
  }
}
type ChatConnector = {
  id: string;
  name: string;
  status: string;
  endpoint?: string;
  tools: Array<{ name: string; description: string }>;
};

const ARTA_GAMES = [
  { command: '/quiz', commandFa: '/کوییز', name: 'Quiz Master', nameFa: 'مسابقهٔ کوئیز', description: 'Trivia, topics, difficulty, scoring', descriptionFa: 'اطلاعات عمومی، موضوع، سطح و امتیاز', exampleFa: 'مثلاً: موضوع سینما، سطح سخت' },
  { command: '/guess', commandFa: '/حدس', name: 'Guessing Games', nameFa: 'بازی حدس‌زدنی', description: 'Character, object, word, place, mystery', descriptionFa: 'شخصیت، شیء، کلمه، مکان و راز', exampleFa: 'مثلاً: حدس شخصیت‌های تاریخی' },
  { command: '/riddle', commandFa: '/معما', name: 'Riddles', nameFa: 'معما', description: 'Logic and lateral-thinking puzzles', descriptionFa: 'معماهای منطقی و خلاقانه', exampleFa: 'مثلاً: یک معمای منطقی سخت' },
  { command: '/words', commandFa: '/کلمات', name: 'Word Games', nameFa: 'بازی کلمات', description: 'Associations, categories, word chains', descriptionFa: 'ارتباط، دسته‌بندی و زنجیرهٔ واژه', exampleFa: 'مثلاً: زنجیرهٔ واژه‌ها دربارهٔ طبیعت' },
  { command: '/story', commandFa: '/داستان', name: 'Interactive Stories', nameFa: 'داستان تعاملی', description: 'Branching adventures and choices', descriptionFa: 'ماجراجویی شاخه‌ای و انتخاب‌های داستانی', exampleFa: 'مثلاً: ماجراجویی در تهران آینده' },
  { command: '/roleplay', commandFa: '/نقش‌آفرینی', name: 'Roleplay', nameFa: 'رول‌پلی', description: 'Fictional characters and scenarios', descriptionFa: 'شخصیت‌ها و سناریوهای کاملاً داستانی', exampleFa: 'مثلاً: کارآگاه و دستیارش' },
  { command: '/party', commandFa: '/مهمانی', name: 'Party Games', nameFa: 'بازی مهمانی', description: 'Group challenges and social rounds', descriptionFa: 'چالش گروهی و دورهای اجتماعی', exampleFa: 'مثلاً: بازی دوراهی برای جمع دوستان' },
  { command: '/mystery', commandFa: '/معمایی', name: 'Mystery / Horror', nameFa: 'معمایی / ترسناک', description: 'Solve a fictional case', descriptionFa: 'حل یک پروندهٔ کاملاً داستانی', exampleFa: 'مثلاً: پروندهٔ خانهٔ متروکه' },
  { command: '/game-design', commandFa: '/طراحی-بازی', name: 'Game Design', nameFa: 'طراحی بازی', description: 'Mechanics, levels, economy, narrative', descriptionFa: 'مکانیک، مرحله، اقتصاد و روایت', exampleFa: 'مثلاً: طراحی یک بازی کارتی' },
  { command: '/prototype', commandFa: '/نمونه-اولیه', name: 'Game Prototype', nameFa: 'پروتوتایپ بازی', description: 'Turn an idea into a playable brief', descriptionFa: 'تبدیل ایده به brief قابل اجرا', exampleFa: 'مثلاً: پروتوتایپ یک بازی موبایلی' },
] as const;

function normalizeFeziVoiceTerms(value: string) {
  return value.replace(
    /(^|[\s\u200c,،.!?؟؛:()[\]{}"'`-])(فزی(?:\s*ای)?|فیزی|فیژی|fezi|fezy|fizi|fizy|fuzzy|fuzzyy|fezzy|fesi|fazi)(?=$|[\s\u200c,،.!?؟؛:()[\]{}"'`-])/giu,
    "$1FEZI",
  );
}

function containsPersianText(value: string) {
  return /[\u0600-\u06ff]/u.test(value);
}

function stripChatTransportArtifacts(value: string) {
  return value
    .replace(/user\s*:\s*safeAttached\s+image\b[^\r\n]*/giu, "")
    .replace(/safeAttached\s+image\b[^\r\n]*/giu, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function chatLineFromHistory(message: ChatHistory['messages'][number]): ChatLine {
  return {
    role: message.role,
    text: message.text,
    messageId: message.id,
    agentId: message.agentId,
    credits: message.credits,
    attachments: message.attachments,
    media: (message as typeof message & { media?: ChatMedia | null }).media ?? undefined,
  };
}
const MIN_VOICE_SECONDS = 3;
const SMART_MODEL = 'smart';
const CHAT_RESTORE_NOTICE_KEY = 'fezi-chat-last-visited-at';
const CHAT_RESTORE_NOTICE_TTL_MS = 10 * 60 * 1000;
const FREE_CHAT_AGENT_IDS = new Set(['monicah', 'arta']);
const VOICE_DRAFT_DB_NAME = 'fezi-chat-drafts';
const VOICE_DRAFT_STORE_NAME = 'voice';
const VOICE_DRAFT_KEY = 'pending';
const FEZI_FREE_MODEL = {
  id: 'openrouter/free',
  name: 'Automatic · Free APIs first',
  free: true,
  supportsReasoning: false,
  provider: 'fezi',
  providerLabel: 'Persian Dark Horse',
};
const CHAT_APPS = {
  claude: 'Claude',
  deepseek: 'DeepSeek',
  gapgpt: 'Persian Dark Horse',
  openai: 'OpenAI',
  mistral: 'Mistral',
} as const;
type ChatAppId = keyof typeof CHAT_APPS;
const isChatAppId = (value: string | null): value is ChatAppId =>
  value !== null && Object.prototype.hasOwnProperty.call(CHAT_APPS, value);
const modelBelongsToApp = (model: ChatModelCatalog['chat'][number], appId: ChatAppId) => {
  const origin = `${model.provider} ${model.id}`.toLowerCase();
  switch (appId) {
    case 'claude': return /anthropic|claude/.test(origin);
    case 'deepseek': return /deepseek/.test(origin);
    case 'openai': return /openai|gpt-|^o[134]-/.test(origin);
    case 'mistral': return /mistral/.test(origin);
    case 'gapgpt': return /gapgpt/.test(origin);
  }
};

function openVoiceDraftDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is unavailable'));
      return;
    }
    const request = indexedDB.open(VOICE_DRAFT_DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(VOICE_DRAFT_STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open voice draft storage'));
  });
}

async function saveVoiceDraft(draft: StoredVoiceDraft) {
  const db = await openVoiceDraftDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(VOICE_DRAFT_STORE_NAME, 'readwrite');
    transaction.objectStore(VOICE_DRAFT_STORE_NAME).put(draft, VOICE_DRAFT_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Could not save voice draft'));
  }).finally(() => db.close());
}

async function loadVoiceDraft(): Promise<StoredVoiceDraft | null> {
  const db = await openVoiceDraftDb();
  return new Promise<StoredVoiceDraft | null>((resolve, reject) => {
    const transaction = db.transaction(VOICE_DRAFT_STORE_NAME, 'readonly');
    const request = transaction.objectStore(VOICE_DRAFT_STORE_NAME).get(VOICE_DRAFT_KEY);
    request.onsuccess = () => resolve((request.result as StoredVoiceDraft | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error('Could not load voice draft'));
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => {
      db.close();
      reject(transaction.error ?? new Error('Could not load voice draft'));
    };
  });
}

async function clearVoiceDraft() {
  const db = await openVoiceDraftDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(VOICE_DRAFT_STORE_NAME, 'readwrite');
    transaction.objectStore(VOICE_DRAFT_STORE_NAME).delete(VOICE_DRAFT_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Could not clear voice draft'));
  }).finally(() => db.close());
}

type GapGptCatalogItem = {
  id: string;
  category: string;
  requiresSubscription: boolean;
  live?: boolean;
};

function gapGptModelName(id: string) {
  const value = id.split('/').pop()?.replace(/^gapgpt-/, '') ?? id;
  return value.replace(/[-_]/g, ' ');
}

function gapGptPickerModel(item: GapGptCatalogItem, reachable: boolean) {
  const supportsReasoning = /thinking|reason|codex|pro/i.test(item.id);
  const available = reachable && item.live === true;
  return {
    id: item.id,
    name: gapGptModelName(item.id),
    free: false,
    supportsReasoning,
    provider: 'gapgpt',
    providerLabel: 'Persian Dark Horse',
    requiresSubscription: item.requiresSubscription,
    available,
    availabilityLabel: available ? undefined : 'Temporarily unavailable',
  };
}

function shouldShowChatRestoreNotice() {
  if (typeof window === 'undefined') return false;
  try {
    const previousVisit = Number(window.sessionStorage.getItem(CHAT_RESTORE_NOTICE_KEY) || 0);
    window.sessionStorage.setItem(CHAT_RESTORE_NOTICE_KEY, String(Date.now()));
    return previousVisit > 0 && Date.now() - previousVisit < CHAT_RESTORE_NOTICE_TTL_MS;
  } catch {
    return false;
  }
}

export default function ChatPage() {
  const { t, lang, isRtl } = useTranslation();
  const { isSignedIn } = useAuth();
  const queryClient = useQueryClient();
  const { saveMemory } = useAccount();
  const apiLocale = useApiLocalization();
  const [location, setLocation] = useLocation();
  const { data: agents, isLoading: agentsLoading } = useListAgents();
  const { voiceEnabled } = useLocalStore(s => s.appSettings);
  
  const query = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : location.split('?')[1] ?? '');
  const requestedAgent = query.get('agent')?.trim().toLowerCase();
  const requestedConversationId = query.get('conversation')?.trim() || null;
  const selectionMode = query.get('select') === '1';
  const requestedTool = query.get('tool');
  const appId = isChatAppId(requestedTool) ? requestedTool : null;
  const appName = appId ? CHAT_APPS[appId] : null;
  const requestedModel = query.get('model')?.trim() || '';
  const toolNames: Record<string, string> = {
    claude: 'Claude',
    deepseek: 'DeepSeek',
    gapgpt: 'Persian Dark Horse',
    openai: 'OpenAI',
    mistral: 'Mistral',
    seedance: 'Seedance',
    image: 'AI Image',
    code: 'Coding Studio',
    research: 'Research Desk',
    voice: 'Persian Voice',
  };
  const [selectedId, setSelectedId] = useState(requestedAgent || (selectionMode && !appId ? '' : 'fezi'));
  const [message, setMessage] = useState('');
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [newChatPending, setNewChatPending] = useState(false);
  const [chatHistoryLoading, setChatHistoryLoading] = useState(false);
  const [chatHistoryError, setChatHistoryError] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(query.get('history') === '1');
  const [feedbackOpenIndex, setFeedbackOpenIndex] = useState<number | null>(null);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackSavingIndex, setFeedbackSavingIndex] = useState<number | null>(null);
  const [feedbackNoticeIndex, setFeedbackNoticeIndex] = useState<number | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [toolMenuOpen, setToolMenuOpen] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<ChatSkill | null>(null);
  const [toolTab, setToolTab] = useState<'tools' | 'connectors'>('tools');
  const [connectors, setConnectors] = useState<ChatConnector[]>([]);
  const [connectorsLoading, setConnectorsLoading] = useState(false);
  const [selectedConnectorIds, setSelectedConnectorIds] = useState<string[]>([]);
  const [connectorArguments, setConnectorArguments] = useState('{}');
  const [connectorCallBusy, setConnectorCallBusy] = useState<string | null>(null);
  const [connectorCallError, setConnectorCallError] = useState<string | null>(null);
  const [modelCatalog, setModelCatalog] = useState<ChatModelCatalog>({ chat: [], code: [], image: [], video: [], audio: [] });
  const [chatModelsLoading, setChatModelsLoading] = useState(false);
  const [selectedChatModel, setSelectedChatModel] = useState(
    requestedModel && requestedModel !== SMART_MODEL ? requestedModel : FEZI_FREE_MODEL.id,
  );
  const [agentPickerOpen, setAgentPickerOpen] = useState(false);
  const [fileError, setFileError] = useState(false);
  const [voiceTooShort, setVoiceTooShort] = useState(false);
  const [voiceError, setVoiceError] = useState(false);
  const [voiceCreditsExhausted, setVoiceCreditsExhausted] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingFinalizing, setRecordingFinalizing] = useState(false);
  const [speechToTextAvailable, setSpeechToTextAvailable] = useState(false);
  const [textToSpeechAvailable, setTextToSpeechAvailable] = useState(false);
  const [voiceFallbackRequired, setVoiceFallbackRequired] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [hasPaidAccess, setHasPaidAccess] = useState(false);
  const appCatalogAccess = Boolean(appId && isSignedIn && hasPaidAccess);
  const [restoredAppModel, setRestoredAppModel] = useState<{ scope: string; model: string } | null>(null);
  const appHistoryScope = `${appId || ''}:${requestedConversationId || ''}`;
  const [subscriptionPromptOpen, setSubscriptionPromptOpen] = useState(false);
  const [imagePanelOpen, setImagePanelOpen] = useState(false);
  const [imagePrompt, setImagePrompt] = useState('');
  const [imageCodes, setImageCodes] = useState<string[]>([]);
  const [imageGenerating, setImageGenerating] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [videoPanelOpen, setVideoPanelOpen] = useState(false);
  const [videoPrompt, setVideoPrompt] = useState('');
  const [chatPending, setChatPending] = useState(false);
  const [savingMemoryIndex, setSavingMemoryIndex] = useState<number | null>(null);
  const [savedMemoryIndexes, setSavedMemoryIndexes] = useState<Set<number>>(new Set());
  const [chatMenuOpen, setChatMenuOpen] = useState(false);
  const [messageActionIndex, setMessageActionIndex] = useState<number | null>(null);
  const [copiedLineIndex, setCopiedLineIndex] = useState<number | null>(null);
  const [sharedLineIndex, setSharedLineIndex] = useState<number | null>(null);
  
  const speech = useSynthesizeSpeech();
  const transcribe = useTranscribeVoice();
  
  const [voiceLineIndex, setVoiceLineIndex] = useState<number | null>(null);
  const [voiceErrorIndex, setVoiceErrorIndex] = useState<number | null>(null);
  const [voiceAudioSrc, setVoiceAudioSrc] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const wholeChatQueueRef = useRef<string[]>([]);
  const wholeChatPlayingRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceUploadFallbackRef = useRef(false);
  const recordingLifecycleLockRef = useRef(false);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingStartedAtRef = useRef<number | null>(null);
  const recordingAgentIdRef = useRef<string | null>(null);
  const recordingRunIdRef = useRef(0);
  const discardRecordingRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioFrameRef = useRef<number | null>(null);
  const chatAbortControllerRef = useRef<AbortController | null>(null);
  const chatHistoryRequestRef = useRef(0);
  const restoredAppModelRef = useRef<{ scope: string; model: string } | null>(null);
  const chosenAppModelRef = useRef<{ scope: string; model: string } | null>(null);
  const chatMountRef = useRef(false);
  const skipNextHistoryRestoreRef = useRef(false);
  const longPressTimerRef = useRef<number | null>(null);

  const selected = agents?.find(a => a.id === selectedId || a.slug?.toLowerCase() === selectedId) || null;
  const canCraftPrompt = !appId && ["monicah", "fezi", "arvin", "negar"].includes(selected?.id ?? "");
  const canTranscribeVoice = speechToTextAvailable;
  const canUseVoicePlayback = voiceEnabled && textToSpeechAvailable;
  const hasPersianChatText = lines.some((line) => containsPersianText(line.text));
  const selectedConnectors = connectors.filter((connector) => selectedConnectorIds.includes(connector.id));
  const isFreeChatAgent = (agentId?: string | null) => Boolean(agentId && FREE_CHAT_AGENT_IDS.has(agentId));

  const closeAudioMonitor = () => {
    if (audioFrameRef.current !== null) {
      window.cancelAnimationFrame(audioFrameRef.current);
      audioFrameRef.current = null;
    }
    analyserRef.current = null;
    const context = audioContextRef.current;
    audioContextRef.current = null;
    if (context && context.state !== 'closed') {
      void context.close().catch(() => undefined);
    }
    setAudioLevel(0);
  };

  const addSubscriptionNotice = () => {
    setLines((current) => [
      ...current,
      { role: 'agent', agentId: selected?.id, text: t('workspace_subscription_required'), subscriptionRequired: true },
    ]);
    setSubscriptionPromptOpen(true);
  };

  // Keep App conversations separate from Agent history and discard any in-flight
  // Agent request when navigating between Apps on the same mounted Chat page.
  useEffect(() => {
    chatAbortControllerRef.current?.abort();
    chatHistoryRequestRef.current += 1;
    setConversationId(null);
    chosenAppModelRef.current = null;
    setLines([]);
    setMessage('');
    setSelectedSkill(null);
    setAttachedFiles([]);
    setChatPending(false);
    setToolMenuOpen(false);
    setToolTab('tools');
    setImagePanelOpen(false);
    setVideoPanelOpen(false);
    setHistoryOpen(false);
  }, [appId]);

  useEffect(() => {
    let cancelled = false;
    let latestRequest = 0;
    if (!isSignedIn) {
      setHasPaidAccess(false);
      return;
    }
    const refreshStatus = () => {
      const requestId = ++latestRequest;
      void fetch('/api/payments/status', { credentials: 'include' })
        .then((response) => response.ok ? response.json() : Promise.reject(new Error('billing status unavailable')))
        .then((data: { hasPaidAccess?: boolean }) => {
          if (!cancelled && requestId === latestRequest) {
            setHasPaidAccess(Boolean(data.hasPaidAccess));
          }
        })
        .catch(() => {
          if (!cancelled && requestId === latestRequest) setHasPaidAccess(false);
        });
    };
    refreshStatus();
    window.addEventListener('focus', refreshStatus);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', refreshStatus);
    };
  }, [isSignedIn]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/voice/capabilities', { credentials: 'include' })
      .then((response) => response.ok ? response.json() as Promise<{ available?: boolean; textToSpeech?: boolean; speechToText?: boolean }> : Promise.reject(new Error('voice capabilities unavailable')))
      .then((data) => {
        if (!cancelled) {
          setSpeechToTextAvailable(Boolean(data.speechToText));
          setTextToSpeechAvailable(Boolean(data.textToSpeech));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSpeechToTextAvailable(false);
          setTextToSpeechAvailable(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadVoiceDraft()
      .then((draft) => {
        if (cancelled || !draft?.blob?.size) return;
        const file = new File([draft.blob], draft.name, { type: draft.mimeType || draft.blob.type || 'audio/webm' });
        setAttachedFiles((current) => current.length ? current : [{
          name: file.name,
          size: file.size,
          mimeType: file.type,
          kind: 'audio',
          sourceFile: file,
          ...(draft.kind === 'recording' ? { voiceDraft: true } : {}),
        }]);
        if (draft.transcript) {
          setMessage((current) => current.trim() ? current : draft.transcript);
        }
      })
      .catch(() => {
        // Voice drafts are best-effort; the chat must still work if browser storage is unavailable.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setChatModelsLoading(true);
    setSelectedChatModel(appId ? '' : FEZI_FREE_MODEL.id);
    setModelCatalog({ chat: [], code: [], image: [], video: [], audio: [] });
    if (appId && !appCatalogAccess) {
      setChatModelsLoading(false);
      return;
    }
    const openRouterRequest = fetch(appId
      ? `/api/openrouter/models?appId=${encodeURIComponent(appId)}`
      : `/api/openrouter/models?agentId=${encodeURIComponent(selected?.id || selectedId)}`, { credentials: 'include' })
      .then((response) => response.ok ? response.json() as Promise<{ appId?: string; modelCatalog?: Partial<ChatModelCatalog> }> : null)
      .catch(() => null);
    const gapGptRequest = appId ? Promise.resolve(null) : fetch('/api/gapgpt/status', { credentials: 'include' })
      .then((response) => response.ok ? response.json() as Promise<{ reachable?: boolean; catalog?: GapGptCatalogItem[] }> : null)
      .catch(() => null);
    Promise.all([openRouterRequest, gapGptRequest]).then(([openRouterData, gapGptData]) => {
        if (!cancelled) {
          const gapGptChat = (gapGptData?.catalog ?? [])
            .filter((item) => item.category === 'text')
            .map((item) => gapGptPickerModel(item, Boolean(gapGptData?.reachable)));
          const gapGptImage = (gapGptData?.catalog ?? [])
            .filter((item) => item.category === 'image')
            .map((item) => gapGptPickerModel(item, Boolean(gapGptData?.reachable)));
          const gapGptCode = gapGptChat.filter((model) => /codex|qwen|deepseek|claude|gpt-/i.test(model.id));
          const returnedModels = [...(openRouterData?.modelCatalog?.chat ?? []), ...gapGptChat];
          // The App catalog is scoped by the server. Only filter locally when
          // talking to an older server that has not yet implemented appId.
          const availableModels = appId && openRouterData?.appId !== appId
            ? returnedModels.filter((model) => modelBelongsToApp(model, appId))
            : returnedModels;
          const isUsableModel = (id: string) => availableModels.some((model) => model.id === id && model.available !== false);
          const savedModel = restoredAppModelRef.current?.scope === appHistoryScope ? restoredAppModelRef.current.model : '';
          const chosenModel = chosenAppModelRef.current?.scope === appHistoryScope ? chosenAppModelRef.current.model : '';
          const preferredModel = requestedModel && requestedModel !== SMART_MODEL && isUsableModel(requestedModel)
            ? requestedModel
            : appId && chosenModel && isUsableModel(chosenModel) ? chosenModel
            : appId && savedModel && isUsableModel(savedModel) ? savedModel
            : appId ? availableModels.find((model) => model.available !== false)?.id ?? '' : FEZI_FREE_MODEL.id;
           setModelCatalog({
             chat: appId ? availableModels : [FEZI_FREE_MODEL, ...availableModels.filter((model) => model.id !== FEZI_FREE_MODEL.id)],
             code: [...(openRouterData?.modelCatalog?.code ?? []), ...gapGptCode],
             image: [...(openRouterData?.modelCatalog?.image ?? []), ...gapGptImage],
             video: openRouterData?.modelCatalog?.video ?? [],
             audio: openRouterData?.modelCatalog?.audio ?? [],
           });
          setSelectedChatModel(preferredModel);
        }
      })
      .finally(() => {
        if (!cancelled) setChatModelsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [requestedModel, selectedId, selected?.id, selected?.model, appId, appCatalogAccess, appHistoryScope]);

  useEffect(() => {
    if (!appId || restoredAppModel?.scope !== appHistoryScope) return;
    if (chosenAppModelRef.current?.scope === appHistoryScope) return;
    if (requestedModel && requestedModel !== SMART_MODEL
      && modelCatalog.chat.some((model) => model.id === requestedModel && model.available !== false)) return;
    if (modelCatalog.chat.some((model) => model.id === restoredAppModel.model && model.available !== false)) {
      setSelectedChatModel(restoredAppModel.model);
    }
  }, [restoredAppModel, appId, appHistoryScope, requestedModel, modelCatalog.chat]);

  useEffect(() => {
    let cancelled = false;
    setConnectorsLoading(true);
    fetch('/api/connectors', { credentials: 'include' })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('connectors unavailable')))
      .then((data: { connections?: ChatConnector[] }) => {
        if (!cancelled) setConnectors((data.connections || []).filter((connection) => connection.status === 'connected'));
      })
      .catch(() => {
        if (!cancelled) setConnectors([]);
      })
      .finally(() => {
        if (!cancelled) setConnectorsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const nextAgent = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : location.split('?')[1] ?? '').get('agent')?.trim().toLowerCase();
    const matchingAgent = nextAgent && agents?.find((agent) => agent.id === nextAgent || agent.slug?.toLowerCase() === nextAgent);
    if (matchingAgent) {
      setSelectedId(matchingAgent.id);
    } else if (appId) {
      setSelectedId('fezi');
    }
    if (new URLSearchParams(typeof window !== 'undefined' ? window.location.search : location.split('?')[1] ?? '').get('history') === '1') {
      setHistoryOpen(true);
    }
  }, [location, agents, appId]);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    const historyRequestId = ++chatHistoryRequestRef.current;
    if (skipNextHistoryRestoreRef.current && !requestedConversationId) {
      skipNextHistoryRestoreRef.current = false;
      return () => {
        cancelled = true;
      };
    }
    skipNextHistoryRestoreRef.current = false;
    if (appId) {
      restoredAppModelRef.current = null;
      setRestoredAppModel(null);
    }
    setConversationId(null);
    setSavedMemoryIndexes(new Set());
    const showRestoreNotice = Boolean(!appId && isSignedIn && !chatMountRef.current && shouldShowChatRestoreNotice());
    chatMountRef.current = true;
    setChatHistoryLoading(Boolean(requestedConversationId) || showRestoreNotice);
    setChatHistoryError(false);
    const restoreNoticeTimer = showRestoreNotice && !requestedConversationId
      ? window.setTimeout(() => setChatHistoryLoading(false), 1800)
      : null;
    if (!isSignedIn || (appId && !hasPaidAccess)) {
      setChatHistoryLoading(false);
      setLines([{ role: 'agent', agentId: selected.id, text: t('workspace_agent_intro', { name: appName || selected.name }) }]);
      return () => {
        cancelled = true;
        if (restoreNoticeTimer !== null) window.clearTimeout(restoreNoticeTimer);
      };
    }
    const historyRequest = appId
      ? fetch(`/api/chat/history?agentId=${encodeURIComponent(selected.id)}&appId=${encodeURIComponent(appId)}${requestedConversationId ? `&conversationId=${encodeURIComponent(requestedConversationId)}` : ''}`, { credentials: 'include' })
        .then((response) => response.ok ? response.json() as Promise<ChatHistory> : Promise.reject(new Error('App chat history unavailable')))
      : getChatHistory({
          agentId: selected.id,
          conversationId: requestedConversationId ?? undefined,
        });
    void historyRequest
      .then((history) => {
        if (cancelled || historyRequestId !== chatHistoryRequestRef.current) return;
        setConversationId(history.conversationId);
        if (appId) {
          const savedModel = (history as ChatHistory & { model?: string }).model;
          const candidate = savedModel ? { scope: appHistoryScope, model: savedModel } : null;
          restoredAppModelRef.current = candidate;
          setRestoredAppModel(candidate);
        }
        setChatHistoryLoading(false);
        setLines(history.messages.length
          ? history.messages.map(chatLineFromHistory)
          : [{
              role: 'agent',
              agentId: selected.id,
              text: t('workspace_agent_intro', { name: appName || selected.name }),
            }]);
      })
      .catch(() => {
        if (cancelled || historyRequestId !== chatHistoryRequestRef.current) return;
        setConversationId(null);
        setChatHistoryLoading(false);
        setChatHistoryError(true);
        setLines([{
          role: 'agent',
          agentId: selected.id,
          text: t('workspace_agent_intro', { name: appName || selected.name }),
        }]);
      });
    return () => {
      cancelled = true;
      if (restoreNoticeTimer !== null) window.clearTimeout(restoreNoticeTimer);
    };
  }, [selected?.id, requestedConversationId, lang, isSignedIn, appId, hasPaidAccess, appHistoryScope]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines, chatPending]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      wholeChatQueueRef.current = [];
      wholeChatPlayingRef.current = false;
      if (longPressTimerRef.current !== null) {
        window.clearTimeout(longPressTimerRef.current);
      }
      if (audioFrameRef.current !== null) window.cancelAnimationFrame(audioFrameRef.current);
       closeAudioMonitor();
      chatAbortControllerRef.current?.abort();
      chatAbortControllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const player = audioRef.current;
    if (!player || !voiceAudioSrc) return;
    player.src = voiceAudioSrc;
    player.load();
    void player.play().catch(() => {
      setVoiceLineIndex(null);
      setVoiceErrorIndex(null);
    });
  }, [voiceAudioSrc]);

  useEffect(() => {
    if (!recording) {
      setRecordingSeconds(0);
      return;
    }
    const timer = window.setInterval(() => setRecordingSeconds((seconds) => seconds + 1), 1000);
    return () => window.clearInterval(timer);
  }, [recording]);

  const clearConversationFromUrl = (agentId: string) => {
    const nextQuery = new URLSearchParams(query);
    nextQuery.set('agent', agentId);
    nextQuery.delete('conversation');
    nextQuery.delete('history');
    setLocation(`/chat?${nextQuery.toString()}`);
  };

  const closeHistory = () => {
    setHistoryOpen(false);
    const nextQuery = new URLSearchParams(window.location.search);
    if (nextQuery.has('history')) {
      nextQuery.delete('history');
      setLocation(`/chat${nextQuery.size ? `?${nextQuery.toString()}` : ''}`);
    }
  };

  const openHistory = () => {
    setHistoryOpen(true);
    setAgentPickerOpen(false);
    setChatMenuOpen(false);
    const nextQuery = new URLSearchParams(window.location.search);
    if (!nextQuery.has('history')) {
      nextQuery.set('history', '1');
      setLocation(`/chat?${nextQuery.toString()}`);
    }
  };

  const switchAgent = (id: string) => {
    const nextAgent = agents?.find((agent) => agent.id === id);
    if (nextAgent?.status === 'locked' && !hasPaidAccess && !isFreeChatAgent(nextAgent.id)) {
      setSubscriptionPromptOpen(true);
      setAgentPickerOpen(false);
      return;
    }
    cancelChat();
    chosenAppModelRef.current = null;
    chatHistoryRequestRef.current += 1;
    if (audioRef.current) audioRef.current.pause();
    setVoiceAudioSrc(null);
    setVoiceLineIndex(null);
    setVoiceErrorIndex(null);
    setLocation(`/chat?agent=${encodeURIComponent(id)}`);
    setSelectedId(id);
    setAgentPickerOpen(false);
    setHistoryOpen(false);
    setMessage('');
    setSelectedSkill(null);
    setLines([]);
    setConversationId(null);
    setSavedMemoryIndexes(new Set());
  };

  const cancelChat = () => {
    chatAbortControllerRef.current?.abort();
    chatAbortControllerRef.current = null;
    setChatPending(false);
  };

  const startNewChat = async () => {
    if (!isSignedIn) {
      requestGuestAccount(isRtl ? 'برای ساخت گفت‌وگوی جدید، ابتدا حساب رایگان بسازید.' : 'Create a free account before creating a new conversation.');
      return;
    }
    if (!selected || newChatPending) return;
    cancelChat();
    chosenAppModelRef.current = null;
    restoredAppModelRef.current = null;
    setRestoredAppModel(null);
    chatHistoryRequestRef.current += 1;
    skipNextHistoryRestoreRef.current = Boolean(requestedConversationId);
    clearConversationFromUrl(selected.id);
    setAgentPickerOpen(false);
    setToolMenuOpen(false);
    setMessage('');
    setSelectedSkill(null);
    setAttachedFiles([]);
    setConversationId(null);
    setChatHistoryError(false);
    setChatHistoryLoading(false);
    setHistoryOpen(false);
    setSavedMemoryIndexes(new Set());
    setLines([{
      role: 'agent',
      agentId: selected.id,
      text: t('workspace_agent_intro', { name: appName || selected.name }),
    }]);
    setNewChatPending(true);
    try {
      const history = appId
        ? await fetch('/api/chat/conversations', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ agentId: selected.id, appId }),
          }).then((response) => response.ok ? response.json() as Promise<ChatHistory> : Promise.reject(new Error('Could not create App chat')))
        : await createChatConversation({ agentId: selected.id });
      setConversationId(history.conversationId);
      if (appId && history.conversationId) {
        const nextQuery = new URLSearchParams(window.location.search);
        nextQuery.set('conversation', history.conversationId);
        setLocation(`/chat?${nextQuery.toString()}`);
      }
      void queryClient.invalidateQueries({ queryKey: getListChatConversationsQueryKey() });
    } catch {
      // The next message can still create the conversation server-side.
    } finally {
      setNewChatPending(false);
    }
  };

  const openConversation = (nextConversationId: string, agentId: string, conversationAppId?: string) => {
    if (newChatPending) return;
    if (nextConversationId === conversationId && conversationAppId === (appId ?? undefined) && (appId || agentId === selected?.id)) {
      closeHistory();
      return;
    }
    if ((message.trim() || attachedFiles.length) && !window.confirm(isRtl
      ? 'متن نوشته‌شده هنوز ارسال نشده است. بدون ذخیره‌کردن آن گفتگو را عوض می‌کنید؟'
      : 'Your draft has not been sent. Switch conversations without saving it?')) return;
    cancelChat();
    chosenAppModelRef.current = null;
    chatHistoryRequestRef.current += 1;
    skipNextHistoryRestoreRef.current = false;
    if (audioRef.current) audioRef.current.pause();
    setVoiceAudioSrc(null);
    setVoiceLineIndex(null);
    setVoiceErrorIndex(null);
    setAgentPickerOpen(false);
    setChatMenuOpen(false);
    setHistoryOpen(false);
    setSelectedId(conversationAppId ? 'fezi' : agentId);
    setMessage('');
    setAttachedFiles([]);
    setSelectedSkill(null);
    setSavedMemoryIndexes(new Set());
    setLines([]);
    setConversationId(null);
    setChatHistoryError(false);
    setChatHistoryLoading(true);
    setLocation(conversationAppId
      ? `/chat?tool=${encodeURIComponent(conversationAppId)}&conversation=${encodeURIComponent(nextConversationId)}`
      : `/chat?agent=${encodeURIComponent(agentId)}&conversation=${encodeURIComponent(nextConversationId)}`);
  };

  const sendMessage = (clean: string, attachmentNames: string[] = [], fileContext = '', targetAgentId?: string, skill?: ChatSkill | null, retryableFiles: AttachedFile[] = []) => {
    if (!isSignedIn) {
      requestGuestAccount(isRtl ? 'برای ارسال اولین پیام، ساخت حساب رایگان لازم است.' : 'Create a free account before sending your first message.');
      return;
    }
    const targetAgent = (targetAgentId ? agents?.find((agent) => agent.id === targetAgentId) : undefined) || selected;
    const safeMessage = stripChatTransportArtifacts(clean);
    if (!safeMessage || !targetAgent || chatPending || newChatPending) return;
    if (appId ? !hasPaidAccess : targetAgent.status === 'locked' && !hasPaidAccess && !isFreeChatAgent(targetAgent.id)) {
      addSubscriptionNotice();
      return;
    }
    if (appId && (!selectedChatModel || !modelCatalog.chat.some((model) => model.id === selectedChatModel && model.available !== false))) {
      setLines((current) => [...current, { role: 'agent', text: isRtl ? 'مدل‌های این برنامه در دسترس نیستند. لطفاً دوباره تلاش کنید.' : 'This App has no available chat models. Please try again later.' }]);
      return;
    }

    const connectorContext = selectedConnectors.length > 0
      ? `Selected connector apps for this chat:\n${selectedConnectors.map((connector) => `- ${connector.name} (${connector.tools.length} discovered tools)`).join('\n')}`
      : '';
    const apiMessage = [skill?.instruction, safeMessage, connectorContext, fileContext ? `Attached files:\n${fileContext}` : ''].filter(Boolean).join('\n\n');
    const displayMessage = skillDisplayText(safeMessage, skill?.command);
    chatHistoryRequestRef.current += 1;
    setLines(prev => [...prev, { role: 'user', text: displayMessage, attachments: attachmentNames }]);
    setMessage('');
    if (skill) setSelectedSkill(null);
    setAttachedFiles([]);
    const controller = new AbortController();
    chatAbortControllerRef.current = controller;
    setChatPending(true);
    void sendChat(
      {
        agentId: targetAgent.id,
        message: apiMessage,
        displayMessage,
        attachments: attachmentNames,
        conversationId,
        model: selectedChatModel,
        ...(appId ? { appId } : {}),
      },
      { signal: controller.signal },
    )
      .then((res) => {
        if (controller.signal.aborted) return;
        void clearVoiceDraft().catch(() => undefined);
        setConversationId(res.conversationId);
        if (appId && res.conversationId) {
          const nextQuery = new URLSearchParams(window.location.search);
          nextQuery.set('tool', appId);
          nextQuery.set('conversation', res.conversationId);
          nextQuery.delete('agent');
          setLocation(`/chat?${nextQuery.toString()}`);
        }
        setLines(prev => [...prev, { role: 'agent', messageId: res.messageId, agentId: res.agentId, text: stripChatTransportArtifacts(res.message), media: (res as typeof res & { media?: ChatMedia | null }).media ?? undefined }]);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const subscriptionRequired = typeof error === 'object' && error !== null
          && 'status' in error && error.status === 402
          && 'data' in error && typeof error.data === 'object' && error.data !== null
          && 'code' in error.data && (error.data.code === 'APP_SUBSCRIPTION_REQUIRED' || error.data.code === 'SUBSCRIPTION_REQUIRED');
        if (subscriptionRequired) {
          if (appId) setHasPaidAccess(false);
          setMessage((current) => current.trim() ? current : safeMessage);
          addSubscriptionNotice();
          return;
        }
        const serverReason = typeof error === 'object' && error !== null && 'data' in error
            && typeof error.data === 'object' && error.data !== null && 'error' in error.data
            && typeof error.data.error === 'string'
              ? error.data.error : null;
        const paymentRequired = typeof error === 'object' && error !== null && 'status' in error && error.status === 402;
        const unavailable = typeof error === 'object' && error !== null && 'status' in error && error.status === 503
          && 'data' in error && typeof error.data === 'object' && error.data !== null && 'code' in error.data && error.data.code === 'CHAT_UNAVAILABLE';
        if (appId) {
          const reason = serverReason ?? (isRtl ? 'ارسال پیام تأیید نشد. متن شما بازگردانده شد؛ قبل از تلاش دوباره تاریخچه را بررسی کنید.' : 'The message could not be confirmed. Your text was restored; check chat history before retrying.');
          setMessage((current) => current.trim() ? current : safeMessage);
          if (attachmentNames.length) setAttachedFiles((current) => current.length ? current : retryableFiles);
          setLines((current) => [...current, { role: 'agent', text: reason, subscriptionRequired: paymentRequired }]);
          return;
        }
        if (unavailable && typeof error.data === 'object' && error.data !== null && 'conversationId' in error.data && typeof error.data.conversationId === 'string') {
          setConversationId(error.data.conversationId);
        }
        setMessage((current) => current.trim() ? current : (attachmentNames.length && safeMessage === t('workspace_file_ready') ? '' : safeMessage));
        if (attachmentNames.length) setAttachedFiles((current) => current.length ? current : retryableFiles);
        if (skill) setSelectedSkill(skill);
        setLines(prev => [...prev, {
          role: 'agent',
          agentId: targetAgent.id,
          subscriptionRequired: paymentRequired,
          text: attachmentNames.length && (!serverReason || unavailable)
            ? attachedChatUnavailableMessage(isRtl)
            : serverReason ?? (isRtl
            ? unavailable
              ? 'پاسخ‌دهنده موقتاً در دسترس نیست. اعتباری برای این پاسخ کسر نشده؛ متن پیام در کادر نوشتن برگشته تا دوباره تلاش کنی.'
              : 'ارسال پیام تأیید نشد. متن پیام در کادر نوشتن برگشته؛ قبل از ارسال دوباره، سابقهٔ گفتگو را بررسی کن.'
            : unavailable
              ? 'The responder is temporarily unavailable. No Credits were charged for this reply; your message has been restored so you can retry.'
              : 'The message could not be confirmed. Your text has been restored; check chat history before trying again.'),
        }]);
      })
      .finally(() => {
        void queryClient.invalidateQueries({ queryKey: getListChatConversationsQueryKey() });
        if (chatAbortControllerRef.current === controller) {
          chatAbortControllerRef.current = null;
          setChatPending(false);
        }
      });
  };

  const submitFeedback = async (index: number, rating: 'like' | 'dislike', comment = '') => {
    const line = lines[index];
    if (!line?.messageId) return;
    setFeedbackSavingIndex(index);
    try {
      const response = await fetch(`/api/chat/messages/${encodeURIComponent(line.messageId)}/feedback`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, comment }),
      });
      if (!response.ok) throw new Error('feedback failed');
      setLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, feedback: rating } : item));
      setFeedbackOpenIndex(null);
      setFeedbackComment('');
      setFeedbackNoticeIndex(index);
      window.setTimeout(() => setFeedbackNoticeIndex((current) => current === index ? null : current), 2200);
    } catch {
      setFeedbackNoticeIndex(null);
    } finally {
      setFeedbackSavingIndex(null);
    }
  };

  const runConnectorTool = async (connector: ChatConnector, tool: ChatConnector['tools'][number]) => {
    if (!isSignedIn) {
      requestGuestAccount(isRtl ? 'برای اجرای ابزار، ابتدا حساب رایگان بسازید.' : 'Create a free account before running a tool.');
      return;
    }
    if (!selected || connectorCallBusy) return;
    let argumentsObject: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(connectorArguments || '{}');
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Arguments must be a JSON object');
      argumentsObject = parsed as Record<string, unknown>;
    } catch {
      setConnectorCallError('Enter valid JSON arguments, for example {}');
      return;
    }
    setConnectorCallBusy(`${connector.id}:${tool.name}`);
    setConnectorCallError(null);
    try {
      const response = await fetch(`/api/connectors/${encodeURIComponent(connector.id)}/call`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: selected.id, toolName: tool.name, arguments: argumentsObject }),
      });
      const payload = await response.json() as { connectorName?: string; toolName?: string; result?: { content?: Array<{ type?: string; text?: string }> }; error?: string };
      if (!response.ok) throw new Error(payload.error || 'Connector tool failed');
      const text = payload.result?.content?.map((item) => item.text || '').filter(Boolean).join('\n') || JSON.stringify(payload.result ?? {}, null, 2);
      setLines((current) => [
        ...current,
        { role: 'user', text: `${payload.connectorName || connector.name} · ${payload.toolName || tool.name}` },
        { role: 'agent', agentId: selected.id, text },
      ]);
      setToolMenuOpen(false);
    } catch (error) {
      setConnectorCallError(error instanceof Error ? error.message : 'Connector tool failed');
    } finally {
      setConnectorCallBusy(null);
    }
  };

  const generateImage = async (promptOverride?: string) => {
    if (!isSignedIn) {
      requestGuestAccount(isRtl ? 'برای ساخت تصویر، ابتدا حساب اسب تیره فارسی بسازید.' : 'Create a Persian Dark Horse account before generating an image.');
      return;
    }
    const cleanPrompt = (promptOverride ?? imagePrompt).trim();
    if (!cleanPrompt || !selected || imageGenerating || chatPending) return;
    const appliedCodes = promptOverride === undefined ? imageCodes : [];
    const generationPrompt = buildImagePrompt(cleanPrompt, appliedCodes);
    sendMessage(isRtl ? `لطفاً یک تصویر بساز: ${generationPrompt}` : `Please generate an image: ${generationPrompt}`);
    setImagePrompt('');
    setImageCodes([]);
    setImagePanelOpen(false);
  };

  const analyzeFile = async (file: AttachedFile, prompt: string, skill?: ChatSkill | null) => {
    if (!isSignedIn) {
      requestGuestAccount(isRtl ? 'برای تحلیل فایل، ابتدا حساب اسب تیره فارسی بسازید.' : 'Create a Persian Dark Horse account before analyzing a file.');
      return;
    }
    if (!selected || !file.sourceFile || !file.mimeType) return;
    if (selected.status === 'locked' && !hasPaidAccess && !isFreeChatAgent(selected.id)) {
      addSubscriptionNotice();
      return;
    }
    setImageGenerating(true);
    setImageError(false);
    try {
      const isImage = file.kind === 'image';
      const response = await fetch('/api/files/analyze-upload', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': file.mimeType,
          'X-Agent-Id': encodeURIComponent(selected.id),
          'X-File-Name': encodeURIComponent(file.name),
          'X-File-Mime-Type': encodeURIComponent(file.mimeType),
          'X-Analysis-Prompt': encodeURIComponent([skill?.instruction, prompt].filter(Boolean).join('\n\n').slice(0, 2000)),
        },
        body: file.sourceFile,
      });
      const result = await response.json() as { analysis?: string; error?: string };
      const analysis = stripChatTransportArtifacts(result.analysis ?? '');
      if (!response.ok || !analysis) throw new Error(result.error || 'image analysis failed');
      const defaultPrompt = file.kind === 'image'
        ? t('workspace_image_analysis_default')
        : file.kind === 'video'
          ? (isRtl ? 'این ویدئو را تحلیل کن.' : 'Analyze this video.')
          : file.kind === 'audio'
            ? (isRtl ? 'این فایل صوتی را تحلیل و خلاصه کن.' : 'Analyze and summarize this audio.')
            : (isRtl ? 'این فایل را تحلیل کن.' : 'Analyze this file.');
      setLines((current) => [
        ...current,
        {
          role: 'user',
          text: skillDisplayText(prompt || defaultPrompt, skill?.command),
          attachments: [file.name],
          ...(isImage ? { image: { dataUrl: file.dataUrl!, prompt: prompt || file.name } } : {}),
        },
        { role: 'agent', agentId: selected.id, text: analysis },
      ]);
      setMessage('');
      if (skill) setSelectedSkill(null);
      setAttachedFiles([]);
      void clearVoiceDraft().catch(() => undefined);
    } catch {
      const fallback = fileAnalysisUnavailableMessage(file.name, file.mimeType === 'application/pdf' ? 'pdf' : file.kind, isRtl);
      setLines((current) => [
        ...current,
        { role: 'agent', agentId: selected.id, text: fallback },
      ]);
      setImageError(false);
    } finally {
      setImageGenerating(false);
    }
  };

  const generateVideo = async () => {
    if (!isSignedIn) {
      requestGuestAccount(isRtl ? 'برای ساخت ویدیو، ابتدا حساب اسب تیره فارسی بسازید.' : 'Create a Persian Dark Horse account before generating a video.');
      return;
    }
    const cleanPrompt = videoPrompt.trim();
    if (!cleanPrompt || !selected || chatPending) return;
    sendMessage(isRtl ? `لطفاً یک ویدیو بساز: ${cleanPrompt}` : `Please generate a video: ${cleanPrompt}`);
    setVideoPrompt('');
    setVideoPanelOpen(false);
  };

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (appId && !isSignedIn) {
      requestGuestAccount(isRtl ? 'برای ارسال پیام، ابتدا حساب بسازید.' : 'Create an account before sending a message.');
      return;
    }
    if (appId && !hasPaidAccess) {
      addSubscriptionNotice();
      return;
    }
    const clean = message.trim();
    const fileContext = attachedFiles
      .filter((file) => file.kind === 'text')
      .map((file) => `--- ${file.name} ---\n${file.content || ''}`)
      .join('\n');
    const voiceDraft = attachedFiles.find((file) => file.voiceDraft);
    const analyzableFile = attachedFiles.find((file) => file.sourceFile && !file.voiceDraft);
    if (analyzableFile) {
      if (appId) {
        setLines((current) => [...current, { role: 'agent', text: isRtl ? 'تحلیل مستقیم این فایل در این برنامه هنوز پشتیبانی نمی‌شود. متن فایل را در گفتگو جای‌گذاری کنید.' : 'Direct file analysis is not supported in this App yet. Paste the file text into chat instead.' }]);
        return;
      }
      void analyzeFile(analyzableFile, clean, selectedSkill);
      return;
    }
    if (voiceDraft && !clean) {
      setVoiceError(true);
      setFileError(true);
      return;
    }
    if (!clean && !fileContext) return;
    const attachmentContext = attachedFiles
      .filter((file) => file.kind === 'file')
      .map((file) => `--- ${file.name} (${file.mimeType || 'file'}, ${file.size} bytes) ---\n${t('workspace_file_uploaded_without_preview')}`)
      .join('\n');
    sendMessage(
      clean || t('workspace_file_ready'),
      attachedFiles.filter((file) => !file.voiceDraft).map((file) => file.name),
      [fileContext, attachmentContext].filter(Boolean).join('\n'),
      undefined,
      selectedSkill,
      attachedFiles,
    );
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const isVoiceUploadFallback = voiceUploadFallbackRef.current;
    voiceUploadFallbackRef.current = false;
    event.currentTarget.accept = '*/*';
    event.target.value = '';
    if (!file) return;
    const mimeType = file.type.toLowerCase();
    const isText = mimeType.startsWith('text/') || textFileExtensions.test(file.name);
    const isAnalyzable = analysisMimeTypes.has(mimeType);
    if (isVoiceUploadFallback && !(isAnalyzable && mimeType.startsWith('audio/'))) {
      setVoiceFallbackRequired(true);
      setVoiceError(true);
      setFileError(true);
      return;
    }
    setVoiceError(false);
    setVoiceFallbackRequired(false);
    if (!file.size || file.size > MAX_CHAT_ATTACHMENT_BYTES || (!isText && !isAnalyzable)) {
      setFileError(true);
      setToolMenuOpen(false);
      return;
    }
    try {
      setFileError(false);
      if (mimeType.startsWith('image/')) {
        const dataUrl = URL.createObjectURL(file);
        setAttachedFiles((current) => [...current.filter((item) => item.name !== file.name), { name: file.name, size: file.size, mimeType: file.type, kind: 'image', dataUrl, sourceFile: file }]);
      } else if (isVoiceUploadFallback) {
        const voiceMimeType = file.type || 'audio/webm';
        const voiceName = file.name || `fezi-voice-${Date.now()}.webm`;
        setAttachedFiles((current) => [
          ...current.filter((item) => !item.voiceDraft),
          {
            name: voiceName,
            size: file.size,
            mimeType: voiceMimeType,
            kind: 'audio',
            sourceFile: file,
            voiceDraft: true,
          },
        ]);
        recordingLifecycleLockRef.current = true;
        setRecordingFinalizing(true);
        setVoiceCreditsExhausted(false);
        void saveVoiceDraft({
          blob: file,
          name: voiceName,
          mimeType: voiceMimeType,
          kind: 'upload',
          transcript: '',
          savedAt: Date.now(),
        }).catch(() => undefined);
        try {
          const audioBase64 = await blobToBase64(file);
          const result = await transcribe.mutateAsync({
            data: { audioBase64, mimeType: voiceMimeType },
          });
          const transcript = normalizeFeziVoiceTerms(result.text.trim());
          if (transcript) {
            setMessage(transcript);
            setFileError(false);
            setVoiceError(false);
            void saveVoiceDraft({
              blob: file,
              name: voiceName,
              mimeType: voiceMimeType,
              kind: 'upload',
              transcript,
              savedAt: Date.now(),
            }).catch(() => undefined);
          } else {
            setFileError(true);
            setVoiceError(true);
          }
        } catch (error) {
          setVoiceError(true);
          setVoiceCreditsExhausted(Boolean(error && typeof error === 'object' && 'status' in error && error.status === 402));
          setFileError(true);
        } finally {
          setRecordingFinalizing(false);
          recordingLifecycleLockRef.current = false;
          setToolMenuOpen(false);
        }
        return;
      } else if (mimeType.startsWith('audio/') || mimeType.startsWith('video/')) {
        setAttachedFiles((current) => [
          ...current.filter((item) => item.name !== file.name),
          {
            name: file.name,
            size: file.size,
            mimeType: file.type,
            kind: file.type.startsWith('audio/') ? 'audio' : 'video',
            sourceFile: file,
          },
        ]);
        if (file.type.startsWith('audio/')) {
          void saveVoiceDraft({
            blob: file,
            name: file.name,
            mimeType: file.type || 'audio/webm',
            kind: 'upload',
            transcript: '',
            savedAt: Date.now(),
          }).catch(() => undefined);
        }
      } else if (isText) {
        const content = await file.text();
        setAttachedFiles((current) => [...current.filter((item) => item.name !== file.name), { name: file.name, content, size: file.size, mimeType: file.type || 'text/plain', kind: 'text' }]);
      } else if (mimeType === 'application/pdf') {
        setAttachedFiles((current) => [...current.filter((item) => item.name !== file.name), { name: file.name, size: file.size, mimeType: file.type, kind: 'file', sourceFile: file }]);
      }
      setToolMenuOpen(false);
    } catch {
      setFileError(true);
    }
  };

  const blobToBase64 = (blob: Blob) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = reject;
    reader.onabort = () => reject(new DOMException('File read was aborted', 'AbortError'));
    reader.readAsDataURL(blob);
  });

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== 'recording' || !recording || recordingFinalizing) return;
    const elapsedSeconds = recordingStartedAtRef.current
      ? (Date.now() - recordingStartedAtRef.current) / 1000
      : recordingSeconds;
    if (elapsedSeconds < MIN_VOICE_SECONDS) {
      setVoiceTooShort(true);
      setFileError(true);
      return;
    }
    discardRecordingRef.current = false;
    setRecordingFinalizing(true);
    recorder.stop();
    closeAudioMonitor();
    setRecording(false);
  };

  const openFilePicker = (audioOnly = false) => {
    const input = fileInputRef.current;
    if (!input) return;
    voiceUploadFallbackRef.current = audioOnly;
    input.accept = audioOnly ? 'audio/*' : '*/*';
    input.click();
  };

  const cancelRecording = () => {
    discardRecordingRef.current = true;
    const recorder = mediaRecorderRef.current;
    if (recorder?.state === 'recording') {
      setRecordingFinalizing(true);
      recorder.stop();
    }
    closeAudioMonitor();
    setRecording(false);
    if (!recorder || recorder.state === 'inactive') setRecordingFinalizing(false);
    recordingAgentIdRef.current = null;
    setFileError(false);
    setVoiceTooShort(false);
    setAttachedFiles((current) => current.filter((file) => !file.voiceDraft));
    void clearVoiceDraft().catch(() => undefined);
  };

  const monitorAudio = (stream: MediaStream) => {
    const AudioContextConstructor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) return;
    const context = new AudioContextConstructor();
    const analyser = context.createAnalyser();
    analyser.fftSize = 64;
    const source = context.createMediaStreamSource(stream);
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    audioContextRef.current = context;
    analyserRef.current = analyser;
    const draw = () => {
      if (audioContextRef.current !== context || context.state === 'closed') return;
      try {
        analyser.getByteTimeDomainData(data);
      } catch {
        return;
      }
      const average = data.reduce((sum, value) => sum + Math.abs(value - 128), 0) / data.length;
      setAudioLevel(Math.min(1, average / 32));
      audioFrameRef.current = window.requestAnimationFrame(draw);
    };
    draw();
  };

  const startRecording = async () => {
    if (!isSignedIn) {
      requestGuestAccount(isRtl ? 'برای ساخت صدای ورودی، ابتدا حساب رایگان بسازید.' : 'Create a free account before using voice input.');
      return;
    }
    if (recordingLifecycleLockRef.current || recording || recordingFinalizing) return;
    setVoiceFallbackRequired(false);
    if (!canTranscribeVoice) {
      setVoiceError(true);
      setFileError(true);
      return;
    }
    setFileError(false);
    setVoiceTooShort(false);
    setVoiceError(false);
    setToolMenuOpen(false);
    recordingLifecycleLockRef.current = true;
    let stream: MediaStream | null = null;
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        recordingLifecycleLockRef.current = false;
        setVoiceFallbackRequired(true);
        setFileError(true);
        openFilePicker(true);
        return;
      }
      const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream = mediaStream;
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
        .find((type) => typeof MediaRecorder.isTypeSupported !== 'function' || MediaRecorder.isTypeSupported(type));
      const recorder = mimeType ? new MediaRecorder(mediaStream, { mimeType }) : new MediaRecorder(mediaStream);
      const runId = recordingRunIdRef.current + 1;
      recordingRunIdRef.current = runId;
      audioChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) audioChunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        recordingRunIdRef.current += 1;
        mediaStream.getTracks().forEach((track) => track.stop());
        if (mediaRecorderRef.current === recorder) mediaRecorderRef.current = null;
        closeAudioMonitor();
        recordingLifecycleLockRef.current = false;
        setRecording(false);
        setRecordingFinalizing(false);
        setVoiceError(true);
        setFileError(true);
      };
      recorder.onstop = async () => {
        mediaStream.getTracks().forEach((track) => track.stop());
        if (mediaRecorderRef.current === recorder) mediaRecorderRef.current = null;
        if (runId !== recordingRunIdRef.current) return;
        const elapsedSeconds = recordingStartedAtRef.current
          ? (Date.now() - recordingStartedAtRef.current) / 1000
          : recordingSeconds;
        recordingStartedAtRef.current = null;
        if (discardRecordingRef.current) {
          discardRecordingRef.current = false;
          recordingAgentIdRef.current = null;
          setRecordingFinalizing(false);
          recordingLifecycleLockRef.current = false;
          return;
        }
        if (elapsedSeconds < MIN_VOICE_SECONDS) {
          setVoiceTooShort(true);
          setVoiceError(false);
          setFileError(true);
          recordingAgentIdRef.current = null;
          setRecordingFinalizing(false);
          recordingLifecycleLockRef.current = false;
          return;
        }
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || mimeType || 'audio/webm' });
        const agentId = recordingAgentIdRef.current;
        if (!blob.size) {
          recordingAgentIdRef.current = null;
          setVoiceError(true);
          setFileError(true);
          setRecordingFinalizing(false);
          recordingLifecycleLockRef.current = false;
          return;
        }
        const voiceMimeType = blob.type || 'audio/webm';
        const voiceName = `fezi-voice-${Date.now()}.${voiceMimeType.includes('mp4') ? 'm4a' : 'webm'}`;
        const voiceFile = new File([blob], voiceName, { type: voiceMimeType });
        setAttachedFiles((current) => [
          ...current.filter((item) => !item.voiceDraft),
          {
            name: voiceFile.name,
            size: voiceFile.size,
            mimeType: voiceMimeType,
            kind: 'audio',
            sourceFile: voiceFile,
            voiceDraft: true,
          },
        ]);
        void saveVoiceDraft({
          blob,
          name: voiceName,
          mimeType: voiceMimeType,
          kind: 'recording',
          transcript: '',
          savedAt: Date.now(),
        }).catch(() => undefined);
        try {
          setVoiceCreditsExhausted(false);
          const audioBase64 = await blobToBase64(blob);
          const result = await transcribe.mutateAsync({
            data: { audioBase64, mimeType: voiceMimeType },
          });
          setVoiceTooShort(false);
          setVoiceError(false);
          setFileError(false);
          const transcript = normalizeFeziVoiceTerms(result.text.trim());
          if (transcript) {
             setMessage(transcript);
              void saveVoiceDraft({
                blob,
                name: voiceName,
                mimeType: voiceMimeType,
                kind: 'recording',
                transcript,
                savedAt: Date.now(),
              }).catch(() => undefined);
          } else {
            setFileError(true);
          }
        } catch (error) {
          setVoiceTooShort(false);
          setVoiceError(true);
          setVoiceCreditsExhausted(Boolean(error && typeof error === 'object' && 'status' in error && error.status === 402));
          setFileError(true);
        } finally {
          recordingAgentIdRef.current = null;
          setRecordingFinalizing(false);
          recordingLifecycleLockRef.current = false;
        }
      };
      mediaRecorderRef.current = recorder;
      recordingAgentIdRef.current = selected?.id || null;
      recordingStartedAtRef.current = Date.now();
      discardRecordingRef.current = false;
      monitorAudio(mediaStream);
      recorder.start();
      setRecording(true);
    } catch {
      stream?.getTracks().forEach((track) => track.stop());
      recordingLifecycleLockRef.current = false;
      setVoiceError(true);
      setVoiceFallbackRequired(true);
      setFileError(true);
      setRecordingFinalizing(false);
      mediaRecorderRef.current = null;
      recordingAgentIdRef.current = null;
      closeAudioMonitor();
      openFilePicker(true);
    }
  };

  const toggleVoice = (line: ChatLine, index: number) => {
    if (!isSignedIn) {
      requestGuestAccount(isRtl ? 'برای ساخت صدای پاسخ، ابتدا حساب رایگان بسازید.' : 'Create a free account before generating audio.');
      return;
    }
    if (!canUseVoicePlayback || containsPersianText(line.text)) return;
    
    if (voiceLineIndex === index && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setVoiceLineIndex(null);
      return;
    }
    
    wholeChatQueueRef.current = [];
    wholeChatPlayingRef.current = false;
    if (audioRef.current) audioRef.current.pause();
    setVoiceAudioSrc(null);
    setVoiceErrorIndex(null);
    setVoiceLineIndex(index);
    
    speech.mutate(
       { data: { agentId: line.agentId || selected?.id || 'fezi', text: line.text } },
      {
        onSuccess: (res) => {
          const mime = res.audioFormat === 'mp3' ? 'audio/mpeg' : `audio/${res.audioFormat}`;
          setVoiceAudioSrc(`data:${mime};base64,${res.audioBase64}`);
        },
        onError: () => {
          setVoiceLineIndex(null);
          setVoiceErrorIndex(index);
        }
      }
    );
  };

  const clearMessageLongPress = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const openMessageActions = (index: number) => {
    clearMessageLongPress();
    setChatMenuOpen(false);
    setMessageActionIndex(index);
  };

  const beginMessageLongPress = (index: number) => {
    clearMessageLongPress();
    longPressTimerRef.current = window.setTimeout(() => {
      openMessageActions(index);
    }, 550);
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        const copied = document.execCommand('copy');
        textarea.remove();
        return copied;
      } catch {
        return false;
      }
    }
  };

  const formatChatText = () => lines
    .filter((line) => line.text.trim())
    .map((line) => `${line.role === 'user' ? (isRtl ? 'شما' : 'You') : (appName || selected?.name || 'Agent')}:\n${line.text.trim()}`)
    .join('\n\n');

  const shareText = async (title: string, text: string) => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, text });
        return true;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return false;
      }
    }
    return copyText(text);
  };

  const saveMemoryForLine = (line: ChatLine, index: number) => {
    if (!line.text.trim() || savedMemoryIndexes.has(index) || savingMemoryIndex === index) return;
    setSavingMemoryIndex(index);
    void saveMemory(line.text, 'chat')
      .then(() => setSavedMemoryIndexes((current) => new Set(current).add(index)))
      .finally(() => setSavingMemoryIndex(null));
  };

  const copyLine = async (line: ChatLine, index: number) => {
    if (await copyText(line.text)) {
      setCopiedLineIndex(index);
      window.setTimeout(() => setCopiedLineIndex((current) => current === index ? null : current), 1600);
    }
    setMessageActionIndex(null);
  };

  const shareLine = async (line: ChatLine, index: number) => {
    if (await shareText(appName || selected?.name || 'Persian Dark Horse', line.text)) {
      setSharedLineIndex(index);
      window.setTimeout(() => setSharedLineIndex((current) => current === index ? null : current), 1600);
    }
    setMessageActionIndex(null);
  };

  const downloadChat = (format: 'txt' | 'json') => {
    if (!lines.length) return;
    const date = new Date().toISOString().slice(0, 10);
    const isJson = format === 'json';
    const content = isJson
      ? JSON.stringify({ agent: appName || selected?.name || selectedId, conversationId, exportedAt: new Date().toISOString(), messages: lines }, null, 2)
      : formatChatText();
    const blob = new Blob([content], { type: isJson ? 'application/json' : 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `fezi-chat-${date}.${format}`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setChatMenuOpen(false);
  };

  const playWholeChatChunk = (chunk: string) => {
    speech.mutate(
      { data: { agentId: selected?.id || selectedId || 'fezi', text: chunk } },
      {
        onSuccess: (res) => {
          const mime = res.audioFormat === 'mp3' ? 'audio/mpeg' : `audio/${res.audioFormat}`;
          setVoiceAudioSrc(`data:${mime};base64,${res.audioBase64}`);
        },
        onError: () => {
          wholeChatQueueRef.current = [];
          wholeChatPlayingRef.current = false;
          setVoiceLineIndex(null);
          setVoiceErrorIndex(-1);
        },
      },
    );
  };

  const playWholeChat = () => {
    if (!isSignedIn) {
      requestGuestAccount(isRtl ? 'برای پخش صوتی پاسخ‌ها، ابتدا حساب رایگان بسازید.' : 'Create a free account before generating audio.');
      return;
    }
    if (!canUseVoicePlayback || hasPersianChatText) return;
    const text = formatChatText();
    if (!text) return;
    const chunks = text.match(/[\s\S]{1,1800}(?:\s|$)/g)?.map((chunk) => chunk.trim()).filter(Boolean) || [text.slice(0, 1800)];
    if (audioRef.current) audioRef.current.pause();
    wholeChatQueueRef.current = chunks.slice(1);
    wholeChatPlayingRef.current = true;
    setVoiceAudioSrc(null);
    setVoiceErrorIndex(null);
    setVoiceLineIndex(-1);
    setChatMenuOpen(false);
    playWholeChatChunk(chunks[0]);
  };

  const shareWholeChat = async () => {
    const text = formatChatText();
    if (!text) return;
    await shareText(appName || selected?.name || 'Persian Dark Horse', text);
    setChatMenuOpen(false);
  };

  if (agentsLoading) return <div className="h-full flex items-center justify-center"><LoaderCircle className="animate-spin text-primary" /></div>;

  if (selectionMode && !selected && !appId) {
    const studios = Object.keys(studioMeta) as StudioId[];
    return (
      <div className="mx-auto w-full max-w-6xl space-y-8 fade-up">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Persian Dark Horse · New Chat</p>
          <h1 className="mt-3 text-3xl font-bold md:text-4xl">{isRtl ? 'Agent خود را انتخاب کنید' : 'Choose an Agent'}</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{isRtl ? 'برای شروع گفتگو یک Agent انتخاب کنید. Manika و Arta رایگان هستند.' : 'Choose an Agent to start your conversation. Manika and Arta are free to use.'}</p>
        </div>
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">{isRtl ? 'Agentها' : 'Agents'}</h2>
            <span className="text-xs text-muted-foreground">{isRtl ? 'Agentهای قفل‌شده نیاز به Subscription دارند.' : 'Locked Agents require a subscription.'}</span>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {agents?.map((agent) => {
              const locked = agent.status === 'locked' || (!hasPaidAccess && !FREE_CHAT_AGENT_IDS.has(agent.id));
              return locked ? (
                <Link key={agent.id} href="/billing" className="group relative rounded-2xl border border-border bg-surface p-5 opacity-75 transition-colors hover:border-primary/50 hover:opacity-100">
                  <div className="flex items-center gap-3">
                    <AgentAvatar agentId={agent.id} name={agent.name} className="h-14 w-14 rounded-xl grayscale" />
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold">{agent.name}</h3>
                      <p className="truncate text-xs text-muted-foreground">{apiLocale.getAgentSpecialty(agent)}</p>
                    </div>
                    <Lock size={16} className="ms-auto shrink-0 text-primary" />
                  </div>
                  <p className="mt-4 text-xs leading-5 text-muted-foreground">{isRtl ? 'برای استفاده اشتراک تهیه کنید.' : 'Subscribe to unlock this Agent.'}</p>
                </Link>
              ) : (
                <button key={agent.id} type="button" onClick={() => setLocation(`/chat?agent=${encodeURIComponent(agent.id)}`)} className="group rounded-2xl border border-border bg-surface p-5 text-start transition-all hover:-translate-y-1 hover:border-primary/60 hover:bg-primary/5">
                  <div className="flex items-center gap-3">
                    <AgentAvatar agentId={agent.id} name={agent.name} className="h-14 w-14 rounded-xl" />
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold">{agent.name}</h3>
                      <p className="truncate text-xs text-muted-foreground">{apiLocale.getAgentSpecialty(agent)}</p>
                    </div>
                    <ChevronRight size={17} className="ms-auto shrink-0 text-primary transition-transform group-hover:translate-x-1 rtl:rotate-180" />
                  </div>
                  <p className="mt-4 text-xs leading-5 text-muted-foreground">{apiLocale.getAgentDescription(agent)}</p>
                </button>
              );
            })}
          </div>
        </section>
        <section>
          <div className="mb-4">
            <h2 className="text-lg font-semibold">{isRtl ? 'استودیوها' : 'Studios'}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{isRtl ? 'استودیوی مناسب کارتان را انتخاب کنید.' : 'Choose the studio for the work you want to do.'}</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {studios.map((studioId) => {
              const studio = studioMeta[studioId];
              const studioLocked = studio.requiresSubscription && !hasPaidAccess;
              return (
                <Link key={studioId} href={studioLocked ? '/billing' : `/studio/${studioId}`} className={`group rounded-2xl border border-border bg-surface p-4 transition-all hover:-translate-y-1 hover:border-primary/60 hover:bg-primary/5 ${studioLocked ? 'opacity-75' : ''}`}>
                  <StudioLogo studioId={studioId} compact />
                  <h3 className="mt-4 font-semibold">{t(studio.titleKey)}</h3>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{t(studio.descKey)}</p>
                  <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary">{studioLocked ? (isRtl ? 'نیازمند اشتراک' : 'Subscription required') : (isRtl ? 'باز کردن' : 'Open')} <ChevronRight size={13} className="rtl:rotate-180" /></span>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-11rem-env(safe-area-inset-bottom))] min-h-[20rem] flex-col gap-3 fade-up md:h-[calc(100dvh-120px)] lg:gap-4 xl:flex-row">
      {/* Sidebar Agents */}
      {!appId && <Card className="xl:basis-[10%] xl:w-auto flex-shrink-0 flex flex-col p-4 lg:p-3 hidden xl:flex h-full">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 lg:text-center lg:mb-3">{t('workspace_agents')}</h3>
        <div className="space-y-2 overflow-y-auto flex-1 pe-2">
          {agents?.map(agent => (
               <div key={agent.id} className={`rounded-xl transition-all ${selectedId === agent.id ? 'border border-primary/30 bg-primary/10' : 'border border-transparent hover:bg-surface-hover'}`}>
                 <button
                   type="button"
                   onClick={() => switchAgent(agent.id)}
                    className="flex w-full items-center gap-3 p-3 text-start tactile-button lg:flex-col lg:gap-2 lg:p-2 lg:text-center"
                 >
                    <div className="w-8 h-8 rounded-lg bg-background flex items-center justify-center font-bold text-sm shrink-0 lg:h-10 lg:w-10 lg:rounded-xl" style={{ color: agent.accent || 'var(--gold)' }}>
                     <AgentAvatar agentId={agent.id} name={agent.name} className="h-full w-full rounded-lg" />
                   </div>
                    <div className="flex-1 min-w-0 lg:w-full">
                     <p className="text-sm font-semibold truncate">{agent.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate lg:hidden xl:block">{apiLocale.getAgentSpecialty(agent)}</p>
                   </div>
                    {agent.status === 'locked' && !hasPaidAccess && !isFreeChatAgent(agent.id) && <SubscriptionBadge className="hidden shrink-0 xl:inline-flex" />}
                 </button>
                  <Link href={`/apps?agent=${agent.id}`} className="mx-3 mb-2 flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] text-muted-foreground hover:bg-surface-hover hover:text-primary lg:mx-1">
                    <Grid2X2 size={13} /> <span className="lg:hidden xl:inline">{t('workspace_apps')}</span>
                 </Link>
               {agent.id === 'negar' && (
                 <Link
                   href="/my-agents?create=1"
                   className="mt-3 block rounded-xl border border-dashed border-primary/45 bg-primary/5 p-3 text-start transition-colors hover:border-primary hover:bg-primary/10"
                 >
                   <div className="flex items-center gap-3 lg:flex-col lg:gap-2 lg:text-center">
                     <img src={customAgentMaker} alt="" className="h-10 w-10 shrink-0 rounded-xl object-cover lg:h-12 lg:w-12" />
                     <div className="min-w-0">
                       <p className="text-xs font-semibold text-primary">{t('workspace_custom_agent_title')}</p>
                       <p className="mt-1 text-[10px] leading-4 text-muted-foreground lg:hidden xl:block">
                         {t('workspace_custom_agent_description')}
                       </p>
                     </div>
                     <Plus size={15} className="ms-auto shrink-0 text-primary lg:hidden" />
                   </div>
                 </Link>
               )}
               </div>
          ))}
        </div>
      </Card>}

       {/* Main Chat Area */}
         <Card className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden !p-0 lg:basis-0">
        {/* Chat Header */}
           <div className="relative flex min-h-16 flex-wrap items-center gap-2 border-b border-border bg-background/70 px-3 py-2 sm:min-h-[76px] sm:gap-3 sm:px-4 sm:py-3 md:px-6">
            <div className="h-10 w-10 shrink-0 rounded-xl bg-surface border border-border flex items-center justify-center font-bold sm:h-12 sm:w-12 sm:rounded-2xl" style={{ color: selected?.accent || 'var(--gold)' }}>
            {appId ? <BrandLogo name={appName || ''} id={appId} size={42} /> : selected && <AgentAvatar agentId={selected.id} name={selected.name} className="h-full w-full rounded-xl" />}
          </div>
           <div className="min-w-0 flex-1">
             <h2 className="truncate text-base font-semibold tracking-tight">{appName || selected?.name}</h2>
             <div className="flex min-w-0 items-center gap-2">
               <p className="truncate text-xs text-muted-foreground">{appId ? (isRtl ? 'گفتگوی برنامه · هزینه از اعتبار اشتراک' : 'App chat · uses subscription Credits') : apiLocale.getAgentSpecialty(selected)}</p>
                 {(appId ? !hasPaidAccess : selected?.status === 'locked' && !hasPaidAccess && !isFreeChatAgent(selected.id)) && (
                   <span className="hidden lg:block"><SubscriptionBadge className="shrink-0" /></span>
                 )}
              {!appId && requestedTool && toolNames[requestedTool] && (
                <span className="shrink-0 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] text-primary">{toolNames[requestedTool]}</span>
              )}
            </div>
          </div>
            {appId && (
              <label className="order-last flex w-full min-w-0 items-center gap-2 text-xs text-muted-foreground sm:order-none sm:w-auto sm:max-w-[14rem]">
                <span className="sr-only">{isRtl ? 'نسخه مدل' : 'Model version'}</span>
                <select
                  aria-label={isRtl ? 'نسخه مدل' : 'Model version'}
                  dir="ltr"
                  value={selectedChatModel}
                  onChange={(event) => {
                    chosenAppModelRef.current = { scope: appHistoryScope, model: event.target.value };
                    setSelectedChatModel(event.target.value);
                  }}
                  disabled={chatModelsLoading || !modelCatalog.chat.length}
                  className="min-h-11 w-full min-w-0 rounded-xl border border-border bg-background px-2 text-xs text-foreground focus:border-primary disabled:opacity-60"
                >
                  {!selectedChatModel && <option value="">{chatModelsLoading ? 'Loading models…' : 'No chat models available'}</option>}
                  {modelCatalog.chat.map((model) => (
                    <option key={model.id} value={model.id} disabled={model.available === false}>{model.name}{model.available === false ? ' · Unavailable' : ''}</option>
                  ))}
                </select>
              </label>
            )}
            <div className="ms-auto flex shrink-0 items-center gap-0.5 sm:gap-1">
              <button
                type="button"
                aria-label={isRtl ? 'تاریخچه گفتگوها' : 'Chat history'}
                aria-expanded={historyOpen}
                disabled={newChatPending}
                onClick={openHistory}
                 className="inline-flex h-10 w-10 items-center justify-center gap-1.5 rounded-xl border border-border text-[11px] font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-primary/10 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50 sm:h-11 sm:w-auto sm:px-2.5"
              >
                <History size={16} />
                 <span className="hidden sm:inline">{isRtl ? 'تاریخچه' : 'History'}</span>
              </button>
              <button
                type="button"
                 aria-label={t('workspace_start_new_chat')}
                onClick={() => void startNewChat()}
                disabled={newChatPending}
                 className="inline-flex h-10 w-10 items-center justify-center gap-1.5 rounded-xl border border-primary/30 text-[11px] font-medium text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50 sm:h-11 sm:w-auto sm:px-3"
              >
                <Plus size={15} />
                <span className="hidden sm:inline">{t('workspace_start_new_chat')}</span>
              </button>
             {!appId && <button
               type="button"
               aria-label={agentPickerOpen ? t('workspace_agent_picker_close') : t('workspace_agent_picker_open')}
               aria-expanded={agentPickerOpen}
               onClick={() => setAgentPickerOpen((open) => !open)}
                 className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors tactile-button sm:h-11 sm:w-11 ${agentPickerOpen ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-surface-hover hover:text-primary'}`}
             >
               <Grid2X2 size={23} strokeWidth={1.8} />
             </button>}
              <button
                type="button"
                aria-label={t('workspace_chat_actions')}
                aria-expanded={chatMenuOpen}
                onClick={() => {
                  setChatMenuOpen((open) => !open);
                  setAgentPickerOpen(false);
                }}
                 className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors sm:h-11 ${chatMenuOpen ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-surface-hover hover:text-primary'}`}
              >
                <MoreVertical size={22} strokeWidth={1.8} />
              </button>
           </div>
            {(appId ? !hasPaidAccess : selected?.status === 'locked' && !hasPaidAccess && !isFreeChatAgent(selected.id)) && (
              <div className="w-full lg:hidden">
                <SubscriptionBadge />
              </div>
            )}

           {agentPickerOpen && (
             <div className="absolute inset-x-3 top-[calc(100%+0.5rem)] z-30 rounded-2xl border border-border bg-surface p-3 shadow-2xl shadow-black/30 md:inset-x-6">
               <div className="mb-3 flex items-center justify-between gap-3">
                 <div>
                   <p className="text-sm font-semibold">{t('workspace_agent_picker_title')}</p>
                   <p className="text-[11px] text-muted-foreground">{t('workspace_agent_picker_hint')}</p>
                 </div>
                  <button type="button" aria-label={t('workspace_agent_picker_close')} onClick={() => setAgentPickerOpen(false)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-hover hover:text-foreground">
                   <X size={16} />
                 </button>
               </div>
               <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                 {agents?.map((agent) => (
                   <button
                     key={agent.id}
                     type="button"
                     onClick={() => switchAgent(agent.id)}
                     className={`flex min-w-0 items-center gap-2 rounded-xl border p-2 text-start transition-colors ${selectedId === agent.id ? 'border-primary/50 bg-primary/10' : 'border-border hover:border-primary/35 hover:bg-surface-hover'}`}
                   >
                     <AgentAvatar agentId={agent.id} name={agent.name} className="h-9 w-9 shrink-0 rounded-lg" />
                     <span className="min-w-0">
                       <span className="block truncate text-xs font-semibold">{agent.name}</span>
                       <span className="block truncate text-[10px] text-muted-foreground">{apiLocale.getAgentSpecialty(agent)}</span>
                         {agent.status === 'locked' && !hasPaidAccess && !isFreeChatAgent(agent.id) && <SubscriptionBadge className="mt-1" />}
                     </span>
                   </button>
                 ))}
               </div>
             </div>
           )}
            {chatMenuOpen && (
              <div className="absolute end-3 top-[calc(100%+0.5rem)] z-40 w-64 rounded-2xl border border-border bg-surface p-2 shadow-2xl shadow-black/30" dir={isRtl ? 'rtl' : 'ltr'}>
                <p className="px-3 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {t('workspace_chat_actions')}
                </p>
                {!hasPersianChatText && (
                  <button
                    type="button"
                    disabled={!lines.length || !canUseVoicePlayback || speech.isPending}
                    onClick={playWholeChat}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start text-xs text-foreground transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <Volume2 size={16} className="shrink-0 text-primary" />
                    <span>{t('workspace_play_chat')}</span>
                    {speech.isPending && <LoaderCircle size={13} className="ms-auto animate-spin" />}
                  </button>
                )}
                <button
                  type="button"
                  disabled={!lines.length}
                  onClick={() => downloadChat('txt')}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start text-xs text-foreground transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <Download size={16} className="shrink-0 text-primary" />
                  <span>{t('workspace_save_chat')}</span>
                </button>
                <button
                  type="button"
                  disabled={!lines.length}
                  onClick={() => downloadChat('json')}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start text-xs text-foreground transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <FileText size={16} className="shrink-0 text-primary" />
                  <span>{t('workspace_export_chat')}</span>
                </button>
                <button
                  type="button"
                  disabled={!lines.length}
                  onClick={() => void shareWholeChat()}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start text-xs text-foreground transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <Share2 size={16} className="shrink-0 text-primary" />
                  <span>{t('workspace_share_chat')}</span>
                </button>
                <Link
                  href={`/agents/${selected?.id || selectedId}`}
                  onClick={() => setChatMenuOpen(false)}
                  className="mt-1 flex w-full items-center gap-3 rounded-xl border-t border-border px-3 pb-1 pt-3 text-start text-xs text-muted-foreground transition-colors hover:text-primary"
                >
                  <MoreVertical size={16} className="shrink-0" />
                  <span>{t('workspace_agent_details')}</span>
                </Link>
              </div>
            )}
        </div>

        {/* Messages */}
         <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-3 sm:space-y-6 sm:p-4 md:p-6" ref={scrollRef}>
           {chatHistoryLoading && (
             <p className="text-center text-xs text-muted-foreground">{t('workspace_chat_history_loading')}</p>
           )}
           {chatHistoryError && (
             <p className="rounded-xl border border-red-400/25 bg-red-400/5 px-3 py-2 text-center text-xs text-red-400">{t('workspace_chat_history_error')}</p>
           )}
          {lines.map((line, i) => (
            <div key={i} className={`flex gap-4 ${line.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {line.role === 'agent' && (
                <div className="w-8 h-8 rounded-lg bg-surface border border-border flex-shrink-0 flex items-center justify-center font-bold text-xs" style={{ color: selected?.accent || 'var(--gold)' }}>
                  {appId ? <BrandLogo name={appName || ''} id={appId} size={30} /> : selected && <AgentAvatar agentId={selected.id} name={selected.name} className="h-full w-full rounded-lg" />}
                </div>
              )}
              
                <div
                  className={`relative max-w-[90%] [overflow-wrap:anywhere] sm:max-w-[85%] ${line.role === 'user' ? 'bg-primary text-primary-foreground rounded-2xl rounded-te-sm px-4 py-3 shadow-md sm:px-5' : 'rounded-2xl rounded-ts-md border border-border/70 bg-surface/65 px-3 py-3 sm:px-4'}`}
                  onPointerDown={() => beginMessageLongPress(i)}
                  onPointerUp={clearMessageLongPress}
                  onPointerCancel={clearMessageLongPress}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    openMessageActions(i);
                  }}
                >
                  {splitSkillDisplay(line.text).command ? (
                    <div className="space-y-2">
                      <span dir="auto" className={`inline-flex max-w-full break-all rounded-md border border-blue-400/40 bg-blue-500/10 px-2 py-1 text-xs font-bold ${line.role === 'user' ? 'text-blue-900' : 'text-blue-700 dark:text-blue-300'}`}>
                        {splitSkillDisplay(line.text).command}
                      </span>
                      {splitSkillDisplay(line.text).body && <p className={`whitespace-pre-wrap text-sm leading-relaxed ${line.role === 'agent' ? 'text-foreground' : ''}`}>{splitSkillDisplay(line.text).body}</p>}
                    </div>
                  ) : <p className={`whitespace-pre-wrap text-sm leading-relaxed ${line.role === 'agent' ? 'text-foreground' : ''}`}>{line.text}</p>}
                  {line.role === 'agent' && line.media && (
                    <div className="mt-3 overflow-hidden rounded-xl border border-border bg-background/50" data-testid={`media-chat-${i}`}>
                      {safeMediaUrl(line.media.url) ? (
                        line.media.type === 'image' ? (
                          <img src={safeMediaUrl(line.media.url)!} alt={line.media.prompt || (isRtl ? 'تصویر ساخته‌شده' : 'Generated image')} className="max-h-[28rem] w-full object-contain" data-testid={`image-chat-${i}`} />
                        ) : (
                          <video src={safeMediaUrl(line.media.url)!} controls playsInline preload="metadata" className="max-h-[28rem] w-full bg-black object-contain" data-testid={`video-chat-${i}`} />
                        )
                      ) : <p className="px-3 py-2 text-xs text-red-400">{isRtl ? 'نشانی رسانه معتبر نیست.' : 'Media URL is invalid.'}</p>}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-2 text-xs">
                        <div className="min-w-0">
                          <span className="block truncate text-foreground" dir="auto" data-testid={`text-media-model-${i}`}>{line.media.model}</span>
                          {line.media.isPreview && <span className="text-amber-600 dark:text-amber-400" data-testid={`text-media-preview-${i}`}>{isRtl ? 'پیش‌نمایش' : 'Preview'}</span>}
                          {line.media.prompt && <span className="block truncate text-muted-foreground" dir="auto">{line.media.prompt}</span>}
                        </div>
                        {safeMediaUrl(line.media.url) && (
                          <div className="flex flex-wrap gap-2">
                            <a href={safeMediaUrl(line.media.url)!} target="_blank" rel="noopener noreferrer" data-testid={`link-open-media-${i}`} className="rounded-lg bg-primary/10 px-2.5 py-1.5 text-primary hover:bg-primary/20">{isRtl ? 'باز کردن' : 'Open'}</a>
                            <a href={safeMediaUrl(line.media.url)!} download={`fezi-${line.media.type}-${line.messageId || i}.${line.media.mimeType.split('/')[1]?.split(';')[0] || (line.media.type === 'image' ? 'png' : 'mp4')}`} data-testid={`link-download-media-${i}`} className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1.5 text-primary hover:bg-primary/20"><Download size={13} />{isRtl ? 'دانلود' : 'Download'}</a>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                   {messageActionIndex === i && (
                     <div
                       className="absolute end-2 top-[calc(100%+0.5rem)] z-40 min-w-[190px] rounded-2xl border border-border bg-surface p-2 text-foreground shadow-2xl shadow-black/30"
                       dir={isRtl ? 'rtl' : 'ltr'}
                       onPointerDown={(event) => event.stopPropagation()}
                       onClick={(event) => event.stopPropagation()}
                     >
                       <button type="button" onClick={() => void copyLine(line, i)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start text-xs transition-colors hover:bg-surface-hover">
                         <Copy size={15} className="shrink-0 text-primary" />
                         <span>{copiedLineIndex === i ? t('workspace_action_copied') : t('workspace_action_copy')}</span>
                       </button>
                       <button
                         type="button"
                         disabled={!line.text.trim() || savingMemoryIndex === i || savedMemoryIndexes.has(i)}
                         onClick={() => {
                           saveMemoryForLine(line, i);
                           setMessageActionIndex(null);
                         }}
                         className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start text-xs transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-45"
                       >
                         <Brain size={15} className="shrink-0 text-primary" />
                         <span>{savedMemoryIndexes.has(i) ? t('workspace_action_saved') : savingMemoryIndex === i ? t('workspace_action_saving') : t('workspace_action_save_memory')}</span>
                       </button>
                       <button type="button" onClick={() => void shareLine(line, i)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start text-xs transition-colors hover:bg-surface-hover">
                         <Share2 size={15} className="shrink-0 text-primary" />
                         <span>{sharedLineIndex === i ? t('workspace_action_shared') : t('workspace_action_share')}</span>
                       </button>
                       {line.role === 'agent' && (
                         <button
                           type="button"
                           disabled={!canUseVoicePlayback || speech.isPending}
                           onClick={() => {
                             setMessageActionIndex(null);
                             toggleVoice(line, i);
                           }}
                           className="flex w-full items-center gap-3 rounded-xl border-t border-border mt-1 px-3 pb-1 pt-3 text-start text-xs transition-colors hover:text-primary disabled:cursor-not-allowed disabled:opacity-45"
                         >
                           <Volume2 size={15} className="shrink-0 text-primary" />
                           <span>{t('workspace_action_read')}</span>
                         </button>
                       )}
                     </div>
                   )}
                  {line.subscriptionRequired && (
                    <Link
                      href="/billing"
                      onClick={() => setSubscriptionPromptOpen(false)}
                      className="mt-2 inline-flex items-center rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary underline-offset-2 hover:bg-primary/20 hover:underline"
                    >
                      {t('subscription_view_plans')}
                    </Link>
                  )}
                 {line.attachments?.length ? (
                   <div className="mt-2 flex flex-wrap gap-1.5">
                     {line.attachments.map((attachment) => (
                       <span key={attachment} className="inline-flex items-center gap-1 rounded-md bg-black/15 px-2 py-1 text-[10px]">
                         <FileText size={12} /> {attachment}
                       </span>
                     ))}
                   </div>
                 ) : null}
                  {line.image && (
                    <div className="mt-3 overflow-hidden rounded-xl border border-border/70 bg-background/50">
                      <img src={line.image.dataUrl} alt={line.image.prompt} className="max-h-[28rem] w-full object-contain" />
                      <div className="flex items-center justify-between gap-3 border-t border-border/70 px-3 py-2">
                        <span className="truncate text-[10px] text-muted-foreground">{line.image.prompt}</span>
                         <div className="flex flex-wrap items-center gap-2">
                          <a
                            href={line.image.dataUrl}
                            download={`fezi-${selected?.id || 'agent'}-gemini-image.png`}
                            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1.5 text-[11px] font-medium text-primary hover:bg-primary/20"
                          >
                            <Download size={13} /> {t('workspace_image_download')}
                          </a>
                          <button
                            onClick={() => {
                              const match = line.image!.dataUrl.match(/^data:(image\/[^;]+);base64,/);
                              if (match) {
                                window.sessionStorage.setItem('fezi_studio_video_source', JSON.stringify({
                                  name: 'generated-image.png',
                                  dataUrl: line.image!.dataUrl,
                                  mimeType: match[1],
                                  kind: 'image'
                                }));
                                setLocation('/studio/video');
                              }
                            }}
                            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1.5 text-[11px] font-medium text-primary hover:bg-primary/20"
                          >
                             <Video size={13} /> {isRtl ? 'ساخت ویدیو' : 'Animate'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  {line.video && (
                    <div className="mt-3 overflow-hidden rounded-xl border border-border/70 bg-background/50">
                      <video src={line.video.dataUrl} controls className="max-h-[28rem] w-full bg-black object-contain" />
                      <div className="flex items-center justify-between gap-3 border-t border-border/70 px-3 py-2">
                        <span className="truncate text-[10px] text-muted-foreground">{line.video.prompt}</span>
                        <a
                          href={line.video.dataUrl}
                          download={`fezi-${selected?.id || 'agent'}-video.mp4`}
                          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1.5 text-[11px] font-medium text-primary hover:bg-primary/20"
                        >
                          <Download size={13} /> {t('workspace_image_download')}
                        </a>
                      </div>
                    </div>
                  )}
                
                {line.role === 'agent' && (
                  <div className="mt-3 space-y-2 border-t border-border/50 pt-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">{isRtl ? 'این پاسخ مفید بود؟' : 'Was this answer helpful?'}</span>
                      <button
                        type="button"
                        aria-label="Like this answer"
                        disabled={!line.messageId || feedbackSavingIndex === i}
                        onClick={() => void submitFeedback(i, 'like')}
                         className={`inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 sm:h-auto sm:w-auto sm:p-1.5 ${line.feedback === 'like' ? 'bg-primary/10 text-primary' : ''}`}
                      >
                        <ThumbsUp size={13} />
                      </button>
                      <button
                        type="button"
                        aria-label="Dislike this answer"
                        disabled={!line.messageId || feedbackSavingIndex === i}
                        onClick={() => {
                          setFeedbackOpenIndex(i);
                          setFeedbackComment('');
                          setFeedbackNoticeIndex(null);
                        }}
                         className={`inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-red-400/10 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-40 sm:h-auto sm:w-auto sm:p-1.5 ${line.feedback === 'dislike' ? 'bg-red-400/10 text-red-400' : ''}`}
                      >
                        <ThumbsDown size={13} />
                      </button>
                      {feedbackNoticeIndex === i && <span className="text-[10px] text-green-400">{isRtl ? 'ثبت شد' : 'Thanks for the feedback'}</span>}
                    </div>
                    {feedbackOpenIndex === i && (
                      <form
                        className="max-w-sm space-y-2 rounded-xl border border-border bg-background/70 p-2.5"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void submitFeedback(i, 'dislike', feedbackComment);
                        }}
                      >
                        <p className="text-[11px] font-medium">{isRtl ? 'چه چیزی در این پاسخ مشکل داشت؟' : 'What could be improved?'}</p>
                        <textarea
                          value={feedbackComment}
                          onChange={(event) => setFeedbackComment(event.target.value)}
                          maxLength={2000}
                          rows={3}
                          placeholder={isRtl ? 'اختیاری' : 'Optional details'}
                          className="w-full resize-none rounded-lg border border-border bg-surface px-2.5 py-2 text-xs outline-none focus:border-primary"
                        />
                        <div className="flex justify-end gap-2">
                          <button type="button" onClick={() => setFeedbackOpenIndex(null)} className="rounded-lg px-2.5 py-1.5 text-[11px] text-muted-foreground hover:bg-surface-hover">
                            {isRtl ? 'انصراف' : 'Cancel'}
                          </button>
                          <button type="submit" disabled={feedbackSavingIndex === i} className="rounded-lg bg-primary px-2.5 py-1.5 text-[11px] font-medium text-primary-foreground disabled:opacity-50">
                            {feedbackSavingIndex === i ? <LoaderCircle size={12} className="animate-spin" /> : (isRtl ? 'ارسال بازخورد' : 'Send feedback')}
                          </button>
                        </div>
                      </form>
                    )}
                    <div className="flex items-center gap-3">
                     {canUseVoicePlayback && !containsPersianText(line.text) && (
                      <button
                        onClick={() => toggleVoice(line, i)}
                        disabled={speech.isPending && voiceLineIndex !== i}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface hover:bg-surface-hover text-xs text-muted-foreground hover:text-primary transition-colors disabled:opacity-50 tactile-button border border-border/50"
                      >
                        {speech.isPending && voiceLineIndex === i ? (
                          <LoaderCircle size={14} className="animate-spin shrink-0" />
                        ) : voiceLineIndex === i && audioRef.current ? (
                          <Square size={12} fill="currentColor" className="shrink-0" />
                        ) : (
                          <Volume2 size={14} className="shrink-0" />
                        )}
                        {voiceLineIndex === i && audioRef.current ? t('workspace_stop') : t('workspace_listen')}
                      </button>
                    )}
                    {voiceErrorIndex === i && <span className="text-[10px] text-red-400">{t('workspace_voice_error')}</span>}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {chatPending && (
            <div className="flex gap-4" role="status" data-testid="status-chat-pending">
              <div className="w-8 h-8 rounded-lg bg-surface border border-border flex-shrink-0"></div>
              <div className="flex items-center gap-1.5 pt-3">
                <div className="w-2 h-2 rounded-full bg-primary/50 animate-bounce"></div>
                <div className="w-2 h-2 rounded-full bg-primary/50 animate-bounce delay-75"></div>
                <div className="w-2 h-2 rounded-full bg-primary/50 animate-bounce delay-150"></div>
                <span className="ms-2 text-xs text-muted-foreground">{isRtl ? 'در حال آماده‌سازی پاسخ یا رسانه…' : 'Preparing response or media…'}</span>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
         <div className="relative border-t border-border bg-background/85 p-2 backdrop-blur-sm sm:p-3 md:p-4">
             {toolMenuOpen && (
               <div className="absolute inset-x-2 bottom-full z-20 mb-2 max-h-[48dvh] touch-pan-y overflow-y-auto overscroll-contain rounded-2xl border border-border bg-surface p-3 shadow-xl [-webkit-overflow-scrolling:touch] sm:static sm:mb-3 sm:max-h-[min(68dvh,38rem)] sm:[scrollbar-gutter:stable]">
                <div className="sticky -top-3 z-10 mb-2 flex items-center justify-between gap-3 border-b border-border/70 bg-surface px-0 py-2">
                  <div>
                     <p className="text-sm font-semibold text-foreground">{isRtl ? 'مدل‌ها و ابزارها' : 'Models & tools'}</p>
                     <p className="mt-0.5 text-[11px] text-muted-foreground">{appName || selected?.name}</p>
                  </div>
                  <button type="button" aria-label={t('workspace_toolbar_close')} onClick={() => setToolMenuOpen(false)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground">
                  <X size={14} />
                </button>
              </div>
                 {selected?.id === 'arta' && (
                   <section className="mb-3 rounded-2xl border border-violet-400/25 bg-violet-500/5 p-3" dir={isRtl ? 'rtl' : 'ltr'}>
                     <div className="flex items-start gap-2">
                       <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300"><Gamepad2 size={16} /></span>
                       <div className="min-w-0">
                         <p className="text-sm font-semibold text-foreground">{isRtl ? 'کتابخانهٔ بازی آرتا' : "Arta's game library"}</p>
                         <p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">{isRtl ? 'روی اجرای هر بازی بزنید؛ فرمان همان لحظه در چت اجرا می‌شود.' : 'Choose a game to execute its command in this chat.'}</p>
                       </div>
                     </div>
                     <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
                       {ARTA_GAMES.map((game) => (
                         <button
                           key={game.command}
                           type="button"
                           onClick={() => {
                             setToolMenuOpen(false);
                              sendMessage(isRtl ? game.commandFa : game.command);
                           }}
                           disabled={chatPending || newChatPending}
                           className="group flex min-w-0 items-center gap-2 rounded-xl border border-violet-300/15 bg-background/50 px-2.5 py-2 text-start transition-colors hover:border-violet-300/50 hover:bg-violet-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                         >
                           <Play size={12} className="shrink-0 text-violet-300 transition-transform group-hover:translate-x-0.5 rtl:rotate-180" fill="currentColor" />
                           <span className="min-w-0">
                             <span className="block truncate text-[11px] font-semibold text-foreground">{isRtl ? game.nameFa : game.name}</span>
                              <span className="block truncate text-[10px] text-muted-foreground">{isRtl ? `${game.commandFa} · ${game.descriptionFa}` : `${game.command} · ${game.description}`}</span>
                              {isRtl && <span className="block truncate text-[10px] text-violet-200/70">{game.exampleFa}</span>}
                           </span>
                         </button>
                       ))}
                     </div>
                     <button
                       type="button"
                       onClick={() => {
                         setToolMenuOpen(false);
                          sendMessage(isRtl ? '/بازی‌ها' : '/games');
                       }}
                       disabled={chatPending || newChatPending}
                       className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-violet-300/20 px-3 py-2 text-[11px] font-medium text-violet-200 transition-colors hover:bg-violet-500/10 disabled:opacity-50"
                     >
                        <Gamepad2 size={13} /> {isRtl ? 'نمایش فهرست کامل بازی‌ها' : 'Run /games for the full list'}
                     </button>
                   </section>
                 )}
                 <div className="mb-3 grid grid-cols-3 gap-2" dir={isRtl ? 'rtl' : 'ltr'}>
                  {selected && (
                    <>
                      <button
                        type="button"
                        data-testid="button-chat-create-image"
                        onClick={() => {
                          setImagePanelOpen(true);
                          setVideoPanelOpen(false);
                          setImageError(false);
                          setToolMenuOpen(false);
                        }}
                        className="flex min-h-12 items-center justify-center gap-1.5 rounded-xl border border-primary/20 bg-primary/5 px-2 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                      >
                        <ImageIcon size={16} /> {isRtl ? 'تصویر' : 'Image'}
                      </button>
                      <button
                        type="button"
                        data-testid="button-chat-create-video"
                        onClick={() => {
                          setVideoPanelOpen(true);
                          setImagePanelOpen(false);
                          setToolMenuOpen(false);
                        }}
                        className="flex min-h-12 items-center justify-center gap-1.5 rounded-xl border border-primary/20 bg-primary/5 px-2 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                      >
                        <Video size={16} /> {isRtl ? 'ویدیو' : 'Video'}
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    data-testid="button-chat-upload-file"
                    onClick={() => {
                      setToolMenuOpen(false);
                      openFilePicker();
                    }}
                    className="flex min-h-12 items-center justify-center gap-1.5 rounded-xl border border-border bg-background/60 px-2 py-2 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-surface-hover"
                  >
                    <Paperclip size={16} /> {appId ? (isRtl ? 'پیوست متن' : 'Attach text') : (isRtl ? 'آپلود و تحلیل' : 'Upload & Analyze')}
                  </button>
                </div>
                <div className="mb-3 flex gap-1 rounded-xl bg-background/60 p-1" role="tablist">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={toolTab === 'tools'}
                    onClick={() => setToolTab('tools')}
                    className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${toolTab === 'tools' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground'}`}
                  >
                    {t('workspace_tool_tab_tools')}
                  </button>
                  {!appId && <button
                    type="button"
                    role="tab"
                    aria-selected={toolTab === 'connectors'}
                    onClick={() => setToolTab('connectors')}
                    className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${toolTab === 'connectors' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground'}`}
                  >
                    {t('workspace_tool_tab_connectors')}
                  </button>}
                </div>
                 {toolTab === 'tools' ? (
                  <div className="space-y-2">
                  {appId ? (
                    <div className="rounded-xl border border-border bg-background p-3 text-xs text-muted-foreground">
                      {isRtl ? 'نسخه مدل را از بالای گفتگو انتخاب کنید.' : 'Choose a model version from the chat header.'}
                    </div>
                  ) : <ChatModelPicker
                    catalog={modelCatalog}
                    loading={chatModelsLoading}
                    selectedModel={selectedChatModel}
                    onSelectModel={setSelectedChatModel}
                    onOpenImage={() => { setImagePanelOpen(true); setImageError(false); setToolMenuOpen(false); }}
                    onOpenVideo={() => { setVideoPanelOpen(true); setToolMenuOpen(false); }}
                    onClose={() => setToolMenuOpen(false)}
                    isRtl={isRtl}
                  />}
                  <button
                    type="button"
                    onClick={() => {
                      setToolMenuOpen(false);
                      openFilePicker();
                    }}
                    className="flex w-full items-center gap-3 rounded-xl border border-border px-3 py-3 text-start text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:bg-surface-hover hover:text-primary"
                  >
                    <Paperclip size={16} className="shrink-0" />
                    <span className="font-medium">{t('workspace_attach')}</span>
                    <ChevronRight size={15} className="ms-auto shrink-0" />
                 </button>
                  {!appId && selected?.capabilityDetails?.slice(0, 6).map((capability) => (
                  <button
                    key={capability.id}
                    type="button"
                     onClick={() => {
                       const label = isRtl ? capability.fa : capability.en;
                       setSelectedSkill({
                         command: capabilityCommand(capability.id, label),
                         instruction: isRtl
                           ? `از قابلیت «${label}» برای درخواست زیر استفاده کن. اگر ابزار لازم در دسترس نیست، صادقانه بگو و ادعای انجام آن را نکن.`
                           : `Use the "${label}" capability for the request below. If a required tool is unavailable, say so rather than claiming to have executed it.`,
                       });
                       setToolMenuOpen(false);
                     }}
                      className="flex w-full items-center gap-3 rounded-xl border border-primary/15 bg-primary/5 px-3 py-3 text-start text-xs text-primary transition-colors hover:border-primary/50 hover:bg-primary/10"
                  >
                      <WandSparkles size={15} className="shrink-0 opacity-80" />
                      <span className="font-medium">{isRtl ? capability.fa : capability.en}</span>
                      <ChevronRight size={15} className="ms-auto shrink-0" />
                  </button>
                ))}
               </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-[11px] leading-5 text-muted-foreground">{t('workspace_connectors_desc')}</p>
                    {connectorsLoading ? (
                      <div className="flex items-center gap-2 rounded-xl border border-border px-3 py-3 text-xs text-muted-foreground">
                        <LoaderCircle size={14} className="animate-spin" /> {t('workspace_connectors_loading')}
                      </div>
                    ) : connectors.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border px-3 py-4 text-center">
                        <Server size={18} className="mx-auto mb-2 text-muted-foreground/60" />
                        <p className="text-xs text-muted-foreground">{t('workspace_connectors_empty')}</p>
                      </div>
                    ) : (
                       connectors.map((connector) => {
                        const isSelected = selectedConnectorIds.includes(connector.id);
                        return (
                           <div key={connector.id} className="space-y-2">
                             <button
                               type="button"
                               aria-pressed={isSelected}
                               onClick={() => setSelectedConnectorIds((current) => isSelected ? current.filter((id) => id !== connector.id) : [...current, connector.id])}
                               className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-start transition-colors ${isSelected ? 'border-primary/50 bg-primary/10' : 'border-border hover:border-primary/35 hover:bg-surface-hover'}`}
                             >
                   <BrandLogo name={connector.name} id={connector.id} endpoint={connector.endpoint} size={32} className="shrink-0" />
                               <span className="min-w-0 flex-1">
                                 <span className="block truncate text-xs font-semibold">{connector.name}</span>
                                 <span className="block truncate text-[10px] text-muted-foreground">{connector.tools.length} {t('conn_tools_available')}</span>
                               </span>
                               {isSelected && <Check size={15} className="shrink-0 text-primary" />}
                             </button>
                             {isSelected && connector.tools.length > 0 && (
                               <div className="ms-3 space-y-1 border-s border-primary/25 ps-3">
                                 {connector.tools.map((tool) => (
                                   <button
                                     key={`${connector.id}:${tool.name}`}
                                     type="button"
                                     onClick={() => void runConnectorTool(connector, tool)}
                                     disabled={Boolean(connectorCallBusy)}
                                     className="flex w-full items-center justify-between gap-2 rounded-lg border border-border px-2.5 py-2 text-start text-[11px] text-muted-foreground hover:border-primary/40 hover:text-primary disabled:opacity-50"
                                   >
                                     <span className="truncate">{tool.name}</span>
                                     {connectorCallBusy === `${connector.id}:${tool.name}` && <LoaderCircle size={13} className="animate-spin" />}
                                   </button>
                                 ))}
                               </div>
                             )}
                           </div>
                        );
                      })
                    )}
                     {selectedConnectors.length > 0 && (
                       <div className="rounded-xl border border-primary/20 bg-primary/5 p-2.5">
                         <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Tool arguments (JSON)</label>
                         <input value={connectorArguments} onChange={(event) => { setConnectorArguments(event.target.value); setConnectorCallError(null); }} dir="ltr" className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-xs text-foreground outline-none focus:border-primary" />
                         {connectorCallError && <p className="mt-1.5 text-[11px] text-red-400">{connectorCallError}</p>}
                       </div>
                     )}
                    <Link
                      href="/connectors"
                      onClick={() => setToolMenuOpen(false)}
                      className="flex items-center justify-center gap-2 rounded-xl border border-primary/30 px-3 py-2.5 text-xs font-medium text-primary hover:bg-primary/10"
                    >
                      <Plus size={14} /> {t('workspace_connectors_add')}
                    </Link>
                  </div>
                )}
             </div>
           )}
            {imagePanelOpen && (
              <div className="absolute inset-x-2 bottom-full z-20 mb-2 max-h-[48dvh] overflow-y-auto overscroll-contain rounded-2xl border border-primary/25 bg-surface p-3 shadow-2xl sm:static sm:mb-3 sm:max-h-none sm:overflow-visible sm:bg-primary/5 sm:shadow-none" dir={isRtl ? 'rtl' : 'ltr'}>
               <div className="flex items-center justify-between gap-3">
                 <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                   <WandSparkles size={16} /> {t('workspace_image_generate')}
                 </div>
                  <button type="button" aria-label={t('workspace_toolbar_close')} onClick={() => setImagePanelOpen(false)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-hover hover:text-foreground">
                   <X size={15} />
                 </button>
               </div>
                <span dir="auto" className="mt-3 inline-flex rounded-lg border border-blue-500/40 bg-blue-500/10 px-3 py-1.5 text-sm font-bold text-blue-700 dark:text-blue-300">{isRtl ? '/ساخت_تصویر' : '/create_image'}</span>
               <textarea
                 value={imagePrompt}
                 onChange={(event) => { setImagePrompt(event.target.value); setImageError(false); }}
                 placeholder={t('workspace_image_prompt')}
                 rows={3}
                 className="mt-3 w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
               />
               <p className="text-xs text-muted-foreground">{isRtl ? 'برای ساخت تصویر در گفتگو، سرور مدل قابل‌دسترس را انتخاب می‌کند.' : 'For inline chat images, the server chooses an available image model.'}</p>
                <ImagePromptCodePicker prompt={imagePrompt} onPromptChange={setImagePrompt} selectedCodes={imageCodes} onChange={setImageCodes} isRtl={isRtl} />
               {imageError && <p className="mt-2 text-xs text-red-400">{t('workspace_image_error')}</p>}
               <div className="mt-3 flex justify-end">
                 <Button type="button" onClick={() => void generateImage()} disabled={!imagePrompt.trim() || imageGenerating}>
                   {imageGenerating ? <LoaderCircle size={15} className="animate-spin" /> : <ImageIcon size={15} />}
                   {imageGenerating ? t('workspace_transcribing') : t('workspace_image_generate')}
                 </Button>
               </div>
             </div>
           )}
           {videoPanelOpen && (
              <div className="absolute inset-x-2 bottom-full z-20 mb-2 max-h-[48dvh] overflow-y-auto overscroll-contain rounded-2xl border border-primary/25 bg-surface p-3 shadow-2xl sm:static sm:mb-3 sm:max-h-none sm:overflow-visible sm:bg-primary/5 sm:shadow-none" dir={isRtl ? 'rtl' : 'ltr'}>
               <div className="flex items-center justify-between gap-3">
                 <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                   <Video size={16} /> {t('workspace_video_generate')}
                 </div>
                  <button type="button" aria-label={t('workspace_toolbar_close')} onClick={() => setVideoPanelOpen(false)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-hover hover:text-foreground">
                   <X size={15} />
                 </button>
               </div>
                <span dir="auto" className="mt-3 inline-flex rounded-lg border border-blue-500/40 bg-blue-500/10 px-3 py-1.5 text-sm font-bold text-blue-700 dark:text-blue-300">{isRtl ? '/ساخت_ویدیو' : '/create_video'}</span>
               <p className="mt-3 text-xs leading-5 text-muted-foreground">{isRtl ? 'درخواست ویدیو در همین گفتگو ارسال می‌شود و سرور مدل و هزینه را تعیین می‌کند. ویدیوی واقعی xAI با کیفیت ۴۸۰p و مدت ۵ ثانیه دست‌کم ۸۸۹ اعتبار نیاز دارد؛ این مسیر ویدیوی ساختگی FFmpeg نیست.' : 'Video requests are sent in this chat; the server determines the model and price. Real xAI video (5 seconds, 480p) requires at least 889 Credits; this is not an FFmpeg mock video.'}</p>
               <textarea
                 value={videoPrompt}
                 onChange={(event) => setVideoPrompt(event.target.value)}
                 placeholder={t('workspace_video_prompt')}
                 rows={3}
                 className="mt-3 w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
               />
               <div className="mt-3 flex justify-end">
                 <Button
                   type="button"
                   onClick={generateVideo}
                        disabled={
                     !videoPrompt.trim()
                     || chatPending
                   }
                 >
                   <Video size={15} /> {t('workspace_video_generate')}
                 </Button>
               </div>
             </div>
           )}
          {attachedFiles.some((file) => !file.voiceDraft) && (
            <div className="mb-2 flex flex-wrap gap-2">
              {attachedFiles.filter((file) => !file.voiceDraft).map((file) => (
                <span key={file.name} className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-xs text-primary">
                  <FileText size={13} /> {file.name}
                  <button
                    type="button"
                    aria-label={t('workspace_file_remove')}
                    onClick={() => {
                      setAttachedFiles((current) => current.filter((item) => item.name !== file.name));
                      if (file.kind === 'audio') void clearVoiceDraft().catch(() => undefined);
                    }}
                  >
                    <X size={13} />
                  </button>
                </span>
              ))}
            </div>
          )}
           {selectedConnectors.length > 0 && (
             <div className="mb-2 flex flex-wrap items-center gap-2" aria-label={t('workspace_connector_selected')}>
               <span className="text-[11px] text-muted-foreground">{t('workspace_connector_selected')}:</span>
               {selectedConnectors.map((connector) => (
                 <button
                   key={connector.id}
                   type="button"
                   onClick={() => setSelectedConnectorIds((current) => current.filter((id) => id !== connector.id))}
                   className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-xs text-primary"
                 >
                   <BrandLogo name={connector.name} id={connector.id} endpoint={connector.endpoint} size={22} /> {connector.name} <X size={12} />
                 </button>
               ))}
             </div>
           )}
            {fileError && <p className="mb-2 text-xs text-red-400">{voiceFallbackRequired ? t('workspace_voice_upload_fallback') : voiceTooShort ? t('workspace_recording_too_short') : voiceCreditsExhausted ? t('workspace_voice_credits_exhausted') : voiceError ? t('workspace_voice_error') : t('workspace_file_invalid')}</p>}
           {canUseVoicePlayback && voiceAudioSrc && (
             <div className="mb-3 flex flex-col gap-2 rounded-2xl border border-primary/25 bg-primary/5 px-3 py-2.5 shadow-lg shadow-black/10 sm:flex-row sm:items-center" dir={isRtl ? 'rtl' : 'ltr'}>
               <div className="flex min-w-0 items-center gap-2 text-xs font-semibold text-primary">
                 <Volume2 size={15} className="shrink-0" />
                 <span className="truncate">{t('workspace_voice_player')}</span>
               </div>
               <audio
                 ref={audioRef}
                 controls
                 onPlay={() => setVoiceLineIndex(voiceLineIndex)}
                  onPause={() => {
                    if (!wholeChatPlayingRef.current) setVoiceLineIndex(null);
                  }}
                  onEnded={() => {
                    const nextChunk = wholeChatPlayingRef.current ? wholeChatQueueRef.current.shift() : undefined;
                    if (nextChunk) {
                      setVoiceAudioSrc(null);
                      window.setTimeout(() => playWholeChatChunk(nextChunk), 0);
                    } else {
                      wholeChatPlayingRef.current = false;
                      setVoiceLineIndex(null);
                      setVoiceAudioSrc(null);
                    }
                  }}
                 className="h-9 min-w-0 flex-1"
               />
               <button
                 type="button"
                  onClick={() => {
                    audioRef.current?.pause();
                    wholeChatQueueRef.current = [];
                    wholeChatPlayingRef.current = false;
                    setVoiceAudioSrc(null);
                    setVoiceLineIndex(null);
                  }}
                 className="self-end rounded-lg p-1.5 text-muted-foreground hover:bg-surface-hover hover:text-foreground sm:self-auto"
                 aria-label={t('workspace_toolbar_close')}
               >
                 <X size={14} />
               </button>
             </div>
           )}

             {canCraftPrompt && !recording && !recordingFinalizing && (
               <div className="mb-2 flex justify-start" dir={isRtl ? 'rtl' : 'ltr'}>
                 <button
                   type="button"
                   disabled={chatPending || newChatPending}
                   onClick={() => {
                      setSelectedSkill({
                        command: isRtl ? '/ساخت_پرامپت' : '/create_prompt',
                        instruction: isRtl
                          ? 'برای درخواست زیر یک پرامپت دقیق بساز یا پرامپت موجود را بهبود بده. رسانهٔ خواسته‌شده (متن، تصویر یا ویدیو) و تمام جزئیات کاربر را حفظ کن؛ خودِ پرامپت را بده.'
                          : 'Create or improve a usable prompt for the request below. Preserve the intended medium (text, image, or video) and all user details; provide the prompt itself.',
                      });
                   }}
                   className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
                 >
                   <WandSparkles size={15} />
                   {isRtl ? 'ساخت / بهبود پرامپت' : 'Create / improve prompt'}
                 </button>
               </div>
             )}
              {selectedSkill && !recording && !recordingFinalizing && (
                <div className="mb-2 flex items-center gap-2" dir={isRtl ? 'rtl' : 'ltr'}>
                  <span dir="auto" className="inline-flex max-w-[calc(100%-3rem)] break-all rounded-lg border border-blue-500/40 bg-blue-500/10 px-3 py-1.5 text-sm font-bold text-blue-700 dark:text-blue-300">{selectedSkill.command}</span>
                  <button type="button" onClick={() => setSelectedSkill(null)} aria-label={isRtl ? 'حذف فرمان انتخاب‌شده' : 'Remove selected command'} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-blue-700 hover:bg-blue-500/10 dark:text-blue-300"><X size={17} /></button>
                </div>
              )}
             <form onSubmit={submit} dir="ltr" className={`relative flex items-end gap-1.5 rounded-2xl border border-border bg-surface shadow-sm transition-colors focus-within:border-primary/50 sm:gap-2 ${recording || recordingFinalizing || transcribe.isPending ? 'min-h-[72px] p-2.5 md:min-h-[80px] md:p-3' : 'min-h-[60px] p-2 md:min-h-[64px] md:p-2.5'}`}>
              {(recording || recordingFinalizing || transcribe.isPending) ? (
                <div
                  className="flex min-h-[68px] w-full items-center gap-2 rounded-xl px-1 sm:gap-4 sm:px-2"
                  aria-live="polite"
                  dir="ltr"
                >
                  <button
                    type="button"
                    onClick={cancelRecording}
                    disabled={recordingFinalizing || transcribe.isPending}
                    aria-label={t('workspace_recording_cancel')}
                    title={t('workspace_recording_cancel')}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <X size={22} strokeWidth={2} />
                  </button>
                  <div
                    className="relative flex min-w-0 flex-1 items-center justify-center gap-[3px] overflow-hidden px-1"
                    aria-label={recordingFinalizing || transcribe.isPending ? t('workspace_transcribing') : t('workspace_recording_status')}
                  >
                    {recordingFinalizing || transcribe.isPending ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <LoaderCircle size={17} className="animate-spin text-primary" />
                        <span>{t('workspace_transcribing')}</span>
                      </div>
                    ) : (
                      <>
                        <span className="voice-recording-cursor" aria-hidden="true" />
                        {Array.from({ length: 36 }).map((_, index) => {
                          const baseHeight = 5 + ((index * 7) % 13);
                          const speechScale = 0.3 + audioLevel * 1.45;
                          return (
                            <span
                              key={index}
                              className="voice-wave-bar"
                              style={{
                                height: `${Math.max(3, Math.round(baseHeight * speechScale))}px`,
                                opacity: 0.42 + Math.min(0.58, audioLevel),
                              }}
                            />
                          );
                        })}
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={stopRecording}
                    disabled={!recording || recordingSeconds < MIN_VOICE_SECONDS}
                    aria-label={t('workspace_recording_stop')}
                    title={recordingSeconds < MIN_VOICE_SECONDS ? t('workspace_recording_wait') : t('workspace_recording_stop')}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {recordingFinalizing || transcribe.isPending ? <LoaderCircle size={19} className="animate-spin" /> : <Check size={22} strokeWidth={2.2} />}
                  </button>
                </div>
              ) : (
                <>
            <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
              <button
                type="button"
                 aria-label={toolMenuOpen ? t('workspace_toolbar_close') : t('workspace_toolbar_open')}
                onClick={() => setToolMenuOpen((open) => !open)}
                 className={`flex h-11 w-11 items-center justify-center rounded-xl transition-colors tactile-button sm:h-10 sm:w-10 ${toolMenuOpen ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-surface-hover hover:text-primary'}`}
              >
                 <Plus size={19} className={toolMenuOpen ? 'rotate-45' : undefined} />
              </button>
               <button
                 type="button"
                 aria-label={recording ? t('workspace_recording_stop') : t('workspace_record')}
                 onClick={recording ? stopRecording : startRecording}
                  disabled={recordingFinalizing || transcribe.isPending || (recording && recordingSeconds < MIN_VOICE_SECONDS)}
                   className={`flex h-11 w-11 items-center justify-center rounded-xl bg-black text-white transition-colors tactile-button hover:bg-black/85 disabled:opacity-50 sm:h-10 sm:w-10 ${recording ? 'ring-2 ring-red-400/70 ring-offset-2 ring-offset-surface' : ''}`}
               >
                 {recording ? <Square size={17} fill="currentColor" /> : <Mic size={19} />}
               </button>
               <input ref={fileInputRef} type="file" hidden accept="*/*" onChange={handleFileChange} />
            </div>
            <textarea
              value={message}
               onChange={(e) => setMessage(e.target.value)}
              placeholder={t('workspace_placeholder')}
              dir={isRtl ? 'rtl' : 'ltr'}
              className="min-h-10 min-w-0 flex-1 resize-none border-none bg-transparent px-2 py-2 text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground sm:px-3"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
            />
              {chatPending ? (
                <button
                  type="button"
                  onClick={cancelChat}
                  aria-label={t('workspace_cancel_chat')}
                  title={t('workspace_cancel_chat')}
                  className="ms-auto flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-black p-0 text-white shadow-lg shadow-black/20 transition-colors hover:bg-black/80 md:h-12 md:w-12"
                >
                  <Square size={22} fill="currentColor" strokeWidth={2.2} />
                </button>
              ) : (
                <Button
                  type="submit"
                  disabled={(!message.trim() && attachedFiles.length === 0) || newChatPending || recordingFinalizing || transcribe.isPending}
                  aria-label={t('workspace_send')}
                  className="ms-auto h-[3.25rem] w-[3.25rem] flex-shrink-0 rounded-xl p-0 shadow-lg shadow-primary/20 md:h-[3.75rem] md:w-[3.75rem]"
                >
                  <Send size={28} strokeWidth={2.35} className={isRtl ? '-scale-x-100' : ''} />
                </Button>
              )}
                </>
              )}
          </form>
        </div>
      </Card>
       <ChatHistoryPanel
         open={historyOpen}
         onClose={closeHistory}
         onSelect={openConversation}
         activeConversationId={conversationId ?? requestedConversationId}
         isSignedIn={Boolean(isSignedIn)}
         agents={agents ?? []}
         isRtl={isRtl}
         appId={appId}
       />
         <SubscriptionPrompt open={subscriptionPromptOpen} onClose={() => setSubscriptionPromptOpen(false)} />
    </div>
  );
}