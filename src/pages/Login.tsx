import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/firebase";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { Building2, Search, ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useEffect } from "react";

export function Login() {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      navigate("/", { replace: true });
    }
  }, [user, navigate]);

  const handleGoogleLogin = async () => {
    if (!auth) {
      alert("Firebase no está configurado.");
      navigate("/");
      return;
    }
    
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      navigate("/");
    } catch (error) {
      console.error(error);
      alert("Error iniciando sesión. " + error);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-50 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-100/50 blur-3xl -z-10"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-100/50 blur-3xl -z-10"></div>
      
      <div className="mb-12 flex items-center gap-3 text-blue-600">
        <div className="bg-blue-600 text-white p-3 rounded-xl shadow-lg">
          <Building2 className="w-8 h-8" />
        </div>
        <h1 className="text-5xl font-extrabold tracking-tight text-slate-900">InmoCRM</h1>
      </div>
      
      <div className="grid md:grid-cols-2 gap-8 max-w-4xl w-full px-4">
        {/* Agent Login Card */}
        <Card className="w-full border-2 border-transparent hover:border-blue-100 transition-colors shadow-lg">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto bg-blue-50 text-blue-600 w-12 h-12 flex items-center justify-center rounded-full mb-4">
              <Building2 className="w-6 h-6" />
            </div>
            <CardTitle className="text-2xl text-slate-900">Inmobiliaria / Agente</CardTitle>
            <CardDescription className="text-sm px-4">
              Gestiona tus propiedades, leads y automatiza tus ventas desde nuestro CRM.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <Button className="w-full h-12 text-md bg-blue-600 hover:bg-blue-700 shadow-md" onClick={handleGoogleLogin}>
              Ingresar con Google
            </Button>
          </CardContent>
        </Card>

        {/* Client Access Card */}
        <Card className="w-full border-2 border-transparent hover:border-indigo-100 transition-colors shadow-lg">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto bg-indigo-50 text-indigo-600 w-12 h-12 flex items-center justify-center rounded-full mb-4">
              <Search className="w-6 h-6" />
            </div>
            <CardTitle className="text-2xl text-slate-900">Cliente Interesado</CardTitle>
            <CardDescription className="text-sm px-4">
              Explora las propiedades disponibles de todas las inmobiliarias y contacta directo.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <Button 
              variant="outline" 
              className="w-full h-12 text-md border-2 hover:bg-slate-50 group"
              onClick={() => navigate("/explore")}
            >
              Explorar Inmuebles
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </CardContent>
        </Card>
      </div>
      
      <p className="mt-16 text-sm text-slate-500 max-w-md text-center">
        Al acceder aceptas nuestros términos de servicio y políticas de privacidad. Tu información está 100% segura.
      </p>
    </div>
  );
}

