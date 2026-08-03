import type { ReactNode } from "react";

export interface Column<T> {
  key: string;
  header: string;
  /** Cell renderer. */
  cell: (row: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
}

/** Generic, presentational table matching the dashboard styling. */
export function DataTable<T>({ columns, rows, rowKey }: DataTableProps<T>) {
  return (
    <div className="overflow-x-auto custom-scrollbar rounded-2xl border border-outline-variant bg-surface-container-lowest">
      <table className="w-full text-start">
        <thead>
          <tr className="border-b border-outline-variant bg-surface-container-low">
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className="px-lg py-md text-start text-label-md font-label-md uppercase tracking-wider text-on-surface-variant whitespace-nowrap"
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant">
          {rows.map((row) => (
            <tr key={rowKey(row)} className="hover:bg-surface-container-low transition-colors">
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`px-lg py-md text-body-sm font-body-sm text-on-surface ${col.className ?? ""}`}
                >
                  {col.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
