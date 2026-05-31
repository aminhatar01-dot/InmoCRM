import { Routes, Route, BrowserRouter } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { Dashboard } from "./pages/Dashboard";
import { Properties } from "./pages/Properties";
import { Clients } from "./pages/Clients";
import { Automations } from "./pages/Automations";
import { Marketing } from "./pages/Marketing";
import { Portals } from "./pages/Portals";
import { Documents } from "./pages/Documents";
import { Appointments } from "./pages/Appointments";
import { Login } from "./pages/Login";
import { Portfolio } from "./pages/Portfolio";
import { AuthProvider } from "@/lib/AuthContext";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/portfolio/:agentId" element={<Portfolio />} />
          
          <Route element={<ProtectedRoute />}>
            <Route element={<DashboardLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/properties" element={<Properties />} />
              <Route path="/clients" element={<Clients />} />
              <Route path="/automations" element={<Automations />} />
              <Route path="/marketing" element={<Marketing />} />
              <Route path="/portals" element={<Portals />} />
              <Route path="/documents" element={<Documents />} />
              <Route path="/appointments" element={<Appointments />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
