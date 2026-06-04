import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Search, MapPin, Share2, Edit2, Copy } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { db } from "@/lib/firebase";
import { collection, addDoc, getDocs, onSnapshot, query, where, updateDoc, doc } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { Property, PropertyStatus, PropertyType } from "@/src/types";

function PropertyForm({ isOpen, setIsOpen, onSave, initialData }: any) {
  const [title, setTitle] = useState(initialData?.title || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [price, setPrice] = useState(initialData?.price || "");
  const [address, setAddress] = useState(initialData?.address || "");
  const [city, setCity] = useState(initialData?.city || "");
  const [type, setType] = useState(initialData?.type || "casa");
  const [bedrooms, setBedrooms] = useState(initialData?.bedrooms || "");
  const [bathrooms, setBathrooms] = useState(initialData?.bathrooms || "");
  const [areaSqM, setAreaSqM] = useState(initialData?.areaSqM || "");

  const handleSaveData = async () => {
    let lat = initialData?.lat || 0;
    let lng = initialData?.lng || 0;

    if (address || city) {
      try {
        const q = encodeURIComponent(`${address}, ${city}`);
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${q}`);
        const data = await res.json();
        if (data && data.length > 0) {
          lat = parseFloat(data[0].lat);
          lng = parseFloat(data[0].lon);
        }
      } catch (e) {
        console.error("Geocoding failed", e);
      }
    }

    onSave({ 
      title, 
      description,
      price: Number(price), 
      address, 
      city, 
      type,
      bedrooms: Number(bedrooms),
      bathrooms: Number(bathrooms),
      areaSqM: Number(areaSqM),
      lat, 
      lng 
    });
  };

  return (
    <DialogContent className="sm:max-w-[700px] overflow-y-auto max-h-[90vh]">
      <DialogHeader>
        <DialogTitle>{initialData ? "Editar Propiedad" : "Nueva Propiedad"}</DialogTitle>
        <DialogDescription>
          {initialData ? "Modifica la ficha técnica y características del inmueble." : "Ingresa la ficha técnica. La ubicación se localizará automáticamente a partir de la dirección."}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Título de Publicación</label>
            <Input placeholder="Ej. Excelente Casa en Palermo" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Precio (USD)</label>
            <Input type="number" placeholder="250000" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Descripción de la Propiedad</label>
          <Textarea 
            placeholder="Describe los detalles, virtudes y características de la propiedad..." 
            value={description} 
            onChange={(e) => setDescription(e.target.value)}
            className="min-h-[100px]"
          />
        </div>
        
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Dirección Exacta</label>
            <Input 
              placeholder="Ej. Av Libertador 1234" 
              value={address} 
              onChange={(e) => setAddress(e.target.value)} 
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Ciudad / Localidad</label>
            <Input 
              placeholder="Ej. CABA, Argentina" 
              value={city} 
              onChange={(e) => setCity(e.target.value)} 
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <label className="text-sm font-medium">Habitaciones</label>
            <Input type="number" placeholder="3" value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Baños</label>
            <Input type="number" placeholder="2" value={bathrooms} onChange={(e) => setBathrooms(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Área (m²)</label>
            <Input type="number" placeholder="120" value={areaSqM} onChange={(e) => setAreaSqM(e.target.value)} />
          </div>
        </div>

        <Button onClick={handleSaveData} className="w-full bg-blue-600 hover:bg-blue-700">
          Guardar Propiedad
        </Button>
      </div>
    </DialogContent>
  );
}



export function Properties() {
  const { user } = useAuth();
  const [addingProperty, setAddingProperty] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

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

  const handleSaveExternal = async (propertyData: any) => {
    if (!user || (!db)) return;
    try {
      await addDoc(collection(db, "properties"), {
        ...propertyData,
        agentId: user.uid,
        status: "disponible",
        currency: "USD",
        images: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      setAddingProperty(false);
    } catch (e) {
      console.error("Error adding property", e);
      alert("Error al guardar la propiedad");
    }
  };

  const handleUpdateExternal = async (propertyData: any) => {
    if (!user || (!db) || !editingProperty) return;
    try {
      await updateDoc(doc(db, "properties", editingProperty.id), {
        title: propertyData.title,
        description: propertyData.description,
        price: propertyData.price,
        address: propertyData.address,
        city: propertyData.city || "",
        type: propertyData.type || "casa",
        bedrooms: propertyData.bedrooms || 0,
        bathrooms: propertyData.bathrooms || 0,
        areaSqM: propertyData.areaSqM || 0,
        lat: propertyData.lat,
        lng: propertyData.lng,
        updatedAt: Date.now()
      });
      setEditingProperty(null);
    } catch (e) {
      console.error("Error updating property", e);
      alert("Error al editar la propiedad");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Propiedades</h2>
          <p className="text-slate-500">Gestiona tu cartera de inmuebles.</p>
        </div>
        
        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={() => {
              const url = `${window.location.origin}/portfolio/${user?.uid}`;
              navigator.clipboard.writeText(url);
              alert("Link del Portfolio copiado al portapapeles:\n" + url);
            }}
          >
            <Share2 className="w-4 h-4 mr-2" />
            Compartir Portfolio
          </Button>
          <Dialog open={addingProperty} onOpenChange={setAddingProperty}>
            <DialogTrigger render={<Button className="bg-blue-600 hover:bg-blue-700" />}>
              <Plus className="w-4 h-4 mr-2" />
              Nueva Propiedad
            </DialogTrigger>
            {addingProperty && (
              <PropertyForm 
                isOpen={addingProperty} 
                setIsOpen={setAddingProperty} 
                onSave={handleSaveExternal} 
              />
            )}
          </Dialog>

        <Dialog open={!!editingProperty} onOpenChange={(open) => !open && setEditingProperty(null)}>
          {editingProperty && (
            <PropertyForm
              initialData={editingProperty}
              isOpen={!!editingProperty}
              setIsOpen={(v: boolean) => !v && setEditingProperty(null)}
              onSave={handleUpdateExternal}
            />
          )}
        </Dialog>
        </div>
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
                
                <div className="flex gap-2 w-full mt-4">
                  <Dialog>
                    <DialogTrigger render={<Button className="flex-1 bg-slate-900 hover:bg-slate-800 text-white" />}>
                      Ver Detalles
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[700px] overflow-y-auto max-h-[90vh]">
                      <DialogHeader>
                        <DialogTitle className="text-2xl">{prop.title}</DialogTitle>
                        <DialogDescription className="text-lg font-bold text-slate-900 mt-1">${prop.price.toLocaleString()} USD</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-6 mt-4">
                        {prop.description && (
                          <div>
                            <h4 className="font-semibold text-slate-900 mb-2">Descripción</h4>
                            <p className="text-sm text-slate-600 whitespace-pre-line">{prop.description}</p>
                          </div>
                        )}
                        
                        <div className="grid gap-4 md:grid-cols-2">
                          <div>
                            <h4 className="font-semibold text-slate-900 mb-2">Especificaciones</h4>
                            <ul className="space-y-2 text-sm text-slate-600">
                              <li><span className="font-medium text-slate-900">Dirección:</span> {prop.address} {prop.city && `, ${prop.city}`}</li>
                              <li><span className="font-medium text-slate-900">Habitaciones:</span> {prop.bedrooms || "-"}</li>
                              <li><span className="font-medium text-slate-900">Baños:</span> {prop.bathrooms || "-"}</li>
                              <li><span className="font-medium text-slate-900">Área:</span> {prop.areaSqM ? `${prop.areaSqM} m²` : "-"}</li>
                            </ul>
                          </div>
                          
                          <div className="bg-slate-50 p-4 rounded-md border flex flex-col justify-center">
                             <h4 className="font-semibold text-slate-900 mb-2">¿Te interesa?</h4>
                             <p className="text-sm text-slate-600 mb-4">Ponte en contacto con el agente responsable para más detalles.</p>
                             <div className="flex gap-2 w-full flex-wrap">
                               <Button 
                                onClick={() => window.open(`/property/${prop.id}`, '_blank')}
                                className="flex-1 bg-slate-900 hover:bg-slate-800 text-white shadow-sm"
                               >
                                 Ver Publicación
                               </Button>
                               <Button
                                 variant="outline"
                                 onClick={() => {
                                   const url = `${window.location.origin}/property/${prop.id}`;
                                   navigator.clipboard.writeText(url);
                                   alert("Link de la propiedad copiado:\n" + url);
                                 }}
                               >
                                 <Copy className="w-4 h-4" />
                               </Button>
                             </div>
                          </div>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                  
                  <Button variant="outline" className="flex-1 text-slate-600 hover:text-slate-900" onClick={() => setEditingProperty(prop)}>
                    <Edit2 className="w-4 h-4 mr-2" />
                    Editar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
