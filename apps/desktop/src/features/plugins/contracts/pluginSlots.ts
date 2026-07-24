import type { SlotName } from "..";

export type {
  SlotComponentProps,
  SlotContext,
  SlotContribution,
  SlotName,
  UIExtensionDeclaration,
} from "..";

export const VALID_SLOTS: ReadonlySet<string> = new Set<SlotName>([
  "row-edit-modal.field.after",
  "row-edit-modal.footer.before",
  "row-editor-sidebar.field.after",
  "row-editor-sidebar.header.actions",
  "data-grid.toolbar.actions",
  "data-grid.context-menu.items",
  "sidebar.footer.actions",
  "settings.plugin.actions",
  "settings.plugin.before_settings",
  "connection-modal.connection_content",
]);
