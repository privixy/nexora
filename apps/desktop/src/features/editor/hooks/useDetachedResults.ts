import type { Tab } from "..";

export function findDetachedTab(tabs: Tab[], tabId: string) {
  return tabs.find((tab) => tab.id === tabId);
}
