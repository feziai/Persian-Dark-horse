import { useCallback, useEffect, useRef } from 'react';
import { useAuth, useUser } from '@clerk/react';
import { useTranslation } from './i18n';

export type Profile = {
  id: string;
  name: string;
  username?: string | null;
  avatarUrl: string | null;
  bio: string;
  links: string[];
  verified: boolean;
  followerCount: number;
  followingCount: number;
  isFollowing: boolean;
  isBlocked: boolean;
};
export type Media = { id: string; url: string; kind: 'image' | 'video' };
export type Post = {
  id: string;
  author: Profile;
  text: string;
  media: Media[];
  kind: 'post' | 'news' | 'prompt';
  parentId: string | null;
  createdAt: string;
  likeCount: number;
  replyCount: number;
  liked: boolean;
  sourceUrl?: string | null;
  title?: string | null;
};
export type CommunityNotification = {
  id: string;
  type: 'like' | 'reply' | 'follow' | 'message' | 'news';
  text: string;
  href: string;
  read: boolean;
  createdAt: string;
};
export type Banner = {
  id: string;
  title: string;
  text: string;
  imageUrl: string;
  buttonLabel: string;
  buttonHref: string;
  enabled: boolean;
  sortOrder: number;
};
export type Creation = { id: string; name: string; url: string; imageUrl?: string };
export type Conversation = { peer: Profile; lastMessage: string; updatedAt: string; unreadCount: number };
export type DirectMessage = { id: string; senderId: string; text: string; createdAt: string };
export type Report = { id: string; reason: string; status: string; postId?: string; userId?: string; createdAt: string };
export type NewsStatus = { configured: boolean; lastRun: string | null; error: string | null };
export type FeedTab = 'all' | 'following' | 'news';

export const MAX_IMAGES = 5;
export const MAX_VIDEO_BYTES = 6_250_000;
export const MAX_POST_TEXT = 2000;
export const MAX_MESSAGE_TEXT = 2000;
const ALLOWED_IMAGE = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_VIDEO = ['video/mp4'];

export class CommunityError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type TokenGetter = () => Promise<string | null>;

