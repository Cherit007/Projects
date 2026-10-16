import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { haptic } from '@/components/PressableScale';
import { Button, Card, Chip, EmptyState, Input, LoadingState, SectionTitle } from '@/components/ui';
import { listCategories } from '@/data/repositories/categories';
import {
  deleteMerchantRule,
  listMerchantRules,
  upsertMerchantRule,
} from '@/data/repositories/merchantRules';
import { useFocusQuery } from '@/hooks/useFocusQuery';
import { colors } from '@/theme/colors';

export default function MerchantRulesScreen() {
  const db = useSQLiteContext();
  const { data, isLoading, reload } = useFocusQuery(
    useCallback(async database => {
      const [rules, categories] = await Promise.all([
        listMerchantRules(database),
        listCategories(database),
      ]);
      return {
        rules,
        categories: categories.filter(c => c.type === 'expense' && !c.isArchived),
      };
    }, []),
  );
  const [matchText, setMatchText] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!data && isLoading) {
    return <LoadingState />;
  }
  if (!data) {
    return null;
  }

  const save = async () => {
    if (!categoryId) {
      Alert.alert('Pick a category', 'Choose which category this merchant should use.');
      return;
    }
    setSaving(true);
    try {
      await upsertMerchantRule(db, matchText, categoryId);
      haptic('success');
      setMatchText('');
      await reload();
    } catch (err) {
      Alert.alert('Could not save rule', err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Card style={styles.card}>
        <Text style={styles.help}>
          When a payee contains this text, new payments use that category first — before learned guesses.
        </Text>
        <Input value={matchText} onChangeText={setMatchText} placeholder="e.g. Swiggy" autoCapitalize="words" />
        <View style={styles.chips}>
          {data.categories.map(c => (
            <Chip
              key={c.id}
              label={c.name}
              selected={categoryId === c.id}
              onPress={() => setCategoryId(c.id)}
            />
          ))}
        </View>
        <Button title={saving ? 'Saving…' : 'Add rule'} icon="add" onPress={save} disabled={saving} />
      </Card>

      <SectionTitle title={`${data.rules.length} rule${data.rules.length === 1 ? '' : 's'}`} />
      {data.rules.length === 0 ? (
        <EmptyState icon="storefront-outline" title="No merchant rules yet" body="Add one for shops you always categorise the same way." />
      ) : (
        data.rules.map(rule => {
          const category = data.categories.find(c => c.id === rule.categoryId);
          return (
            <Card key={rule.id} style={styles.row}>
              <View style={styles.flex}>
                <Text style={styles.title}>{rule.matchText}</Text>
                <Text style={styles.muted}>→ {category?.name ?? 'Unknown category'}</Text>
              </View>
              <Button
                title="Remove"
                variant="secondary"
                onPress={() =>
                  Alert.alert('Remove rule?', rule.matchText, [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Remove',
                      style: 'destructive',
                      onPress: async () => {
                        await deleteMerchantRule(db, rule.id);
                        await reload();
                      },
                    },
                  ])
                }
              />
            </Card>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12, paddingBottom: 48 },
  card: { gap: 12 },
  help: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1, gap: 2 },
  title: { fontSize: 16, fontWeight: '600', color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
});
