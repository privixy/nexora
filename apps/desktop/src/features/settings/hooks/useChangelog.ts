import { useMemo } from "react";
import { type ChangelogEntry, parseChangelog } from "../lib/changelog";
import { changelogMarkdown, versionLinks } from "../config/changelog";

interface UseChangelogResult {
  entries: ChangelogEntry[];
  isLoading: boolean;
  error: string | null;
}

export function useChangelog(): UseChangelogResult {
  const entries = useMemo(
    () => parseChangelog(changelogMarkdown, versionLinks),
    [],
  );

  return { entries, isLoading: false, error: null };
}
