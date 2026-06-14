import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { authService } from '@fixture-maker/api/auth/authService';
import { groupCollectionsService } from '@fixture-maker/api/groups/groupCollectionsService';
import { useAppSession } from '../context/AppSessionContext';
import type { GroupSummary } from '../navigation/types';

type GroupAccessScreenProps = {
  onGroupSelected: () => void;
  onSignedOut: () => void;
};

export default function GroupAccessScreen({ onGroupSelected, onSignedOut }: GroupAccessScreenProps) {
  const { user, setUser, setGroups, setActiveGroup } = useAppSession();
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [groupName, setGroupName] = useState('');
  const [items, setItems] = useState<GroupSummary[]>([]);
  const hasLoadedRef = useRef(false);
  const onGroupSelectedRef = useRef(onGroupSelected);
  const onSignedOutRef = useRef(onSignedOut);

  useEffect(() => {
    onGroupSelectedRef.current = onGroupSelected;
    onSignedOutRef.current = onSignedOut;
  }, [onGroupSelected, onSignedOut]);

  const loadGroups = useCallback(async (force = false) => {
    if (hasLoadedRef.current && !force) return;
    setLoading(true);
    setError('');
    try {
      const currentUser = await authService.getCurrentUser();
      if (!currentUser) {
        onSignedOutRef.current();
        return;
      }
      setUser(currentUser);
      const memberships = await groupCollectionsService.getUserGroups(currentUser.$id);
      const mapped: GroupSummary[] = [];
      for (const group of memberships) {
        if (!group) continue;
        mapped.push({
          id: group.id,
          name: group.name,
          role: group.role,
        });
      }
      setItems(mapped);
      setGroups(mapped);
      hasLoadedRef.current = true;
      if (mapped.length === 1 && mapped[0].role !== 'viewer') {
        setActiveGroup(mapped[0]);
        onGroupSelectedRef.current();
      }
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Failed to load groups';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [setActiveGroup, setGroups, setUser]);

  useEffect(() => {
    void loadGroups();
  }, [loadGroups]);

  const handleSelectGroup = (group: GroupSummary) => {
    setActiveGroup(group);
    onGroupSelectedRef.current();
  };

  const handleCreateGroup = async () => {
    const trimmed = groupName.trim();
    if (!trimmed || !user) return;
    setActionLoading(true);
    setError('');
    try {
      const created = await groupCollectionsService.createGroup({
        name: trimmed,
        user,
      });
      const next: GroupSummary = {
        id: created.group.id,
        name: created.group.name,
        role: created.role,
      };
      setItems((prev) => [next, ...prev]);
      setGroups([next, ...items]);
      setGroupName('');
      setActiveGroup(next);
      onGroupSelected();
    } catch (createError) {
      const message = createError instanceof Error ? createError.message : 'Failed to create group';
      setError(message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleLogout = async () => {
    setActionLoading(true);
    try {
      await authService.logout();
    } catch {
      // Ignore network logout errors; clear local session regardless.
    } finally {
      setActionLoading(false);
      onSignedOut();
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0f766e" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Choose a group</Text>
      <Text style={styles.subtitle}>{user?.name || user?.email || 'Signed in'}</Text>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={styles.empty}>No groups yet. Create one below.</Text>}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => handleSelectGroup(item)}>
            <Text style={styles.cardTitle}>{item.name}</Text>
            <Text style={styles.cardMeta}>{item.role}</Text>
          </Pressable>
        )}
      />

      <TextInput
        style={styles.input}
        placeholder="New group name"
        value={groupName}
        onChangeText={setGroupName}
      />
      <Pressable
        style={[styles.button, actionLoading && styles.buttonDisabled]}
        onPress={handleCreateGroup}
        disabled={actionLoading}
      >
        <Text style={styles.buttonText}>Create group</Text>
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable onPress={handleLogout} disabled={actionLoading}>
        <Text style={styles.link}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f8fafc',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
  },
  subtitle: {
    color: '#64748b',
    marginBottom: 16,
  },
  empty: {
    color: '#64748b',
    marginVertical: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  cardMeta: {
    marginTop: 4,
    color: '#64748b',
    textTransform: 'capitalize',
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 12,
    backgroundColor: '#fff',
  },
  button: {
    backgroundColor: '#0f766e',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  link: {
    marginTop: 16,
    textAlign: 'center',
    color: '#0f766e',
  },
  error: {
    color: '#b91c1c',
    marginTop: 8,
  },
});
