import Ionicons from '@expo/vector-icons/Ionicons';
import type { SQLiteDatabase } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { TransactionRow } from '@/components/TransactionRow';
import { Chip, EmptyState, Input, LoadingState } from '@/components/ui';
import { listTags } from '@/data/repositories/tags';
import { listTransactions } from '@/data/repositories/transactions';
import { useFocusQuery } from '@/hooks/useFocusQuery';
import { colors, radius } from '@/theme/colors';

async function searchAll(db: SQLiteDatabase, query: string, tagName: string | null) {
  const q = query.trim();
  const tags = await listTags(db);
  if (!q && !tagName) {
    return { items: [], tags };
  }
  if (tagName) {
    const rows = await db.getAllAsync<{ id: string }>(
      `SELECT t.id FROM transactions t
       JOIN transaction_tags tt ON tt.transaction_id = t.id
       JOIN tags g ON g.id = tt.tag_id
       WHERE g.name = ? COLLATE NOCASE
       ORDER BY t.occurred_at DESC
       LIMIT 200`,
      tagName,
    );
    const all = await listTransactions(db, { limit: 500 });
    const ids = new Set(rows.map(r => r.id));
    let items = all.filter(t => ids.has(t.id));
    if (q) {
      const lower = q.toLowerCase();
      items = items.filter(t =>
        [t.counterparty, t.note, t.categoryName, t.accountName].some(f => f?.toLowerCase().includes(lower)),
      );
    }
    return { items, tags };
  }
  return { items: await listTransactions(db, { search: q, limit: 200 }), tags };
}

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const { data, isLoading, reload } = useFocusQuery(
    useCallback((db: SQLiteDatabase) => searchAll(db, query, tag), [query, tag]),
  );

  return (
    <View style={styles.container}>
      <View style={styles.search}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <Input
          value={query}
          onChangeText={setQuery}
          placeholder="Payee, note, category, account"
          clearButtonMode="while-editing"
          style={styles.input}
          autoFocus
        />
      </View>
      {data && data.tags.length > 0 && (
        <View style={styles.tagList}>
          {data.tags.map(t => (
            <Chip
              key={t.id}
              label={t.name}
              icon="pricetag"
              selected={tag === t.name}
              onPress={() => setTag(tag === t.name ? null : t.name)}
            />
          ))}
        </View>
      )}
      {!data && isLoading ? (
        <LoadingState />
      ) : (
        <FlatList
          data={data?.items ?? []}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => <TransactionRow item={item} showDate onDeleted={reload} />}
          ListEmptyComponent={
            <EmptyState
              icon="search"
              title={query || tag ? 'No matches' : 'Search everything'}
              body={
                query || tag
                  ? 'Try another word or tag.'
                  : 'Type a payee, note or category. Results cover every month.'
              }
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    marginBottom: 8,
    paddingLeft: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: { flex: 1, borderWidth: 0, backgroundColor: 'transparent' },
  tagList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  list: { paddingHorizontal: 16, paddingBottom: 48, gap: 2 },
});
