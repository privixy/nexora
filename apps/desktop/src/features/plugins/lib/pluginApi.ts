/**
 * @nexora/plugin-api
 *
 * Public API surface for plugin UI extensions.
 * Plugin components import these hooks to interact with the host application.
 */

// Plugin hooks
export { usePluginQuery, usePluginConnection, usePluginToast, usePluginSetting, usePluginModal, usePluginTheme, usePluginTranslation, openUrl } from "../hooks/usePluginApi";

// Types
export type { SlotComponentProps, SlotContext, SlotName } from "../../../types/pluginSlots";
export type { PluginModalOptions } from "../state/PluginModalContext";

// Slot registration helper exposed through the Nexora plugin API global.
export function defineSlot(slot: string, component: unknown): { readonly __slot: string; readonly component: unknown } {
  return { __slot: slot, component } as const;
}
