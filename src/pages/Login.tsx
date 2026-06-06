import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { auth } from "@/lib/firebase";
import { GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { Building2, Search, ArrowRight, Mail, UserPlus } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useEffect, useState } from "react";

export function Login() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  useEffect(() => {
    // Solo redirigir si el correo está verificado (a menos que quieran entrar igual sin verificar, 
    // pero exigiremos verificación). Las cuentas creadas con Google vienen verificadas.
    if (user && user.emailVerified) {
      navigate("/", { replace: true });
    }
  }, [user, navigate]);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) {
      alert("Firebase no está configurado.");
      return;
    }
    
    if (!email || !password) {
      alert("Por favor ingresa tu correo y contraseña.");
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(userCredential.user);
        alert("Cuenta creada con éxito. Por favor, revisa tu correo electrónico para verificar tu cuenta e iniciar sesión.");
        await auth.signOut();
        setIsSignUp(false);
        setPassword("");
      } else {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        if (!userCredential.user.emailVerified) {
          alert("Por favor verifica tu correo electrónico antes de ingresar. Revisa tu bandeja de entrada.");
          await auth.signOut();
        } else {
          navigate("/");
        }
      }
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/email-already-in-use') {
         alert("El correo ya está en uso. Por favor inicia sesión.");
         setIsSignUp(false);
      } else if (error.code === 'auth/weak-password') {
         alert("La contraseña debe tener al menos 6 caracteres.");
      } else if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
         alert("Credenciales inválidas. Verifica tu correo y contraseña.");
      } else {
         alert("Error: " + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

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
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/operation-not-allowed') {
        alert("El inicio de sesión con Google no está habilitado. Por favor, habilita 'Google' en la consola de Firebase.");
      } else {
        alert("Error al intentar acceder con Google. " + error.message);
      }
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
        <Card className="w-full border-2 border-transparent hover:border-blue-100 transition-colors shadow-lg flex flex-col">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto bg-blue-50 text-blue-600 w-12 h-12 flex items-center justify-center rounded-full mb-4">
              <Building2 className="w-6 h-6" />
            </div>
            <CardTitle className="text-2xl text-slate-900">Inmobiliaria / Agente</CardTitle>
            <CardDescription className="text-sm px-4">
              Gestiona tus propiedades, leads y automatiza tus ventas desde nuestro CRM.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 flex-1 flex flex-col">
            <form onSubmit={handleEmailAuth} className="space-y-4 mb-4">
              <div className="space-y-2">
                <Label htmlFor="email">Correo Electrónico</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="tu@correo.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input 
                  id="password" 
                  type="password" 
                  placeholder="••••••••" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full h-12 text-md bg-slate-800 hover:bg-slate-900 shadow-md">
                {isSignUp ? (
                  <UserPlus className="w-4 h-4 mr-2" />
                ) : (
                  <Mail className="w-4 h-4 mr-2" />
                )}
                {loading 
                  ? "Procesando..." 
                  : (isSignUp ? "Crear Cuenta" : "Ingresar con Correo")}
              </Button>
            </form>

            <div className="text-center text-sm text-slate-600 mb-4">
              {isSignUp ? "¿Ya tienes una cuenta?" : "¿Sos nuevo?"}
              <button 
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="ml-1 text-blue-600 hover:underline font-medium"
              >
                {isSignUp ? "Inicia sesión" : "Crea una cuenta"}
              </button>
            </div>
            
            <div className="relative mb-4 mt-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-slate-500">
                  {isSignUp ? "O regístrate con" : "O ingresa con"}
                </span>
              </div>
            </div>

            <Button type="button" variant="outline" className="w-full h-12 text-md border-2 hover:bg-slate-50" onClick={handleGoogleLogin}>
              Google
            </Button>
          </CardContent>
        </Card>

        {/* Client Access Card */}
        <Card className="w-full border-2 border-transparent hover:border-indigo-100 transition-colors shadow-lg flex flex-col">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto bg-indigo-50 text-indigo-600 w-12 h-12 flex items-center justify-center rounded-full mb-4">
              <Search className="w-6 h-6" />
            </div>
            <CardTitle className="text-2xl text-slate-900">Cliente Interesado</CardTitle>
            <CardDescription className="text-sm px-4">
              Explora las propiedades disponibles de todas las inmobiliarias y contacta directo.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 flex-1 flex flex-col justify-end">
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
