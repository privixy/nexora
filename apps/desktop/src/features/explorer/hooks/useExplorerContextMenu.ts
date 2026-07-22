import { useState } from "react";
import type { ContextMenuData } from "../../../types/sidebar";

export interface ExplorerContextMenuState {
  x: number;
  y: number;
  type: string;
  id: string;
  label: string;
  data?: ContextMenuData;
}

interface ContextMenuEvent {
  preventDefault: () => void;
  clientX: number;
  clientY: number;
}

export const useExplorerContextMenu = () => {
  const [contextMenu, setContextMenu] = useState<ExplorerContextMenuState | null>(null);

  const openContextMenu = (
    event: ContextMenuEvent,
    type: string,
    id: string,
    label: string,
    data?: ContextMenuData,
  ) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY, type, id, label, data });
  };

  return {
    contextMenu,
    openContextMenu,
    closeContextMenu: () => setContextMenu(null),
  };
};
