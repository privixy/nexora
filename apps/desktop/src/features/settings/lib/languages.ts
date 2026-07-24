import type { AppLanguage } from "../contracts";

export const SUPPORTED_LANGUAGES = [
  { id: "en", label: "English" },
  { id: "it", label: "Italiano" },
  { id: "es", label: "Español" },
  { id: "zh", label: "中文" },
  { id: "fr", label: "Français" },
  { id: "de", label: "Deutsch" },
  { id: "ja", label: "日本語" },
  { id: "ru", label: "Русский" },
  { id: "ko", label: "한국어" },
  { id: "tl", label: "Tagalog" },
] as const;

export function getAiExplanationLanguage(language: AppLanguage): string {
  if (language === "auto") return "English";
  return SUPPORTED_LANGUAGES.find(({ id }) => id === language)?.label ?? "English";
}
