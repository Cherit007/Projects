import type { CardBill } from '@/domain/cards/billing';
import { formatMinor } from '@/domain/money/money';
import { colors } from '@/theme/colors';
import { formatShortLocalDate } from '@/utils/dates';

/** One line on what to do about a card's bill, and the colour to show it in. */
export function billSummary(bill: CardBill): { text: string; color: string } {
  const amount = formatMinor(bill.remainingMinor);
  switch (bill.status) {
    case 'overdue':
      return { text: `${amount} overdue since ${formatShortLocalDate(bill.dueDate)}`, color: colors.expense };
    case 'due':
      if (bill.daysToDue === 0) {
        return { text: `Pay ${amount} today`, color: colors.expense };
      }
      return {
        text:
          bill.daysToDue === 1
            ? `Pay ${amount} by tomorrow`
            : `Pay ${amount} by ${formatShortLocalDate(bill.dueDate)} · ${bill.daysToDue} days`,
        color: bill.daysToDue <= 3 ? colors.warning : colors.text,
      };
    case 'paid':
      return { text: `Statement paid · next on ${formatShortLocalDate(bill.nextStatementDate)}`, color: colors.income };
    default:
      return { text: `Next statement on ${formatShortLocalDate(bill.nextStatementDate)}`, color: colors.textMuted };
  }
}
