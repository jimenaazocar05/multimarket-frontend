export const money = (n: number | null | undefined) => {
  const v = Number(n ?? 0);
  return v.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export const bolivares = (n: number | null | undefined) => {
  const v = Number(n ?? 0);
  return "Bs. " + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const num = (n: number | null | undefined, d = 2) => {
  const v = Number(n ?? 0);
  return v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
};

/** Un string "YYYY-MM-DD" (sin hora) lo interpreta `new Date()` como
 * medianoche UTC; en timezones negativos (ej. Venezuela, UTC-4) eso cae en
 * el día local anterior. Estas fechas se arman en hora local en su lugar. */
const parseDate = (d: string | Date): Date => {
  if (d instanceof Date) return d;
  const m = /^\d{4}-\d{2}-\d{2}$/.exec(d);
  if (m) {
    const [y, mo, day] = d.split("-").map(Number);
    return new Date(y, mo - 1, day);
  }
  return new Date(d);
};

export const formatDate = (d: string | Date | null | undefined) => {
  if (!d) return "";
  return parseDate(d).toLocaleDateString("es-DO", { year: "numeric", month: "short", day: "2-digit" });
};

export const formatDateTime = (d: string | Date | null | undefined) => {
  if (!d) return "";
  return parseDate(d).toLocaleString("es-DO", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const daysBetween = (a: Date, b: Date) =>
  Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
