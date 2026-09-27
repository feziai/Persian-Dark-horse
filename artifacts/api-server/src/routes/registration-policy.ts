export type RegistrationSettings = {
  attributes?: Record<string, { enabled?: boolean; required?: boolean }>;
  social?: Record<string, { enabled?: boolean; authenticatable?: boolean }>;
  sign_up?: { mode?: string };
};

export const registrationUsernamePattern = /^[a-zA-Z0-9_]{4,20}$/;

export function safeRegistrationCapabilities(settings?: RegistrationSettings) {
  const attrs = settings?.attributes;
  const usernameEnabled = attrs?.username?.enabled === true;
  return {
    usernameOnly: settings?.sign_up?.mode === "public" &&
      usernameEnabled && attrs?.password?.enabled === true &&
      attrs?.email_address?.required === false &&
      attrs?.phone_number?.required !== true &&
      attrs?.last_name?.required !== true,
    usernameEnabled,
    socialProviders: Object.entries(settings?.social ?? {})
      .filter(([, provider]) => provider.enabled === true && provider.authenticatable === true)
      .map(([strategy]) => strategy),
  };
}