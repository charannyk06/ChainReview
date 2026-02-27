"use client";

import {
  type ReactNode,
  type HTMLAttributes,
  type ThHTMLAttributes,
  type TdHTMLAttributes,
  useState,
  useCallback,
  forwardRef,
} from "react";
import { clsx } from "clsx";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { EmptyState } from "./EmptyState";
import { SkeletonTable } from "./Skeleton";
import { Inbox } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Primitive table parts                                              */
/* ------------------------------------------------------------------ */

export const TableRoot = forwardRef<
  HTMLTableElement,
  HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
    <table
      ref={ref}
      className={clsx("w-full text-sm", className)}
      {...props}
    />
  </div>
));
TableRoot.displayName = "TableRoot";

export const TableHead = forwardRef<
  HTMLTableSectionElement,
  HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={clsx(
      "bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800",
      className,
    )}
    {...props}
  />
));
TableHead.displayName = "TableHead";

export const TableBody = forwardRef<
  HTMLTableSectionElement,
  HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={clsx(
      "divide-y divide-zinc-100 dark:divide-zinc-800 bg-white dark:bg-zinc-900",
      className,
    )}
    {...props}
  />
));
TableBody.displayName = "TableBody";

export const TableRow = forwardRef<
  HTMLTableRowElement,
  HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={clsx(
      "transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50",
      className,
    )}
    {...props}
  />
));
TableRow.displayName = "TableRow";

/* ------------------------------------------------------------------ */
/*  Sortable header cell                                               */
/* ------------------------------------------------------------------ */

type SortDir = "asc" | "desc" | null;

interface TableHeaderCellProps extends ThHTMLAttributes<HTMLTableCellElement> {
  sortable?: boolean;
  sortDir?: SortDir;
  onSort?: () => void;
}

export const TableHeaderCell = forwardRef<
  HTMLTableCellElement,
  TableHeaderCellProps
>(({ className, sortable = false, sortDir, onSort, children, ...props }, ref) => (
  <th
    ref={ref}
    className={clsx(
      "px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider",
      sortable && "cursor-pointer select-none hover:text-zinc-700 dark:hover:text-zinc-200",
      className,
    )}
    onClick={sortable ? onSort : undefined}
    {...props}
  >
    <span className="inline-flex items-center gap-1">
      {children}
      {sortable && (
        <span className="inline-flex flex-col">
          {sortDir === "asc" ? (
            <ChevronUp size={14} className="text-brand-500" />
          ) : sortDir === "desc" ? (
            <ChevronDown size={14} className="text-brand-500" />
          ) : (
            <ChevronsUpDown size={14} className="text-zinc-400" />
          )}
        </span>
      )}
    </span>
  </th>
));
TableHeaderCell.displayName = "TableHeaderCell";

export const TableCell = forwardRef<
  HTMLTableCellElement,
  TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={clsx("px-4 py-3 text-zinc-700 dark:text-zinc-300", className)}
    {...props}
  />
));
TableCell.displayName = "TableCell";

/* ------------------------------------------------------------------ */
/*  Pagination footer                                                  */
/* ------------------------------------------------------------------ */

interface TablePaginationProps {
  offset: number;
  limit: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
}

export function TablePagination({
  offset,
  limit,
  total,
  onPrev,
  onNext,
}: TablePaginationProps) {
  if (total <= limit) return null;

  const start = offset + 1;
  const end = Math.min(offset + limit, total);
  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="flex items-center justify-between px-1 py-3">
      <span className="text-xs text-zinc-500 dark:text-zinc-400">
        {start}&ndash;{end} of {total}
      </span>
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-zinc-500 dark:text-zinc-400 mr-2">
          Page {currentPage} of {totalPages}
        </span>
        <button
          onClick={onPrev}
          disabled={offset === 0}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Previous
        </button>
        <button
          onClick={onNext}
          disabled={offset + limit >= total}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Composed DataTable                                                 */
/* ------------------------------------------------------------------ */

export interface ColumnDef<T> {
  key: string;
  header: string;
  sortable?: boolean;
  render: (row: T) => ReactNode;
  /** Custom className applied to both <th> and <td> */
  className?: string;
}

interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  /** Unique key accessor for each row. */
  rowKey: (row: T) => string;
  /** Total count for pagination. If omitted, data.length is used. */
  total?: number;
  offset?: number;
  limit?: number;
  onPrev?: () => void;
  onNext?: () => void;
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  rowKey,
  total,
  offset = 0,
  limit = 20,
  onPrev,
  onNext,
  loading = false,
  emptyTitle = "No data",
  emptyDescription,
  className,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  const handleSort = useCallback(
    (key: string) => {
      if (sortKey === key) {
        setSortDir((prev) =>
          prev === "asc" ? "desc" : prev === "desc" ? null : "asc",
        );
        if (sortDir === "desc") setSortKey(null);
      } else {
        setSortKey(key);
        setSortDir("asc");
      }
    },
    [sortKey, sortDir],
  );

  if (loading) {
    return (
      <SkeletonTable rows={5} cols={columns.length} className={className} />
    );
  }

  if (data.length === 0) {
    return (
      <div
        className={clsx(
          "rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900",
          className,
        )}
      >
        <EmptyState
          icon={Inbox}
          title={emptyTitle}
          description={emptyDescription}
        />
      </div>
    );
  }

  const resolvedTotal = total ?? data.length;

  return (
    <div className={className}>
      <TableRoot>
        <TableHead>
          <tr>
            {columns.map((col) => (
              <TableHeaderCell
                key={col.key}
                sortable={col.sortable}
                sortDir={sortKey === col.key ? sortDir : undefined}
                onSort={() => handleSort(col.key)}
                className={col.className}
              >
                {col.header}
              </TableHeaderCell>
            ))}
          </tr>
        </TableHead>
        <TableBody>
          {data.map((row) => (
            <TableRow key={rowKey(row)}>
              {columns.map((col) => (
                <TableCell key={col.key} className={col.className}>
                  {col.render(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </TableRoot>

      {onPrev && onNext && (
        <TablePagination
          offset={offset}
          limit={limit}
          total={resolvedTotal}
          onPrev={onPrev}
          onNext={onNext}
        />
      )}
    </div>
  );
}
