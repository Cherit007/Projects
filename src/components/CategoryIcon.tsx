import Ionicons from '@expo/vector-icons/Ionicons';
import { View } from 'react-native';

import type { TransactionType } from '@/domain/types';
import { categoryStyle } from '@/theme/categoryStyle';

export function CategoryIcon({
  name,
  type,
  size = 40,
}: {
  name: string | null | undefined;
  type?: TransactionType;
  size?: number;
}) {
  const { icon, color } = categoryStyle(name, type);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2.6,
        backgroundColor: `${color}1F`,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name={icon} size={size * 0.5} color={color} />
    </View>
  );
}
