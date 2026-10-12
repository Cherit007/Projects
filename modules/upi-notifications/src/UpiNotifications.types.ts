export interface UpiNotificationEvent {
  id: string;
  packageName: string;
  title: string | null;
  text: string | null;
  /** Epoch milliseconds. */
  postedAt: number;
}

export interface UpiNotificationsConfig {
  enabled: boolean;
  packages: string[];
}

export type UpiNotificationsModuleEvents = {
  onNotification: (event: UpiNotificationEvent) => void;
};
