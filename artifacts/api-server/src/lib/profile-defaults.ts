// Only server-verified Clerk data is used to bootstrap a new local profile.
export type ClerkProfile = {
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  hasImage?: boolean;
  imageUrl?: string | null;
  externalAccounts?: Array<{
    imageUrl?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  }>;
};

export function accountPhotoUrl(user: ClerkProfile): string | undefined {
  const socialPhoto = user.externalAccounts?.find(account => account.imageUrl?.startsWith("https://"))?.imageUrl;
  if (user.hasImage && user.imageUrl?.startsWith("https://")) return user.imageUrl;
  return socialPhoto ?? undefined;
}

export function initialProfileDefaults(user: ClerkProfile) {
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim()
    || user.externalAccounts?.map(account => [account.firstName, account.lastName].filter(Boolean).join(" ").trim()).find(Boolean)
    || "";
  const username = user.username?.trim();
  return {
    displayName: name.slice(0, 120),
    avatarId: accountPhotoUrl(user) ? "account-photo" : undefined,
    username: username && /^[A-Za-z0-9_]{4,20}$/.test(username) ? username : undefined,
  };
}