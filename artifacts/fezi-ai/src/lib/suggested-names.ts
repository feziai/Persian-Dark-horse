export const suggestedNames = [
  "Fazel",
  "Moein",
  "Saber",
  "Negar",
  "Arta",
  "Fatmeh",
  "Sadegh",
  "Ara",
  "Eli",
  "Monika",
] as const;

export function randomSuggestedName(): string {
  return suggestedNames[Math.floor(Math.random() * suggestedNames.length)];
}