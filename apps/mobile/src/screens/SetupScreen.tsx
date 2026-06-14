import React, { useMemo } from 'react';
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
import { getSport, listSports } from '@fixture-maker/domain/sports';
import { useAppSession } from '../context/AppSessionContext';
import { useTournament } from '../context/TournamentContext';
import type { RootStackParamList } from '../navigation/types';

export default function SetupScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { activeGroup, sportId, setSportId } = useAppSession();
  const {
    tournamentName,
    setTournamentName,
    numTeams,
    setNumTeams,
    gameMode,
    setGameMode,
    tournamentFormat,
    setTournamentFormat,
    format,
    setFormat,
    prepareTeamEntry,
    activeTournament,
    statusMessage,
    loading,
  } = useTournament();

  const sport = useMemo(() => getSport(sportId), [sportId]);
  const sports = listSports();
  const activeFixtures = Array.isArray(activeTournament?.fixtures) ? activeTournament.fixtures : [];
  const completedFixtureCount = activeFixtures.filter((match) => match?.completed).length;

  const handleContinue = () => {
    const result = prepareTeamEntry();
    if (!result.ok) {
      Alert.alert('Setup', result.message || 'Could not continue.');
      return;
    }
    navigation.navigate('Teams');
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable onPress={() => navigation.goBack()} style={{ marginBottom: 8 }}>
        <Text style={{ color: '#0f766e', fontWeight: '600' }}>← Back</Text>
      </Pressable>
      <Text style={styles.heading}>New tournament</Text>
      {!activeGroup?.name ? null : (
        <Text style={styles.meta}>Group: {activeGroup.name}</Text>
      )}

      {activeTournament?.status === 'active' ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            Active: {activeTournament.name} ({completedFixtureCount}/{activeFixtures.length} scored)
          </Text>
          <Pressable onPress={() => navigation.navigate('Tournament')}>
            <Text style={styles.bannerLink}>Open tournament →</Text>
          </Pressable>
        </View>
      ) : null}

      <Text style={styles.label}>Sport</Text>
      <View style={styles.chips}>
        {sports.filter((item) => item.available).map((item) => {
          const selected = item.id === sportId;
          return (
            <Pressable
              key={item.id}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => setSportId(item.id)}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {item.icon} {item.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>Tournament name</Text>
      <TextInput
        style={styles.input}
        placeholder="Friday League"
        value={tournamentName}
        onChangeText={setTournamentName}
      />

      <Text style={styles.label}>Format</Text>
      <View style={styles.chips}>
        {(sport.formats || []).map((item: { value: string; label: string }) => {
          const selected = item.value === tournamentFormat;
          return (
            <Pressable
              key={item.value}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => setTournamentFormat(item.value)}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {tournamentFormat === 'league' ? (
        <>
          <Text style={styles.label}>Teams</Text>
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            value={String(numTeams)}
            onChangeText={(value) => {
              const parsed = Number.parseInt(value, 10);
              if (!Number.isNaN(parsed)) setNumTeams(parsed);
            }}
          />
        </>
      ) : null}

      <Text style={styles.label}>Game mode</Text>
      <View style={styles.chips}>
        {(sport.gameModes || []).map((item: { value: string; label: string }) => {
          const selected = item.value === gameMode;
          return (
            <Pressable
              key={item.value}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => setGameMode(item.value)}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>Matches per pair</Text>
      <View style={styles.chips}>
        {(sport.matchesPerPair || []).map((item: { value: string; label: string }) => {
          const selected = item.value === format;
          return (
            <Pressable
              key={item.value}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => setFormat(item.value)}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {statusMessage ? <Text style={styles.status}>{statusMessage}</Text> : null}

      <Pressable
        style={[styles.button, loading && styles.buttonDisabled]}
        disabled={loading}
        onPress={handleContinue}
      >
        <Text style={styles.buttonText}>Continue to teams</Text>
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
  banner: {
    backgroundColor: '#ecfdf5',
    borderColor: '#99f6e4',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  bannerText: {
    color: '#115e59',
    fontWeight: '600',
  },
  bannerLink: {
    marginTop: 6,
    color: '#0f766e',
    fontWeight: '600',
  },
  label: {
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 8,
    color: '#334155',
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  chipSelected: {
    backgroundColor: '#0f766e',
    borderColor: '#0f766e',
  },
  chipText: {
    color: '#0f172a',
  },
  chipTextSelected: {
    color: '#fff',
  },
  status: {
    marginTop: 12,
    color: '#0f766e',
  },
  button: {
    backgroundColor: '#0f766e',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
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
