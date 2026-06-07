import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bell, Mail, MonitorSmartphone, MousePointer2, UserCircle2, KeyRound, CreditCard, Users, CheckCircle2, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { db, auth } from "@/lib/firebase";
import { doc, getDoc, setDoc, updateDoc, collection, addDoc, query, where, getDocs, deleteDoc } from "firebase/firestore";
import { updateProfile, updatePassword, EmailAuthProvider, reauthenticateWithCredential, sendPasswordResetEmail } from "firebase/auth";

export function Settings() {
  const { user, userProfile } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [message, setMessage] = useState<{type: 'success'|'error', text: string} | null>(null);

  // Perfil State
  const [displayName, setDisplayName] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  // Contraseña State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Equipo State
  const [inviteEmail, setInviteEmail] = useState("");
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);

  // Notificaciones State
  const [preferences, setPreferences] = useState({
    email: true,
    emailAddress: "",
    push: false,
    desktop: true,
  });

  useEffect(() => {
    // Check URL for payment status
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get('payment');
    if (paymentStatus === 'success') {
       setMessage({ type: 'success', text: '¡Pago exitoso! Tu suscripción se ha actualizado temporalmente, si el nivel del plan no cambia de inmediato refresca la página en unos minutos. ¡Gracias! '});
    } else if (paymentStatus === 'failure') {
       setMessage({ type: 'error', text: 'El pago no pudo procesarse. Por favor, intenta de nuevo.'});
    } else if (paymentStatus === 'pending') {
       setMessage({ type: 'success', text: 'El pago está pendiente de aprobación.'});
    }

    async function loadSettings() {
      if (!user) return;
      setDisplayName(user.displayName || "");
      setPhotoURL(user.photoURL || "");

      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setPhoneNumber(userData.phoneNumber || "");
          setContactEmail(userData.contactEmail || user.email || "");
          setPhotoURL(userData.photoURL || user.photoURL || "");
        }

        const docRef = doc(db, "settings", user.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          setPreferences({
            email: data.email ?? true,
            emailAddress: data.emailAddress ?? user.email ?? "",
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

  const loadTeam = async () => {
    if (!user || userProfile?.subscription?.plan !== 'pro') return;
    setLoadingTeam(true);
    try {
      // Cargar Miembros Registrados
      const usersQ = query(collection(db, "users"), where("ownerId", "==", user.uid));
      const usersSnap = await getDocs(usersQ);
      setTeamMembers(usersSnap.docs.map(d => ({id: d.id, ...d.data()})));
      
      // Cargar Invitaciones Pendientes
      const invitesQ = query(collection(db, "teamInvitations"), where("ownerId", "==", user.uid));
      const invitesSnap = await getDocs(invitesQ);
      setInvitations(invitesSnap.docs.map(d => ({id: d.id, ...d.data()})));
    } catch (e) {
      console.error("Error loading team/invitations:", e);
    } finally {
      setLoadingTeam(false);
    }
  };

  useEffect(() => {
    loadTeam();
  }, [user, userProfile]);

  const handleInvite = async () => {
     if (!user || !inviteEmail) return;
     if (teamMembers.length + invitations.length >= 10) {
       setMessage({ type: 'error', text: 'Has alcanzado el límite de 10 agentes en tu plan Pro.' });
       return;
     }

     try {
       await addDoc(collection(db, "teamInvitations"), {
         email: inviteEmail,
         ownerId: user.uid,
         createdAt: Date.now()
       });
       setInviteEmail("");
       setMessage({ type: 'success', text: `Invitación enviada a ${inviteEmail}` });
       loadTeam();
     } catch (e) {
       setMessage({ type: 'error', text: 'Error al invitar al agente.' });
     }
  };

  const handleRevokeInvite = async (id: string) => {
    try {
      await deleteDoc(doc(db, "teamInvitations", id));
      setMessage({ type: 'success', text: 'Invitación revocada.' });
      loadTeam();
    } catch (e) {
      setMessage({ type: 'error', text: 'Error al revocar.' });
    }
  };

  const handleUpdateProfile = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const isDataUrl = photoURL.startsWith('data:');
      
      // Update Firebase Auth profile only with non-data URLs to avoid length limits
      if (!isDataUrl && photoURL !== user.photoURL) {
         await updateProfile(user, { displayName, photoURL });
      } else if (displayName !== user.displayName) {
         await updateProfile(user, { displayName });
      }
      
      const userRef = doc(db, "users", user.uid);
      await setDoc(userRef, { displayName, photoURL, phoneNumber, contactEmail }, { merge: true });
      
      setMessage({ type: 'success', text: 'Perfil actualizado correctamente.' });
    } catch (e: any) {
      console.error(e);
      setMessage({ type: 'error', text: 'Error al actualizar perfil: ' + e.message });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleResetPassword = async () => {
    if (!user || !user.email) return;
    setResettingPassword(true);
    try {
      await sendPasswordResetEmail(auth, user.email);
      setMessage({ type: 'success', text: `Correo de recuperación enviado a ${user.email}. Por favor, revisa tu bandeja de entrada y la carpeta de SPAM (Correo no deseado).` });
    } catch (e: any) {
      console.error(e);
      let errorText = e.message;
      if (e.code === 'auth/operation-not-allowed') {
        errorText = 'La autenticación por correo no está habilitada. Habilita "Email/Password" en la consola de Firebase > Authentication > Sign-in method.';
      }
      setMessage({ type: 'error', text: 'Error al enviar recuperación: ' + errorText });
    } finally {
      setResettingPassword(false);
      setTimeout(() => setMessage(null), 8000); 
    }
  };

  const handleUpdatePassword = async () => {
    if (!user || !user.email) return;
    setSaving(true);
    try {
      if (!currentPassword) {
        throw new Error('Debes ingresar tu contraseña actual para cambiarla. Si la olvidaste, usa "Restablecer por Correo".');
      }
      if (!newPassword || newPassword.length < 6) {
        throw new Error('La nueva contraseña debe tener al menos 6 caracteres.');
      }

      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);

      setCurrentPassword("");
      setNewPassword("");
      setMessage({ type: 'success', text: 'Contraseña actualizada exitosamente.' });
    } catch (e: any) {
      console.error(e);
      let errorText = e.message;
      if (e.code === 'auth/invalid-credential') {
        errorText = 'La contraseña actual es incorrecta.';
      } else if (e.code === 'auth/operation-not-allowed') {
        errorText = 'La autenticación por correo no está habilitada. Habilita "Email/Password" en la consola de Firebase > Authentication > Sign-in method.';
      }
      setMessage({ type: 'error', text: 'Error: ' + errorText });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 4000);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const MAX_DIMENSION = 300; // Resize to max 300x300 for Firestore limit

          if (width > height) {
            if (width > MAX_DIMENSION) {
              height *= MAX_DIMENSION / width;
              width = MAX_DIMENSION;
            }
          } else {
            if (height > MAX_DIMENSION) {
              width *= MAX_DIMENSION / height;
              height = MAX_DIMENSION;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            setPhotoURL(dataUrl);
          }
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const savePreferences = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const docRef = doc(db, "settings", user.uid);
      await setDoc(docRef, {
        ...preferences,
        updatedAt: Date.now()
      }, { merge: true });
      setMessage({ type: 'success', text: 'Preferencias guardadas.' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Error al guardar las preferencias.' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleSubscribe = async (plan: 'plus' | 'pro') => {
    if (!user) return;
    try {
      const res = await fetch('/api/mercadopago/preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan,
          userId: user.uid,
          userEmail: user.email
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al generar pago');
      if (data.init_point) {
        window.open(data.init_point, "_blank");
      }
    } catch (e: any) {
      console.error(e);
      setMessage({ type: 'error', text: 'Error iniciando Mercado Pago: ' + e.message });
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const handleCancelSubscription = async () => {
    if (!user) return;
    if (!confirm('¿Estás seguro de que deseas cancelar tu suscripción?')) return;
    
    setCanceling(true);
    try {
      const res = await fetch('/api/subscription/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cancelar la suscripción');
      
      setMessage({ type: 'success', text: 'Suscripción cancelada exitosamente.' });
      setTimeout(() => window.location.reload(), 2000);
    } catch (e: any) {
      console.error(e);
      setMessage({ type: 'error', text: 'Error al cancelar: ' + e.message });
      setTimeout(() => setMessage(null), 5000);
    } finally {
      setCanceling(false);
    }
  };

  if (loading) return <div className="p-8 text-slate-500">Cargando configuración...</div>;

  return (
    <div className="space-y-6 max-w-4xl pb-10">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Configuración de Cuenta</h1>
        <p className="text-slate-500">Gestiona tu perfil, seguridad, preferencias y subscripción a InmoCRM.</p>
      </div>

      {message && (
        <div className={`p-4 rounded-md text-sm font-medium ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full grid-cols-4 md:w-[600px] mb-8">
          <TabsTrigger value="profile"><UserCircle2 className="w-4 h-4 mr-2" />Perfil</TabsTrigger>
          <TabsTrigger value="security"><KeyRound className="w-4 h-4 mr-2" />Seguridad</TabsTrigger>
          <TabsTrigger value="notifications"><Bell className="w-4 h-4 mr-2" />Alertas</TabsTrigger>
          <TabsTrigger value="subscription"><CreditCard className="w-4 h-4 mr-2" />Plan SaaS</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Información del Agente</CardTitle>
              <CardDescription>Actualiza tus datos públicos y de contacto.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Nombre Completo</Label>
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Teléfono de Contacto Públic</Label>
                  <Input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="+54 9 11 1234-5678" />
                </div>
                <div className="space-y-2">
                  <Label>Correo de Contacto</Label>
                  <Input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} type="email" placeholder="contacto@inmobiliaria.com" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Foto de Perfil</Label>
                <Input type="file" accept="image/*" onChange={handleFileChange} />
                {photoURL && (
                  <div className="mt-4 flex items-center gap-4">
                    <img src={photoURL} alt="Preview" className="w-16 h-16 rounded-full object-cover border" />
                    <Button variant="ghost" size="sm" onClick={() => setPhotoURL("")} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                      Eliminar Foto
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleUpdateProfile} disabled={saving}>Guardar Perfil</Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Cambiar Contraseña</CardTitle>
              <CardDescription>
                Por razones de seguridad la contraseña actual no se puede mostrar visiblemente. 
                Si la olvidaste, utiliza la opción de recuperación por correo.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Contraseña Actual</Label>
                <div className="relative">
                  <Input type={showPassword ? "text" : "password"} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Nueva Contraseña</Label>
                <div className="relative">
                  <Input type={showPassword ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-sm font-medium">
                    {showPassword ? "Ocultar" : "Mostrar"}
                  </button>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between items-center bg-slate-50 border-t p-4 rounded-b-xl">
              <Button variant="outline" onClick={handleResetPassword} disabled={resettingPassword}>
                Restablecer por Correo
              </Button>
              <Button onClick={handleUpdatePassword} disabled={saving || !newPassword}>Actualizar Contraseña</Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
           {/* Notificaciones Reutilizadas del original */}
           <Card>
            <CardHeader>
              <CardTitle>Preferencias de Notificación</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base flex items-center gap-2">
                    <Mail className="w-4 h-4 text-slate-500" /> Notificaciones por Email
                  </Label>
                </div>
                <Switch checked={preferences.email} onCheckedChange={(v) => setPreferences(p=>({...p, email:v}))} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base flex items-center gap-2">
                    <MousePointer2 className="w-4 h-4 text-slate-500" /> Alertas de Escritorio
                  </Label>
                </div>
                <Switch checked={preferences.desktop} onCheckedChange={(v) => setPreferences(p=>({...p, desktop:v}))} />
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={savePreferences} disabled={saving}>Guardar Preferencias</Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="subscription" className="space-y-4">
          <Card className="border-blue-200">
            <CardHeader className="bg-blue-50/50 pb-8">
              <div className="flex items-start justify-between">
                <div>
                   <CardTitle className="text-2xl flex items-center gap-2">
                     Mi Subscripción: 
                     <span className="text-blue-600 uppercase tracking-wide">
                        {userProfile?.subscription?.plan || 'Free'}
                     </span>
                   </CardTitle>
                   <p className="text-sm text-slate-500 mt-2">
                     Estado: <strong>{userProfile?.subscription?.status === 'trial' ? 'Prueba (15 días)' : userProfile?.subscription?.status}</strong>
                   </p>
                </div>
              </div>
            </CardHeader>
          </Card>

          <div className="grid md:grid-cols-2 gap-6 mt-6">
            <Card className={userProfile?.subscription?.plan === 'plus' ? 'border-2 border-blue-500' : ''}>
              <CardHeader>
                <CardTitle>Plan Plus Personal</CardTitle>
                <CardDescription>Para agentes individuales activos</CardDescription>
                <div className="mt-4 font-bold text-3xl">$29.000 ARS<span className="text-sm text-slate-500 font-normal">/mes</span></div>
              </CardHeader>
              <CardContent className="space-y-3 font-medium text-sm">
                <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500"/> Acceso total al CRM</div>
                <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500"/> Automatizaciones con IA</div>
                <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500"/> WhatsApp Bot Ilimitado</div>
              </CardContent>
              <CardFooter className="flex-col gap-2">
                {userProfile?.subscription?.plan === 'plus' ? (
                  <>
                    <Button className="w-full" disabled variant="outline">Plan Actual</Button>
                    {userProfile?.subscription?.status !== 'canceled' && (
                      <Button className="w-full text-red-600 hover:text-red-700 hover:bg-red-50" variant="ghost" onClick={handleCancelSubscription} disabled={canceling}>Cancelar Suscripción</Button>
                    )}
                  </>
                ) : (
                  <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={() => handleSubscribe('plus')}>
                    Subscribirse a Plus
                  </Button>
                )}
              </CardFooter>
            </Card>

            <Card className={userProfile?.subscription?.plan === 'pro' ? 'border-2 border-indigo-500' : ''}>
              <CardHeader>
                <CardTitle className="text-indigo-700">Plan Pro (Team)</CardTitle>
                <CardDescription>Inmobiliarias: Invita hasta 10 colegas gratis</CardDescription>
                <div className="mt-4 font-bold text-3xl">$49.000 ARS<span className="text-sm text-slate-500 font-normal">/mes</span></div>
              </CardHeader>
              <CardContent className="space-y-3 font-medium text-sm">
                <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500"/> Todas las ventajas de Plus</div>
                <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500"/> 10 Cuentas Invitadas Gratuitas</div>
                <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500"/> Portafolio Compartido</div>
              </CardContent>
              <CardFooter className="flex-col gap-2">
                {userProfile?.subscription?.plan === 'pro' ? (
                  <>
                    <Button className="w-full" disabled variant="outline">Plan Actual</Button>
                    {userProfile?.subscription?.status !== 'canceled' && (
                      <Button className="w-full text-red-600 hover:text-red-700 hover:bg-red-50" variant="ghost" onClick={handleCancelSubscription} disabled={canceling}>Cancelar Suscripción</Button>
                    )}
                  </>
                ) : (
                  <Button className="w-full bg-indigo-600 hover:bg-indigo-700" onClick={() => handleSubscribe('pro')}>
                    Adquirir Plan Pro
                  </Button>
                )}
              </CardFooter>
            </Card>
          </div>
          <p className="text-xs text-slate-400 mt-4 text-center">
            Los pagos se procesan de forma segura por MercadoPago a través de Débito, Crédito o Transferencia Automática Mensual. Se brindan 7 días hábiles de gracia en caso de pago fallido antes de pausar automatizaciones.
          </p>

          {userProfile?.subscription?.plan === 'pro' && (
             <Card className="mt-8 border-indigo-200">
               <CardHeader className="bg-indigo-50/50">
                 <div className="flex items-center justify-between">
                   <div>
                     <CardTitle className="flex items-center gap-2 text-indigo-900"><Users className="w-5 h-5"/> Equipo (Plan Pro)</CardTitle>
                     <CardDescription>Estás suscrito al plan inmobiliario. Puedes añadir y gestionar hasta 10 agentes a tu cuenta.</CardDescription>
                   </div>
                 </div>
               </CardHeader>
               <CardContent className="pt-6 space-y-6">
                 <div>
                   <Label>Invitar Nuevo Agente</Label>
                   <div className="flex items-center gap-4 mt-2">
                     <Input 
                        placeholder="correo@ejemplo.com" 
                        value={inviteEmail} 
                        onChange={(e) => setInviteEmail(e.target.value)} 
                        type="email"
                     />
                     <Button 
                       onClick={handleInvite} 
                       disabled={!inviteEmail || teamMembers.length + invitations.length >= 10}
                     >
                       Invitar
                     </Button>
                   </div>
                   <p className="text-sm text-slate-500 mt-2">
                     Cupos en uso: {teamMembers.length + invitations.length} / 10
                   </p>
                 </div>

                 {invitations.length > 0 && (
                   <div>
                     <h3 className="text-sm font-semibold mb-3">Invitaciones Pendientes</h3>
                     <div className="space-y-2">
                       {invitations.map(inv => (
                         <div key={inv.id} className="flex items-center justify-between p-3 border rounded-md">
                           <div className="text-sm font-medium">{inv.email}</div>
                           <Button variant="ghost" size="sm" onClick={() => handleRevokeInvite(inv.id)} className="text-red-500 hover:text-red-700">
                             <Trash2 className="w-4 h-4"/>
                           </Button>
                         </div>
                       ))}
                     </div>
                   </div>
                 )}

                 {teamMembers.length > 0 && (
                   <div>
                     <h3 className="text-sm font-semibold mb-3">Agentes Activos</h3>
                     <div className="space-y-2">
                       {teamMembers.map(member => (
                         <div key={member.id} className="flex items-center justify-between p-3 border rounded-md bg-white">
                           <div className="flex items-center gap-3">
                             <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm font-bold uppercase">
                               {member.displayName ? member.displayName[0] : member.email[0]}
                             </div>
                             <div>
                               <div className="text-sm font-medium">{member.displayName || 'Sin Nombre'}</div>
                               <div className="text-xs text-slate-500">{member.email}</div>
                             </div>
                           </div>
                           <div className="flex gap-1">
                             <Button
                               variant="ghost" size="sm"
                               className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 h-8"
                               onClick={async () => {
                                 if (!confirm(`¿Suspender a ${member.displayName || member.email}?`)) return;
                                 await updateDoc(doc(db, "users", member.id), { 'subscription.status': 'suspended' });
                                 loadTeam();
                               }}
                             >Suspender</Button>
                             <Button
                               variant="ghost" size="sm"
                               className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8"
                               onClick={async () => {
                                 if (!confirm(`¿Eliminar a ${member.displayName || member.email}?`)) return;
                                 await deleteDoc(doc(db, "users", member.id));
                                 loadTeam();
                               }}
                             ><Trash2 className="w-4 h-4" /></Button>
                           </div>
                         </div>
                       ))}
                     </div>
                   </div>
                 )}

               </CardContent>
             </Card>
          )}

        </TabsContent>
      </Tabs>
    </div>
  );
}