/** Lightweight SM-2-style scheduling for syllabus topic revision. */

export type RevisionCard = {
  topicId: string
  /** ISO date YYYY-MM-DD when next due */
  due: string
  /** Days until next review */
  interval: number
  ease: number
  reps: number
}

export function todayIso(d = new Date()): string {
  return d.toISOString().slice(0, 10)
}

export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + days)
  return todayIso(d)
}

/** First schedule after marking a topic complete. */
export function scheduleFirstReview(topicId: string, from = todayIso()): RevisionCard {
  return {
    topicId,
    due: addDaysIso(from, 1),
    interval: 1,
    ease: 2.5,
    reps: 0,
  }
}

/**
 * quality: 0 = forgot / hard, 1 = ok / good
 */
export function reviewCard(card: RevisionCard, quality: 0 | 1, from = todayIso()): RevisionCard {
  if (quality === 0) {
    return {
      ...card,
      interval: 1,
      ease: Math.max(1.3, card.ease - 0.2),
      due: addDaysIso(from, 1),
      reps: card.reps,
    }
  }
  const nextInterval =
    card.reps === 0 ? 1 : card.reps === 1 ? 3 : Math.max(1, Math.round(card.interval * card.ease))
  return {
    ...card,
    interval: nextInterval,
    ease: card.ease + 0.1,
    due: addDaysIso(from, nextInterval),
    reps: card.reps + 1,
  }
}

export function dueRevisions(
  cards: Record<string, RevisionCard>,
  onOrBefore = todayIso(),
): RevisionCard[] {
  return Object.values(cards)
    .filter((c) => c.due <= onOrBefore)
    .sort((a, b) => a.due.localeCompare(b.due) || a.interval - b.interval)
}
