import React, { useEffect, useState } from "react";
import { Building2, Mail, Phone, MapPin, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "@/lib/firebase";
import { doc, getDoc, addDoc, collection } from "firebase/firestore";
import { Property, ClientType, ClientStatus } from "@/src/types";

export function PropertyDetail() {
  const { propertyId } = useParams();
  const navigate = useNavigate();
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [openContact, setOpenContact] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!propertyId || !db) return;

    const fetchProperty = async () => {
      try {
        const docRef = doc(db, "properties", propertyId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setProperty({ id: docSnap.id, ...docSnap.data() } as Property);
        } else {
          setError("La propiedad no existe o fue eliminada.");
        }
      } catch (err) {
        console.error("Error fetching property", err);
        setError("Error al cargar la propiedad.");
      } finally {
        setLoading(false);
      }
    };
    
    fetchProperty();
  }, [propertyId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!property || !db || !name || !email) return;

    setSubmitting(true);
    try {
      await addDoc(collection(db, "clients"), {
        name,
        email,
        phone,
        notes: `Consulta por la propiedad: ${property.title}.\n\nMensaje: ${notes}`,
        agentId: property.agentId,
        type: "lead" as ClientType,
        status: "nuevo" as ClientStatus,
        createdAt: Date.now()
      });
      setSuccess(true);
      setTimeout(() => {
        setOpenContact(false);
        setSuccess(false);
        setName("");
        setEmail("");
        setPhone("");
        setNotes("");
      }, 2000);
    } catch (err) {
      console.error("Error saving lead", err);
      alert("Hubo un error al enviar tu consulta. Por favor, intenta nuevamente.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="text-center py-12 text-slate-500">Cargando propiedad...</div>;
  if (error || !property) return <div className="text-center py-12 text-red-500 font-medium">{error}</div>;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl cursor-pointer" onClick={() => navigate(`/portfolio/${property.agentId}`)}>
            <ArrowLeft className="w-5 h-5 text-slate-500 hover:text-slate-900" />
            <span className="text-blue-600">
              <Building2 className="w-5 h-5 inline-block mr-2 pb-1" />
              Ver Portfolio del Agente
            </span>
          </div>
          <div className="flex gap-2">
            <Dialog open={openContact} onOpenChange={setOpenContact}>
              <DialogTrigger render={<Button className="bg-blue-600 hover:bg-blue-700" />}>
                <Mail className="w-4 h-4 mr-2"/> Contactar Agente
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Contacto Directo</DialogTitle>
                  <DialogDescription>
                    Envía un mensaje para solicitar más información sobre esta propiedad o agendar una cita.
                  </DialogDescription>
                </DialogHeader>
                {success ? (
                  <div className="p-4 bg-green-50 text-green-700 rounded-md text-center">
                    ¡Gracias por tu mensaje! El agente se pondrá en contacto pronto.
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
                      <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Me interesa agendar una visita..." />
                    </div>
                    <Button type="submit" disabled={submitting} className="w-full bg-blue-600">
                      {submitting ? "Enviando..." : "Enviar Mensaje"}
                    </Button>
                  </form>
                )}
              </DialogContent>
            </Dialog>
            
          </div>
        </div>
      </header>
      
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-4">
          <div className="flex gap-2 text-sm text-slate-500 mb-2">
            <span className="capitalize">{property.type}</span>
            <span>•</span>
            <span className="capitalize">{property.status}</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">{property.title}</h1>
          <p className="text-xl font-semibold text-slate-700">${property.price.toLocaleString()} {property.currency}</p>
          <div className="flex items-center text-slate-500 mt-2">
            <MapPin className="w-4 h-4 mr-1" />
            <span>{property.address} {property.city && `, ${property.city}`}</span>
          </div>
        </div>
        
        <div className="h-64 sm:h-96 w-full bg-slate-200 rounded-xl mb-8 flex items-center justify-center text-slate-400">
           Sin imagen cargada
        </div>
        
        <div className="grid gap-8 md:grid-cols-3">
          <div className="md:col-span-2 space-y-8">
            <section>
              <h2 className="text-xl font-bold mb-4">Descripción</h2>
              <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm whitespace-pre-line text-slate-700 leading-relaxed">
                {property.description || "Esta propiedad no tiene una descripción detallada."}
              </div>
            </section>
          </div>
          
          <div className="space-y-6">
            <Card className="border-slate-100 shadow-sm">
              <CardContent className="p-6">
                <h3 className="font-bold text-lg mb-4 text-slate-900">Características Principales</h3>
                <ul className="space-y-4 text-slate-600">
                  <li className="flex justify-between border-b pb-2">
                    <span className="font-medium">Habitaciones:</span>
                    <span>{property.bedrooms || "-"}</span>
                  </li>
                  <li className="flex justify-between border-b pb-2">
                    <span className="font-medium">Baños:</span>
                    <span>{property.bathrooms || "-"}</span>
                  </li>
                  <li className="flex justify-between pb-2">
                    <span className="font-medium">Área total:</span>
                    <span>{property.areaSqM ? `${property.areaSqM} m²` : "-"}</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
            
            <Card className="border-slate-100 shadow-sm bg-blue-50/50">
              <CardContent className="p-6 text-center">
                 <h3 className="font-bold text-lg mb-2 text-slate-900">¿Dudas sobre esta propiedad?</h3>
                 <p className="text-sm text-slate-600 mb-4">Ponte en contacto directo con el agente a cargo de la venta.</p>
                 <Button onClick={() => setOpenContact(true)} className="w-full bg-blue-600 hover:bg-blue-700 shadow-sm">
                   Contactar Agente
                 </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
