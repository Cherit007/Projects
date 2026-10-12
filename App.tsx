import { StatusBar } from 'expo-status-bar';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { formatMinor } from './src/domain/money/money';

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Finance Tracker</Text>
      <Text style={styles.amount}>{formatMinor(123450)}</Text>
      <Text style={styles.caption}>Running on {Platform.OS}</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
  },
  amount: {
    fontSize: 32,
  },
  caption: {
    color: '#666',
  },
});
