import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";

export const clipboardAdapter = {
  readText: (...args: Parameters<typeof readText>) => readText(...args),
  writeText: (...args: Parameters<typeof writeText>) => writeText(...args),
};
