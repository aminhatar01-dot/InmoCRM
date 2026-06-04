import { Outlet } from "react-router-dom";
import { Sidebar, MobileSidebar } from "./Sidebar";
import { Building2 } from "lucide-react";
import { LiveNotifications } from "./LiveNotifications";

export function DashboardLayout() {
  return (
    <div className="flex bg-slate-50 min-h-screen">
      <LiveNotifications />
      <Sidebar />
      <main className="flex-1 overflow-y-auto w-full">
        {/* Mobile Top Bar */}
        <div className="md:hidden flex items-center justify-between p-4 border-b bg-white sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <Building2 className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl font-bold text-blue-600">InmoCRM</h1>
          </div>
          <MobileSidebar />
        </div>
        
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
