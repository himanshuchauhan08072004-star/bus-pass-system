import type { ReactNode } from "react";
import { Button } from "./Button";
import { EmptyState, Spinner } from "./States";

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
}

export function DataTable<T>({
  rows,
  columns,
  loading,
  empty = "Nothing here yet",
  rowKey,
}: {
  rows: T[] | undefined;
  columns: Column<T>[];
  loading?: boolean;
  empty?: string;
  rowKey: (row: T) => string | number;
}) {
  if (loading && !rows) return <Spinner />;
  if (!rows || rows.length === 0) return <EmptyState title={empty} />;
  return (
    <div className="overflow-x-auto rounded-3xl border border-line/70 bg-surface/90 shadow-card">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-line/60 bg-sage/30 text-xs uppercase tracking-wide text-muted">
          <tr>
            {columns.map((c) => (
              <th key={c.header} scope="col" className={`px-4 py-3 font-semibold ${c.className ?? ""}`}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line/60">
          {rows.map((r) => (
            <tr key={rowKey(r)} className="hover:bg-surface2/40">
              {columns.map((c) => (
                <td key={c.header} className={`px-4 py-3 align-middle ${c.className ?? ""}`}>
                  {c.cell(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({ total, limit, offset, onChange }: { total: number; limit: number; offset: number; onChange: (offset: number) => void }) {
  if (total <= limit) return null;
  const page = Math.floor(offset / limit) + 1;
  const pages = Math.ceil(total / limit);
  return (
    <div className="mt-3 flex items-center justify-between text-sm text-muted">
      <span>
        Page {page} of {pages} · {total} total
      </span>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" disabled={offset === 0} onClick={() => onChange(Math.max(0, offset - limit))}>
          Previous
        </Button>
        <Button size="sm" variant="secondary" disabled={offset + limit >= total} onClick={() => onChange(offset + limit)}>
          Next
        </Button>
      </div>
    </div>
  );
}
