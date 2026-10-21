export const careSymbols = [
  'hand-wash',
  'machine-wash-cold',
  'no-bleach',
  'dry-flat',
  'no-tumble-dry',
  'no-iron',
] as const;

export type CareSymbolName = (typeof careSymbols)[number];

export const careLabels: Record<CareSymbolName, string> = {
  'hand-wash': 'Hand wash',
  'machine-wash-cold': 'Machine wash cold',
  'no-bleach': 'Do not bleach',
  'dry-flat': 'Dry flat',
  'no-tumble-dry': 'Do not tumble dry',
  'no-iron': 'Do not iron',
};
