import type { SyllabusSection } from './types'

/** Reusable syllabus slices so shared topics stay in sync across exams. */

export const APTITUDE_FULL: SyllabusSection[] = [
  {
    area: 'quant',
    label: 'Quantitative Aptitude',
    topicIds: [
      'qa-number-system',
      'qa-percent-pl',
      'qa-si-ci',
      'qa-ratio',
      'qa-time-work',
      'qa-speed',
      'qa-mensuration',
      'qa-algebra',
      'qa-permutation',
      'qa-di',
      'qa-ds',
    ],
    weightNote: 'Bank prelims + mains DI heavy',
  },
  {
    area: 'reasoning',
    label: 'Reasoning Ability',
    topicIds: [
      're-puzzle',
      're-inequality',
      're-coding',
      're-blood',
      're-order',
      're-critical',
      're-ds',
    ],
  },
  {
    area: 'english',
    label: 'English Language',
    topicIds: ['en-rc', 'en-grammar', 'en-vocab', 'en-para'],
  },
]

export const APTITUDE_SCREENING: SyllabusSection[] = [
  {
    area: 'quant',
    label: 'Quantitative Aptitude (Screening)',
    topicIds: [
      'qa-number-system',
      'qa-percent-pl',
      'qa-si-ci',
      'qa-ratio',
      'qa-time-work',
      'qa-speed',
      'qa-algebra',
      'qa-di',
    ],
  },
  {
    area: 'reasoning',
    label: 'Reasoning (Screening)',
    topicIds: [
      're-puzzle',
      're-inequality',
      're-coding',
      're-blood',
      're-order',
    ],
  },
  {
    area: 'english',
    label: 'English (Screening)',
    topicIds: ['en-rc', 'en-grammar', 'en-vocab', 'en-para'],
  },
]

export const GA_BANKING: SyllabusSection[] = [
  {
    area: 'ga',
    label: 'General Awareness',
    topicIds: ['ga-current', 'ga-static', 'ga-economy'],
  },
  {
    area: 'banking',
    label: 'Banking Awareness',
    topicIds: ['ba-rbi-basics', 'ba-products', 'ba-financial', 'ba-schemes'],
  },
]

export const DESCRIPTIVE: SyllabusSection[] = [
  {
    area: 'desc-eng',
    label: 'Descriptive English',
    topicIds: ['de-essay', 'de-precis', 'de-letter'],
  },
]

export const ESI_FULL: SyllabusSection[] = [
  {
    area: 'esi',
    label: 'Economic & Social Issues',
    topicIds: [
      'esi-growth',
      'esi-inflation',
      'esi-social',
      'esi-sustainable',
      'esi-global',
      'esi-reports',
    ],
    weightNote: 'EduTap / Anuj Jindal / Oliveboard ESI track',
  },
]

export const FM_FULL: SyllabusSection[] = [
  {
    area: 'fm',
    label: 'Finance & Management',
    topicIds: ['fm-basics', 'fm-ratio', 'fm-risk', 'fm-mgmt', 'fm-fintech'],
    weightNote: 'RBI P2 FM · SEBI / PFRDA / IRDAI overlap',
  },
]

export const ARD_FULL: SyllabusSection[] = [
  {
    area: 'ard',
    label: 'Agriculture & Rural Development',
    topicIds: ['ard-agri', 'ard-rural', 'ard-finance', 'ard-schemes'],
    weightNote: 'NABARD-specific — EduTap ARD modules',
  },
]

export const COMPUTER_IT: SyllabusSection[] = [
  {
    area: 'computer',
    label: 'Computer / IT Professional Knowledge',
    topicIds: [
      'comp-fundamentals',
      'comp-networking',
      'comp-dbms',
      'comp-dsa',
      'comp-security',
      'comp-se',
      'comp-web',
    ],
    weightNote: 'IBPS SO IT · SEBI IT · Oliveboard / Adda IT PK',
  },
]

export const COMPUTER_AWARENESS: SyllabusSection[] = [
  {
    area: 'computer',
    label: 'Computer Awareness',
    topicIds: [
      'comp-fundamentals',
      'comp-networking',
      'comp-ms-office',
      'comp-security',
      'comp-web',
    ],
  },
]

export const GATE_CS_FULL: SyllabusSection[] = [
  {
    area: 'gate-cs',
    label: 'GATE CS Core',
    topicIds: [
      'gate-algo',
      'gate-ds',
      'gate-toc',
      'gate-compiler',
      'gate-os',
      'gate-db',
      'gate-cn',
      'gate-digital',
      'gate-engmath',
      'gate-programming',
    ],
    weightNote: 'GATE Academy / Made Easy / GFG GATE CS syllabus',
  },
]

export const INTERVIEW_GENERAL: SyllabusSection[] = [
  {
    area: 'interview',
    label: 'Interview Prep',
    topicIds: ['iv-hr', 'iv-domain'],
  },
]

export const INTERVIEW_TECH: SyllabusSection[] = [
  {
    area: 'interview',
    label: 'Interview Prep',
    topicIds: ['iv-hr', 'iv-domain', 'iv-tech'],
  },
]

export function mergeSections(
  ...groups: Array<SyllabusSection | SyllabusSection[]>
): SyllabusSection[] {
  return groups.flatMap((g) => (Array.isArray(g) ? g : [g]))
}
