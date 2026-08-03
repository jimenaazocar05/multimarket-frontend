import { useState, useMemo } from "react";

export type SortOrder = "asc" | "desc";

export function useTableSort<T>(
  items: T[],
  defaultKey: string = "",
  defaultOrder: SortOrder = "asc",
  customGetter?: (item: T, key: string) => any
) {
  const [sortKey, setSortKey] = useState<string>(defaultKey);
  const [sortOrder, setSortOrder] = useState<SortOrder>(defaultOrder);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  };

  const sorted = useMemo(() => {
    if (!sortKey || !items || items.length === 0) return items;
    return [...items].sort((a, b) => {
      let va = customGetter ? customGetter(a, sortKey) : undefined;
      if (va === undefined) va = getNestedValue(a, sortKey);
      let vb = customGetter ? customGetter(b, sortKey) : undefined;
      if (vb === undefined) vb = getNestedValue(b, sortKey);

      if (va === undefined || va === null) va = "";
      if (vb === undefined || vb === null) vb = "";

      if (typeof va === "number" && typeof vb === "number") {
        return sortOrder === "asc" ? va - vb : vb - va;
      }
      if (va instanceof Date && vb instanceof Date) {
        return sortOrder === "asc"
          ? va.getTime() - vb.getTime()
          : vb.getTime() - va.getTime();
      }
      const numA = Number(va);
      const numB = Number(vb);
      if (
        !isNaN(numA) &&
        !isNaN(numB) &&
        va !== "" &&
        vb !== "" &&
        typeof va !== "boolean" &&
        typeof vb !== "boolean"
      ) {
        return sortOrder === "asc" ? numA - numB : numB - numA;
      }
      const strA = String(va).toLowerCase();
      const strB = String(vb).toLowerCase();
      if (strA < strB) return sortOrder === "asc" ? -1 : 1;
      if (strA > strB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [items, sortKey, sortOrder, customGetter]);

  return { sorted, sortKey, sortOrder, handleSort };
}

function getNestedValue(obj: any, path: string): any {
  if (!obj || !path) return undefined;
  return path.split(".").reduce((acc, part) => (acc ? acc[part] : undefined), obj);
}
