import React, { useState, useEffect, useRef } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageCircle, Mail, MoreHorizontal, ChevronDown, Upload, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";  
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import Papa from "papaparse";

interface WhatsAppTemplate {
  id: string;
  name: string;
  content: string;
}

export function Clients() {
  const { user } = useAuth();
  const [clients, setClients] = useState<any[]>([]);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [automations, setAutomations] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modal State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newClientName, setNewClientName] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [newClientInterest, setNewClientInterest] = useState("");
  const [newClientType, setNewClientType] = useState("Lead");
  const [newClientStatus, setNewClientStatus] = useState("nuevo");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    
    // Load Leads/Clients
    const q = query(collection(db, "clients"), where("agentId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: any[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() });
      });
      setClients(data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
    });

    // Load templates and automations
    const loadSecondaryData = async () => {
      try {
        const tq = query(collection(db, "whatsappTemplates"), where("agentId", "==", user.uid));
        const tSnapshot = await getDocs(tq);
        const tData: WhatsAppTemplate[] = [];
        tSnapshot.forEach((doc) => {
          tData.push({ id: doc.id, ...doc.data() } as WhatsAppTemplate);
        });
        setTemplates(tData);

        const aq = query(collection(db, "automations"), where("agentId", "==", user.uid));
        const aSnapshot = await getDocs(aq);
        const aData: any[] = [];
        aSnapshot.forEach((doc) => {
          aData.push({ id: doc.id, ...doc.data() });
        });
        setAutomations(aData);
      } catch (error) {
        console.error("Error fetching secondary data:", error);
      }
    };
    
    loadSecondaryData();

    return () => unsubscribe();
  }, [user]);

  const handleAssignToAutomation = async (clientId: string, automation: any) => {
    try {
      const targetLeads = automation.targetLeads || [];
      if (!targetLeads.includes(clientId)) {
        await updateDoc(doc(db, "automations", automation.id), {
          targetLeads: [...targetLeads.filter((id: string) => id !== "all" && id !== "all_leads"), clientId]
        });
        alert(`Lead añadido a la automatización "${automation.name}" exitosamente.`);
      } else {
        alert('Este lead ya está asignado a esa automatización.');
      }
    } catch (error) {
      console.error("Error al asignar automatización", error);
    }
  };

  const handleWhatsAppClick = (client: any, templateId?: string) => {
    if (!client.phone) return;
    const numericPhone = client.phone.replace(/\D/g, '');
    
    let message = "";
    if (templateId) {
      const template = templates.find(t => t.id === templateId);
      if (template) {
        message = template.content
          .replace(/{nombre}/g, client.name || "")
          .replace(/{interes}/g, client.interest || client.notes || "");
      }
    } else {
      const interests = client.interest || client.notes;
      message = interests
        ? `Hola ${client.name}, te escribo desde InmoCRM. Vi que tienes interés en: ${interests}. ¿Cómo te podemos ayudar?`
        : `Hola ${client.name}, te escribo desde InmoCRM. ¿En qué te podemos ayudar hoy?`;
    }
    
    const whatsappUrl = `https://wa.me/${numericPhone}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const promises = results.data.map((row: any) => {
            const newClient = {
              name: row.name || row.nombre || "Sin nombre",
              phone: row.phone || row.telefono || row.celular || "",
              email: row.email || row.correo || "",
              interest: row.interest || row.interes || "",
              type: row.type || row.tipo || "Lead Importado",
              status: "nuevo",
              agentId: user.uid,
              createdAt: Date.now()
            };
            return addDoc(collection(db, "clients"), newClient);
          });
          
          await Promise.all(promises);
          alert(`Se importaron ${results.data.length} clientes correctamente.`);
        } catch (error) {
          console.error("Error importing CSV:", error);
          alert("Hubo un error al importar el archivo CSV.");
        } finally {
          setUploading(false);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }
      },
      error: (error) => {
        console.error("Error parsing CSV:", error);
        alert("Hubo un error al leer el archivo CSV.");
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    });
  };

  const handleOpenDialog = (client?: any) => {
    if (client) {
      setEditingId(client.id);
      setNewClientName(client.name || "");
      setNewClientPhone(client.phone || "");
      setNewClientEmail(client.email || "");
      setNewClientInterest(client.interest || client.notes || "");
      setNewClientType(client.type || "Lead");
      setNewClientStatus(client.status || "nuevo");
    } else {
      setEditingId(null);
      setNewClientName("");
      setNewClientPhone("");
      setNewClientEmail("");
      setNewClientInterest("");
      setNewClientType("Lead");
      setNewClientStatus("nuevo");
    }
    setIsDialogOpen(true);
  };

  const handleSaveClient = async () => {
    if (!user || !newClientName.trim()) return;
    setIsSaving(true);
    try {
      if (editingId) {
        await updateDoc(doc(db, "clients", editingId), {
          name: newClientName.trim(),
          phone: newClientPhone.trim(),
          email: newClientEmail.trim(),
          interest: newClientInterest.trim(),
          type: newClientType.trim(),
          status: newClientStatus.trim()
        });
      } else {
        const newClient = {
          name: newClientName.trim(),
          phone: newClientPhone.trim(),
          email: newClientEmail.trim(),
          interest: newClientInterest.trim(),
          type: newClientType.trim() || "Lead",
          status: "nuevo",
          agentId: user.uid,
          createdAt: Date.now()
        };
        await addDoc(collection(db, "clients"), newClient);
      }
      setIsDialogOpen(false);
    } catch (error) {
      console.error("Error saving client:", error);
      alert("Hubo un error al guardar el cliente.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClient = async (id: string) => {
    if (confirm("¿Estás seguro de que deseas eliminar este cliente?")) {
      try {
        await deleteDoc(doc(db, "clients", id));
      } catch (error) {
        console.error("Error deleting client:", error);
      }
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, "clients", id), { status: newStatus });
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Clientes & Leads</h2>
          <p className="text-slate-500">Modulo automatizado de seguimiento en frío y gestión de leads.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setIsDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Añadir Manual
          </Button>
          <input 
            type="file" 
            accept=".csv" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            className="hidden" 
          />
          <Button 
            onClick={() => fileInputRef.current?.click()} 
            disabled={uploading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Upload className="w-4 h-4 mr-2" />
            {uploading ? 'Importando...' : 'Importar CSV'}
          </Button>
        </div>
      </div>

      <div className="bg-white border rounded-lg overflow-hidden flex flex-col md:overflow-x-auto">
        <Table className="min-w-full">
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Contacto</TableHead>
              <TableHead>Interés</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-6 text-slate-500">
                  No hay clientes registrados o cargando...
                </TableCell>
              </TableRow>
            )}
            {clients.map((client) => (
              <TableRow key={client.id}>
                <TableCell className="font-medium">{client.name}</TableCell>
                <TableCell>{client.phone}</TableCell>
                <TableCell className="text-slate-500 max-w-[200px] truncate">{client.interest || client.notes || "N/A"}</TableCell>
                <TableCell><Badge variant="outline">{client.type || "Lead"}</Badge></TableCell>
                <TableCell>
                  <Badge 
                    className={client.status === 'nuevo' ? "bg-amber-100 text-amber-800 hover:bg-amber-200 border-0" : "bg-green-100 text-green-800 hover:bg-green-200 border-0"}
                  >
                    {client.status || "nuevo"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <div className="group relative flex items-center">
                      <select 
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val) handleWhatsAppClick(client, val !== 'default' ? val : undefined);
                          e.target.value = ""; // Reset
                        }}
                        title="Contactar vía WhatsApp"
                        defaultValue=""
                      >
                        <option value="" disabled>Seleccionar plantilla</option>
                        <option value="default">Mensaje por defecto</option>
                        {templates.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="text-green-600 pointer-events-none group-hover:bg-green-50 group-hover:text-green-700"
                        title="Contactar vía WhatsApp"
                      >
                        <MessageCircle className="h-4 w-4"/>
                      </Button>
                      <ChevronDown className="h-3 w-3 text-green-600 pointer-events-none -ml-1" />
                    </div>
                    <Button size="icon" variant="ghost" className="text-blue-600 hover:bg-blue-50 hover:text-blue-700"><Mail className="h-4 w-4"/></Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-slate-100 hover:text-slate-900 h-9 w-9">
                        <MoreHorizontal className="h-4 w-4"/>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuGroup>
                          <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleOpenDialog(client)}>
                            Editar Cliente
                          </DropdownMenuItem>
                          {client.status === 'nuevo' ? (
                            <DropdownMenuItem onClick={() => handleUpdateStatus(client.id, 'contactado')}>
                              Marcar Contactado
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => handleUpdateStatus(client.id, 'nuevo')}>
                              Marcar Nuevo
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          {automations.length > 0 && (
                            <DropdownMenuGroup>
                              <DropdownMenuLabel>Asignar Automatización</DropdownMenuLabel>
                              {automations.map(aut => (
                                <DropdownMenuItem 
                                  key={aut.id} 
                                  onClick={() => handleAssignToAutomation(client.id, aut)}
                                >
                                  {aut.name}
                                </DropdownMenuItem>
                              ))}
                              <DropdownMenuSeparator />
                            </DropdownMenuGroup>
                          )}
                          <DropdownMenuItem 
                            className="text-red-600 focus:bg-red-50 focus:text-red-700"
                            onClick={() => handleDeleteClient(client.id)}
                          >
                            Eliminar Cliente
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Cliente / Lead" : "Nuevo Cliente / Lead"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nombre y Apellido *</Label>
              <Input placeholder="Ej. Juan Pérez" value={newClientName} onChange={e => setNewClientName(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Teléfono</Label>
                <Input placeholder="Ej. +54 9 11..." value={newClientPhone} onChange={e => setNewClientPhone(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" placeholder="juan@ejemplo.com" value={newClientEmail} onChange={e => setNewClientEmail(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Input placeholder="Ej. Lead, Comprador, Inversor..." value={newClientType} onChange={e => setNewClientType(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Interés / Notas</Label>
              <Textarea placeholder="Detalles de lo que busca..." value={newClientInterest} onChange={e => setNewClientInterest(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>Cancelar</Button>
            <Button onClick={handleSaveClient} disabled={isSaving || !newClientName.trim()}>
              {isSaving ? "Guardando..." : "Guardar Cliente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
