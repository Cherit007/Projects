import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

export type PointsTableRow = {
  id?: string | number;
  name?: string;
  emoji?: string;
  won?: number;
  lost?: number;
  played?: number;
  points?: number;
  netRunRate?: number;
};

type TableTabProps = {
  sportId: string;
  pointsTable: PointsTableRow[];
};

export default function TableTab({ sportId, pointsTable }: TableTabProps) {
  const showNrr = sportId === 'boxCricket';

  if (pointsTable.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No standings yet. Score matches to populate the table.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.cell, styles.rankCell]}>#</Text>
        <Text style={[styles.cell, styles.teamCell]}>Team</Text>
        <Text style={styles.cell}>W</Text>
        <Text style={styles.cell}>L</Text>
        <Text style={styles.cell}>MP</Text>
        <Text style={styles.cell}>Pts</Text>
        {showNrr ? <Text style={styles.cell}>NRR</Text> : null}
      </View>
      <FlatList
        data={pointsTable}
        keyExtractor={(item, index) => String(item.id ?? item.name ?? index)}
        renderItem={({ item, index }) => (
          <View style={[styles.row, index === 0 && styles.rowLeader]}>
            <Text style={[styles.cell, styles.rankCell]}>{index + 1}</Text>
            <View style={[styles.cell, styles.teamCell, styles.teamNameWrap]}>
              <Text style={styles.emoji}>{item.emoji || '🏸'}</Text>
              <Text style={styles.teamName} numberOfLines={1}>{item.name || 'Team'}</Text>
            </View>
            <Text style={styles.cell}>{Number(item.won || 0)}</Text>
            <Text style={styles.cell}>{Number(item.lost || 0)}</Text>
            <Text style={styles.cell}>{Number(item.played || 0)}</Text>
            <Text style={[styles.cell, styles.pointsCell]}>{Number(item.points || 0)}</Text>
            {showNrr ? (
              <Text style={styles.cell}>
                {Number.isFinite(Number(item.netRunRate))
                  ? Number(item.netRunRate).toFixed(3)
                  : '0.000'}
              </Text>
            ) : null}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  empty: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyText: {
    color: '#64748b',
    lineHeight: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#e2e8f0',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  rowLeader: {
    backgroundColor: '#ecfdf5',
  },
  cell: {
    width: 34,
    textAlign: 'center',
    color: '#334155',
    fontSize: 12,
    fontWeight: '600',
  },
  rankCell: {
    width: 24,
  },
  teamCell: {
    flex: 1,
    width: undefined,
    textAlign: 'left',
  },
  teamNameWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  emoji: {
    fontSize: 14,
  },
  teamName: {
    flex: 1,
    color: '#0f172a',
    fontWeight: '600',
    fontSize: 13,
  },
  pointsCell: {
    color: '#0f766e',
  },
});
