import type { ComponentType } from "react";
import {
  API_VERSION,
  MIN_HOST_VERSION,
  defineSlot,
  type SlotContextMap,
  type SlotName,
  type TypedSlotProps,
} from "../src/index";

const slot: SlotName = "data-grid.toolbar.actions";
const component: ComponentType<TypedSlotProps<typeof slot>> = () => null;
const definition = defineSlot(slot, component);
const apiVersion: "0.1.0" = API_VERSION;
const minimumVersion: "0.1.0" = MIN_HOST_VERSION;
const context: SlotContextMap["settings.plugin.actions"] = { targetPluginId: "demo" };
void definition;
void apiVersion;
void minimumVersion;
void context;

// @ts-expect-error unknown slots are rejected
const invalidSlot: SlotName = "unknown.slot";
void invalidSlot;
