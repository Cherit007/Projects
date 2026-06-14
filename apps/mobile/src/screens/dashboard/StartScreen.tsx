import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getSport } from '@fixture-maker/domain/sports';
import { useAppSession } from '../../context/AppSessionContext';
import { dashboardStyles as styles } from '../../styles/dashboardStyles';
import type { RootStackParamList } from '../../navigation/types';

export default function StartScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { sportId } = useAppSession();
  const sport = getSport(sportId);
  const isBoxCricket = sportId === 'boxCricket';

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Start</Text>
        <Text style={styles.headerSubtitle}>Choose how you want to play</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>Match type</Text>
          <Text style={styles.heroTitle}>{sport?.name || 'Sport'}</Text>
          <Text style={styles.heroCopy}>Track results and keep standings up to date</Text>
        </View>

        <View style={styles.section}>
          <Pressable style={styles.card} onPress={() => navigation.navigate('CasualMatch')}>
            <View style={styles.listRow}>
              <Text style={styles.listIcon}>🎯</Text>
              <View style={styles.listCopy}>
                <Text style={styles.listTitle}>Casual match</Text>
                <Text style={styles.listSubtitle}>
                  {isBoxCricket
                    ? 'Save innings totals and squad stats'
                    : 'Singles or doubles · updates ELO'}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </View>
          </Pressable>

          <Pressable style={styles.card} onPress={() => navigation.navigate('TournamentSetup')}>
            <View style={styles.listRow}>
              <Text style={styles.listIcon}>🏆</Text>
              <View style={styles.listCopy}>
                <Text style={styles.listTitle}>Tournament</Text>
                <Text style={styles.listSubtitle}>League fixtures, table, and knockout</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </View>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
