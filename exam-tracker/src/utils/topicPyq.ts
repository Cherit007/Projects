import { examsSharingTopic } from '../data/exams'
import { papersForExam } from '../data/pyqs'
import type { Topic, TopicArea } from '../data/types'

export type TopicPyqLink = {
  label: string
  url: string
  source: string
}

/** Area → free practice / PYQ hub when exam-specific papers are thin. */
const AREA_PYQ_HUBS: Partial<Record<TopicArea, TopicPyqLink>> = {
  quant: {
    label: 'Quant PYQ drills',
    url: 'https://testbook.com/ssc-cgl/previous-year-papers',
    source: 'Testbook',
  },
  reasoning: {
    label: 'Reasoning PYQ drills',
    url: 'https://www.adda247.com/jobs/ssc-cgl-previous-year-question-paper/',
    source: 'Adda247',
  },
  english: {
    label: 'English PYQ practice',
    url: 'https://testbook.com/ssc-cgl/previous-year-papers',
    source: 'Testbook',
  },
  ga: {
    label: 'GA / static PYQ',
    url: 'https://www.adda247.com/jobs/ssc-cgl-previous-year-question-paper/',
    source: 'Adda247',
  },
  banking: {
    label: 'Banking awareness PYQ',
    url: 'https://prepp.in/ibps-po-exam/practice-papers',
    source: 'Prepp',
  },
  esi: {
    label: 'ESI / eco PYQ hubs',
    url: 'https://prepp.in/rbi-grade-b-exam/practice-papers',
    source: 'Prepp',
  },
  fm: {
    label: 'Finance / markets papers',
    url: 'https://prepp.in/sebi-grade-a-exam/practice-papers',
    source: 'Prepp',
  },
  ard: {
    label: 'ARD / rural PYQ',
    url: 'https://prepp.in/nabard-grade-a-exam/practice-papers',
    source: 'Prepp',
  },
  computer: {
    label: 'IT / computer PYQ',
    url: 'https://prepp.in/ibps-so-exam/practice-papers',
    source: 'Prepp',
  },
  'gate-cs': {
    label: 'GATE CS PYQ',
    url: 'https://gateoverflow.in/',
    source: 'GATE Overflow',
  },
}

/** Up to 2 PYQ links for a topic card (exam paper + area hub). */
export function pyqLinksForTopic(topic: Topic): TopicPyqLink[] {
  const links: TopicPyqLink[] = []
  const seen = new Set<string>()

  const shared = examsSharingTopic(topic.id)
  for (const exam of shared.slice(0, 4)) {
    const papers = papersForExam(exam.id)
    const pick = papers.find((p) => p.kind === 'page') ?? papers[0]
    if (!pick || seen.has(pick.url)) continue
    seen.add(pick.url)
    links.push({
      label: `${exam.shortName} papers`,
      url: pick.url,
      source: pick.source,
    })
    if (links.length >= 1) break
  }

  const hub = AREA_PYQ_HUBS[topic.area]
  if (hub && !seen.has(hub.url)) {
    links.push(hub)
  }

  return links.slice(0, 2)
}
