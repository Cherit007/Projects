export type Tier = 'Core' | 'Extra' | 'Tech' | 'PSU'

export type TopicArea =
  | 'quant'
  | 'reasoning'
  | 'english'
  | 'ga'
  | 'banking'
  | 'esi'
  | 'fm'
  | 'ard'
  | 'computer'
  | 'gate-cs'
  | 'desc-eng'
  | 'interview'

export interface Topic {
  id: string
  area: TopicArea
  title: string
  /** Coaching-style subtopics for fine-grained ticking */
  subtopics: string[]
  /** Short note on where this appears / why it matters */
  note?: string
}

export interface SyllabusSection {
  area: TopicArea
  label: string
  topicIds: string[]
  weightNote?: string
}

export interface ExamRound {
  name: string
  what: string
}

export interface Exam {
  id: string
  name: string
  shortName: string
  tier: Tier
  difficulty: string
  competitiveness: string
  vacancies: string
  obcSeats: string
  obcAge: string
  obcCutoff: string
  reg: string
  exam: string
  status: string
  cycle: string
  applied: string
  offered: string
  appsNote: string
  compensation: string
  perks: string
  location: string
  qual: string
  fit: string
  rounds: ExamRound[]
  /** Official / coaching-aligned syllabus sections */
  syllabus: SyllabusSection[]
  /** Coaching platforms that cover this exam well */
  coachingRefs: string[]
  priority: number
  /** Discovery tags e.g. it-officer, bank, regulator, gate */
  tags?: string[]
}
