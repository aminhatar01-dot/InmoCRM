import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/firebase";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { useNavigate } from "react-router-dom";

export function Login() {
  const navigate = useNavigate();

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
    <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50">
      <div className="mb-8 flex items-center gap-2 text-blue-600">
        <h1 className="text-4xl font-bold">InmoCRM</h1>
      </div>
      <Card className="w-[400px]">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Bienvenido</CardTitle>
          <CardDescription>Inicia sesión con tu cuenta de agente para acceder al panel.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full bg-slate-900 border-0 hover:bg-slate-800" onClick={handleGoogleLogin}>
            Iniciar Sesión con Google
          </Button>
        </CardContent>
      </Card>
      
      <p className="mt-8 text-sm text-slate-500 max-w-sm text-center">
        Protegido bajo estrictas políticas de privacidad. Tu información está 100% segura.
      </p>
    </div>
  );
}
