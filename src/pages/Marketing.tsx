import { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Sparkles, Copy, CheckCircle2 } from "lucide-react";

export function Marketing() {
  const [prompt, setPrompt] = useState("");
  const [platform, setPlatform] = useState("Meta Ads (Instagram/Facebook)");
  const [generating, setGenerating] = useState(false);
  const [generatedCopy, setGeneratedCopy] = useState("");
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (!prompt) return;
    setGenerating(true);
    setGeneratedCopy("");
    setCopied(false);
    try {
      const res = await fetch("/api/generate-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, platform }),
      });
      const data = await res.json();
      if (res.ok) {
        setGeneratedCopy(data.copy);
      } else {
        alert(data.error || "Error al generar el copy");
      }
    } catch (err) {
      console.error(err);
      alert("Fallo la conexión con el servidor");
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">Campañas de Marketing</h2>
        <p className="text-slate-500">Gestiona tus anuncios en Meta Ads y Google Ads, y genera copys con IA.</p>
      </div>

      <Card className="border-blue-100 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white flex justify-between items-center">
          <div>
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-200" />
              Generador de Copy con IA (Gemini)
            </h3>
            <p className="text-blue-100 text-sm mt-1">
              Redacta anuncios atractivos para tus propiedades en segundos.
            </p>
          </div>
        </div>
        <CardContent className="p-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Plataforma</label>
                <select 
                  className="w-full flex h-10 rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                >
                  <option value="Meta Ads (Instagram/Facebook)">Meta Ads (Instagram/Facebook)</option>
                  <option value="Google Ads (Search)">Google Ads (Search)</option>
                  <option value="TikTok Ads">TikTok Ads</option>
                  <option value="WhatsApp Broadcast">WhatsApp Broadcast</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Describe la propiedad o el objetivo</label>
                <Textarea 
                  placeholder="Ej. Casa de 4 ambientes en Palermo. Luminosa, con pileta y cochera doble. Ideal para familias. Destacar la ubicación y la tranquilidad." 
                  className="h-32 resize-none"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />
              </div>
              <Button 
                onClick={handleGenerate} 
                disabled={generating || !prompt}
                className="w-full bg-slate-900 hover:bg-slate-800"
              >
                {generating ? "Generando..." : "Generar Copy con IA"}
                {!generating && <Sparkles className="w-4 h-4 ml-2" />}
              </Button>
            </div>
            
            <div className="bg-slate-50 border rounded-md p-4 relative min-h-[220px]">
              {generatedCopy ? (
                <>
                  <div className="whitespace-pre-wrap text-sm text-slate-700 pb-10">
                    {generatedCopy}
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleCopy}
                    className="absolute bottom-4 right-4 bg-white"
                  >
                    {copied ? (
                      <><CheckCircle2 className="w-4 h-4 mr-2 text-green-600" /> Copiado</>
                    ) : (
                      <><Copy className="w-4 h-4 mr-2" /> Copiar</>
                    )}
                  </Button>
                </>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm italic py-12">
                  El copy generado aparecerá aquí...
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

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
