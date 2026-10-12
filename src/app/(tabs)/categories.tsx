import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import {
  Button,
  Card,
  Chip,
  ErrorState,
  Field,
  Input,
  LoadingState,
  Segmented,
} from '@/components/ui';
import {
  createCategory,
  listCategories,
  renameCategory,
  setCategoryArchived,
} from '@/data/repositories/categories';
import type { Category, CategoryType } from '@/domain/types';
import { useFocusQuery } from '@/hooks/useFocusQuery';
import { colors } from '@/theme/colors';

const typeOptions = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
] as const;

const loadAllCategories = (db: SQLiteDatabase) =>
  listCategories(db, { includeArchived: true });

export default function CategoriesScreen() {
  const db = useSQLiteContext();
  const [type, setType] = useState<CategoryType>('expense');
  const [showArchived, setShowArchived] = useState(false);
  const { data, error, isLoading, reload } = useFocusQuery(loadAllCategories);
  const [newName, setNewName] = useState('');
  const [parentId, setParentId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  if (error) {
    return <ErrorState error={error} onRetry={reload} />;
  }
  if (!data && isLoading) {
    return <LoadingState />;
  }

  const all = (data ?? []).filter(c => c.type === type);
  const visible = all.filter(c => showArchived || !c.isArchived);
  const parents = visible.filter(c => c.parentId === null);
  const childrenOf = (id: string) => visible.filter(c => c.parentId === id);
  const activeParents = all.filter(c => c.parentId === null && !c.isArchived);

  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
      reload();
    } catch (err) {
      Alert.alert('Could not update category', String(err));
    }
  };

  const add = () => {
    const name = newName.trim();
    if (!name) {
      return;
    }
    run(async () => {
      await createCategory(db, { name, type, parentId });
      setNewName('');
      setParentId(null);
    });
  };

  const saveRename = (category: Category) => {
    const name = editName.trim();
    if (name && name !== category.name) {
      run(() => renameCategory(db, category.id, name));
    }
    setEditingId(null);
  };

  const renderRow = (category: Category, isChild: boolean) => {
    const editing = editingId === category.id;
    return (
      <View key={category.id} style={[styles.row, isChild && styles.childRow]}>
        {editing ? (
          <>
            <Input
              value={editName}
              onChangeText={setEditName}
              autoFocus
              onSubmitEditing={() => saveRename(category)}
              style={styles.editInput}
            />
            <Pressable onPress={() => saveRename(category)} hitSlop={8}>
              <Text style={styles.link}>Save</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Pressable
              style={styles.rowName}
              onPress={() => {
                setEditingId(category.id);
                setEditName(category.name);
              }}
            >
              <Text style={[styles.name, category.isArchived && styles.archived]}>
                {category.name}
              </Text>
            </Pressable>
            <Pressable
              hitSlop={8}
              onPress={() => run(() => setCategoryArchived(db, category.id, !category.isArchived))}
            >
              <Text style={styles.link}>{category.isArchived ? 'Restore' : 'Archive'}</Text>
            </Pressable>
          </>
        )}
      </View>
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Segmented
        options={typeOptions}
        value={type}
        onChange={value => {
          setType(value);
          setParentId(null);
        }}
      />

      <Card style={styles.addCard}>
        <Field label="New category">
          <Input value={newName} onChangeText={setNewName} placeholder="Name" onSubmitEditing={add} />
        </Field>
        <Text style={styles.hint}>Parent (optional)</Text>
        <View style={styles.chips}>
          <Chip label="None" selected={parentId === null} onPress={() => setParentId(null)} />
          {activeParents.map(p => (
            <Chip key={p.id} label={p.name} selected={parentId === p.id} onPress={() => setParentId(p.id)} />
          ))}
        </View>
        <Button title="Add category" onPress={add} disabled={!newName.trim()} />
      </Card>

      <View style={styles.archivedToggle}>
        <Text style={styles.hint}>Show archived</Text>
        <Switch value={showArchived} onValueChange={setShowArchived} />
      </View>
      <Text style={styles.hint}>Tap a name to rename it.</Text>

      <View style={styles.list}>
        {parents.map(parent => (
          <View key={parent.id}>
            {renderRow(parent, false)}
            {childrenOf(parent.id).map(child => renderRow(child, true))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  addCard: { gap: 10 },
  hint: { color: colors.textMuted, fontSize: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  archivedToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  list: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  childRow: { paddingLeft: 34 },
  rowName: { flex: 1 },
  name: { fontSize: 16, color: colors.text },
  archived: { color: colors.textMuted, textDecorationLine: 'line-through' },
  link: { color: colors.primary, fontWeight: '600' },
  editInput: { flex: 1, paddingVertical: 6 },
});
