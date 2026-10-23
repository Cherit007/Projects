export type PyqPaper = {
  id: string
  year: string
  title: string
  stage: string
  /** Direct PDF when available; else hub page */
  url: string
  kind: 'pdf' | 'page'
  source: string
  note?: string
}

/**
 * Curated free / official previous papers.
 * Many recent papers are memory-based (orgs don’t always publish).
 * Prefer Open for pages; Download works best on direct PDFs.
 */
export const PYQS_BY_EXAM: Record<string, PyqPaper[]> = {
  ibpsso: [
    {
      id: 'ibpsso-2025-mains',
      year: '2025',
      title: 'IBPS SO IT Officer Mains (memory-based)',
      stage: 'Mains',
      url: 'https://cdn-images.prepp.in/public/image/IBPS_SO_2025_Mains_Memory_Based_Question_Paper_Nov_9_2025_IT_Officer_Scale_I__771cbb3292ea09e9375fc97857e5a418.pdf',
      kind: 'pdf',
      source: 'Prepp',
    },
    {
      id: 'ibpsso-2024-mains',
      year: '2024',
      title: 'IBPS SO IT Officer Mains (memory-based)',
      stage: 'Mains',
      url: 'https://cdn-images.prepp.in/public/image/IBPS_SO_2024_Mains_Memory_Based_Question_Paper_Dec_14_2024_IT_Officer_Scale_I__6a697ea86dd0d240afa8a7b2507fa614.pdf',
      kind: 'pdf',
      source: 'Prepp',
    },
    {
      id: 'ibpsso-hub',
      year: 'Multi',
      title: 'IBPS SO previous papers hub (Prelims + Mains)',
      stage: 'All',
      url: 'https://prepp.in/ibps-so-exam/practice-papers',
      kind: 'page',
      source: 'Prepp',
    },
    {
      id: 'ibpsso-adda',
      year: 'Multi',
      title: 'IBPS SO PYQ PDFs with solutions',
      stage: 'All',
      url: 'https://www.adda247.com/jobs/ibps-so-previous-year-question-paper/',
      kind: 'page',
      source: 'Adda247',
    },
  ],
  rbi: [
    {
      id: 'rbi-official-samples',
      year: '2010–2015',
      title: 'RBI official Grade B sample / old papers',
      stage: 'Phase II',
      url: 'https://rbi.org.in/scripts/bs_viewcontent.aspx?Id=2817',
      kind: 'page',
      source: 'RBI.gov.in',
      note: 'Official older papers',
    },
    {
      id: 'rbi-prepp',
      year: 'Multi',
      title: 'RBI Grade B PYQ PDF collection',
      stage: 'P1 + P2',
      url: 'https://prepp.in/rbi-grade-b-exam/practice-papers',
      kind: 'page',
      source: 'Prepp',
    },
    {
      id: 'rbi-oliveboard',
      year: 'Multi',
      title: 'RBI Grade B previous year papers',
      stage: 'P1 + P2',
      url: 'https://www.oliveboard.in/blog/rbi-grade-b-pyps/',
      kind: 'page',
      source: 'Oliveboard',
    },
    {
      id: 'rbi-edutap',
      year: '2021–2026',
      title: 'RBI Grade B memory-based PYQs',
      stage: 'P1 + P2',
      url: 'https://edutap.in/rbi-grade-b/previous-year-questions/',
      kind: 'page',
      source: 'EduTap',
    },
  ],
  sebi: [
    {
      id: 'sebi-prepp',
      year: 'Multi',
      title: 'SEBI Grade A previous papers',
      stage: 'P1 + P2',
      url: 'https://prepp.in/sebi-grade-a-exam/practice-papers',
      kind: 'page',
      source: 'Prepp',
    },
    {
      id: 'sebi-oliveboard',
      year: 'Multi',
      title: 'SEBI Grade A PYQ / memory papers',
      stage: 'All',
      url: 'https://www.oliveboard.in/blog/sebi-grade-a-previous-year-question-paper/',
      kind: 'page',
      source: 'Oliveboard',
    },
  ],
  nabard: [
    {
      id: 'nabard-prepp',
      year: 'Multi',
      title: 'NABARD Grade A previous papers',
      stage: 'P1 + P2',
      url: 'https://prepp.in/nabard-grade-a-exam/practice-papers',
      kind: 'page',
      source: 'Prepp',
    },
    {
      id: 'nabard-oliveboard',
      year: 'Multi',
      title: 'NABARD Grade A PYQs',
      stage: 'All',
      url: 'https://www.oliveboard.in/blog/nabard-grade-a-previous-year-question-papers/',
      kind: 'page',
      source: 'Oliveboard',
    },
  ],
  sbi: [
    {
      id: 'sbi-prepp',
      year: 'Multi',
      title: 'SBI PO previous year papers',
      stage: 'Prelims + Mains',
      url: 'https://prepp.in/sbi-po-exam/practice-papers',
      kind: 'page',
      source: 'Prepp',
    },
    {
      id: 'sbi-oliveboard',
      year: 'Multi',
      title: 'SBI PO memory-based / PYQ PDFs',
      stage: 'All',
      url: 'https://www.oliveboard.in/blog/sbi-po-previous-year-question-paper/',
      kind: 'page',
      source: 'Oliveboard',
    },
  ],
  ibpspo: [
    {
      id: 'ibpspo-prepp',
      year: 'Multi',
      title: 'IBPS PO previous year papers',
      stage: 'Prelims + Mains',
      url: 'https://prepp.in/ibps-po-exam/practice-papers',
      kind: 'page',
      source: 'Prepp',
    },
    {
      id: 'ibpspo-oliveboard',
      year: 'Multi',
      title: 'IBPS PO PYQ PDFs',
      stage: 'All',
      url: 'https://www.oliveboard.in/blog/ibps-po-previous-year-question-paper/',
      kind: 'page',
      source: 'Oliveboard',
    },
  ],
  pfrda: [
    {
      id: 'pfrda-hub',
      year: 'Multi',
      title: 'PFRDA Grade A previous papers / pattern',
      stage: 'All',
      url: 'https://prepp.in/pfrda-grade-a-exam/practice-papers',
      kind: 'page',
      source: 'Prepp',
    },
  ],
  irdai: [
    {
      id: 'irdai-hub',
      year: 'Multi',
      title: 'IRDAI AM previous papers hub',
      stage: 'All',
      url: 'https://prepp.in/irdai-assistant-manager-exam/practice-papers',
      kind: 'page',
      source: 'Prepp',
    },
  ],
  rrb2it: [
    {
      id: 'rrb-so-hub',
      year: 'Multi',
      title: 'IBPS RRB Officer / IT papers hub',
      stage: 'All',
      url: 'https://prepp.in/ibps-rrb-exam/practice-papers',
      kind: 'page',
      source: 'Prepp',
    },
  ],
  rrbjeit: [
    {
      id: 'rrb-je-hub',
      year: 'Multi',
      title: 'RRB JE previous year papers',
      stage: 'CBT',
      url: 'https://prepp.in/rrb-je-exam/practice-papers',
      kind: 'page',
      source: 'Prepp',
    },
  ],
  isrosc: [
    {
      id: 'isro-hub',
      year: 'Multi',
      title: 'ISRO Scientist/Engineer previous papers',
      stage: 'CBT',
      url: 'https://prepp.in/isro-scientist-engineer-exam/practice-papers',
      kind: 'page',
      source: 'Prepp',
    },
  ],
  drdosb: [
    {
      id: 'gate-cs-hub',
      year: 'Multi',
      title: 'GATE CS previous papers (DRDO shortlist path)',
      stage: 'GATE',
      url: 'https://gate.iitkgp.ac.in/gate_2025/previous.php',
      kind: 'page',
      source: 'GATE Official',
      note: 'DRDO uses GATE CS score',
    },
  ],
  nicscb: [
    {
      id: 'gate-cs-nic',
      year: 'Multi',
      title: 'GATE CS previous papers (NIC path)',
      stage: 'GATE',
      url: 'https://gate.iitkgp.ac.in/gate_2025/previous.php',
      kind: 'page',
      source: 'GATE Official',
    },
  ],
  pwcsgate: [
    {
      id: 'gate-cs-pg',
      year: 'Multi',
      title: 'GATE CS previous papers (POWERGRID path)',
      stage: 'GATE',
      url: 'https://gate.iitkgp.ac.in/gate_2025/previous.php',
      kind: 'page',
      source: 'GATE Official',
    },
  ],
  barcoces: [
    {
      id: 'barc-hub',
      year: 'Multi',
      title: 'BARC OCES / related CS practice hubs',
      stage: 'Screening',
      url: 'https://www.barc.gov.in/',
      kind: 'page',
      source: 'BARC',
      note: 'Check careers / OCES brochure each year',
    },
  ],
  sbisco: [
    {
      id: 'sbi-sco-note',
      year: 'Advt',
      title: 'SBI SCO — papers vary by advertisement',
      stage: 'As notified',
      url: 'https://sbi.co.in/web/careers',
      kind: 'page',
      source: 'SBI Careers',
      note: 'No fixed annual PYQ set; use SO IT PK + banking awareness',
    },
  ],
  aaimanit: [
    {
      id: 'aai-hub',
      year: 'Multi',
      title: 'AAI JE/Manager previous papers hub',
      stage: 'CBT',
      url: 'https://prepp.in/aai-exam/practice-papers',
      kind: 'page',
      source: 'Prepp',
    },
  ],
  fcimgr: [
    {
      id: 'fci-hub',
      year: 'Multi',
      title: 'FCI Manager previous papers',
      stage: 'P1 + P2',
      url: 'https://prepp.in/fci-manager-exam/practice-papers',
      kind: 'page',
      source: 'Prepp',
    },
  ],
  ifsca: [
    {
      id: 'ifsca-hub',
      year: 'Multi',
      title: 'IFSCA Grade A previous papers / pattern',
      stage: 'All',
      url: 'https://prepp.in/ifsca-grade-a-exam/practice-papers',
      kind: 'page',
      source: 'Prepp',
    },
  ],
  sidbi: [
    {
      id: 'sidbi-hub',
      year: 'Multi',
      title: 'SIDBI Grade A / Officer papers hub',
      stage: 'All',
      url: 'https://prepp.in/sidbi-grade-a-exam/practice-papers',
      kind: 'page',
      source: 'Prepp',
    },
  ],
  cris: [
    {
      id: 'cris-note',
      year: 'Advt',
      title: 'CRIS — check careers for each notification',
      stage: 'As notified',
      url: 'https://www.cris.org.in/careers',
      kind: 'page',
      source: 'CRIS',
      note: 'Role-specific; pair with GATE CS / SO IT PK',
    },
  ],
  defpsu: [
    {
      id: 'defpsu-gate',
      year: 'Multi',
      title: 'GATE CS previous papers (defence PSU shortlist path)',
      stage: 'GATE',
      url: 'https://gate.iitkgp.ac.in/gate_2025/previous.php',
      kind: 'page',
      source: 'GATE Official',
    },
  ],
  oilpsu: [
    {
      id: 'oilpsu-gate',
      year: 'Multi',
      title: 'GATE CS previous papers (oil PSU shortlist path)',
      stage: 'GATE',
      url: 'https://gate.iitkgp.ac.in/gate_2025/previous.php',
      kind: 'page',
      source: 'GATE Official',
    },
  ],
  ssccgl: [
    {
      id: 'ssccgl-official',
      year: 'Multi',
      title: 'SSC CGL — official notices & results hub',
      stage: 'All',
      url: 'https://ssc.gov.in/',
      kind: 'page',
      source: 'SSC',
    },
    {
      id: 'ssccgl-adda',
      year: 'Multi',
      title: 'SSC CGL previous year papers with solutions',
      stage: 'Tier-1 + Tier-2',
      url: 'https://www.adda247.com/jobs/ssc-cgl-previous-year-question-paper/',
      kind: 'page',
      source: 'Adda247',
    },
    {
      id: 'ssccgl-testbook',
      year: 'Multi',
      title: 'SSC CGL PYQ practice hub',
      stage: 'All',
      url: 'https://testbook.com/ssc-cgl/previous-year-papers',
      kind: 'page',
      source: 'Testbook',
    },
  ],
  ssccgliti: [
    {
      id: 'ssccgliti-hub',
      year: 'Multi',
      title: 'SSC CGL papers (prefer ITI after merit)',
      stage: 'Tier-1 + Tier-2',
      url: 'https://www.adda247.com/jobs/ssc-cgl-previous-year-question-paper/',
      kind: 'page',
      source: 'Adda247',
      note: 'Same exam as SSC CGL — post preference decides ITI',
    },
  ],
  ssccglgst: [
    {
      id: 'ssccglgst-hub',
      year: 'Multi',
      title: 'SSC CGL papers (prefer GST/Excise Inspector)',
      stage: 'Tier-1 + Tier-2',
      url: 'https://testbook.com/ssc-cgl/previous-year-papers',
      kind: 'page',
      source: 'Testbook',
      note: 'Same exam as SSC CGL — prefer Central Excise Inspector',
    },
  ],
  ssccglaao: [
    {
      id: 'ssccglaao-p3',
      year: 'Multi',
      title: 'SSC CGL AAO Paper-III (Finance & Economics) material / PYQ',
      stage: 'Paper-III',
      url: 'https://www.adda247.com/jobs/ssc-cgl-previous-year-question-paper/',
      kind: 'page',
      source: 'Adda247',
    },
    {
      id: 'ssccglaao-hub',
      year: 'Multi',
      title: 'SSC CGL Tier-1/2 PYQ hub',
      stage: 'Tier-1 + Tier-2',
      url: 'https://testbook.com/ssc-cgl/previous-year-papers',
      kind: 'page',
      source: 'Testbook',
    },
  ],
  ssccglaso: [
    {
      id: 'ssccglaso-hub',
      year: 'Multi',
      title: 'SSC CGL papers (prefer ASO CSS/MEA)',
      stage: 'Tier-1 + Tier-2',
      url: 'https://www.adda247.com/jobs/ssc-cgl-previous-year-question-paper/',
      kind: 'page',
      source: 'Adda247',
      note: 'Practice DEST/typing for CSS/MEA standards',
    },
  ],
  statepcs: [
    {
      id: 'statepcs-note',
      year: 'State',
      title: 'Use your State PSC official site for syllabus & PYQs',
      stage: 'All',
      url: 'https://www.google.com/search?q=state+psc+previous+year+question+paper',
      kind: 'page',
      source: 'State PSC',
      note: 'Syllabus and papers are state-specific — pick home PSC first',
    },
  ],
}

export function papersForExam(examId: string): PyqPaper[] {
  return PYQS_BY_EXAM[examId] ?? []
}

/** Filename-safe download name */
export function paperFilename(paper: PyqPaper): string {
  const base = `${paper.year}-${paper.title}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
  return paper.kind === 'pdf' ? `${base}.pdf` : `${base}.html`
}
