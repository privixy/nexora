import { useState, useEffect } from "react";
import { schemaGateway } from "../../../platform/tauri/schemaGateway";
import type { DataTypeRegistry } from "../contracts/dataTypes";

const dataTypesCache = new Map<string, DataTypeRegistry>();

export function useDataTypes(driver: string | undefined) {
  const [dataTypes, setDataTypes] = useState<DataTypeRegistry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!driver) {
      setDataTypes(null);
      setLoading(false);
      return;
    }

    const fetchDataTypes = async () => {
      try {
        setLoading(true);
        setError(null);

        if (dataTypesCache.has(driver)) {
          setDataTypes(dataTypesCache.get(driver)!);
          setLoading(false);
          return;
        }

        const registry = await schemaGateway.invoke<DataTypeRegistry>("get_data_types", {
          driver,
        });

        dataTypesCache.set(driver, registry);
        setDataTypes(registry);
      } catch (err) {
        console.error("Failed to fetch data types:", err);
        setError(String(err));
      } finally {
        setLoading(false);
      }
    };

    fetchDataTypes();
  }, [driver]);

  return { dataTypes, loading, error };
}
