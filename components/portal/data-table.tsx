import type { Key, ReactNode, Ref } from "react";

import { cn } from "@/lib/utils";

export type PortalTableColumn<T> = {
  header: string;
  headerContent?: ReactNode;
  sortDirection?: "ascending" | "descending" | "none";
  cell: (row: T, index: number) => ReactNode;
  className?: string;
};

export function PortalTable<T>({
  rows,
  columns,
  rowKey,
  className,
  cellClassName = "px-4 py-4 align-top",
  rowClassName = "hover:bg-muted/30",
  scrollAreaClassName,
  scrollAreaRef,
  scrollAreaLabel,
  stickyHeader = false,
  emptyState,
}: {
  rows: T[];
  columns: PortalTableColumn<T>[];
  rowKey: (row: T, index: number) => Key;
  className?: string;
  cellClassName?: string;
  rowClassName?: string;
  scrollAreaClassName?: string;
  scrollAreaRef?: Ref<HTMLDivElement>;
  scrollAreaLabel?: string;
  stickyHeader?: boolean;
  emptyState?: ReactNode;
}) {
  return (
    <div ref={scrollAreaRef} role={scrollAreaLabel ? "region" : undefined} aria-label={scrollAreaLabel} tabIndex={scrollAreaLabel ? 0 : undefined} className={cn("overflow-x-auto", scrollAreaClassName)}>
      <table className={cn("w-full text-left text-sm", className)}>
        <thead className={cn("border-b border-border bg-muted/50 text-xs uppercase text-muted-foreground", stickyHeader && "sticky top-0 z-10 bg-muted")}>
          <tr>
            {columns.map(({ header, headerContent, sortDirection }) => (
              <th key={header} scope="col" aria-sort={sortDirection} className="px-4 py-3 font-semibold">{headerContent ?? header}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.length === 0 && emptyState && <tr><td colSpan={columns.length}>{emptyState}</td></tr>}
          {rows.map((row, index) => (
            <tr key={rowKey(row, index)} className={rowClassName}>
              {columns.map(({ header, cell, className: columnClassName }) => (
                <td key={header} className={cn(cellClassName, columnClassName)}>{cell(row, index)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
