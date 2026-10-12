import { Platform } from 'react-native';
import type { SQLiteDatabase } from 'expo-sqlite';

import UpiNotifications from '../../../modules/upi-notifications';
import { insertCandidate } from '../../data/repositories/upiCandidates';
import { parseUpiNotification, SUPPORTED_UPI_APPS } from '../../domain/upi/parser';

export const upiNative = Platform.OS === 'android' ? UpiNotifications : null;

/**
 * In development builds, notifications posted with
 * `adb shell cmd notification post` come from the shell package, which lets
 * the listener be tested on an emulator without real payment apps.
 */
export const DEV_TEST_PACKAGE = 'com.android.shell';

export function allowedApps(): Readonly<Record<string, string>> {
  return __DEV__ ? { ...SUPPORTED_UPI_APPS, [DEV_TEST_PACKAGE]: 'Test (adb)' } : SUPPORTED_UPI_APPS;
}

export function setDetectionEnabled(enabled: boolean): void {
  upiNative?.setConfig(enabled, Object.keys(allowedApps()));
}

/** Moves captured notifications into the review list. Returns how many were new. */
export async function syncUpiEvents(db: SQLiteDatabase): Promise<number> {
  if (!upiNative) {
    return 0;
  }
  const events = upiNative.getPendingEvents();
  if (events.length === 0) {
    return 0;
  }
  const apps = allowedApps();
  let added = 0;
  for (const event of events) {
    const parsed = parseUpiNotification(event, apps);
    if (parsed && (await insertCandidate(db, parsed))) {
      added += 1;
    }
  }
  upiNative.removeEvents(events.map(e => e.id));
  return added;
}
