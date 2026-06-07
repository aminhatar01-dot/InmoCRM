import React, { useEffect, useState } from "react";
import { Building2, Mail, MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, addDoc, onSnapshot } from "firebase/firestore";
import { Property, ClientType, ClientStatus } from "@/src/types";

export function Explore() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [filteredProperties, setFilteredProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  const [openContact, setOpenContact] = useState(false);
  const [contactProperty, setContactProperty] = useState<Property | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!db) return;

    // Fetch ALL visible properties
    const q = query(collection(db, "properties"), where("status", "==", "disponible"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const propsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Property[];
      
      setProperties(propsData);
      setFilteredProperties(propsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching all properties", error);
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Basic search filtering
    if (!searchTerm) {
      setFilteredProperties(properties);
    } else {
      const lowerSearch = searchTerm.toLowerCase();
      const filtered = properties.filter(p => 
        p.title.toLowerCase().includes(lowerSearch) || 
        p.address.toLowerCase().includes(lowerSearch) ||
        (p.city && p.city.toLowerCase().includes(lowerSearch))
      );
      setFilteredProperties(filtered);
    }
  }, [searchTerm, properties]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactProperty || !db || !name || !email) return;

    setSubmitting(true);
    try {
      await addDoc(collection(db, "clients"), {
        name,
        email,
        phone,
        notes: `Consulta desde el explorador general por propiedad: ${contactProperty.title}.\n\nMensaje: ${notes}`,
        agentId: contactProperty.agentId,
        type: "lead" as ClientType,
        status: "nuevo" as ClientStatus,
        createdAt: Date.now()
      });
      
      setSuccess(true);
      setTimeout(() => {
        setOpenContact(false);
        setSuccess(false);
        setContactProperty(null);
        setName("");
        setEmail("");
        setPhone("");
        setNotes("");
      }, 2000);
    } catch (err) {
      console.error("Error saving lead", err);
      alert("Hubo un error al enviar tu consulta. Por favor, intenta de nuevo.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenContact = (prop: Property) => {
    setContactProperty(prop);
    setNotes(`Me interesa consultar por la propiedad: ${prop.title}`);
    setOpenContact(true);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-600 font-bold text-xl cursor-default">
            <Building2 className="w-6 h-6" />
            InmoCRM <span className="font-light text-slate-400">| Explorador</span>
          </div>
          
          <div className="hidden sm:flex items-center relative w-64 md:w-96">
            <Search className="w-4 h-4 absolute left-3 text-slate-400" />
            <Input 
              placeholder="Buscar por ciudad, título, dirección..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-slate-50 border-slate-200"
            />
          </div>
          
          <div>
            <Button variant="outline" className="border-indigo-200 text-indigo-700 hover:bg-indigo-50" onClick={() => window.location.href = "/"}>
               Acceso Agentes
            </Button>
          </div>
        </div>
      </header>
      
      <main className="max-w-6xl mx-auto px-4 py-8">
        
        {/* Mobile search bar */}
        <div className="flex sm:hidden items-center relative mb-6 w-full">
          <Search className="w-4 h-4 absolute left-3 text-slate-400" />
          <Input 
            placeholder="Buscar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-white"
          />
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Propiedades Disponibles</h1>
          <p className="text-slate-500 mt-2">Encuentra tu próximo hogar entre las mejores opciones de nuestras inmobiliarias asociadas.</p>
        </div>
        
        {loading ? (
          <div className="text-center py-12 text-slate-500">Cargando catálogo...</div>
        ) : filteredProperties.length === 0 ? (
          <div className="text-center py-16 px-4 bg-white border border-slate-200 rounded-xl">
             <div className="mx-auto w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
               <Search className="w-8 h-8 text-slate-400" />
             </div>
             <h3 className="text-xl font-bold text-slate-700 mb-2">No encontramos propiedades</h3>
             <p className="text-slate-500">Prueba ajustando tu búsqueda o intenta más tarde.</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredProperties.map((prop) => (
              <Card key={prop.id} className="overflow-hidden hover:shadow-lg transition-shadow border-slate-100 group">
                <div className="h-48 bg-slate-200 flex items-center justify-center text-slate-400 text-sm overflow-hidden relative">
                   {prop.images && prop.images.length > 0 ? (
                     <img src={prop.images[0]} alt={prop.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                   ) : (
                     <iframe
                       title="Mapa"
                       className="w-full h-full border-0"
                       referrerPolicy="no-referrer-when-downgrade"
                       src={`https://maps.google.com/maps?q=${encodeURIComponent(prop.address + (prop.city ? ', ' + prop.city : ''))}&z=14&output=embed`}
                     />
                   )}
                   <Badge className="absolute top-3 left-3 shadow-md capitalize bg-blue-600 hover:bg-blue-700">
                     {prop.type}
                   </Badge>
                </div>
                <CardContent className="p-5">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-extrabold text-2xl text-slate-900">${prop.price.toLocaleString()}</span>
                    <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-600 font-medium">USD</span>
                  </div>
                  <h3 className="font-semibold text-slate-800 mb-3 line-clamp-1">{prop.title}</h3>
                  
                  <div className="flex text-sm text-slate-500 gap-4 mb-4">
                     <span title="Habitaciones">{prop.bedrooms || "-"} Hab</span>
                     <span title="Baños">{prop.bathrooms || "-"} Ba</span>
                     <span title="Metros Cuadrados">{prop.areaSqM || "-"} m²</span>
                  </div>

                  <div className="flex items-center text-xs text-slate-500 mb-6">
                    <MapPin className="w-3 h-3 mr-1" />
                    <span className="truncate">{prop.address} {prop.city && `, ${prop.city}`}</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 mt-auto">
                    <Button 
                      className="w-full bg-slate-900 hover:bg-slate-800" 
                      onClick={() => window.open(`/property/${prop.id}`, '_blank')}
                    >
                      Ver Detalle
                    </Button>
                    <Button 
                      variant="outline"
                      className="w-full border-indigo-200 text-indigo-700 hover:bg-indigo-50" 
                      onClick={() => handleOpenContact(prop)}
                    >
                      Contactar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

      </main>

      {/* Global Contact Modal */}
      <Dialog open={openContact} onOpenChange={setOpenContact}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Contactar al Agente</DialogTitle>
            <DialogDescription>
              {contactProperty && `Interés por: ${contactProperty.title}`}
            </DialogDescription>
          </DialogHeader>
          
          {success ? (
            <div className="p-4 bg-green-50 text-green-700 rounded-md text-center py-8">
              <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <Building2 className="w-6 h-6 text-green-600" />
              </div>
              <p className="font-bold">¡Mensaje enviado correctamente!</p>
              <p className="text-sm mt-2">El agente encargado de esta propiedad se contactará pronto.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nombre completo</label>
                <Input required value={name} onChange={e => setName(e.target.value)} placeholder="Ej. Juan Pérez" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <Input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="juan@email.com" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Teléfono</label>
                <Input required value={phone} onChange={e => setPhone(e.target.value)} placeholder="+54 9 11 1234-5678" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Consulta</label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} className="min-h-[100px]" />
              </div>
              <Button type="submit" disabled={submitting} className="w-full bg-indigo-600 hover:bg-indigo-700">
                {submitting ? "Enviando..." : "Enviar Mensaje"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}