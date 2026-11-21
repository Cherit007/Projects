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

import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { CategoryIcon } from '@/components/CategoryIcon';
import { haptic, PressableScale } from '@/components/PressableScale';
import {
  Button,
  Card,
  Chip,
  ErrorState,
  Field,
  Input,
  LoadingState,
  Segmented,
  typeColor,
} from '@/components/ui';
import {
  createCategory,
  listCategories,
  moveCategory,
  renameCategory,
  setCategoryArchived,
} from '@/data/repositories/categories';
import type { Category, CategoryType } from '@/domain/types';
import { useFocusQuery } from '@/hooks/useFocusQuery';
import { categoryStyle } from '@/theme/categoryStyle';
import { colors, radius, shadow, themedStyles } from '@/theme/colors';

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
  const [reordering, setReordering] = useState(false);

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

  const renderRow = (category: Category, parentName: string | null, first: boolean, last: boolean) => {
    const editing = editingId === category.id;
    return (
      <View key={category.id} style={[styles.row, parentName !== null && styles.childRow]}>
        <CategoryIcon name={parentName ?? category.name} type={type} size={parentName ? 30 : 36} />
        {editing ? (
          <>
            <Input
              value={editName}
              onChangeText={setEditName}
              autoFocus
              onSubmitEditing={() => saveRename(category)}
              style={styles.editInput}
            />
            <PressableScale accessibilityLabel="Save name" hitSlop={8} onPress={() => saveRename(category)}>
              <Ionicons name="checkmark-circle" size={26} color={colors.primary} />
            </PressableScale>
          </>
        ) : (
          <>
            <Pressable
              style={styles.rowName}
              onPress={() => {
                haptic('selection');
                setEditingId(category.id);
                setEditName(category.name);
              }}
            >
              <Text style={[styles.name, category.isArchived && styles.archived]}>{category.name}</Text>
            </Pressable>
            {reordering ? (
              <>
                <PressableScale
                  accessibilityLabel="Move up"
                  hitSlop={6}
                  hapticKind="selection"
                  disabled={first}
                  onPress={() => run(() => moveCategory(db, category.id, -1))}
                  style={first && styles.disabled}
                >
                  <Ionicons name="chevron-up-circle-outline" size={24} color={colors.primary} />
                </PressableScale>
                <PressableScale
                  accessibilityLabel="Move down"
                  hitSlop={6}
                  hapticKind="selection"
                  disabled={last}
                  onPress={() => run(() => moveCategory(db, category.id, 1))}
                  style={last && styles.disabled}
                >
                  <Ionicons name="chevron-down-circle-outline" size={24} color={colors.primary} />
                </PressableScale>
              </>
            ) : (
              <PressableScale
                accessibilityLabel={category.isArchived ? 'Restore category' : 'Archive category'}
                hitSlop={8}
                hapticKind="light"
                onPress={() => run(() => setCategoryArchived(db, category.id, !category.isArchived))}
              >
                <Ionicons
                  name={category.isArchived ? 'arrow-undo-outline' : 'archive-outline'}
                  size={20}
                  color={colors.textMuted}
                />
              </PressableScale>
            )}
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
        tint={value => typeColor[value]}
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
          {activeParents.map(p => {
            const style = categoryStyle(p.name, type);
            return (
              <Chip
                key={p.id}
                label={p.name}
                icon={style.icon}
                color={style.color}
                selected={parentId === p.id}
                onPress={() => setParentId(p.id)}
              />
            );
          })}
        </View>
        <Button title="Add category" icon="add" onPress={add} disabled={!newName.trim()} hapticKind="success" />
      </Card>

      <View style={styles.archivedToggle}>
        <Chip
          label={reordering ? 'Done' : 'Reorder'}
          icon={reordering ? 'checkmark' : 'swap-vertical'}
          selected={reordering}
          onPress={() => setReordering(r => !r)}
        />
        <View style={styles.switchRow}>
          <Text style={styles.hint}>Show archived</Text>
          <Switch
            value={showArchived}
            onValueChange={setShowArchived}
            trackColor={{ true: colors.primary, false: colors.border }}
            thumbColor="#fff"
          />
        </View>
      </View>
      <Text style={styles.hint}>
        {reordering ? 'Move categories up or down; pickers follow this order.' : 'Tap a name to rename it.'}
      </Text>

      <View style={styles.list}>
        {parents.map((parent, index) => {
          const kids = childrenOf(parent.id);
          return (
            <Animated.View key={parent.id} entering={FadeInDown.delay(Math.min(index, 10) * 30).duration(250)}>
              {renderRow(parent, null, index === 0, index === parents.length - 1)}
              {kids.map((child, i) => renderRow(child, parent.name, i === 0, i === kids.length - 1))}
            </Animated.View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  content: { padding: 16, gap: 14, paddingBottom: 48 },
  addCard: { gap: 10 },
  hint: { color: colors.textMuted, fontSize: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  archivedToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  list: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadow,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  childRow: { paddingLeft: 38 },
  rowName: { flex: 1, paddingVertical: 4 },
  name: { fontSize: 16, color: colors.text, fontWeight: '500' },
  archived: { color: colors.textMuted, textDecorationLine: 'line-through' },
  editInput: { flex: 1, paddingVertical: 6 },
  disabled: { opacity: 0.3 },
}));
