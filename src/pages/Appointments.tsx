import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Calendar as CalendarIcon, Clock } from "lucide-react";

export function Appointments() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Citas y Agenda</h2>
          <p className="text-slate-500">Gestiona tus visitas a propiedades y reuniones.</p>
        </div>
        <Button className="bg-blue-600">
          <Plus className="w-4 h-4 mr-2" />
          Nueva Cita
        </Button>
      </div>

      <div className="grid gap-4">
        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-blue-100 text-blue-700 p-3 rounded-lg flex flex-col items-center justify-center min-w-[4rem]">
                <span className="text-sm font-bold uppercase">OCT</span>
                <span className="text-2xl font-black">14</span>
              </div>
              <div>
                <h3 className="font-bold text-lg">Visita: Casa en Palermo</h3>
                <div className="flex items-center gap-4 text-slate-500 text-sm mt-1">
                  <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> 15:30 - 16:30 hs</span>
                  <span className="flex items-center gap-1"><CalendarIcon className="w-4 h-4" /> Juan Perez (Lead)</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline">Reprogramar</Button>
              <Button>Completada</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
