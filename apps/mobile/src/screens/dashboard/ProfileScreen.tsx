import React from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { areGroupsEnabled } from '@fixture-maker/config/groupFeatures';
import { useAppSession } from '../../context/AppSessionContext';
import { dashboardStyles as styles } from '../../styles/dashboardStyles';
import type { RootStackParamList } from '../../navigation/types';

type ProfileScreenProps = {
  onSignedOut: () => void;
};

export default function ProfileScreen({ onSignedOut }: ProfileScreenProps) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, activeGroup, sportId } = useAppSession();
  const groupsEnabled = areGroupsEnabled();

  const confirmSignOut = () => {
    Alert.alert('Sign out', 'Leave this device session?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: onSignedOut },
    ]);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <Text style={styles.headerSubtitle}>{user?.email || user?.name || 'Signed in'}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <View style={styles.listRow}>
            <Text style={styles.listIcon}>🏸</Text>
            <View style={styles.listCopy}>
              <Text style={styles.listTitle}>Current sport</Text>
              <Text style={styles.listSubtitle}>{sportId}</Text>
            </View>
          </View>
          <Pressable style={styles.listRow} onPress={() => navigation.navigate('SportHub')}>
            <Text style={styles.listIcon}>🔀</Text>
            <View style={styles.listCopy}>
              <Text style={styles.listTitle}>Change sport</Text>
              <Text style={styles.listSubtitle}>Open sport hub</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
          {!groupsEnabled ? (
            <View style={[styles.listRow, styles.listRowLast]}>
              <Text style={styles.listIcon}>👥</Text>
              <View style={styles.listCopy}>
                <Text style={styles.listTitle}>Workspace</Text>
                <Text style={styles.listSubtitle}>
                  {activeGroup?.name || 'Default group'} (groups UI disabled)
                </Text>
              </View>
            </View>
          ) : (
            <View style={[styles.listRow, styles.listRowLast]}>
              <Text style={styles.listIcon}>👥</Text>
              <View style={styles.listCopy}>
                <Text style={styles.listTitle}>Group</Text>
                <Text style={styles.listSubtitle}>{activeGroup?.name || 'None selected'}</Text>
              </View>
            </View>
          )}
        </View>

        <Pressable style={styles.secondaryBtn} onPress={confirmSignOut}>
          <Text style={[styles.secondaryBtnText, { color: '#dc2626' }]}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
