import * as dialog from "@tauri-apps/plugin-dialog";

export const dialogGateway = {
  ask: (...args: Parameters<typeof dialog.ask>) => dialog.ask(...args),
  confirm: (...args: Parameters<typeof dialog.confirm>) => dialog.confirm(...args),
  message: (...args: Parameters<typeof dialog.message>) => dialog.message(...args),
  open: (...args: Parameters<typeof dialog.open>) => dialog.open(...args),
  save: (...args: Parameters<typeof dialog.save>) => dialog.save(...args),
};
