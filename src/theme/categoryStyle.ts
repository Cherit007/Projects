import type Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

import type { TransactionType } from '@/domain/types';

import { colors } from './colors';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export interface CategoryStyle {
  icon: IconName;
  color: string;
}

const RULES: readonly [RegExp, CategoryStyle][] = [
  [/personal care|salon|beauty|groom/i, { icon: 'cut', color: '#DB2777' }],
  [/fitness|gym|sport/i, { icon: 'barbell', color: '#EA580C' }],
  [/insur/i, { icon: 'shield-checkmark', color: '#0284C7' }],
  [/donat|charit|temple/i, { icon: 'heart', color: '#E11D48' }],
  [/food|dining|restaurant|cafe|swiggy|zomato/i, { icon: 'restaurant', color: '#F97316' }],
  [/grocer/i, { icon: 'cart', color: '#16A34A' }],
  [/rent|housing|home/i, { icon: 'home', color: '#8B5CF6' }],
  [/utilit|bill|electric|water|internet|phone/i, { icon: 'flash', color: '#EAB308' }],
  [/transport|fuel|uber|ola|cab|metro|travel/i, { icon: 'car', color: '#0EA5E9' }],
  [/shop/i, { icon: 'bag-handle', color: '#EC4899' }],
  [/health|medic|pharma|doctor/i, { icon: 'medkit', color: '#EF4444' }],
  [/entertain|movie|music|game/i, { icon: 'film', color: '#A855F7' }],
  [/educat|course|school|book/i, { icon: 'school', color: '#2563EB' }],
  [/trip|flight|hotel|vacation/i, { icon: 'airplane', color: '#06B6D4' }],
  [/friend/i, { icon: 'people-circle', color: '#0EA5E9' }],
  [/family|kids|gift/i, { icon: 'people', color: '#F43F5E' }],
  [/loan|interest|fee|emi/i, { icon: 'card', color: '#64748B' }],
  [/salary|payroll/i, { icon: 'briefcase', color: '#0E9F6E' }],
  [/freelance/i, { icon: 'laptop', color: '#14B8A6' }],
  [/business/i, { icon: 'storefront', color: '#0891B2' }],
  [/rental/i, { icon: 'key', color: '#7C3AED' }],
  [/dividend|invest/i, { icon: 'trending-up', color: '#059669' }],
];

const FALLBACK_COLORS = ['#6366F1', '#F59E0B', '#10B981', '#EF4444', '#3B82F6', '#D946EF', '#14B8A6'];

/** Picks an icon and colour from the category name so user-created categories look consistent. */
export function categoryStyle(name: string | null | undefined, type?: TransactionType): CategoryStyle {
  if (type === 'transfer') {
    return { icon: 'swap-horizontal', color: colors.transfer };
  }
  if (!name) {
    return { icon: 'help-circle', color: colors.textMuted };
  }
  const match = RULES.find(([pattern]) => pattern.test(name));
  if (match) {
    return match[1];
  }
  let hash = 0;
  for (const char of name) {
    hash = (hash * 31 + char.charCodeAt(0)) | 0;
  }
  return {
    icon: type === 'income' ? 'cash' : 'pricetag',
    color: FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length],
  };
}
