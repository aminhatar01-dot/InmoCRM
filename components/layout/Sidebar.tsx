import { Link, useLocation } from "react-router-dom";
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
  Menu
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: Building2, label: "Propiedades", path: "/properties" },
  { icon: Users, label: "Clientes & Leads", path: "/clients" },
  { icon: Calendar, label: "Citas", path: "/appointments" },
  { icon: MessageSquare, label: "Automatizaciones (CRM)", path: "/automations" },
  { icon: Megaphone, label: "Marketing", path: "/marketing" },
  { icon: Share2, label: "Portales de Venta", path: "/portals" },
  { icon: FileText, label: "Formularios y Docs", path: "/documents" },
  { icon: Settings, label: "Configuración", path: "/settings" },
];

export function SidebarContent({ onClickLink }: { onClickLink?: () => void }) {
  const location = useLocation();

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-blue-600 flex items-center gap-2">
          <Building2 className="w-8 h-8"/>
          InmoCRM
        </h1>
      </div>
      
      <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path || (location.pathname.startsWith(item.path) && item.path !== "/");
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onClickLink}
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

      <div className="p-4 border-t">
        <button className="flex w-full items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900">
          <LogOut className="w-5 h-5 text-slate-400" />
          Cerrar Sesión
        </button>
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <div className="w-64 border-r bg-white h-screen hidden md:flex flex-col sticky top-0">
      <SidebarContent />
    </div>
  );
}

export function MobileSidebar() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="ghost" size="icon" className="md:hidden" />}>
        <Menu className="w-6 h-6" />
      </SheetTrigger>
      <SheetContent side="left" className="p-0 w-72">
        <SidebarContent onClickLink={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
