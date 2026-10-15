"use client";

import { useId, useMemo, useRef, useState, type Key, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PortalTable, type PortalTableColumn } from "./data-table";
import { PortalEmptyState } from "./page-header";
import { filterTableRows, paginateTableRows, sortTableRows, type TableSortDirection, type TableSortValue } from "@/lib/table";

export type InteractiveTableColumn<T> = PortalTableColumn<T> & {
  sortValue?: (row: T) => TableSortValue;
};

type TableSort = { column: string; direction: TableSortDirection };

export function InteractivePortalTable<T>({
  rows, columns, rowKey, searchValue, searchLabel = "Search table", searchPlaceholder = "Search...",
  initialSort, className, cellClassName, rowLabel = "records", emptyTitle = "No records found", toolbarControls,
}: {
  rows: T[];
  columns: InteractiveTableColumn<T>[];
  rowKey: (row: T, index: number) => Key;
  searchValue: (row: T) => string;
  searchLabel?: string;
  searchPlaceholder?: string;
  initialSort?: TableSort;
  className?: string;
  cellClassName?: string;
  rowLabel?: string;
  emptyTitle?: string;
  toolbarControls?: ReactNode;
}) {
  const inputId = useId();
  const pageSizeId = useId();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<TableSort | undefined>(initialSort);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const sortedRows = useMemo(() => {
    const filtered = filterTableRows(rows, query, searchValue);
    const column = columns.find((item) => item.header === sort?.column);
    return column?.sortValue && sort ? sortTableRows(filtered, column.sortValue, sort.direction) : filtered;
  }, [rows, query, searchValue, columns, sort]);
  const pagination = paginateTableRows(sortedRows, page, pageSize);

  function changePage(nextPage: number) {
    setPage(nextPage);
    scrollAreaRef.current?.scrollTo({ top: 0 });
  }

  const sortableColumns = columns.map((column): PortalTableColumn<T> => {
    if (!column.sortValue) return column;
    const active = sort?.column === column.header;
    const ascending = active && sort.direction === "asc";
    const Icon = active ? ascending ? ArrowUp : ArrowDown : ArrowUpDown;
    return {
      ...column,
      sortDirection: active ? ascending ? "ascending" : "descending" : "none",
      headerContent: (
        <button
          type="button"
          aria-label={`Sort by ${column.header} ${ascending ? "descending" : "ascending"}`}
          className="flex w-full items-center gap-2 whitespace-nowrap rounded-sm text-left uppercase transition hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          onClick={() => {
            setSort({ column: column.header, direction: ascending ? "desc" : "asc" });
            changePage(0);
          }}
        >
          {column.header}<Icon className="size-3.5 shrink-0" aria-hidden="true" />
        </button>
      ),
    };
  });

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <div className={toolbarControls ? "relative w-full min-w-0 sm:w-auto sm:min-w-56 sm:max-w-md sm:flex-1" : "relative w-full sm:max-w-sm"}>
          <label htmlFor={inputId} className="sr-only">{searchLabel}</label>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            id={inputId} role="searchbox" value={query} placeholder={searchPlaceholder} className="pl-9 pr-10"
            onChange={(event) => { setQuery(event.target.value); changePage(0); }}
          />
          {query && <Button type="button" variant="ghost" size="icon-sm" className="absolute right-1 top-1/2 -translate-y-1/2" aria-label="Clear search" onClick={() => { setQuery(""); changePage(0); }}><X className="size-4" /></Button>}
        </div>
        {toolbarControls ?? <p className="text-xs text-muted-foreground">Click a column heading to sort.</p>}
      </div>
      <PortalTable
        rows={pagination.rows} columns={sortableColumns} rowKey={rowKey} className={className} cellClassName={cellClassName}
        scrollAreaRef={scrollAreaRef} scrollAreaLabel={`${rowLabel} table`} scrollAreaClassName="max-h-[min(60vh,36rem)] overflow-auto overscroll-contain focus-visible:outline-2 focus-visible:outline-ring" stickyHeader
        emptyState={<PortalEmptyState title={rows.length ? "No matches found" : emptyTitle} description={rows.length ? "Try another search or clear the search field." : "Records will appear here when they are available."} />}
      />
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border p-4">
        <p role="status" className="text-sm text-muted-foreground">
          Showing {pagination.start}–{pagination.end} of {pagination.total} {rowLabel}
          {query.trim() && ` (filtered from ${rows.length})`}
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label htmlFor={pageSizeId} className="text-sm text-muted-foreground">Rows per page</label>
            <select id={pageSizeId} value={pageSize} className="h-9 rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" onChange={(event) => { setPageSize(Number(event.target.value)); changePage(0); }}>
              {[10, 25, 50].map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
          </div>
          {pagination.pageCount > 1 && (
            <nav aria-label="Table pagination" className="flex items-center gap-2">
              <Button type="button" variant="outline" size="icon-sm" aria-label="Previous page" disabled={pagination.page === 0} onClick={() => changePage(pagination.page - 1)}><ChevronLeft /></Button>
              <span className="whitespace-nowrap text-sm">Page {pagination.page + 1} of {pagination.pageCount}</span>
              <Button type="button" variant="outline" size="icon-sm" aria-label="Next page" disabled={pagination.page === pagination.pageCount - 1} onClick={() => changePage(pagination.page + 1)}><ChevronRight /></Button>
            </nav>
          )}
        </div>
      </div>
    </>
  );
}
