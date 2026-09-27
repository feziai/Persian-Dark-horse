export type ChatSkill = { command: string; instruction: string };

export function capabilityCommand(id: string, label: string) {
  const slug = (label || id).trim().replace(/\s+/gu, "_").replace(/[^\p{L}\p{N}_-]/gu, "").slice(0, 48);
  return `/${slug || id.replace(/[^a-z0-9_-]/giu, "_").slice(0, 48)}`;
}

export function skillDisplayText(text: string, command?: string) {
  return command ? `${command}\n${text}` : text;
}

export function splitSkillDisplay(text: string) {
  const match = text.match(/^(\/[\p{L}\p{N}_-]{1,48})(?:\n([\s\S]*))?$/u);
  return match ? { command: match[1], body: match[2] || "" } : { command: null, body: text };
}