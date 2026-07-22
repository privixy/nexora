import { convertFileSrc as convertTauriFileSrc } from "@tauri-apps/api/core";

function convertFileSrc(path: string): string;
function convertFileSrc(path: string, protocol: string): string;
function convertFileSrc(path: string, protocol?: string): string {
  return arguments.length === 1
    ? convertTauriFileSrc(path)
    : convertTauriFileSrc(path, protocol);
}

export const assetAdapter = { convertFileSrc };
