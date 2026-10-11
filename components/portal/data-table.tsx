import type { Key, ReactNode } from "react";

import { cn } from "@/lib/utils";

export type PortalTableColumn<T> = {
  header: string;
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
}: {
  rows: T[];
  columns: PortalTableColumn<T>[];
  rowKey: (row: T, index: number) => Key;
  className?: string;
  cellClassName?: string;
  rowClassName?: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className={cn("w-full text-left text-sm", className)}>
        <thead className="border-b border-border bg-muted/50 text-xs uppercase text-muted-foreground">
          <tr>
            {columns.map(({ header }) => <th key={header} className="px-4 py-3 font-semibold">{header}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
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
