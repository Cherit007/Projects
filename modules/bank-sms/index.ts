import { NativeModule, requireOptionalNativeModule } from 'expo';

export interface QueuedBankSms {
  id: string;
  text: string;
  /** Epoch milliseconds. */
  receivedAt: number;
}

/** An expense started from Siri, the Action button or a Control Center shortcut. */
export interface QuickAdd {
  amount: number;
  paidTo?: string;
  /** Epoch milliseconds. */
  at: number;
}

declare class BankSmsModule extends NativeModule<Record<never, never>> {
  getPending(): QueuedBankSms[];
  remove(ids: string[]): void;
  lastCapturedAt(): number | null;
  requestNotificationPermission(): Promise<boolean>;
  /** Returns the pending quick add once, then clears it. Missing in builds before it was added. */
  takeQuickAdd?(): QuickAdd | null;
}

/**
 * The queue filled by the "Capture bank SMS" Shortcuts action. Null on
 * Android, web and in Expo Go, where the capture link is used instead.
 */
export default requireOptionalNativeModule<BankSmsModule>('BankSms');
