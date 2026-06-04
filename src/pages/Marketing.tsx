import { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Sparkles, Copy, CheckCircle2, Link as LinkIcon, Unlink, ExternalLink, PlayCircle } from "lucide-react";

export function Marketing() {
  const { user } = useAuth();
  const [prompt, setPrompt] = useState("");
  const [platform, setPlatform] = useState("Meta Ads (Instagram/Facebook)");
  const [generating, setGenerating] = useState(false);
  const [generatedCopy, setGeneratedCopy] = useState("");
  const [copied, setCopied] = useState(false);

  // Integrations state
  const [integrations, setIntegrations] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [activePlatform, setActivePlatform] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user) {
      fetchIntegrations();
    }
  }, [user]);

  const fetchIntegrations = async () => {
    if (!user) return;
    try {
      const docRef = doc(db, "integrations", user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setIntegrations(docSnap.data());
      } else {
        setIntegrations({});
      }
    } catch (error) {
      console.error("Error fetching integrations:", error);
    } finally {
      setLoading(false);
    }
  };

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

  const handleConnect = async () => {
    if (!user || !activePlatform || !tokenInput.trim()) return;
    setIsSaving(true);
    try {
      const docRef = doc(db, "integrations", user.uid);
      await setDoc(docRef, { [activePlatform]: { connected: true, token: tokenInput, connectedAt: Date.now() } }, { merge: true });
      setIntegrations((prev: any) => ({ ...prev, [activePlatform]: { connected: true } }));
      setActivePlatform(null);
      setTokenInput("");
    } catch (error) {
      console.error("Error connecting platform:", error);
      alert("Error al vincular cuenta publicitaria");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisconnect = async (platformName: string) => {
    if (!user) return;
    if (!confirm(`¿Estás seguro de que deseas desvincular ${platformName}?`)) return;
    try {
      const docRef = doc(db, "integrations", user.uid);
      await setDoc(docRef, { [platformName]: { connected: false, token: null } }, { merge: true });
      setIntegrations((prev: any) => ({ ...prev, [platformName]: { connected: false } }));
    } catch (error) {
      console.error("Error disconnecting platform:", error);
    }
  };

  const openConnectDialog = (platformName: string) => {
    setActivePlatform(platformName);
    setTokenInput("");
  };

  const getPlatformLinks = (platform: string | null) => {
    switch (platform) {
      case 'metaAds':
        return {
          tokenUrl: "https://developers.facebook.com/apps/",
          videoUrl: "https://www.youtube.com/results?search_query=como+generar+token+de+acceso+api+meta+ads"
        };
      case 'googleAds':
        return {
          tokenUrl: "https://ads.google.com/aw/apicenter",
          videoUrl: "https://www.youtube.com/results?search_query=como+generar+developer+token+google+ads"
        };
      default: return null;
    }
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
            {integrations?.metaAds?.connected ? (
              <>
                <div className="bg-green-50 p-4 rounded-md text-sm text-green-800 flex items-center">
                  <CheckCircle2 className="w-5 h-5 mr-2 text-green-600" />
                  Cuenta publicitaria vinculada correctamente.
                </div>
                <Button variant="ghost" className="w-full text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleDisconnect("metaAds")}>
                  <Unlink className="w-4 h-4 mr-2" /> Desvincular Meta Ads
                </Button>
              </>
            ) : (
              <>
                <div className="bg-slate-50 p-4 rounded-md text-sm text-slate-500">
                  Para lanzar campañas automáticamente, provee tu Access Token de sistema.
                </div>
                <Button className="w-full bg-[#1877F2] hover:bg-[#1877F2]/90" onClick={() => openConnectDialog("metaAds")}>
                  <LinkIcon className="w-4 h-4 mr-2" /> Vincular Meta Ads
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-[#DB4437]">Google Ads</CardTitle>
            <CardDescription>Aparece en los primeros resultados de búsqueda.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {integrations?.googleAds?.connected ? (
              <>
                <div className="bg-green-50 p-4 rounded-md text-sm text-green-800 flex items-center">
                  <CheckCircle2 className="w-5 h-5 mr-2 text-green-600" />
                  Cuenta de Google Ads vinculada correctamente.
                </div>
                <Button variant="ghost" className="w-full text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleDisconnect("googleAds")}>
                  <Unlink className="w-4 h-4 mr-2" /> Desvincular Google Ads
                </Button>
              </>
            ) : (
              <>
                <div className="bg-slate-50 p-4 rounded-md text-sm text-slate-500">
                  Campañas de red de búsqueda para captación de propiedades. Require Developer Token.
                </div>
                <Button className="w-full bg-[#DB4437] hover:bg-[#DB4437]/90" onClick={() => openConnectDialog("googleAds")}>
                  <LinkIcon className="w-4 h-4 mr-2" /> Vincular Google Ads
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!activePlatform} onOpenChange={(open) => !open && setActivePlatform(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vincular {activePlatform === 'metaAds' ? 'Meta Ads' : 'Google Ads'}</DialogTitle>
            <DialogDescription>
              Ingresa el token de acceso para permitir que el sistema cree campañas y lea métricas desde tu cuenta de {activePlatform === 'metaAds' ? 'Meta Ads' : 'Google Ads'}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Token de Acceso (Access Token)</Label>
              <Input 
                type="password" 
                placeholder="Ingresa tu token de API..." 
                value={tokenInput} 
                onChange={(e) => setTokenInput(e.target.value)} 
              />
              <p className="text-xs text-slate-500">
                Asegurate de que el token contenga los permisos de lectura y escritura de campañas publicitarias.
              </p>
            </div>
            
            {activePlatform && (
              <div className="flex flex-col gap-3 mt-4 text-sm bg-slate-50 p-4 rounded-lg border border-slate-100">
                <p className="font-medium text-slate-700">¿Necesitas ayuda para obtener tu token?</p>
                <a 
                  href={getPlatformLinks(activePlatform)?.tokenUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" /> Ir a la página para obtener credenciales
                </a>
                <a 
                  href={getPlatformLinks(activePlatform)?.videoUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-red-600 hover:text-red-800 hover:underline flex items-center gap-2"
                >
                  <PlayCircle className="w-4 h-4" /> Ver video instructivo paso a paso
                </a>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActivePlatform(null)} disabled={isSaving}>Cancelar</Button>
            <Button onClick={handleConnect} disabled={isSaving || !tokenInput.trim()}>
              {isSaving ? "Guardando..." : "Conectar Cuenta publicitaria"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
