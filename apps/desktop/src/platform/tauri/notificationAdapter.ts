import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

export const notificationAdapter = {
  isPermissionGranted,
  requestPermission,
  sendNotification,
};
