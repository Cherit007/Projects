import { NativeModule, requireOptionalNativeModule } from 'expo';

export interface QueuedBankSms {
  id: string;
  text: string;
  /** Epoch milliseconds. */
  receivedAt: number;
}

declare class BankSmsModule extends NativeModule<Record<never, never>> {
  getPending(): QueuedBankSms[];
  remove(ids: string[]): void;
  lastCapturedAt(): number | null;
  requestNotificationPermission(): Promise<boolean>;
}

/**
 * The queue filled by the "Capture bank SMS" Shortcuts action. Null on
 * Android, web and in Expo Go, where the capture link is used instead.
 */
export default requireOptionalNativeModule<BankSmsModule>('BankSms');
