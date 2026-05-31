import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Plus } from "lucide-react";

export function Documents() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Formularios y Docs</h2>
          <p className="text-slate-500">Carga plantillas y genera contratos para tus inmuebles.</p>
        </div>
        <Button className="bg-blue-600">
          <Plus className="w-4 h-4 mr-2" />
          Nueva Plantilla
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-500" />
              Contrato de Alquiler
            </CardTitle>
            <CardDescription>Plantilla estándar para alquiler de vivienda.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full">Generar Documento</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-500" />
              Reserva Ad-Referendum
            </CardTitle>
            <CardDescription>Documento para reservas de compra-venta.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full">Generar Documento</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
