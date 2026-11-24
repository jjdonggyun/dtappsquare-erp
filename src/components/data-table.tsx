import type { ReactNode } from "react";
import { Inbox } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type DataTableColumn = {
  id: string;
  label: string;
  align?: "left" | "right" | "center";
  className?: string;
};

export type DataTableRow = {
  id: string;
  cells: Record<string, ReactNode>;
};

export function DataTable({
  title,
  description,
  columns,
  rows,
  emptyTitle = "표시할 데이터가 없습니다.",
  emptyDescription = "조건을 바꾸거나 새 항목을 등록해 주세요.",
}: {
  title?: string;
  description?: string;
  columns: readonly DataTableColumn[];
  rows: readonly DataTableRow[];
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  return (
    <Card className="gap-0 overflow-hidden py-0">
      {title || description ? (
        <CardHeader className="border-b px-5 py-4">
          {title ? <h2 className="text-sm font-semibold">{title}</h2> : null}
          {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        </CardHeader>
      ) : null}
      {rows.length ? (
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/35 hover:bg-muted/35">
              {columns.map((column) => (
                <TableHead key={column.id} className={cn("px-4 text-[11px] text-muted-foreground", column.align === "right" && "text-right", column.align === "center" && "text-center", column.className)}>
                  {column.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                {columns.map((column) => (
                  <TableCell key={column.id} className={cn("px-4 py-3", column.align === "right" && "text-right", column.align === "center" && "text-center", column.className)}>
                    {row.cells[column.id] ?? "—"}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <CardContent className="flex flex-col items-center py-14 text-center">
          <span className="mb-3 flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground"><Inbox size={18} /></span>
          <p className="text-sm font-semibold">{emptyTitle}</p>
          <p className="mt-1 text-xs text-muted-foreground">{emptyDescription}</p>
        </CardContent>
      )}
    </Card>
  );
}
