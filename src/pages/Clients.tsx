import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageCircle, Mail, MoreHorizontal } from "lucide-react";

export function Clients() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">Clientes & Leads</h2>
        <p className="text-slate-500">Modulo automatizado de seguimiento en frío y gestión de leads.</p>
      </div>

      <div className="bg-white border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Contacto</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">Juan Perez</TableCell>
              <TableCell>+54 9 11 1234-5678</TableCell>
              <TableCell><Badge variant="outline">Lead (Web)</Badge></TableCell>
              <TableCell><Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200 border-0">Nuevo</Badge></TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button size="icon" variant="ghost" className="text-green-600"><MessageCircle className="h-4 w-4"/></Button>
                  <Button size="icon" variant="ghost" className="text-blue-600"><Mail className="h-4 w-4"/></Button>
                  <Button size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4"/></Button>
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
