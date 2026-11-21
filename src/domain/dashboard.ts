/** Dashboard sections the user can hide and reorder. The balance summary at the top is always shown. */
export const DASHBOARD_SECTIONS = [
  { id: 'review', label: 'Payments to review' },
  { id: 'balances', label: 'Account balances' },
  { id: 'safe', label: 'Safe to spend' },
  { id: 'cards', label: 'Credit card bills' },
  { id: 'bills', label: 'Upcoming bills' },
  { id: 'shortcuts', label: 'Reports and statement import' },
  { id: 'budgets', label: 'Budgets' },
  { id: 'spending', label: 'Spending by category' },
  { id: 'recent', label: 'Recent transactions' },
] as const;

export type DashboardSectionId = (typeof DASHBOARD_SECTIONS)[number]['id'];

export interface DashboardSection {
  id: DashboardSectionId;
  visible: boolean;
}

const KNOWN = new Set<string>(DASHBOARD_SECTIONS.map(s => s.id));

export function sectionLabel(id: DashboardSectionId): string {
  return DASHBOARD_SECTIONS.find(s => s.id === id)!.label;
}

export function defaultDashboardLayout(): DashboardSection[] {
  return DASHBOARD_SECTIONS.map(s => ({ id: s.id, visible: true }));
}

/**
 * Reads a saved layout. Unknown or repeated sections are dropped, and
 * sections added in later versions appear (visible) at their default place.
 */
export function parseDashboardLayout(json: string | null): DashboardSection[] {
  let saved: unknown;
  try {
    saved = json ? JSON.parse(json) : null;
  } catch {
    saved = null;
  }
  if (!Array.isArray(saved)) {
    return defaultDashboardLayout();
  }
  const layout: DashboardSection[] = [];
  const seen = new Set<string>();
  for (const item of saved) {
    const id = (item as { id?: unknown })?.id;
    if (typeof id !== 'string' || !KNOWN.has(id) || seen.has(id)) {
      continue;
    }
    seen.add(id);
    layout.push({ id: id as DashboardSectionId, visible: (item as { visible?: unknown }).visible !== false });
  }
  DASHBOARD_SECTIONS.forEach((section, index) => {
    if (!seen.has(section.id)) {
      layout.splice(Math.min(index, layout.length), 0, { id: section.id, visible: true });
    }
  });
  return layout;
}

/** Moves a section up (-1) or down (+1); out-of-range moves change nothing. */
export function moveSection(layout: readonly DashboardSection[], id: DashboardSectionId, delta: -1 | 1): DashboardSection[] {
  const from = layout.findIndex(s => s.id === id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= layout.length) {
    return [...layout];
  }
  const next = [...layout];
  [next[from], next[to]] = [next[to]!, next[from]!];
  return next;
}

export function setSectionVisible(
  layout: readonly DashboardSection[],
  id: DashboardSectionId,
  visible: boolean,
): DashboardSection[] {
  return layout.map(s => (s.id === id ? { ...s, visible } : s));
}
