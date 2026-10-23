/** SSC CGL post-preference pack: one core path + optional AAO Paper-III. */

export type CglCoreId =
  | 'ssccglaso'
  | 'ssccgliti'
  | 'ssccglgst'
  | 'ssccglaao'

export type CglPackConfig = {
  core: CglCoreId
  /** Star AAO + Paper-III syllabus as an add-on (ignored if core is already AAO). */
  aaoAddon: boolean
}

export const CGL_CORE_OPTIONS: Array<{
  id: CglCoreId
  label: string
  blurb: string
}> = [
  {
    id: 'ssccglaso',
    label: 'ASO CSS / MEA',
    blurb: 'Best WLB desk path — Delhi ministries or MEA.',
  },
  {
    id: 'ssccgliti',
    label: 'Income Tax Inspector',
    blurb: 'CBDT urban tax authority — stronger field variance.',
  },
  {
    id: 'ssccglgst',
    label: 'GST / Excise Inspector',
    blurb: 'Largest Level-7 inspector pool — CBIC zones.',
  },
  {
    id: 'ssccglaao',
    label: 'AAO (C&AG)',
    blurb: 'Level-8 + Finance & Economics Paper-III.',
  },
]

/** Always include umbrella CGL for shared Tier-1/2 syllabus. */
export const CGL_UMBRELLA_ID = 'ssccgl'
export const CGL_AAO_ID = 'ssccglaao'

export const CGL_PATH_IDS = new Set<string>([
  CGL_UMBRELLA_ID,
  'ssccglaso',
  'ssccgliti',
  'ssccglgst',
  CGL_AAO_ID,
])

export function examsForCglPack(pack: CglPackConfig): string[] {
  const ids = new Set<string>([CGL_UMBRELLA_ID, pack.core])
  if (pack.aaoAddon && pack.core !== CGL_AAO_ID) {
    ids.add(CGL_AAO_ID)
  }
  return [...ids]
}
