export function requestGuestAccount(reason: string) {
  window.dispatchEvent(new CustomEvent('fezi:auth-required', { detail: { reason } }));
}