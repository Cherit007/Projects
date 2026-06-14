import React from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTournament } from '../context/TournamentContext';
import type { RootStackParamList } from '../navigation/types';
import type { TeamDraft } from '../types/tournament';

export default function TeamEntryScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {
    teams,
    setTeams,
    generateAndStart,
    loading,
    tournamentName,
    gameMode,
  } = useTournament();

  const updateTeam = (index: number, patch: Partial<TeamDraft>) => {
    setTeams((prev) => prev.map((team, teamIndex) => (
      teamIndex === index ? { ...team, ...patch } : team
    )));
  };

  const handleStart = async () => {
    const result = await generateAndStart();
    if (!result.ok) {
      Alert.alert('Teams', result.message || 'Could not start tournament.');
      return;
    }
    Alert.alert('Tournament started', `"${tournamentName}" is ready to play.`);
    navigation.navigate('Tournament');
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Teams</Text>
      <Text style={styles.meta}>{teams.length} teams · {gameMode}</Text>

      {teams.map((team, index) => (
        <View key={team.id} style={styles.card}>
          <Text style={styles.cardTitle}>Team {index + 1}</Text>
          <TextInput
            style={styles.input}
            placeholder="Team name"
            value={team.name}
            onChangeText={(value) => updateTeam(index, { name: value })}
          />
          <TextInput
            style={styles.input}
            placeholder={gameMode === 'singles' ? 'Player' : 'Player 1'}
            value={team.player1 || team.player || ''}
            onChangeText={(value) => updateTeam(index, {
              player1: value,
              player: value,
            })}
          />
          {gameMode !== 'singles' ? (
            <TextInput
              style={styles.input}
              placeholder="Player 2"
              value={team.player2}
              onChangeText={(value) => updateTeam(index, { player2: value })}
            />
          ) : null}
        </View>
      ))}

      <Pressable
        style={[styles.button, loading && styles.buttonDisabled]}
        disabled={loading || teams.length === 0}
        onPress={handleStart}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Starting…' : 'Generate fixtures & start'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#f8fafc',
    flexGrow: 1,
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
  },
  meta: {
    marginTop: 4,
    marginBottom: 16,
    color: '#64748b',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardTitle: {
    fontWeight: '600',
    marginBottom: 8,
    color: '#334155',
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  button: {
    backgroundColor: '#0f766e',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});
