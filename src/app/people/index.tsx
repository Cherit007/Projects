import type { SQLiteDatabase } from 'expo-sqlite';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { PersonRow } from '@/components/PersonRow';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { listPeople } from '@/data/repositories/people';
import { useFocusQuery } from '@/hooks/useFocusQuery';
import { useUpi } from '@/services/upi/UpiProvider';
import { colors, radius, shadow, themedStyles } from '@/theme/colors';

const load = (db: SQLiteDatabase) => listPeople(db);

export default function PeopleScreen() {
  const { lastSyncAt } = useUpi();
  const { data, error, isLoading, reload } = useFocusQuery(load, lastSyncAt);

  if (error) {
    return <ErrorState error={error} onRetry={reload} />;
  }
  if (!data && isLoading) {
    return <LoadingState />;
  }
  if (!data || data.length === 0) {
    return (
      <EmptyState
        icon="people"
        title="No one here yet"
        body="Money you send to or receive from people appears here, grouped by person. Payments are added under Friends automatically, or pick Friends or Family as the category yourself."
      />
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.intro}>
        Everyone you have sent money to or received money from. The amount on the right is the difference: green
        means they paid you more, red means you paid them more.
      </Text>
      <View style={styles.list}>
        {data.map(person => (
          <PersonRow key={person.name.toLowerCase()} person={person} />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  content: { padding: 16, gap: 12 },
  intro: { color: colors.textMuted, lineHeight: 20 },
  list: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surface, ...shadow },
}));
