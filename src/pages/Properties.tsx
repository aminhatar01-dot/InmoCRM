import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Search, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { APIProvider, Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';
import { db } from "@/lib/firebase";
import { collection, addDoc, getDocs, onSnapshot, query, where } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { Property, PropertyStatus, PropertyType } from "@/src/types";

const API_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  '';
const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

export function Properties() {
  const { user } = useAuth();
  const [addingProperty, setAddingProperty] = useState(false);
  const [selPos, setSelPos] = useState({ lat: -34.588, lng: -58.431 });
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [address, setAddress] = useState("");

  useEffect(() => {
    if (!user || (!db)) return;
    
    setLoading(true);
    const q = query(collection(db, "properties"), where("agentId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const propsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Property[];
      setProperties(propsData);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleSave = async () => {
    if (!user || !title || !price || !db) return;
    
    try {
      await addDoc(collection(db, "properties"), {
        title,
        price: Number(price),
        address,
        lat: selPos.lat,
        lng: selPos.lng,
        agentId: user.uid,
        status: "disponible" as PropertyStatus,
        type: "casa" as PropertyType,
        currency: "USD",
        images: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      setAddingProperty(false);
      setTitle("");
      setPrice("");
      setAddress("");
    } catch (e) {
      console.error("Error adding property", e);
      alert("Error al guardar la propiedad");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Propiedades</h2>
          <p className="text-slate-500">Gestiona tu cartera de inmuebles.</p>
        </div>
        
        <Dialog open={addingProperty} onOpenChange={setAddingProperty}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              Nueva Propiedad
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] overflow-y-auto max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Nueva Propiedad</DialogTitle>
              <DialogDescription>
                Ingresa los datos y marca la ubicación en el mapa.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Título</label>
                  <Input placeholder="Ej. Casa en Palermo" value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Precio (USD)</label>
                  <Input type="number" placeholder="250000" value={price} onChange={(e) => setPrice(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Dirección</label>
                <Input placeholder="Av. Libertador 1234" value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>

              <div className="space-y-2 relative">
                <label className="text-sm font-medium">Geolocalización</label>
                {!hasValidKey ? (
                  <div className="h-48 bg-slate-100 flex items-center justify-center rounded border p-4 text-center text-sm text-slate-500">
                    Añade GOOGLE_MAPS_PLATFORM_KEY en los secretos para activar la geolocalización.
                  </div>
                ) : (
                  <div className="h-48 rounded border overflow-hidden">
                    <APIProvider apiKey={API_KEY} version="weekly">
                      <Map
                        defaultCenter={selPos}
                        defaultZoom={14}
                        mapId="MAP_ADD_PROPERTY"
                        internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                        style={{ width: '100%', height: '100%' }}
                        onClick={(e) => {
                          if (e.detail.latLng) {
                            setSelPos({ lat: e.detail.latLng.lat, lng: e.detail.latLng.lng });
                          }
                        }}
                      >
                        <AdvancedMarker position={selPos}>
                          <Pin background="#2563eb" glyphColor="#fff" />
                        </AdvancedMarker>
                      </Map>
                    </APIProvider>
                  </div>
                )}
              </div>

              <Button onClick={handleSave} className="w-full bg-blue-600">
                Guardar Propiedad
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder="Buscar por código, zona o título..." className="pl-10" />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500">Cargando propiedades...</div>
      ) : properties.length === 0 ? (
        <div className="text-center py-12 text-slate-500 border-2 border-dashed rounded-lg">
          No tienes propiedades registradas aún. ¡Añade tu primera propiedad!
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {properties.map((prop) => (
            <Card key={prop.id} className="overflow-hidden">
              <div className="h-48 bg-slate-200 flex items-center justify-center text-slate-400 text-sm">Sin imagen</div>
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <Badge variant={prop.status === "disponible" ? "default" : "secondary"} className={prop.status === "disponible" ? "bg-blue-600" : ""}>
                    {prop.status.toUpperCase()}
                  </Badge>
                  <span className="font-bold text-lg">${prop.price.toLocaleString()}</span>
                </div>
                <h3 className="font-medium text-slate-900 mb-1">{prop.title}</h3>
                <p className="text-sm text-slate-500 capitalize">{prop.type}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
