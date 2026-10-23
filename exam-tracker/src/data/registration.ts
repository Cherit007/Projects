import type { Exam } from './types'

/** Registration / apply window for dashboard target cards */
export type RegState = 'open' | 'closed' | 'watch'

export interface ExamRegistration {
  state: RegState
  /** Official apply portal or careers page */
  url: string
  /** Button label */
  linkLabel: string
  /** ISO YYYY-MM-DD — when set, open windows auto-close after this date */
  closesOn?: string
  /** Shown when open, e.g. "Apply by 31 Oct 2026" */
  openNote?: string
  /** Next expected notification / cycle when not open */
  nextNotification?: string
}

/**
 * Per-exam apply status. Keep dates honest — cards auto-flip when closesOn passes.
 * Verify on the official link before applying.
 */
export const EXAM_REGISTRATION: Record<string, ExamRegistration> = {
  sebi: {
    state: 'watch',
    url: 'https://www.sebi.gov.in/sebiweb/home/HomeAction.do?doListing=yes&sid=2&ssid=14&smid=9',
    linkLabel: 'SEBI careers',
    nextNotification: 'Expected ~Nov 2026 (verify sebi.gov.in)',
  },
  ibpsso: {
    state: 'closed',
    url: 'https://www.ibps.in/',
    linkLabel: 'IBPS portal',
    nextNotification: 'Next SO cycle after this mains/interview — usually mid-2027',
  },
  nabard: {
    state: 'watch',
    url: 'https://www.nabard.org/careers-notices.aspx?cid=693&id=26',
    linkLabel: 'NABARD careers',
    nextNotification: 'Expected Oct–Nov 2026 window',
  },
  rbi: {
    state: 'closed',
    url: 'https://opportunities.rbi.org.in/',
    linkLabel: 'RBI opportunities',
    nextNotification: 'Next Grade B cycle ~Apr–May 2027',
  },
  pfrda: {
    state: 'closed',
    url: 'https://www.pfrda.org.in/',
    linkLabel: 'PFRDA site',
    nextNotification: 'Apply closed · Phase II 20 Nov 2026 if shortlisted · next cycle after that',
  },
  sbi: {
    state: 'closed',
    url: 'https://sbi.bank.in/web/careers/current-openings',
    linkLabel: 'SBI careers',
    nextNotification: 'PO apply closed · next PO cycle usually mid-year',
  },
  ibpspo: {
    state: 'closed',
    url: 'https://www.ibps.in/',
    linkLabel: 'IBPS portal',
    nextNotification: 'Apply closed · await interview/next CRP cycle',
  },
  sbisco: {
    state: 'open',
    url: 'https://sbi.bank.in/web/careers/current-openings',
    linkLabel: 'Apply on SBI careers',
    closesOn: '2026-10-31',
    openNote: 'SCO windows open (incl. PDM Technology) — apply by 31 Oct 2026',
    nextNotification: 'Rolling SCO ads — watch SBI careers after this window',
  },
  rrb2it: {
    state: 'closed',
    url: 'https://www.ibps.in/',
    linkLabel: 'IBPS RRB',
    nextNotification: 'Exam ~20 Dec 2026 if applied · next RRB IT with next CRP',
  },
  irdai: {
    state: 'watch',
    url: 'https://irdai.gov.in/',
    linkLabel: 'IRDAI site',
    nextNotification: 'Irregular — watch after SEBI/RBI windows',
  },
  ifsca: {
    state: 'watch',
    url: 'https://www.ifsca.gov.in/',
    linkLabel: 'IFSCA site',
    nextNotification: 'When notified — watch ifsca.gov.in careers',
  },
  sidbi: {
    state: 'watch',
    url: 'https://www.sidbi.in/en/careers',
    linkLabel: 'SIDBI careers',
    nextNotification: 'Whenever each development-finance body notifies',
  },
  fcimgr: {
    state: 'watch',
    url: 'https://fci.gov.in/',
    linkLabel: 'FCI site',
    nextNotification: 'When fci.gov.in notifies Manager recruitment',
  },
  isrosc: {
    state: 'watch',
    url: 'https://www.isro.gov.in/Careers.html',
    linkLabel: 'ISRO careers',
    nextNotification: 'Watch next ICRB / Sci-Eng window',
  },
  drdosb: {
    state: 'watch',
    url: 'https://rac.gov.in/',
    linkLabel: 'RAC careers',
    nextNotification: 'Watch rac.gov.in for next Scientist B CS/IT',
  },
  rrbjeit: {
    state: 'watch',
    url: 'https://www.rrbcdg.gov.in/',
    linkLabel: 'RRB CDG',
    nextNotification: 'Watch RRB CEN for next JE IT window',
  },
  cris: {
    state: 'watch',
    url: 'https://www.cris.org.in/loadpage?page=indexcareer',
    linkLabel: 'CRIS careers',
    nextNotification: 'When CRIS / GATE ASE window opens',
  },
  nicscb: {
    state: 'closed',
    url: 'https://www.recruitment.nic.in/',
    linkLabel: 'NIC recruitment',
    nextNotification: 'Mar–Apr 2026 window closed · watch next Sci-B / GATE drive',
  },
  barcoces: {
    state: 'watch',
    url: 'https://www.barc.gov.in/',
    linkLabel: 'BARC site',
    nextNotification: 'Watch BARC / HBNI OCES cycle',
  },
  pwcsgate: {
    state: 'watch',
    url: 'https://www.powergrid.in/en/careers',
    linkLabel: 'POWERGRID careers',
    nextNotification: 'ET post-GATE window ~early 2027',
  },
  aaimanit: {
    state: 'watch',
    url: 'https://www.aai.aero/en/careers/recruitment',
    linkLabel: 'AAI careers',
    nextNotification: 'Watch Manager (IT) in next AAI drive',
  },
  defpsu: {
    state: 'watch',
    url: 'https://bel-india.in/careers/',
    linkLabel: 'BEL careers',
    nextNotification: 'Rolling — also check HAL / ECIL careers',
  },
  oilpsu: {
    state: 'watch',
    url: 'https://iocl.com/Careers',
    linkLabel: 'IOCL careers',
    nextNotification: 'Yearly GATE PSU windows — verify CS/IT posts',
  },
  ssccgl: {
    state: 'closed',
    url: 'https://ssc.gov.in/',
    linkLabel: 'SSC portal',
    nextNotification:
      '2026 apply closed · Tier-1 ~Sep–Oct 2026 if applied · next full cycle expected ~May–Jun 2027',
  },
  ssccgliti: {
    state: 'closed',
    url: 'https://ssc.gov.in/',
    linkLabel: 'SSC CGL (ITI via preference)',
    nextNotification: 'Same as SSC CGL — prefer Income Tax Inspector after Tier-2',
  },
  ssccglgst: {
    state: 'closed',
    url: 'https://ssc.gov.in/',
    linkLabel: 'SSC CGL (GST/Excise via preference)',
    nextNotification: 'Same as SSC CGL — prefer Inspector (Central Excise)',
  },
  ssccglaao: {
    state: 'closed',
    url: 'https://ssc.gov.in/',
    linkLabel: 'SSC CGL (AAO path)',
    nextNotification: 'Same as SSC CGL — sit Paper-III Finance & Economics for AAO',
  },
  ssccglaso: {
    state: 'closed',
    url: 'https://ssc.gov.in/',
    linkLabel: 'SSC CGL (ASO CSS/MEA)',
    nextNotification: 'Same as SSC CGL — prefer ASO CSS / MEA in post list',
  },
  statepcs: {
    state: 'watch',
    url: 'https://www.google.com/search?q=state+public+service+commission+notification',
    linkLabel: 'Search your State PSC',
    nextNotification: 'Watch your home-state PSC for Group-1 / SSE / Combined + Commercial Tax posts',
  },
}

const FALLBACK: ExamRegistration = {
  state: 'watch',
  url: 'https://www.google.com/search?q=official+notification',
  linkLabel: 'Search official site',
  nextNotification: 'Watch official careers for next notification',
}

/** Resolve registration for an exam; auto-closes open windows past closesOn. */
export function getExamRegistration(exam: Exam, now = new Date()): ExamRegistration {
  const raw = EXAM_REGISTRATION[exam.id] ?? {
    ...FALLBACK,
    nextNotification: exam.reg || FALLBACK.nextNotification,
  }

  if (raw.state === 'open' && raw.closesOn) {
    const end = new Date(`${raw.closesOn}T23:59:59`)
    if (!Number.isNaN(end.getTime()) && now.getTime() > end.getTime()) {
      return {
        ...raw,
        state: 'watch',
        openNote: undefined,
        linkLabel: raw.linkLabel.replace(/^Apply\s+/i, '').trim() || 'Official careers',
        nextNotification:
          raw.nextNotification ?? 'Apply window closed — watch for next notification',
      }
    }
  }

  return raw
}
