// Re-export the native module. On web, it will be resolved to UpiNotificationsModule.web.ts
// and on native platforms to UpiNotificationsModule.ts
export { default } from './src/UpiNotificationsModule';
export * from './src/UpiNotifications.types';
