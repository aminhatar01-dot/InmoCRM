import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Bell, Mail, MonitorSmartphone, MousePointer2 } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

export function Settings() {
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState({
    email: true,
    emailAddress: "",
    push: false,
    desktop: true,
  });
  const [message, setMessage] = useState<{type: 'success'|'error', text: string} | null>(null);
  const [emailError, setEmailError] = useState("");
  const [testingEmail, setTestingEmail] = useState(false);

  const validateEmail = (email: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const handleTestEmail = async () => {
    if (!preferences.emailAddress.trim()) {
      setEmailError("Ingresa un correo para probar.");
      return;
    }
    if (!validateEmail(preferences.emailAddress)) {
      setEmailError("Ingresa un formato de email válido.");
      return;
    }
    
    setTestingEmail(true);
    setEmailError("");
    setMessage(null);
    try {
      const response = await fetch('/api/test-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: preferences.emailAddress }),
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setMessage({ type: 'success', text: 'Correo de prueba enviado con éxito. Revisa tu bandeja de entrada.' });
      } else {
        throw new Error(data.error || 'Error al enviar de correo');
      }
    } catch (error: any) {
      console.error('Error sending test email:', error);
      setMessage({ type: 'error', text: `Error de envío: ${error.message || 'Error desconocido'}` });
    } finally {
      setTestingEmail(false);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  useEffect(() => {
    async function loadSettings() {
      if (!user) return;
      try {
        const docRef = doc(db, "settings", user.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          setPreferences({
            email: data.email ?? true,
            emailAddress: data.emailAddress ?? user?.email ?? "",
            push: data.push ?? false,
            desktop: data.desktop ?? true,
          });
        }
      } catch (error) {
        console.error("Error loading settings:", error);
      } finally {
        setLoading(false);
      }
    }
    
    loadSettings();
  }, [user]);

  const handleToggle = (key: keyof typeof preferences) => {
    setPreferences(prev => ({ ...prev, [key]: typeof prev[key] === "boolean" ? !prev[key] : prev[key] }));
  };

  const handleTextChange = (key: keyof typeof preferences, value: string) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
  };

  const saveSettings = async () => {
    if (!user) return;
    
    if (preferences.email) {
      if (!preferences.emailAddress.trim()) {
        setEmailError("El email de destino es requerido.");
        return;
      }
      if (!validateEmail(preferences.emailAddress)) {
        setEmailError("Ingresa un formato de email válido.");
        return;
      }
    }
    
    setEmailError("");
    setSaving(true);
    setMessage(null);
    try {
      const docRef = doc(db, "settings", user.uid);
      await setDoc(docRef, {
        ...preferences,
        updatedAt: Date.now()
      }, { merge: true });
      
      // Request desktop permission if newly enabled
      if (preferences.desktop && "Notification" in window && Notification.permission === "default") {
        await Notification.requestPermission();
      }
      
      setMessage({ type: 'success', text: 'Preferencias guardadas correctamente.' });
    } catch (error) {
      console.error("Error saving settings:", error);
      setMessage({ type: 'error', text: 'Error al guardar las preferencias.' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  if (loading) {
    return <div className="p-8 text-slate-500">Cargando configuración...</div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Configuración</h1>
        <p className="text-slate-500">Gestiona tus preferencias de cuenta y notificaciones.</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-blue-500" />
            <CardTitle>Preferencias de Notificación</CardTitle>
          </div>
          <CardDescription>
            Elige cómo y cuándo quieres recibir alertas de nuevos leads y mensajes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          
          <div className="flex flex-col gap-4 border-b pb-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base flex items-center gap-2">
                  <Mail className="w-4 h-4 text-slate-500" /> 
                  Notificaciones por Email
                </Label>
                <p className="text-sm text-slate-500">
                  Recibe resúmenes diarios y alertas críticas en tu correo.
                </p>
              </div>
              <Switch 
                checked={preferences.email}
                onCheckedChange={() => handleToggle('email')}
              />
            </div>
            
            {preferences.email && (
              <div className="pl-6 space-y-2">
                <Label htmlFor="emailAddress" className="text-sm text-slate-600">Email de destino para alertas</Label>
                <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                  <Input 
                    id="emailAddress" 
                    type="email" 
                    placeholder="ejemplo@correo.com" 
                    value={preferences.emailAddress}
                    onChange={(e) => {
                      handleTextChange('emailAddress', e.target.value);
                      if (emailError) setEmailError("");
                    }}
                    className={`max-w-md ${emailError ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                  />
                  <Button 
                    variant="outline" 
                    onClick={handleTestEmail} 
                    disabled={testingEmail || !preferences.emailAddress.trim()}
                    className="shrink-0"
                  >
                    {testingEmail ? 'Enviando...' : 'Probar Conexión SMTP'}
                  </Button>
                </div>
                {emailError && <p className="text-sm text-red-500 font-medium">{emailError}</p>}
              </div>
            )}
          </div>
          
          <div className="flex items-center justify-between pt-2">
            <div className="space-y-0.5">
              <Label className="text-base flex items-center gap-2">
                <MonitorSmartphone className="w-4 h-4 text-slate-500" />
                Notificaciones Push (Móvil)
              </Label>
              <p className="text-sm text-slate-500">
                Recibe notificaciones push en tu dispositivo móvil.
              </p>
            </div>
            <Switch 
              checked={preferences.push}
              onCheckedChange={() => handleToggle('push')}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base flex items-center gap-2">
                <MousePointer2 className="w-4 h-4 text-slate-500" />
                Alertas de Escritorio
              </Label>
              <p className="text-sm text-slate-500">
                Muestra popups en la pantalla cuando el CRM está abierto.
              </p>
            </div>
            <Switch 
              checked={preferences.desktop}
              onCheckedChange={() => handleToggle('desktop')}
            />
          </div>

        </CardContent>
        <CardFooter className="flex flex-col items-start gap-4 border-t px-6 py-4">
          <Button onClick={saveSettings} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar Preferencias'}
          </Button>
          
          {message && (
            <div className={`text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
              {message.text}
            </div>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
