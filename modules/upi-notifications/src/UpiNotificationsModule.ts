import { NativeModule, requireOptionalNativeModule } from 'expo';

import type {
  UpiNotificationEvent,
  UpiNotificationsConfig,
  UpiNotificationsModuleEvents,
} from './UpiNotifications.types';

declare class UpiNotificationsModule extends NativeModule<UpiNotificationsModuleEvents> {
  isAccessGranted(): boolean;
  openAccessSettings(): void;
  setConfig(enabled: boolean, packages: string[]): void;
  getConfig(): UpiNotificationsConfig;
  getPendingEvents(): UpiNotificationEvent[];
  removeEvents(ids: string[]): void;
}

/**
 * Null on iOS, web and in Expo Go, where reading other apps' notifications is
 * not possible. Callers must hide the feature when this is null.
 */
export default requireOptionalNativeModule<UpiNotificationsModule>('UpiNotifications');
