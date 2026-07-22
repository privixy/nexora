import { readTextFile, writeFile, writeTextFile } from "@tauri-apps/plugin-fs";

export const fileGateway = {
  readTextFile: (...args: Parameters<typeof readTextFile>) => readTextFile(...args),
  writeTextFile: (...args: Parameters<typeof writeTextFile>) => writeTextFile(...args),
  writeFile: (...args: Parameters<typeof writeFile>) => writeFile(...args),
};
