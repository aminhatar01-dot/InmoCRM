import { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, getDoc, setDoc } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Plus, Edit, Trash2, Save, X, MessageSquare, CheckCircle2, QrCode, Bot, CalendarClock, BrainCircuit, Phone } from "lucide-react";

export interface WhatsAppTemplate {
  id: string;
  name: string;
  content: string;
  agentId: string;
  createdAt: number;
}

export function Automations() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({ name: "", content: "" });

  const [waConfigOpen, setWaConfigOpen] = useState(false);
  const [waToken, setWaToken] = useState("");
  const [waPhoneId, setWaPhoneId] = useState("");
  const [waSaving, setWaSaving] = useState(false);
  const [waConnected, setWaConnected] = useState(false);
  const [waPhoneInput, setWaPhoneInput] = useState("");
  const [waConfigMode, setWaConfigMode] = useState<"qr" | "phone">("qr");
  
  // Real Connection states
  const [connectionStatus, setConnectionStatus] = useState<string>("none");
  const [qrCodeData, setQrCodeData] = useState<string>("");
  const [pairingCode, setPairingCode] = useState<string>("");

  useEffect(() => {
    let interval: any;
    if (waConfigOpen && user && (connectionStatus !== 'connected' && connectionStatus !== 'none')) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/whatsapp/status/${user.uid}`);
          if (res.ok) {
            const data = await res.json();
            if (data.status) {
              setConnectionStatus(data.status);
              if (data.qr) setQrCodeData(data.qr);
              if (data.pairingCode) setPairingCode(data.pairingCode);
              
              if (data.status === 'connected') {
                setWaToken("real-session-" + user.uid);
                setWaPhoneId("real-phone-" + user.uid);
              }
            }
          }
        } catch (e) {
          console.error("Error polling WA status", e);
        }
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [waConfigOpen, user, connectionStatus]);

  const resetWaConnection = async () => {
    if (!user) return;
    setConnectionStatus('starting');
    try {
      await fetch('/api/whatsapp/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid })
      });
      setConnectionStatus('none');
      setQrCodeData("");
      setPairingCode("");
      setWaToken("");
      setWaPhoneId("");
    } catch (e) {
      console.error(e);
    }
  };

  const requestWaConnection = async (method: 'qr' | 'phone') => {
    if (!user) return;
    setConnectionStatus('starting');
    setQrCodeData("");
    setPairingCode("");
    try {
      await fetch('/api/whatsapp/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method, userId: user.uid, phone: waPhoneInput })
      });
    } catch (e) {
      console.error(e);
      setConnectionStatus('error');
    }
  };

  // AI & Agenda Config
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [agendaReminder, setAgendaReminder] = useState(true);
  const [agendaAgentNotif, setAgendaAgentNotif] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!user) return;
      try {
        // Load WhatsApp Config
        const settingsSnap = await getDoc(doc(db, "settings", user.uid));
        if (settingsSnap.exists()) {
          const data = settingsSnap.data();
          if (data.waToken) {
            setWaToken(data.waToken);
            setWaPhoneId(data.waPhoneId || "");
            setWaConnected(true);
          }
          if (data.aiEnabled !== undefined) setAiEnabled(data.aiEnabled);
          if (data.aiPrompt) setAiPrompt(data.aiPrompt);
          if (data.agendaReminder !== undefined) setAgendaReminder(data.agendaReminder);
          if (data.agendaAgentNotif !== undefined) setAgendaAgentNotif(data.agendaAgentNotif);
        }

        // Load Templates
        const q = query(
          collection(db, "whatsappTemplates"),
          where("agentId", "==", user.uid)
        );
        const querySnapshot = await getDocs(q);
        const data: WhatsAppTemplate[] = [];
        querySnapshot.forEach((doc) => {
          data.push({ id: doc.id, ...doc.data() } as WhatsAppTemplate);
        });
        setTemplates(data.sort((a, b) => b.createdAt - a.createdAt));
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [user]);

  const handleOpenNew = () => {
    setFormData({ name: "", content: "" });
    setEditingId(null);
    setOpenDialog(true);
  };

  const handleOpenEdit = (template: WhatsAppTemplate) => {
    setFormData({ name: template.name, content: template.content });
    setEditingId(template.id);
    setOpenDialog(true);
  };

  const handleSave = async () => {
    if (!user || !formData.name || !formData.content) return;
    try {
      if (editingId) {
        const docRef = doc(db, "whatsappTemplates", editingId);
        await updateDoc(docRef, {
          name: formData.name,
          content: formData.content
        });
        setTemplates(templates.map(t => t.id === editingId ? { ...t, name: formData.name, content: formData.content } : t));
      } else {
        const newTemplate = {
          name: formData.name,
          content: formData.content,
          agentId: user.uid,
          createdAt: Date.now()
        };
        const docRef = await addDoc(collection(db, "whatsappTemplates"), newTemplate);
        setTemplates([{ id: docRef.id, ...newTemplate }, ...templates]);
      }
      setOpenDialog(false);
    } catch (error) {
      console.error("Error saving template:", error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, "whatsappTemplates", id));
      setTemplates(templates.filter(t => t.id !== id));
    } catch (error) {
      console.error("Error deleting template:", error);
    }
  };

  const handleSaveWaConfig = async () => {
    if (!user) return;
    setWaSaving(true);
    try {
      await setDoc(doc(db, "settings", user.uid), {
        waToken,
        waPhoneId,
        updatedAt: Date.now()
      }, { merge: true });
      setWaConnected(!!waToken);
      setWaConfigOpen(false);
    } catch (error) {
      console.error("Error saving WA config:", error);
    } finally {
      setWaSaving(false);
    }
  };

  const handleSaveAISettings = async () => {
    if (!user) return;
    setSavingSettings(true);
    try {
      await setDoc(doc(db, "settings", user.uid), {
        aiEnabled,
        aiPrompt,
        agendaReminder,
        agendaAgentNotif,
        updatedAt: Date.now()
      }, { merge: true });
    } catch (error) {
      console.error("Error saving AI settings:", error);
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Automatizaciones & WhatsApp</h2>
          <p className="text-slate-500">Configura plantillas de mensajes y flujos de seguimiento.</p>
        </div>
      </div>

      <div className="grid gap-8 mb-8 md:grid-cols-2">
        <div className="p-8 border-2 border-dashed rounded-lg bg-slate-50 text-center flex flex-col h-full">
          {waConnected ? (
            <div className="flex flex-col items-center justify-center flex-1">
              <CheckCircle2 className="w-12 h-12 text-green-500 mb-4" />
              <h3 className="font-semibold text-lg text-green-700">WhatsApp Business Conectado</h3>
              <p className="text-slate-500 max-w-md mx-auto mt-2">
                Tu cuenta está enlazada y lista para enviar mensajes automáticos desde el CRM.
              </p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => setWaConfigOpen(true)}
              >
                Modificar Configuración
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center flex-1">
              <h3 className="font-semibold text-lg">Conectar WhatsApp API</h3>
              <p className="text-slate-500 max-w-md mx-auto mt-2">
                Vincula tu número comercial para procesar envíos automáticos (requiere token de Meta Developers).
              </p>
              <Button 
                onClick={() => setWaConfigOpen(true)}
                className="mt-4 bg-[#25D366] text-white hover:bg-[#20b858]"
              >
                Vincular WhatsApp
              </Button>
            </div>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-blue-600" />
              Asistente Comercial de IA
            </CardTitle>
            <CardDescription>
              Configura el comportamiento del agente de IA que responderá las consultas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base text-slate-800">Habilitar IA en Mensajes</Label>
                <p className="text-sm text-slate-500">
                  La IA leerá tu catálogo y contestará automáticamente a los leads.
                </p>
              </div>
              <Switch 
                checked={aiEnabled}
                onCheckedChange={setAiEnabled}
              />
            </div>
            {aiEnabled && (
              <div className="space-y-2">
                <Label className="text-slate-700">Comportamiento / Instrucciones del Asistente</Label>
                <Textarea 
                  placeholder="Ej: Eres un vendedor inmobiliario amable. Ayuda a cerrar visitas. Proporciona solo la info de la propiedad que te pregunten..." 
                  className="min-h-[100px] text-sm"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                />
              </div>
            )}
            <div className="pt-2 border-t flex justify-end">
              <Button 
                onClick={handleSaveAISettings} 
                disabled={savingSettings}
                className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto"
              >
                {savingSettings ? "Guardando..." : "Guardar Ajustes de IA"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-indigo-600" />
            Automatizaciones de Agenda
          </CardTitle>
          <CardDescription>Eventos que se disparan automáticamente en base a tus citas y agenda.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between border-b pb-4">
            <div className="space-y-0.5">
              <Label className="text-base text-slate-800">Recordatorio 24hs a Clientes</Label>
              <p className="text-sm text-slate-500">
                Avisa al cliente por WhatsApp 24 horas antes de su visita o reunión programada.
              </p>
            </div>
            <Switch 
              checked={agendaReminder}
              onCheckedChange={setAgendaReminder}
            />
          </div>
          <div className="flex items-center justify-between pb-2">
            <div className="space-y-0.5">
              <Label className="text-base text-slate-800">Notificación al Agente</Label>
              <p className="text-sm text-slate-500">
                Notifícame a mi propio WhatsApp cada vez que un cliente auto-agende o modifique una cita.
              </p>
            </div>
            <Switch 
              checked={agendaAgentNotif}
              onCheckedChange={setAgendaAgentNotif}
            />
          </div>
          <div className="pt-2 flex justify-end">
            <Button 
              onClick={handleSaveAISettings} 
              disabled={savingSettings}
              variant="outline"
            >
              Aplicar Reglas de Agenda
            </Button>
          </div>
        </CardContent>
      </Card>

      {waConfigOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-auto">
          <div className="absolute inset-0 bg-black/50" onClick={() => setWaConfigOpen(false)}></div>
          <div className="relative z-50 bg-white rounded-lg shadow-xl w-full max-w-md p-6 m-4 flex flex-col gap-4">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-lg font-bold">Configuración de WhatsApp</h2>
              <button className="text-slate-400 hover:text-slate-600" onClick={() => setWaConfigOpen(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="w-full">
              <div className="grid w-full grid-cols-2 mb-4 bg-slate-100 p-1 rounded-lg">
                <button 
                  className={`text-sm font-medium py-1.5 rounded-md transition-colors ${waConfigMode === "qr" ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"}`}
                  onClick={() => setWaConfigMode("qr")}
                >
                  Código QR
                </button>
                <button 
                  className={`text-sm font-medium py-1.5 rounded-md transition-colors ${waConfigMode === "phone" ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"}`}
                  onClick={() => setWaConfigMode("phone")}
                >
                  Número
                </button>
              </div>

              {waConfigMode === "qr" && (
                <div className="space-y-4 flex flex-col items-center">
                  <p className="text-sm text-center text-slate-500 mb-2">
                    Abre WhatsApp en tu teléfono, ve a <b>Configuración &gt; Dispositivos vinculados</b> y selecciona <b>Vincular un dispositivo</b>.
                  </p>
                  <div className="p-4 bg-white border-2 border-slate-100 rounded-xl shadow-sm inline-block min-h-[220px] flex items-center justify-center min-w-[220px]">
                    {qrCodeData ? (
                      <img src={qrCodeData} alt="WhatsApp QR Code" className="w-48 h-48" />
                    ) : connectionStatus === 'starting' ? (
                      <span className="text-sm text-slate-500">Generando QR...</span>
                    ) : (
                      <QrCode className="w-48 h-48 text-slate-800 opacity-20" strokeWidth={1} />
                    )}
                  </div>
                  
                  {connectionStatus === 'connected' ? (
                    <div className="flex items-center gap-2 text-green-600 mt-2 font-medium">
                      <CheckCircle2 className="w-4 h-4" /> Dispositivo conectado con éxito
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 mt-6">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => requestWaConnection('qr')}
                        disabled={connectionStatus === 'starting'}
                      >
                        {connectionStatus === 'starting' ? "Iniciando servicio..." : "Generar Código QR"}
                      </Button>
                      {(connectionStatus === 'error' || connectionStatus === 'disconnected') && (
                         <Button variant="ghost" size="sm" onClick={resetWaConnection} className="text-red-500 hover:text-red-600 hover:bg-red-50">Resetear Conexión</Button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {waConfigMode === "phone" && (
                <div className="space-y-4">
                  <p className="text-sm text-slate-500 text-center mb-4">
                    Ingresa tu número de teléfono para enlazar tu cuenta. Te enviaremos un código de verificación.
                  </p>
                  <div className="space-y-2">
                    <Label>Número de teléfono</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input 
                        placeholder="+54 9 11 1234-5678" 
                        className="pl-9"
                        value={waPhoneInput}
                        onChange={(e) => setWaPhoneInput(e.target.value)}
                        disabled={connectionStatus === 'starting' || connectionStatus === 'code_ready' || connectionStatus === 'connected'}
                      />
                    </div>
                  </div>
                  
                  {pairingCode && (
                     <div className="mt-4 p-4 bg-slate-100 rounded-lg text-center border">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Ingresa este código en WhatsApp</p>
                        <div className="text-3xl font-mono tracking-[0.2em] font-bold text-slate-800">{pairingCode}</div>
                     </div>
                  )}

                  {connectionStatus === 'connected' ? (
                    <div className="flex items-center justify-center gap-2 text-green-600 mt-4 font-medium">
                      <CheckCircle2 className="w-4 h-4" /> Número vinculado con éxito
                    </div>
                  ) : (
                    <div className="flex flex-col justify-center pt-2 gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => requestWaConnection('phone')}
                        disabled={!waPhoneInput || connectionStatus === 'starting' || connectionStatus === 'code_ready'}
                      >
                        {connectionStatus === 'starting' ? "Generando código..." : connectionStatus === 'code_ready' ? "Esperando validación..." : "Verificar Número"}
                      </Button>
                      {(connectionStatus === 'error' || connectionStatus === 'disconnected') && (
                         <Button variant="ghost" size="sm" onClick={resetWaConnection} className="text-red-500 hover:text-red-600 hover:bg-red-50">Resetear Conexión</Button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
              <Button variant="outline" onClick={() => setWaConfigOpen(false)}>Cancelar</Button>
              <Button 
                onClick={handleSaveWaConfig} 
                disabled={waSaving || !waToken} 
                className="bg-[#25D366] hover:bg-[#20b858]"
              >
                {waSaving ? "Conectando..." : "Confirmar Conexión"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mt-8 mb-4">
        <h3 className="text-xl font-bold text-slate-900">Plantillas de Mensajes</h3>
        <Button onClick={handleOpenNew} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          Nueva Plantilla
        </Button>
      </div>

      {openDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-auto">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpenDialog(false)}></div>
          <div className="relative z-50 bg-white rounded-lg shadow-xl w-full max-w-md p-6 m-4 flex flex-col gap-4">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-lg font-bold">{editingId ? "Editar Plantilla" : "Nueva Plantilla"}</h2>
              <button className="text-slate-400 hover:text-slate-600" onClick={() => setOpenDialog(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nombre de la plantilla</label>
                <Input 
                  placeholder="Ej: Bienvenida nuevo lead" 
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Contenido del mensaje</label>
                <Textarea 
                  placeholder="Hola {nombre}, te escribo desde InmoCRM..." 
                  className="min-h-[150px]"
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                />
                <p className="text-xs text-slate-500">Puedes usar las variables: {"{nombre}"}, {"{interes}"}</p>
              </div>
            </div>
            
            <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
              <Button variant="outline" onClick={() => setOpenDialog(false)}>Cancelar</Button>
              <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">Guardar</Button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-slate-500 text-center py-8">Cargando plantillas...</div>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-8 text-center text-slate-500">
            <MessageSquare className="w-12 h-12 mb-4 text-slate-300" />
            <p>No tienes plantillas configuradas.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map(template => (
            <Card key={template.id}>
              <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
                <CardTitle className="text-lg">{template.name}</CardTitle>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(template)} className="h-8 w-8 text-slate-400 hover:text-blue-600">
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(template.id)} className="h-8 w-8 text-slate-400 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <p className="text-sm text-slate-600 line-clamp-4 whitespace-pre-wrap">
                  {template.content}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