async function communityRequest<T>(getToken: TokenGetter | null, path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (getToken) {
    try {
      const token = await getToken();
      if (token) headers.set('Authorization', `Bearer ${token}`);
    } catch {
      /* anonymous request */
    }
  }
  if (init.body && typeof init.body === 'string' && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await fetch(`/api${path}`, { credentials: 'include', ...init, headers });
  if (!response.ok) {
    let message = '';
    try {
      const data = await response.json();
      message = typeof data?.error === 'string' ? data.error : typeof data?.message === 'string' ? data.message : '';
    } catch {
      /* no body */
    }
    throw new CommunityError(message || `Request failed (${response.status})`, response.status);
  }
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/** Auth-aware client: Clerk bearer token + credentialed cookies (admin session). */
export function useCommunityApi() {
  const { getToken, isSignedIn } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const signedRef = useRef(isSignedIn);
  signedRef.current = isSignedIn;
  return useCallback(<T,>(path: string, init?: RequestInit) =>
    communityRequest<T>(signedRef.current ? () => getTokenRef.current() : null, path, init), []);
}

export function useCommunityViewer() {
  const { isSignedIn, userId, isLoaded } = useAuth();
  const { user } = useUser();
  const emailVerified = !!user?.emailAddresses?.some((e) => e.verification?.status === 'verified');
  return { isSignedIn: !!isSignedIn, userId: userId ?? null, isLoaded, emailVerified };
}

export function validateMediaFiles(existing: Media[], pending: File[], incoming: File[], c: CommunityCopy): string | null {
  const all = [...pending, ...incoming];
  const kinds = [...existing.map((m) => m.kind), ...all.map((f) => (f.type.startsWith('video/') ? 'video' : 'image'))];
  for (const f of incoming) {
    if (f.type === 'image/svg+xml') return c.errSvg;
    if (!ALLOWED_IMAGE.includes(f.type) && !ALLOWED_VIDEO.includes(f.type)) return c.errType;
    if (f.type.startsWith('video/') && f.size >= MAX_VIDEO_BYTES) return c.errVideoSize;
    if (f.type.startsWith('image/') && f.size > 10_000_000) return c.errImageSize;
  }
  const videos = kinds.filter((k) => k === 'video').length;
  const images = kinds.filter((k) => k === 'image').length;
  if (videos > 1 || (videos === 1 && images > 0)) return c.errMix;
  if (images > MAX_IMAGES) return c.errTooMany;
  return null;
}

export async function uploadMedia(api: ReturnType<typeof useCommunityApi>, file: File, admin = false) {
  const res = await api<{ media: Media }>(admin ? '/admin/community/uploads' : '/community/uploads', {
    method: 'POST',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  return res.media;
}

export function safeHref(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export function isInternalHref(href: string) {
  return href.startsWith('/') && !href.startsWith('//');
}

export function linkLabel(href: string) {
  try {
    const url = new URL(href);
    return (url.hostname.replace(/^www\./, '') + url.pathname).replace(/\/$/, '');
  } catch {
    return href;
  }
}

export function formatRelative(iso: string, lang: string) {
  const date = new Date(iso);
  const diff = (Date.now() - date.getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(lang === 'fa' ? 'fa' : 'en', { numeric: 'auto', style: 'short' });
  if (diff < 60) return rtf.format(0, 'second');
  if (diff < 3600) return rtf.format(-Math.floor(diff / 60), 'minute');
  if (diff < 86400) return rtf.format(-Math.floor(diff / 3600), 'hour');
  if (diff < 604800) return rtf.format(-Math.floor(diff / 86400), 'day');
  return date.toLocaleDateString(lang === 'fa' ? 'fa-IR' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatCount(n: number, lang: string) {
  return new Intl.NumberFormat(lang === 'fa' ? 'fa-IR' : 'en-US', { notation: n >= 10000 ? 'compact' : 'standard' }).format(n);
}

/** setInterval that pauses while the tab is hidden and refreshes on focus. */
export function usePolling(fn: () => void, ms: number, enabled = true) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!enabled) return;
    const tick = () => { if (document.visibilityState === 'visible') ref.current(); };
    const id = window.setInterval(tick, ms);
    document.addEventListener('visibilitychange', tick);
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', tick); };
  }, [ms, enabled]);
}

const en = {
  community: 'Community', all: 'For you', following: 'Following', news: 'News',
  searchPosts: 'Search posts and news', clearSearch: 'Clear search', emptySearch: 'No posts match your search. Try another phrase.',
  composerPlaceholder: 'Share something with the Persian Dark Horse community', replyPlaceholder: 'Write a reply',
  post: 'Post', reply: 'Reply', posting: 'Posting', addMedia: 'Add photos or a video', removeMedia: 'Remove attachment',
  signInToPost: 'Sign in to join the conversation', signIn: 'Sign in',
  verifyEmail: 'Verify your email address in account settings before posting or messaging.',
  errSvg: 'SVG files are not accepted.', errType: 'That file type is not supported.',
  errVideoSize: 'That video is too large. Choose a shorter or smaller clip.', errImageSize: 'That image is too large.',
  errMix: 'Attach photos or a single video, not both.', errTooMany: 'Too many photos for one post.',
  errEmpty: 'Write something or attach media.', errTooLong: 'That text is too long.',
  like: 'Like', unlike: 'Unlike', replies: 'Replies', edit: 'Edit', delete: 'Delete', save: 'Save', cancel: 'Cancel',
  report: 'Report', block: 'Block', unblock: 'Unblock', more: 'More actions', share: 'Copy link', copied: 'Link copied',
  deleteConfirm: 'Delete this post permanently?', deleted: 'Post deleted', edited: 'Edited',
  reportTitle: 'Report', reportReason: 'What is wrong?', reportSend: 'Send report', reportSent: 'Report sent. Thank you.',
  reasonSpam: 'Spam or scam', reasonAbuse: 'Harassment or hate', reasonNsfw: 'Explicit content', reasonOther: 'Something else', reasonDetails: 'Details (optional)',
  blockConfirm: 'Block this person? You will not see each other or be able to message.', blocked: 'Blocked', unblocked: 'Unblocked',
  loadMore: 'Load more', loading: 'Loading', retry: 'Try again', errorLoad: 'Could not load this.',
  emptyAll: 'The feed is quiet. Start it.', emptyFollowing: 'Follow people to see their posts here.', emptyNews: 'No news yet.',
  emptyReplies: 'No replies yet.', newPosts: 'New posts', backToFeed: 'Back', thread: 'Thread', notFound: 'This post is not available.',
  source: 'Source', readSource: 'Read at source', official: 'Official', pro: 'Pro',
  followers: 'Followers', followingCount: 'Following', follow: 'Follow', unfollow: 'Unfollow', message: 'Message',
  editProfile: 'Edit profile', bio: 'Bio', links: 'Links', addLink: 'Add link', linkInvalid: 'Links must start with https://',
  avatarNote: 'Name and avatar are managed in account Settings.', creations: 'Public creations', noCreations: 'No public creations yet.',
  posts: 'Posts', noPosts: 'No posts yet.', profileNotFound: 'This profile is not available.', blockedProfile: 'You blocked this person.',
  messages: 'Messages', inbox: 'Inbox', noConversations: 'No conversations yet. Message someone from their profile.',
  selectConversation: 'Choose a conversation', typeMessage: 'Write a message', send: 'Send', signInMessages: 'Sign in to read your messages.',
  noMessages: 'Say hello.', earlier: 'Load earlier', unread: 'unread',
  notifications: 'Notifications', markAllRead: 'Mark all read', noNotifications: 'Nothing new.', enableBrowser: 'Browser alerts while open',
  browserUnsupported: 'Not supported in this browser', browserDenied: 'Blocked in browser settings', browserOn: 'On',
  admin: 'Community admin', reports: 'Reports', banners: 'Banners', analytics: 'Analytics', newsDesk: 'News',
  day: 'Day', week: 'Week', month: 'Month', online: 'Online now', visits: 'Visits',
  resolve: 'Resolve', dismiss: 'Dismiss', removePost: 'Resolve and remove post', open: 'Open', noReports: 'No open reports.',
  title: 'Title', text: 'Text', image: 'Image', upload: 'Upload', buttonLabel: 'Button label', buttonHref: 'Button destination', enabled: 'Enabled',
  addBanner: 'Add banner', saveBanners: 'Save banners', saved: 'Saved', moveUp: 'Move up', moveDown: 'Move down',
  publish: 'Publish', sourceUrl: 'Source URL', syncNow: 'Sync now', configured: 'Configured', notConfigured: 'Not configured (GNEWS_API_KEY missing)',
  lastRun: 'Last run', never: 'Never', published: 'published', status: 'Status', noBanners: 'No banners yet.', noData: 'No visits recorded in this period.',
  adminRequired: 'Admin session required.',
};
export type CommunityCopy = typeof en;
const fa: CommunityCopy = {
  community: 'انجمن', all: 'برای شما', following: 'دنبال‌شده‌ها', news: 'اخبار',
  searchPosts: 'جست‌وجو در پست‌ها و اخبار', clearSearch: 'پاک کردن جست‌وجو', emptySearch: 'پستی با این عبارت پیدا نشد. عبارت دیگری امتحان کنید.',
  composerPlaceholder: 'چیزی با جامعه فزی به اشتراک بگذارید', replyPlaceholder: 'پاسخ بنویسید',
  post: 'انتشار', reply: 'پاسخ', posting: 'در حال انتشار', addMedia: 'افزودن عکس یا ویدیو', removeMedia: 'حذف پیوست',
  signInToPost: 'برای پیوستن به گفتگو وارد شوید', signIn: 'ورود',
  verifyEmail: 'پیش از انتشار یا ارسال پیام، ایمیل خود را در تنظیمات حساب تأیید کنید.',
  errSvg: 'فایل SVG پذیرفته نمی‌شود.', errType: 'این نوع فایل پشتیبانی نمی‌شود.',
  errVideoSize: 'حجم ویدیو زیاد است. کلیپ کوتاه‌تر یا کوچک‌تری انتخاب کنید.', errImageSize: 'حجم تصویر زیاد است.',
  errMix: 'عکس یا یک ویدیو پیوست کنید، نه هر دو.', errTooMany: 'تعداد عکس‌ها برای یک پست زیاد است.',
  errEmpty: 'چیزی بنویسید یا رسانه پیوست کنید.', errTooLong: 'متن بیش از حد طولانی است.',
  like: 'پسندیدن', unlike: 'لغو پسند', replies: 'پاسخ‌ها', edit: 'ویرایش', delete: 'حذف', save: 'ذخیره', cancel: 'انصراف',
  report: 'گزارش', block: 'مسدود کردن', unblock: 'رفع مسدودی', more: 'گزینه‌های بیشتر', share: 'کپی پیوند', copied: 'پیوند کپی شد',
  deleteConfirm: 'این پست برای همیشه حذف شود؟', deleted: 'پست حذف شد', edited: 'ویرایش‌شده',
  reportTitle: 'گزارش', reportReason: 'مشکل چیست؟', reportSend: 'ارسال گزارش', reportSent: 'گزارش ارسال شد. سپاس.',
  reasonSpam: 'هرزنامه یا کلاهبرداری', reasonAbuse: 'آزار یا نفرت‌پراکنی', reasonNsfw: 'محتوای نامناسب', reasonOther: 'مورد دیگر', reasonDetails: 'توضیحات (اختیاری)',
  blockConfirm: 'این شخص مسدود شود؟ دیگر یکدیگر را نمی‌بینید و نمی‌توانید پیام دهید.', blocked: 'مسدود شد', unblocked: 'رفع مسدودی شد',
  loadMore: 'بیشتر', loading: 'در حال بارگذاری', retry: 'تلاش دوباره', errorLoad: 'بارگذاری ممکن نشد.',
  emptyAll: 'فید آرام است. شما شروع کنید.', emptyFollowing: 'افرادی را دنبال کنید تا پست‌هایشان اینجا بیاید.', emptyNews: 'هنوز خبری نیست.',
  emptyReplies: 'هنوز پاسخی نیست.', newPosts: 'پست‌های جدید', backToFeed: 'بازگشت', thread: 'گفتگو', notFound: 'این پست در دسترس نیست.',
  source: 'منبع', readSource: 'خواندن در منبع', official: 'رسمی', pro: 'پرو',
  followers: 'دنبال‌کننده', followingCount: 'دنبال‌شونده', follow: 'دنبال کردن', unfollow: 'لغو دنبال', message: 'پیام',
  editProfile: 'ویرایش نمایه', bio: 'درباره', links: 'پیوندها', addLink: 'افزودن پیوند', linkInvalid: 'پیوندها باید با https:// شروع شوند',
  avatarNote: 'نام و آواتار در تنظیمات حساب مدیریت می‌شوند.', creations: 'ساخته‌های عمومی', noCreations: 'هنوز ساخته عمومی ندارد.',
  posts: 'پست‌ها', noPosts: 'هنوز پستی نیست.', profileNotFound: 'این نمایه در دسترس نیست.', blockedProfile: 'شما این شخص را مسدود کرده‌اید.',
  messages: 'پیام‌ها', inbox: 'صندوق', noConversations: 'هنوز گفتگویی نیست. از نمایه افراد پیام دهید.',
  selectConversation: 'یک گفتگو انتخاب کنید', typeMessage: 'پیام بنویسید', send: 'ارسال', signInMessages: 'برای دیدن پیام‌ها وارد شوید.',
  noMessages: 'سلام کنید.', earlier: 'پیام‌های قبلی', unread: 'خوانده‌نشده',
  notifications: 'اعلان‌ها', markAllRead: 'همه خوانده شد', noNotifications: 'چیز تازه‌ای نیست.', enableBrowser: 'هشدار مرورگر هنگام باز بودن',
  browserUnsupported: 'در این مرورگر پشتیبانی نمی‌شود', browserDenied: 'در تنظیمات مرورگر مسدود است', browserOn: 'روشن',
  admin: 'مدیریت انجمن', reports: 'گزارش‌ها', banners: 'بنرها', analytics: 'آمار', newsDesk: 'اخبار',
  day: 'روز', week: 'هفته', month: 'ماه', online: 'آنلاین', visits: 'بازدید',
  resolve: 'رسیدگی شد', dismiss: 'رد', removePost: 'رسیدگی و حذف پست', open: 'باز کردن', noReports: 'گزارش بازی نیست.',
  title: 'عنوان', text: 'متن', image: 'تصویر', upload: 'بارگذاری', buttonLabel: 'متن دکمه', buttonHref: 'مقصد دکمه', enabled: 'فعال',
  addBanner: 'افزودن بنر', saveBanners: 'ذخیره بنرها', saved: 'ذخیره شد', moveUp: 'بالا', moveDown: 'پایین',
  publish: 'انتشار', sourceUrl: 'نشانی منبع', syncNow: 'همگام‌سازی', configured: 'پیکربندی شده', notConfigured: 'پیکربندی نشده (GNEWS_API_KEY موجود نیست)',
  lastRun: 'آخرین اجرا', never: 'هرگز', published: 'منتشر شد', status: 'وضعیت', noBanners: 'هنوز بنری نیست.', noData: 'در این بازه بازدیدی ثبت نشده.',
  adminRequired: 'نشست مدیر لازم است.',
};

export function useCommunityCopy() {
  const { lang, isRtl } = useTranslation();
  return { c: lang === 'fa' ? fa : en, lang, isRtl };
}
