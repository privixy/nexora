import { useContext } from "react";

import { PluginSlotContext } from "../state/PluginSlotContext";
import type { PluginSlotRegistryType } from "../state/PluginSlotContext";

export function usePluginSlotRegistry(): PluginSlotRegistryType {
  const context = useContext(PluginSlotContext);
  if (!context) {
    throw new Error("usePluginSlotRegistry must be used within a PluginSlotProvider");
  }
  return context;
}
