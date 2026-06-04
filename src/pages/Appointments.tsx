import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, orderBy } from "firebase/firestore";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Calendar as CalendarIcon, Clock, Trash2 } from "lucide-react";

interface Appointment {
  id: string;
  clientId: string;
  propertyId: string;
  agentId: string;
  date: string;
  status: "pendiente" | "completada" | "cancelada";
  notes: string;
}

interface Client {
  id: string;
  name: string;
}

interface Property {
  id: string;
  title: string;
}

export function Appointments() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [clientId, setClientId] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    try {
      // Fetch clients
      const clientsQ = query(collection(db, "clients"), where("agentId", "==", user.uid));
      const clientsSnapshot = await getDocs(clientsQ);
      const clientsData = clientsSnapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name }));
      setClients(clientsData);

      // Fetch properties
      const propertiesQ = query(collection(db, "properties"), where("agentId", "==", user.uid));
      const propertiesSnapshot = await getDocs(propertiesQ);
      const propertiesData = propertiesSnapshot.docs.map(doc => ({ id: doc.id, title: doc.data().title }));
      setProperties(propertiesData);

      // Fetch appointments
      const apptsQ = query(collection(db, "appointments"), where("agentId", "==", user.uid)); 
      const apptsSnapshot = await getDocs(apptsQ);
      const apptsData = apptsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment));
      
      // Sort manually
      apptsData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      setAppointments(apptsData);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  const handleOpenDialog = (appt?: Appointment) => {
    if (appt) {
      setEditingId(appt.id);
      setClientId(appt.clientId);
      setPropertyId(appt.propertyId || "none");
      
      const apptDate = new Date(appt.date);
      // Format as YYYY-MM-DD
      setDate(apptDate.toISOString().split('T')[0]);
      // Format as HH:MM
      setTime(apptDate.toTimeString().substring(0, 5));
      setNotes(appt.notes || "");
    } else {
      setEditingId(null);
      setClientId("");
      setPropertyId("");
      setDate("");
      setTime("");
      setNotes("");
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!user || !clientId || !date || !time) return;
    setIsLoading(true);
    try {
      const dateTime = new Date(`${date}T${time}`).toISOString();
      const payload = {
        agentId: user.uid,
        clientId,
        propertyId: propertyId === "none" ? "" : propertyId,
        date: dateTime,
        notes,
        ...(editingId ? {} : { status: "pendiente" as const }),
      };

      if (editingId) {
        await updateDoc(doc(db, "appointments", editingId), payload);
      } else {
        await addDoc(collection(db, "appointments"), payload);
      }
      
      setIsDialogOpen(false);
      fetchData();
    } catch (err) {
      console.error("Error saving appointment", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: "pendiente" | "completada" | "cancelada") => {
    try {
      await updateDoc(doc(db, "appointments", id), { status: newStatus });
      fetchData();
    } catch (err) {
      console.error("Error updating status", err);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("¿Estás seguro de que deseas eliminar esta cita?")) {
      try {
        await deleteDoc(doc(db, "appointments", id));
        fetchData();
      } catch (err) {
        console.error("Error deleting appointment", err);
      }
    }
  };

  const getClientName = (id: string) => clients.find(c => c.id === id)?.name || "Cliente Desconocido";
  const getPropertyTitle = (id: string) => {
    if (!id || id === "none") return "Reunión";
    return `Visita: ${properties.find(p => p.id === id)?.title || "Propiedad"}`;
  };

  const formatMonth = (isoStr: string) => {
    const d = new Date(isoStr);
    return d.toLocaleString('es-ES', { month: 'short' });
  };
  
  const formatDay = (isoStr: string) => {
    const d = new Date(isoStr);
    return d.getDate();
  };

  const formatTimeRange = (isoStr: string) => {
    const d = new Date(isoStr);
    const end = new Date(d.getTime() + 60 * 60 * 1000); // 1 hr diff
    const tFormat = (dateObj: Date) => dateObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    return `${tFormat(d)} - ${tFormat(end)} hs`;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Citas y Agenda</h2>
          <p className="text-slate-500">Gestiona tus visitas a propiedades y reuniones.</p>
        </div>
        <Button className="bg-blue-600" onClick={() => handleOpenDialog()}>
          <Plus className="w-4 h-4 mr-2" />
          Nueva Cita
        </Button>
      </div>

      <div className="grid gap-4">
        {appointments.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            No tienes citas agendadas. Crea una nueva cita para comenzar.
          </div>
        ) : (
          appointments.map(appt => (
            <Card key={appt.id} className={appt.status === 'completada' ? 'opacity-60 bg-slate-50' : ''}>
              <CardContent className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-start md:items-center gap-4">
                  <div className={`p-3 rounded-lg flex flex-col items-center justify-center min-w-[4rem] ${appt.status === 'completada' ? 'bg-slate-200 text-slate-600' : 'bg-blue-100 text-blue-700'}`}>
                    <span className="text-sm font-bold uppercase">{formatMonth(appt.date)}</span>
                    <span className="text-2xl font-black">{formatDay(appt.date)}</span>
                  </div>
                  <div>
                    <h3 className={`font-bold text-lg ${appt.status === 'completada' ? 'line-through text-slate-500' : ''}`}>
                      {getPropertyTitle(appt.propertyId)}
                    </h3>
                    <div className="flex flex-wrap items-center gap-4 text-slate-500 text-sm mt-1">
                      <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {formatTimeRange(appt.date)}</span>
                      <span className="flex items-center gap-1"><CalendarIcon className="w-4 h-4" /> {getClientName(appt.clientId)}</span>
                      {appt.status === 'pendiente' && <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full text-xs font-medium tracking-wide">Pendiente</span>}
                      {appt.status === 'completada' && <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full text-xs font-medium tracking-wide">Completada</span>}
                    </div>
                    {appt.notes && (
                      <p className="text-sm text-slate-600 mt-2 italic">"{appt.notes}"</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button variant="ghost" size="sm" onClick={() => handleOpenDialog(appt)}>
                    Editar
                  </Button>
                  {appt.status !== 'completada' && (
                    <Button variant="outline" size="sm" onClick={() => handleStatusChange(appt.id, 'completada')}>
                      Completar
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50 p-2" onClick={() => handleDelete(appt.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Cita" : "Nueva Cita"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar cliente..." />
                </SelectTrigger>
                <SelectContent>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Propiedad (Opcional)</Label>
              <Select value={propertyId} onValueChange={setPropertyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar propiedad o reunión..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Reunión general (Sin propiedad)</SelectItem>
                  {properties.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fecha</Label>
                <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Hora</Label>
                <Input type="time" value={time} onChange={e => setTime(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notas (Opcional)</Label>
              <Textarea placeholder="Detalles de la visita..." value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={isLoading || !clientId || !date || !time}>
              {isLoading ? "Guardando..." : "Guardar Cita"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
