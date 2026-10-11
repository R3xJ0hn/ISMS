export type TableSortDirection = "asc" | "desc";
export type TableSortValue = string | number | boolean | null | undefined;

const textComparator = new Intl.Collator("en", {
  numeric: true,
  sensitivity: "base",
});

function normalizeSearch(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export function filterTableRows<T>(
  rows: readonly T[],
  query: string,
  searchValue: (row: T) => string,
): T[] {
  const terms = normalizeSearch(query).trim().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [...rows];

  return rows.filter((row) => {
    const text = normalizeSearch(searchValue(row));
    return terms.every((term) => text.includes(term));
  });
}

function isMissing(value: TableSortValue): boolean {
  return value == null
    || (typeof value === "number" && Number.isNaN(value))
    || (typeof value === "string" && value.trim() === "");
}

function compareValues(left: TableSortValue, right: TableSortValue): number {
  if (typeof left === "number" && typeof right === "number") {
    return left < right ? -1 : left > right ? 1 : 0;
  }
  if (typeof left === "boolean" && typeof right === "boolean") {
    return Number(left) - Number(right);
  }
  return textComparator.compare(String(left), String(right));
}

export function sortTableRows<T>(
  rows: readonly T[],
  value: (row: T) => TableSortValue,
  direction: TableSortDirection,
): T[] {
  const multiplier = direction === "asc" ? 1 : -1;

  return rows
    .map((row, index) => ({ row, index, value: value(row) }))
    .sort((left, right) => {
      const leftMissing = isMissing(left.value);
      const rightMissing = isMissing(right.value);
      if (leftMissing !== rightMissing) return leftMissing ? 1 : -1;
      if (leftMissing) return left.index - right.index;

      return compareValues(left.value, right.value) * multiplier || left.index - right.index;
    })
    .map(({ row }) => row);
}

export function paginateTableRows<T>(
  rows: readonly T[],
  page: number,
  pageSize: number,
): { rows: T[]; page: number; pageCount: number; start: number; end: number; total: number } {
  if (!Number.isFinite(pageSize) || !Number.isInteger(pageSize) || pageSize < 1) {
    throw new RangeError("Page size must be a positive finite integer.");
  }

  const total = rows.length;
  const pageCount = Math.ceil(total / pageSize);
  const requestedPage = Number.isFinite(page) && Number.isInteger(page) && page >= 0 ? page : 0;
  const currentPage = Math.min(requestedPage, Math.max(pageCount - 1, 0));
  const offset = currentPage * pageSize;
  const pageRows = rows.slice(offset, offset + pageSize);

  return {
    rows: pageRows,
    page: currentPage,
    pageCount,
    start: total === 0 ? 0 : offset + 1,
    end: offset + pageRows.length,
    total,
  };
}
