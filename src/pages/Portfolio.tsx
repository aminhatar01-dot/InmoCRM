import React, { useEffect, useState } from "react";
import { Building2, Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useParams } from "react-router-dom";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, addDoc, onSnapshot } from "firebase/firestore";
import { Property, ClientType, ClientStatus } from "@/src/types";

export function Portfolio() {
  const { agentId } = useParams();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [openContact, setOpenContact] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!agentId || !db) return;

    const q = query(collection(db, "properties"), where("agentId", "==", agentId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const propsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Property[];
      setProperties(propsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching portfolio properties", error);
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, [agentId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentId || !db || !name || !email) return;

    setSubmitting(true);
    try {
      await addDoc(collection(db, "clients"), {
        name,
        email,
        phone,
        notes: `Consulta desde el portfolio digital.\n\nMensaje: ${notes}`,
        agentId,
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

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-blue-600 font-bold text-xl">
            <Building2 className="w-6 h-6" />
            Portafolio del Agente
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm"><Phone className="w-4 h-4 mr-2"/> Contactar</Button>
            
            <Dialog open={openContact} onOpenChange={setOpenContact}>
              <DialogTrigger render={<Button size="sm" />}>
                <Mail className="w-4 h-4 mr-2"/> Enviar Mensaje
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Contacto Directo</DialogTitle>
                  <DialogDescription>
                    Envía un mensaje para solicitar más información o agendar una cita.
                  </DialogDescription>
                </DialogHeader>
                {success ? (
                  <div className="p-4 bg-green-50 text-green-700 rounded-md text-center">
                    ¡Gracias por tu mensaje! Me pondré en contacto contigo pronto.
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
                      <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Quisiera más información sobre..." />
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
      
      <main className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Mis Propiedades Destacadas</h1>
        
        {loading ? (
          <div className="text-center py-12 text-slate-500">Cargando propiedades...</div>
        ) : properties.length === 0 ? (
          <div className="text-center py-12 text-slate-500 border-2 border-dashed rounded-lg bg-white">
            El agente aún no tiene propiedades en su portafolio.
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {properties.map((prop) => (
              <Card key={prop.id} className="overflow-hidden">
                <div className="h-48 bg-slate-200 flex items-center justify-center text-slate-400 text-sm">Sin imagen</div>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <Badge variant="default" className={prop.status === "disponible" ? "bg-blue-600" : "bg-slate-500"}>
                      {prop.status.toUpperCase()}
                    </Badge>
                    <span className="font-bold text-lg">${prop.price.toLocaleString()}</span>
                  </div>
                  <h3 className="font-medium text-slate-900 mb-1">{prop.title}</h3>
                  <p className="text-sm text-slate-500 capitalize">{prop.type}</p>
                  
                  <div className="flex gap-2 mt-4">
                    <Button 
                      className="flex-1 bg-slate-900" 
                      onClick={() => window.open(`/property/${prop.id}`, '_blank')}
                    >
                      Ver Detalle
                    </Button>
                    <Button 
                      variant="outline"
                      className="flex-1" 
                      onClick={() => {
                        setNotes(`Me interesa consultar por la propiedad: ${prop.title}`);
                        setOpenContact(true);
                      }}
                    >
                      Solicitar Info
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
