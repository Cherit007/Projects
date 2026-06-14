import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { FixtureMatch } from '../types/tournament';

type ScoreMatchModalProps = {
  visible: boolean;
  match: FixtureMatch | null;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (score1: string, score2: string) => void;
};

export default function ScoreMatchModal({
  visible,
  match,
  loading = false,
  onClose,
  onSubmit,
}: ScoreMatchModalProps) {
  const [score1, setScore1] = useState('');
  const [score2, setScore2] = useState('');

  useEffect(() => {
    if (!match) return;
    setScore1(match.score1 != null ? String(match.score1) : '');
    setScore2(match.score2 != null ? String(match.score2) : '');
  }, [match]);

  if (!match) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Score match</Text>
          <Text style={styles.subtitle}>
            {match.team1?.name || 'Team 1'} vs {match.team2?.name || 'Team 2'}
          </Text>

          <View style={styles.scoreRow}>
            <View style={styles.scoreField}>
              <Text style={styles.label}>{match.team1?.name || 'Team 1'}</Text>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                value={score1}
                onChangeText={setScore1}
              />
            </View>
            <Text style={styles.vs}>–</Text>
            <View style={styles.scoreField}>
              <Text style={styles.label}>{match.team2?.name || 'Team 2'}</Text>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                value={score2}
                onChangeText={setScore2}
              />
            </View>
          </View>

          <Pressable
            style={[styles.button, loading && styles.buttonDisabled]}
            disabled={loading}
            onPress={() => onSubmit(score1, score2)}
          >
            <Text style={styles.buttonText}>{loading ? 'Saving…' : 'Save score'}</Text>
          </Pressable>
          <Pressable onPress={onClose}>
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  subtitle: {
    marginTop: 4,
    marginBottom: 16,
    color: '#64748b',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  scoreField: {
    flex: 1,
  },
  label: {
    marginBottom: 6,
    color: '#334155',
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 18,
    textAlign: 'center',
  },
  vs: {
    fontSize: 20,
    color: '#64748b',
    marginTop: 20,
  },
  button: {
    backgroundColor: '#0f766e',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  cancel: {
    marginTop: 14,
    textAlign: 'center',
    color: '#64748b',
  },
});
