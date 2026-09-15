export const CREW_CHEERS = [
  {type:"heart",emoji:"❤️",label:"하트"},
  {type:"clap",emoji:"👏",label:"박수"},
  {type:"smile",emoji:"😊",label:"웃음"},
  {type:"run",emoji:"🏃",label:"달리기"},
] as const;
export type CrewCheerType = typeof CREW_CHEERS[number]["type"];
export function isCrewCheerType(value: unknown): value is CrewCheerType {
  return CREW_CHEERS.some(cheer=>cheer.type===value);
}
