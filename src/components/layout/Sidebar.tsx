import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { 
  Building2, 
  Users, 
  Calendar, 
  LayoutDashboard, 
  Share2, 
  MessageSquare, 
  FileText, 
  Settings,
  LogOut,
  Megaphone,
  AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { useAuth } from "@/lib/AuthContext";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: MessageSquare, label: "Mensajes & Chat", path: "/inbox" },
  { icon: Building2, label: "Propiedades", path: "/properties" },
  { icon: Users, label: "Clientes & Leads", path: "/clients" },
  { icon: Calendar, label: "Citas & Agenda", path: "/appointments" },
  { icon: Settings, label: "Automatizaciones", path: "/automations" },
  { icon: Megaphone, label: "Marketing", path: "/marketing" },
  { icon: Share2, label: "Portales de Venta", path: "/portals" },
  { icon: FileText, label: "Formularios y Docs", path: "/documents" },
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { userProfile } = useAuth();

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      await signOut(auth);
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Error signing out:", error);
      navigate("/login", { replace: true });
    }
  };

  const getTrialDaysRemaining = () => {
    if (!userProfile || userProfile.subscription.status !== 'trial') return null;
    const remainingMs = userProfile.subscription.trialEndsAt - Date.now();
    return Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60 * 24)));
  };

  const trialDays = getTrialDaysRemaining();

  return (
    <div className="w-64 border-r border-slate-200 bg-white h-screen flex flex-col shrink-0 relative">
      {/* Banner de subscripción */}
      {trialDays !== null && (
        <div className="bg-yellow-50 text-yellow-800 text-xs text-center py-2 px-4 shadow-sm border-b border-yellow-100 flex items-center justify-center gap-2 font-medium">
           <AlertCircle className="w-4 h-4" /> Pruebas gratis: {trialDays} días
        </div>
      )}

      <div className="p-6 pb-2">
        <h1 className="text-2xl font-bold text-blue-600 flex items-center gap-2">
          <Building2 className="w-8 h-8"/>
          InmoCRM
        </h1>
      </div>
      
      <nav className="flex-1 px-4 py-2 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path || (location.pathname.startsWith(item.path) && item.path !== "/");
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium",
                isActive 
                  ? "bg-blue-50 text-blue-700" 
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <item.icon className={cn("w-5 h-5", isActive ? "text-blue-700" : "text-slate-400")} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Perfil Miniatura */}
      <div className="p-4 border-t flex flex-col gap-2">
        <Link to="/settings" className="flex items-center gap-3 p-2 rounded-md hover:bg-slate-50 transition-colors cursor-pointer group">
           {userProfile?.photoURL ? (
             <img src={userProfile.photoURL} alt="User" className="w-9 h-9 rounded-full object-cover border" />
           ) : (
             <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center uppercase font-bold text-sm">
               {userProfile?.displayName ? userProfile.displayName[0] : 'U'}
             </div>
           )}
           <div className="flex-1 min-w-0">
             <p className="text-sm font-medium text-slate-800 truncate group-hover:text-blue-600">{userProfile?.displayName || 'Agente'}</p>
             <p className="text-xs text-slate-500 capitalize">{userProfile?.subscription?.plan || 'Free Plan'}</p>
           </div>
        </Link>
        <button 
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-600"
        >
          <LogOut className="w-5 h-5 text-slate-400 group-hover:text-red-500" />
          Cerrar Sesión
        </button>
      </div>
    </div>
  );
}
