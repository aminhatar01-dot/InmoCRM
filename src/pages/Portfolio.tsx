import { Building2, Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function Portfolio() {
  const mockProperties = [
    { id: 1, title: "Hermosa casa en Palermo", status: "disponible", price: 250000, type: "casa" },
    { id: 2, title: "Oficina céntrica", status: "disponible", price: 90000, type: "oficina" }
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-blue-600 font-bold text-xl">
            <Building2 className="w-6 h-6" />
            Portafolio de Carlos (Agente Asociado)
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm"><Phone className="w-4 h-4 mr-2"/> Contactar</Button>
            <Button size="sm"><Mail className="w-4 h-4 mr-2"/> Enviar Mensaje</Button>
          </div>
        </div>
      </header>
      
      <main className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Mis Propiedades Destacadas</h1>
        
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {mockProperties.map((prop) => (
            <Card key={prop.id} className="overflow-hidden">
              <div className="h-48 bg-slate-200" />
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <Badge variant="default" className="bg-blue-600">{prop.status.toUpperCase()}</Badge>
                  <span className="font-bold text-lg">${prop.price.toLocaleString()}</span>
                </div>
                <h3 className="font-medium text-slate-900 mb-1">{prop.title}</h3>
                <p className="text-sm text-slate-500 capitalize">{prop.type}</p>
                
                <Button className="w-full mt-4 bg-slate-900">Ver Detalles</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
