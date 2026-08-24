export function anonymizeParticipantName(name: string) {
  const characters = Array.from(name.trim());

  if (!characters.length) return "";
  if (characters.length === 1) return "*";
  if (characters.length === 2) return `${characters[0]}*`;

  return `${characters[0]}${"*".repeat(characters.length - 2)}${characters.at(-1)}`;
}
