import horse from '../assets/persian-dark-horse-round-small.webp';
import lion from '../assets/avatars/lion.svg';
import human from '../assets/avatars/human.svg';
import fox from '../assets/avatars/fox.svg';
import owl from '../assets/avatars/owl.svg';
import cat from '../assets/avatars/cat.svg';
import wolf from '../assets/avatars/wolf.svg';
import bear from '../assets/avatars/bear.svg';
import sun from '../assets/avatars/sun.svg';
import robot from '../assets/avatars/robot.svg';

const originalHorseImages = import.meta.glob('../assets/avatars/original-horses/horse-*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const originalHorseOptions = Array.from({ length: 10 }, (_, index) => {
  const number = String(index + 1).padStart(2, '0');
  return {
    id: `original-horse-${number}`,
    label: `Original horse ${index + 1}`,
    src: originalHorseImages[`../assets/avatars/original-horses/horse-${number}.webp`] || horse,
  };
});

export const minimalAvatarOptions = [
  { id: 'horse', label: 'Horse', src: horse },
  { id: 'lion', label: 'Lion', src: lion },
  { id: 'human', label: 'Human', src: human },
  { id: 'fox', label: 'Fox', src: fox },
  { id: 'owl', label: 'Owl', src: owl },
  { id: 'cat', label: 'Cat', src: cat },
  { id: 'wolf', label: 'Wolf', src: wolf },
  { id: 'bear', label: 'Bear', src: bear },
  { id: 'sun', label: 'Sun', src: sun },
  { id: 'robot', label: 'Robot', src: robot },
  ...originalHorseOptions,
] as const;

const characterImages = import.meta.glob('../assets/avatars/characters/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const characters = [
  ['joker', 'Joker'],
  ['sherlock-holmes', 'Sherlock Holmes'],
  ['iron-man', 'Iron Man'],
  ['spider-man', 'Spider-Man'],
  ['batman', 'Batman'],
  ['dexter', 'Dexter'],
  ['harley-quinn', 'Harley Quinn'],
  ['tom', 'Tom'],
  ['jerry', 'Jerry'],
  ['homer-simpson', 'Homer Simpson'],
  ['bojack-horseman', 'BoJack Horseman'],
  ['pink-panther', 'Pink Panther'],
  ['yusuf-payambar', 'Yusuf Payambar'],
  ['naruto', 'Naruto'],
  ['saitama', 'Saitama (One Punch Man)'],
  ['luffy', 'Luffy (One Piece)'],
  ['levi', 'Levi (Attack on Titan)'],
  ['barbie', 'Barbie'],
  ['mokhtar', 'Mokhtar'],
  ['fezi-agent', 'FEZI'],
  ['manika-agent', 'Manika'],
  ['negar-agent', 'Negar'],
  ['arta-agent', 'Arta'],
] as const;

export const characterAvatarOptions = characters.map(([id, label]) => ({
  id,
  label,
  src: characterImages[`../assets/avatars/characters/${id}.webp`],
}));

export const avatarOptions = [...minimalAvatarOptions, ...characterAvatarOptions];
export const defaultFeziAvatar = `${import.meta.env.BASE_URL}fezi-avatar.webp`;

export function avatarSource(avatarId?: string | null) {
  return avatarOptions.find((option) => option.id === avatarId)?.src;
}

type AccountImage = {
  hasImage?: boolean;
  imageUrl?: string | null;
  externalAccounts?: readonly { imageUrl?: string | null }[];
};

export function accountAvatarSource(avatarId: string | null | undefined, user?: AccountImage | null) {
  const selected = avatarSource(avatarId);
  if (selected) return selected;
  if (avatarId && avatarId !== 'account-photo') return undefined;
  if (user?.hasImage && user.imageUrl?.startsWith('https://')) return user.imageUrl;
  return user?.externalAccounts?.find(account => account.imageUrl?.startsWith('https://'))?.imageUrl ?? undefined;
}

export function publicAvatarSource(avatarId?: string | null, publicId?: string) {
  const local = avatarSource(avatarId);
  if (local) return local;
  if (publicId === 'fezi') return defaultFeziAvatar;
  if (!avatarId) return undefined;
  try {
    const url = new URL(avatarId);
    if (url.protocol === 'https:' && (
      url.hostname === 'img.clerk.com' || url.hostname.endsWith('.clerk.dev')
      || url.hostname === 'lh3.googleusercontent.com' || url.hostname === 'avatars.githubusercontent.com'
      || url.hostname === 'pbs.twimg.com'
    )) {
      return avatarId;
    }
  } catch {
    // Unknown avatar choices are not external image URLs.
  }
  return undefined;
}