import type { DriverCapabilities, PluginManifest } from "../contracts/plugins";

export function isLocalDriver(
  capabilities?: DriverCapabilities | null,
): boolean {
  return (
    capabilities?.file_based === true || capabilities?.folder_based === true
  );
}

export function supportsAlterColumn(
  capabilities?: DriverCapabilities | null,
): boolean {
  return capabilities?.alter_column === true;
}

export function supportsCreateForeignKeys(
  capabilities?: DriverCapabilities | null,
): boolean {
  return capabilities?.create_foreign_keys === true;
}

export function findDriverManifest(
  driverId: string,
  drivers: PluginManifest[],
): PluginManifest | null {
  return drivers.find((d) => d.id === driverId) ?? null;
}

export function isReadonly(
  capabilities?: DriverCapabilities | null,
): boolean {
  return capabilities?.readonly === true;
}

export function supportsManageTables(
  capabilities?: DriverCapabilities | null,
): boolean {
  if (capabilities?.readonly === true) return false;
  return capabilities?.manage_tables !== false;
}

export function supportsCreateDatabase(
  capabilities?: DriverCapabilities | null,
): boolean {
  if (capabilities?.readonly === true) return false;
  return capabilities?.create_database === true;
}

export function supportsDropDatabase(
  capabilities?: DriverCapabilities | null,
): boolean {
  if (capabilities?.readonly === true) return false;
  return capabilities?.drop_database === true;
}

export function supportsRenameDatabase(
  capabilities?: DriverCapabilities | null,
): boolean {
  if (capabilities?.readonly === true) return false;
  return capabilities?.rename_database === true;
}

export function supportsCreateSchema(
  capabilities?: DriverCapabilities | null,
): boolean {
  if (capabilities?.readonly === true) return false;
  return capabilities?.create_schema === true;
}

export function supportsTruncateTable(
  capabilities?: DriverCapabilities | null,
): boolean {
  if (capabilities?.readonly === true) return false;
  return capabilities?.truncate_table === true;
}

export function getCapabilitiesForDriver(
  driverId: string,
  drivers: PluginManifest[],
): DriverCapabilities | null {
  return findDriverManifest(driverId, drivers)?.capabilities ?? null;
}
