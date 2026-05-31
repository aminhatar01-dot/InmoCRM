import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";

export function Portals() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">Portales de Venta</h2>
        <p className="text-slate-500">Sincroniza tus inmuebles con los principales portales inmobiliarios.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardContent className="p-6 text-center">
            <div className="h-12 flex items-center justify-center font-bold text-xl mb-4 text-[#FFF059] bg-[#2D3277] rounded">Mercado Libre</div>
            <p className="text-sm text-slate-500 mb-4">Conectado. 12 propiedades sincronizadas.</p>
            <Button variant="outline" className="w-full text-green-600 border-green-600 hover:bg-green-50">
              <CheckCircle2 className="w-4 h-4 mr-2" /> Vinculado
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <div className="h-12 flex items-center justify-center font-bold text-xl mb-4 bg-[#FF4500] text-white rounded">Argenprop</div>
            <p className="text-sm text-slate-500 mb-4">No conectado.</p>
            <Button className="w-full bg-blue-600">Vincular Cuenta</Button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <div className="h-12 flex items-center justify-center font-bold text-xl mb-4 bg-purple-600 text-white rounded">Zonaprop</div>
            <p className="text-sm text-slate-500 mb-4">No conectado.</p>
            <Button className="w-full bg-blue-600">Vincular Cuenta</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
