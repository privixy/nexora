import { createContext } from "react";
import type { Theme } from "../types/theme";

export const EditorThemeContext = createContext<Theme | null>(null);
