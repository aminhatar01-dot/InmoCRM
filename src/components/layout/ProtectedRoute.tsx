import { useAuth } from "@/lib/AuthContext";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";

export function ProtectedRoute() {
  const { user, userProfile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="h-screen w-screen flex items-center justify-center">Cargando...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Si no ha cargado el userProfile todavía, esperamos
  if (!userProfile) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center gap-4">
        <div className="text-slate-500">Iniciando perfil...</div>
        <Button variant="outline" onClick={async () => { await signOut(auth); window.location.href='/login'; }}>Cerrar Sesión</Button>
      </div>
    );
  }

  const { subscription } = userProfile;
  const isTrialExpired = subscription.status === 'trial' && Date.now() > subscription.trialEndsAt;
  const isGraceExpired = subscription.status === 'past_due' && subscription.gracePeriodEndsAt && Date.now() > subscription.gracePeriodEndsAt;
  
  const isLocked = isTrialExpired || isGraceExpired || subscription.status === 'canceled';

  if (isLocked && location.pathname !== '/settings') {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center z-50 fixed inset-0">
        <h2 className="text-3xl font-bold mb-4 text-slate-800">Suscripción Expirada</h2>
        <p className="text-slate-600 max-w-md mx-auto mb-8">
          Tu período de prueba ha finalizado o hay un problema con tu pago. Por favor, regulariza tu suscripción mensual para continuar usando InmoCRM y para reactivar tus automatizaciones de WhatsApp e IA.
        </p>
        <div className="flex gap-4">
          <Button onClick={() => window.location.href = '/settings'} className="bg-blue-600 hover:bg-blue-700">Ver Planes</Button>
          <Button variant="outline" onClick={async () => { await signOut(auth); window.location.href='/login'; }}>Cerrar Sesión</Button>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
