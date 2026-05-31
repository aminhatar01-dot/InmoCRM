import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function Marketing() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">Campañas de Marketing</h2>
        <p className="text-slate-500">Gestiona tus anuncios en Meta Ads y Google Ads.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-[#1877F2]">Meta Ads (Facebook & Instagram)</CardTitle>
            <CardDescription>Genera leads promocionando propiedades específicas.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-slate-50 p-4 rounded-md text-sm text-slate-500">
              Para lanzar campañas, asegurate de tener tu cuenta publicitaria vinculada.
            </div>
            <Button className="w-full bg-[#1877F2] hover:bg-[#1877F2]/90">Vincular Meta Ads</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-[#DB4437]">Google Ads</CardTitle>
            <CardDescription>Aparece en los primeros resultados de búsqueda.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-slate-50 p-4 rounded-md text-sm text-slate-500">
               Campañas de red de búsqueda para captación de propiedades.
            </div>
            <Button className="w-full bg-[#DB4437] hover:bg-[#DB4437]/90">Vincular Google Ads</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
