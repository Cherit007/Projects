import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import { casualMatchService } from '@fixture-maker/api/casual/casualMatchService';
import { queryKeys } from '@fixture-maker/config/queryKeys';
import { getSport } from '@fixture-maker/domain/sports';
import { useAppSession } from '../context/AppSessionContext';
import { colors, dashboardStyles as styles } from '../styles/dashboardStyles';
import type { RootStackParamList } from '../navigation/types';

type CasualServiceWithGroup = {
  createCasualMatch: (matchData: Record<string, unknown>, groupId?: string | null) => Promise<unknown>;
};

const casualApi = casualMatchService as CasualServiceWithGroup;

export default function CasualMatchScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const queryClient = useQueryClient();
  const { activeGroup, sportId } = useAppSession();
  const sport = getSport(sportId);
  const isBoxCricket = sportId === 'boxCricket';

  const [matchType, setMatchType] = useState<'singles' | 'doubles'>('doubles');
  const [team1Name, setTeam1Name] = useState('');
  const [team1Player2, setTeam1Player2] = useState('');
  const [team2Name, setTeam2Name] = useState('');
  const [team2Player2, setTeam2Player2] = useState('');
  const [score1, setScore1] = useState('');
  const [score2, setScore2] = useState('');
  const [saving, setSaving] = useState(false);

  const buildTeam = (side: 'team1' | 'team2') => {
    if (isBoxCricket) {
      const name = side === 'team1' ? team1Name : team2Name;
      return { name: name.trim() };
    }
    if (matchType === 'singles') {
      const player = side === 'team1' ? team1Name : team2Name;
      return { player: player.trim() };
    }
    const p1 = side === 'team1' ? team1Name : team2Name;
    const p2 = side === 'team1' ? team1Player2 : team2Player2;
    return { player1: p1.trim(), player2: p2.trim() };
  };

  const canSave = () => {
    const s1 = Number(score1);
    const s2 = Number(score2);
    if (!Number.isFinite(s1) || !Number.isFinite(s2) || s1 === s2) return false;
    if (isBoxCricket) return Boolean(team1Name.trim() && team2Name.trim());
    if (matchType === 'singles') return Boolean(team1Name.trim() && team2Name.trim());
    return Boolean(team1Name.trim() && team1Player2.trim() && team2Name.trim() && team2Player2.trim());
  };

  const handleSave = async () => {
    if (!canSave() || !activeGroup?.id) {
      Alert.alert('Casual match', 'Fill in teams and valid scores.');
      return;
    }

    setSaving(true);
    try {
      const team1 = buildTeam('team1');
      const team2 = buildTeam('team2');
      await casualApi.createCasualMatch({
        type: 'casual',
        sportId,
        matchType: isBoxCricket ? 'squad' : matchType,
        date: new Date().toISOString(),
        team1,
        team2,
        score1: Number(score1),
        score2: Number(score2),
        completed: true,
      }, activeGroup.id);

      await queryClient.invalidateQueries({ queryKey: queryKeys.casualMatches(activeGroup.id) });
      Alert.alert('Saved', 'Casual match recorded.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save match';
      Alert.alert('Casual match', message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={{ color: colors.primary, fontWeight: '600', marginBottom: 8 }}>← Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Casual match</Text>
        <Text style={styles.headerSubtitle}>{sport?.name || sportId}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {!isBoxCricket && (
          <View style={styles.chipRow}>
            <Pressable
              style={[styles.chip, matchType === 'singles' && styles.chipActive]}
              onPress={() => setMatchType('singles')}
            >
              <Text style={[styles.chipText, matchType === 'singles' && styles.chipTextActive]}>Singles</Text>
            </Pressable>
            <Pressable
              style={[styles.chip, matchType === 'doubles' && styles.chipActive]}
              onPress={() => setMatchType('doubles')}
            >
              <Text style={[styles.chipText, matchType === 'doubles' && styles.chipTextActive]}>Doubles</Text>
            </Pressable>
          </View>
        )}

        <Text style={styles.label}>{isBoxCricket ? 'Team 1 name' : 'Team 1 player'}</Text>
        <TextInput style={styles.input} value={team1Name} onChangeText={setTeam1Name} placeholder="Name" />

        {!isBoxCricket && matchType === 'doubles' && (
          <>
            <Text style={styles.label}>Team 1 partner</Text>
            <TextInput style={styles.input} value={team1Player2} onChangeText={setTeam1Player2} placeholder="Partner" />
          </>
        )}

        <Text style={styles.label}>{isBoxCricket ? 'Team 2 name' : 'Team 2 player'}</Text>
        <TextInput style={styles.input} value={team2Name} onChangeText={setTeam2Name} placeholder="Name" />

        {!isBoxCricket && matchType === 'doubles' && (
          <>
            <Text style={styles.label}>Team 2 partner</Text>
            <TextInput style={styles.input} value={team2Player2} onChangeText={setTeam2Player2} placeholder="Partner" />
          </>
        )}

        <Text style={styles.label}>{isBoxCricket ? 'Runs' : 'Score'}</Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={score1}
            onChangeText={setScore1}
            keyboardType="number-pad"
            placeholder="Team 1"
          />
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={score2}
            onChangeText={setScore2}
            keyboardType="number-pad"
            placeholder="Team 2"
          />
        </View>

        <Pressable
          style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: canSave() ? 1 : 0.5 }]}
          disabled={!canSave() || saving}
          onPress={() => { void handleSave(); }}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={[styles.primaryBtnText, { color: '#fff' }]}>Save match</Text>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}
