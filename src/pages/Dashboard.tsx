import { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Building2, Users, CalendarCheck, TrendingUp } from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';

const COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6'];

export function Dashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [totalProperties, setTotalProperties] = useState(0);
  const [totalClients, setTotalClients] = useState(0);
  const [pendingAppointments, setPendingAppointments] = useState(0);
  const [nextAppointment, setNextAppointment] = useState<string | null>(null);
  const [monthlyLeads, setMonthlyLeads] = useState<{ name: string; leads: number }[]>([]);
  const [propertiesByStatus, setPropertiesByStatus] = useState<{ name: string; value: number }[]>([]);

  useEffect(() => {
    if (!user || !db) return;

    // Listener: propiedades
    const propsQ = query(collection(db, "properties"), where("agentId", "==", user.uid));
    const unsubProps = onSnapshot(propsQ, (snap) => {
      const all = snap.docs.map(d => d.data());
      setTotalProperties(all.length);
      const statusCounts: Record<string, number> = {};
      all.forEach(p => {
        const status = p.status || 'disponible';
        const key = status.charAt(0).toUpperCase() + status.slice(1);
        statusCounts[key] = (statusCounts[key] || 0) + 1;
      });
      setPropertiesByStatus(
        Object.entries(statusCounts).filter(([, v]) => v > 0).map(([k, v]) => ({ name: k, value: v }))
      );
      setLoading(false);
    }, console.error);

    // Listener: clients
    const clientsQ = query(collection(db, "clients"), where("agentId", "==", user.uid));
    const unsubClients = onSnapshot(clientsQ, (snap) => {
      const all = snap.docs.map(d => d.data());
      setTotalClients(all.length);

      const now = new Date();
      const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      const monthly: Record<string, number> = {};
      for (let i = 5; i >= 0; i--) {
        const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
        monthly[monthNames[m.getMonth()]] = 0;
      }
      all.forEach(c => {
        if (c.createdAt) {
          const d = new Date(c.createdAt);
          const key = monthNames[d.getMonth()];
          const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
          if (d >= sixMonthsAgo && monthly[key] !== undefined) monthly[key]++;
        }
      });
      setMonthlyLeads(Object.entries(monthly).map(([name, leads]) => ({ name, leads })));
    }, console.error);

    // Listener: appointments
    const apptsQ = query(collection(db, "appointments"), where("agentId", "==", user.uid));
    const unsubAppts = onSnapshot(apptsQ, (snap) => {
      const all = snap.docs.map(d => ({ ...d.data() }) as any);
      const pending = all.filter((a: any) => a.status === 'pendiente');
      setPendingAppointments(pending.length);

      if (pending.length > 0) {
        pending.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const next = new Date(pending[0].date);
        const diffMs = next.getTime() - Date.now();
        const diffHrs = Math.max(0, Math.round(diffMs / (1000 * 60 * 60)));
        setNextAppointment(diffHrs <= 0 ? 'Ahora' : `en ${diffHrs} horas`);
      } else {
        setNextAppointment(null);
      }
    }, console.error);

    return () => { unsubProps(); unsubClients(); unsubAppts(); };
  }, [user]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard</h2>
        <p className="text-slate-500">Bienvenido a InmoCRM. Aquí tienes un resumen de tu actividad.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-500">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-3" />
          Cargando datos del dashboard...
        </div>
      ) : (
        <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Propiedades Activas</CardTitle>
            <Building2 className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalProperties}</div>
            <p className="text-xs text-slate-500">{totalProperties > 0 ? `${totalProperties} propiedades activas` : 'Sin propiedades'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Clientes</CardTitle>
            <Users className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalClients}</div>
            <p className="text-xs text-slate-500">{monthlyLeads.length > 0 ? `+${monthlyLeads[monthlyLeads.length - 1]?.leads || 0} nuevos este mes` : 'Sin leads aún'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Citas Pendientes</CardTitle>
            <CalendarCheck className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingAppointments}</div>
            <p className="text-xs text-slate-500">{nextAppointment ? `Próxima cita ${nextAppointment}` : 'Sin citas pendientes'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Ventas Acumuladas</CardTitle>
            <TrendingUp className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-400">Próx.</div>
            <p className="text-xs text-slate-400">Métrica en desarrollo</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Leads Captados</CardTitle>
            <CardDescription>Resumen de adquisición mensual</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[300px] w-full">
              {monthlyLeads.length === 0 ? (
                <div className="flex items-center justify-center h-full text-slate-400 text-sm">Sin datos de leads aún</div>
              ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyLeads}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                  <RechartsTooltip cursor={{fill: 'transparent'}} />
                  <Bar dataKey="leads" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Estado del Portafolio</CardTitle>
            <CardDescription>Distribución de propiedades activas</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <div className="h-[300px] w-full">
              {propertiesByStatus.length === 0 ? (
                <div className="flex items-center justify-center h-full text-slate-400 text-sm">Sin propiedades registradas</div>
              ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={propertiesByStatus}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    fill="#8884d8"
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {propertiesByStatus.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
        </>
      )}
    </div>
  );
}