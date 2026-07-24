import { useContext } from "react";
import { KeybindingsContext } from "../state/KeybindingsContext";
import type { KeybindingsContextType } from "../state/KeybindingsContext";

export function useKeybindings(): KeybindingsContextType {
  const ctx = useContext(KeybindingsContext);
  if (!ctx) throw new Error("useKeybindings must be used inside KeybindingsProvider");
  return ctx;
}
