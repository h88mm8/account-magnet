import { User, MapPin, Briefcase, ExternalLink, MoreHorizontal } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import type { LeadResult } from "@/lib/api/unipile";

type Props = {
  results: LeadResult[];
  isLoading: boolean;
};

export function LeadResultsTable({ results, isLoading }: Props) {
  if (isLoading) {
    return (
      <Card className="flex flex-col items-center justify-center gap-4 border border-border p-16 shadow-none">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-muted border-t-primary" />
        <p className="text-sm text-muted-foreground">Buscando leads...</p>
      </Card>
    );
  }

  if (results.length === 0) {
    return (
      <Card className="flex flex-col items-center justify-center gap-3 border border-border p-16 shadow-none">
        <User className="h-10 w-10 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">Nenhum resultado. Ajuste seus filtros e tente novamente.</p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border border-border shadow-none">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{results.length}</span> resultados
        </p>
        <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
          Exportar
        </Button>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-border hover:bg-transparent">
              <TableHead className="w-10 pl-5">
                <Checkbox />
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nome</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cargo</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Empresa</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Localização</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((item, index) => (
              <TableRow
                key={index}
                className="group border-b border-border transition-colors hover:bg-accent/50"
              >
                <TableCell className="pl-5">
                  <Checkbox />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <span className="text-sm font-medium text-foreground">
                      {[item.firstName, item.lastName].filter(Boolean).join(" ") || "Desconhecido"}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  {item.title ? (
                    <Badge variant="secondary" className="font-normal text-xs">
                      {item.title}
                    </Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {item.company ? (
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Briefcase className="h-3 w-3" />
                      {item.company}
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {item.location ? (
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {item.location}
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground opacity-0 group-hover:opacity-100">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
