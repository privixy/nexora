import { convertFileSrc } from "@tauri-apps/api/core";

export const coreAdapter = {
  convertFileSrc: (...args: Parameters<typeof convertFileSrc>) => convertFileSrc(...args),
};
