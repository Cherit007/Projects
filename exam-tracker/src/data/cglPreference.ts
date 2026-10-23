/** Ordered CGL post-preference helper with short tradeoffs. */

export type CglPrefRow = {
  id: string
  label: string
  rankHint: string
  tradeoff: string
}

/** Default preference order for this user’s stated goals (WLB → cash → tax). */
export const CGL_PREF_DEFAULT: CglPrefRow[] = [
  {
    id: 'ssccglaao',
    label: 'AAO (C&AG)',
    rankHint: 'Best cash · Level-8',
    tradeoff: 'Needs Paper-III Finance & Economics grind.',
  },
  {
    id: 'ssccglaso',
    label: 'ASO CSS / MEA',
    rankHint: 'Best WLB desk',
    tradeoff: 'Closes high — need top Tier-2 rank.',
  },
  {
    id: 'ssccgliti',
    label: 'Income Tax Inspector',
    rankHint: 'Urban authority',
    tradeoff: 'Fewer seats; field/survey variance.',
  },
  {
    id: 'ssccglgst',
    label: 'GST / Excise Inspector',
    rankHint: 'Volume Level-7',
    tradeoff: 'More seats; zone transfers + field.',
  },
]
