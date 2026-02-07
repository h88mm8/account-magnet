import { motion } from "framer-motion";
import { Building2, MapPin, Users, ExternalLink } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AccountResult } from "@/lib/api/unipile";

type Props = {
  results: AccountResult[];
  isLoading: boolean;
};

export function ResultsTable({ results, isLoading }: Props) {
  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center justify-center gap-4 rounded-xl border border-border bg-card p-16"
      >
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-muted border-t-primary" />
        <p className="text-sm text-muted-foreground">Buscando leads no Sales Navigator...</p>
      </motion.div>
    );
  }

  if (results.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card p-16"
      >
        <Building2 className="h-12 w-12 text-muted-foreground/40" />
        <p className="text-muted-foreground">Nenhum resultado encontrado. Ajuste seus filtros e tente novamente.</p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-card)]"
    >
      <div className="border-b border-border px-6 py-4">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{results.length}</span> resultados encontrados
        </p>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-display font-semibold">Empresa</TableHead>
              <TableHead className="font-display font-semibold">Setor</TableHead>
              <TableHead className="font-display font-semibold">Localização</TableHead>
              <TableHead className="font-display font-semibold">Funcionários</TableHead>
              <TableHead className="font-display font-semibold">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((item, index) => (
              <motion.tr
                key={item.id || index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className="group border-b border-border transition-colors hover:bg-muted/30"
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                      <Building2 className="h-4 w-4 text-primary" />
                    </div>
                    <span className="font-medium text-foreground">
                      {item.name || "Empresa desconhecida"}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  {item.industry ? (
                    <Badge variant="secondary" className="font-normal">
                      {item.industry}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {item.location ? (
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                      {item.location}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {item.employeeCount ? (
                    <div className="flex items-center gap-1.5 text-sm">
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      {item.employeeCount}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {item.linkedinUrl && (
                    <Button variant="ghost" size="sm" asChild>
                      <a href={item.linkedinUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="mr-1 h-3.5 w-3.5" />
                        Ver
                      </a>
                    </Button>
                  )}
                </TableCell>
              </motion.tr>
            ))}
          </TableBody>
        </Table>
      </div>
    </motion.div>
  );
}
