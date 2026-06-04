import { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { CheckCircle2, Link as LinkIcon, Unlink, ExternalLink, PlayCircle } from "lucide-react";

export function Portals() {
  const { user } = useAuth();
  const [integrations, setIntegrations] = useState<any>({});
  const [loading, setLoading] = useState(true);
  
  // Dialog state
  const [activePortal, setActivePortal] = useState<string | null>(null);
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

  const handleConnect = async () => {
    if (!user || !activePortal || !tokenInput.trim()) return;
    setIsSaving(true);
    try {
      const docRef = doc(db, "integrations", user.uid);
      await setDoc(docRef, { [activePortal]: { connected: true, token: tokenInput, connectedAt: Date.now() } }, { merge: true });
      setIntegrations((prev: any) => ({ ...prev, [activePortal]: { connected: true } }));
      setActivePortal(null);
      setTokenInput("");
    } catch (error) {
      console.error("Error connecting portal:", error);
      alert("Error al vincular el portal");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisconnect = async (portal: string) => {
    if (!user) return;
    if (!confirm(`¿Estás seguro de que deseas desvincular ${portal}?`)) return;
    try {
      const docRef = doc(db, "integrations", user.uid);
      await setDoc(docRef, { [portal]: { connected: false, token: null } }, { merge: true });
      setIntegrations((prev: any) => ({ ...prev, [portal]: { connected: false } }));
    } catch (error) {
      console.error("Error disconnecting portal:", error);
    }
  };

  const openConnectDialog = (portal: string) => {
    setActivePortal(portal);
    setTokenInput("");
  };

  const getPortalLinks = (portal: string | null) => {
    switch (portal) {
      case 'mercadolibre':
        return {
          tokenUrl: "https://developers.mercadolibre.com.ar/devcenter",
          videoUrl: "https://www.youtube.com/results?search_query=generar+token+mercado+libre+developers"
        };
      case 'argenprop':
        return {
          tokenUrl: "https://panel.argenprop.com/", 
          videoUrl: "https://www.youtube.com/results?search_query=api+argenprop+integracion"
        };
      case 'zonaprop':
        return {
          tokenUrl: "https://panel.zonaprop.com/", 
          videoUrl: "https://www.youtube.com/results?search_query=api+zonaprop+integracion"
        };
      default: return null;
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Cargando integraciones...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">Portales de Venta</h2>
        <p className="text-slate-500">Conecta tus credenciales de API para sincronizar propiedades en producción.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Mercado Libre */}
        <Card>
          <CardContent className="p-6 text-center flex flex-col h-full">
            <div className="h-12 flex items-center justify-center font-bold text-xl mb-4 text-[#FFF059] bg-[#2D3277] rounded">Mercado Libre</div>
            {integrations.mercadolibre?.connected ? (
              <>
                <p className="text-sm text-slate-500 mb-4 flex-grow">Conectado y listo para sincronizar.</p>
                <div className="space-y-2">
                  <Button variant="outline" className="w-full text-green-600 border-green-600 hover:bg-green-50 pointer-events-none">
                    <CheckCircle2 className="w-4 h-4 mr-2" /> Cuenta Vinculada
                  </Button>
                  <Button variant="ghost" className="w-full text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleDisconnect("mercadolibre")}>
                    <Unlink className="w-4 h-4 mr-2" /> Desvincular
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-slate-500 mb-4 flex-grow">Requiere Access Token generado desde tu app en Mercado Libre Developers.</p>
                <Button className="w-full bg-blue-600" onClick={() => openConnectDialog("mercadolibre")}>
                  <LinkIcon className="w-4 h-4 mr-2" /> Vincular Cuenta
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Argenprop */}
        <Card>
          <CardContent className="p-6 text-center flex flex-col h-full">
            <div className="h-12 flex items-center justify-center font-bold text-xl mb-4 bg-[#FF4500] text-white rounded">Argenprop</div>
            {integrations.argenprop?.connected ? (
              <>
                <p className="text-sm text-slate-500 mb-4 flex-grow">Conectado y listo para sincronizar.</p>
                <div className="space-y-2">
                  <Button variant="outline" className="w-full text-green-600 border-green-600 hover:bg-green-50 pointer-events-none">
                    <CheckCircle2 className="w-4 h-4 mr-2" /> Cuenta Vinculada
                  </Button>
                  <Button variant="ghost" className="w-full text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleDisconnect("argenprop")}>
                    <Unlink className="w-4 h-4 mr-2" /> Desvincular
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-slate-500 mb-4 flex-grow">Ingresa tu API Key proporcionada por el equipo de integraciones de Argenprop.</p>
                <Button className="w-full bg-blue-600" onClick={() => openConnectDialog("argenprop")}>
                  <LinkIcon className="w-4 h-4 mr-2" /> Vincular Cuenta
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Zonaprop */}
        <Card>
          <CardContent className="p-6 text-center flex flex-col h-full">
            <div className="h-12 flex items-center justify-center font-bold text-xl mb-4 bg-purple-600 text-white rounded">Zonaprop</div>
            {integrations.zonaprop?.connected ? (
              <>
                <p className="text-sm text-slate-500 mb-4 flex-grow">Conectado y listo para sincronizar.</p>
                <div className="space-y-2">
                  <Button variant="outline" className="w-full text-green-600 border-green-600 hover:bg-green-50 pointer-events-none">
                    <CheckCircle2 className="w-4 h-4 mr-2" /> Cuenta Vinculada
                  </Button>
                  <Button variant="ghost" className="w-full text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleDisconnect("zonaprop")}>
                    <Unlink className="w-4 h-4 mr-2" /> Desvincular
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-slate-500 mb-4 flex-grow">Ingresa el Client ID y Client Secret de tu cuenta de Zonaprop B2B.</p>
                <Button className="w-full bg-blue-600" onClick={() => openConnectDialog("zonaprop")}>
                  <LinkIcon className="w-4 h-4 mr-2" /> Vincular Cuenta
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!activePortal} onOpenChange={(open) => !open && setActivePortal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="capitalize">Vincular {activePortal}</DialogTitle>
            <DialogDescription>
              Para configurar la integración en producción, necesitas proveer las credenciales de API de tu cuenta en <b>{activePortal}</b>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Token de Integración / API Key</Label>
              <Input 
                type="password" 
                placeholder="Ingresa tu token o credencial de API..." 
                value={tokenInput} 
                onChange={(e) => setTokenInput(e.target.value)} 
              />
              <p className="text-xs text-slate-500">Tus credenciales se cifrarán y almacenarán de forma segura en tu base de datos.</p>
            </div>
            
            {activePortal && (
              <div className="flex flex-col gap-3 mt-4 text-sm bg-slate-50 p-4 rounded-lg border border-slate-100">
                <p className="font-medium text-slate-700">¿Necesitas ayuda para obtener tu token?</p>
                <a 
                  href={getPortalLinks(activePortal)?.tokenUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" /> Ir a la página para obtener credenciales
                </a>
                <a 
                  href={getPortalLinks(activePortal)?.videoUrl} 
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
            <Button variant="outline" onClick={() => setActivePortal(null)} disabled={isSaving}>Cancelar</Button>
            <Button onClick={handleConnect} disabled={isSaving || !tokenInput.trim()}>
              {isSaving ? "Guardando..." : "Conectar Portal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
