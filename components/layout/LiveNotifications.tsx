import { useEffect, useRef } from "react";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";

export function LiveNotifications() {
  const { user } = useAuth();
  const initialized = useRef(false);

  useEffect(() => {
    if (!user || !db) return;

    // Pedir permiso para notificaciones
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    const q = query(
      collection(db, "clients"),
      where("agentId", "==", user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!initialized.current) {
        // En el primer snapshot se reciben todos los datos actuales
        initialized.current = true;
        return;
      }

      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const lead = change.doc.data();
          
          // Verificar si es un lead nuevo y ha sido creado recientemente para evitar alertas redundantes
          // Usamos la propiedad createdAt (ms) que guardamos en Portfolio
          if (lead.createdAt && (Date.now() - lead.createdAt) < 60000) {
            if ("Notification" in window && Notification.permission === "granted") {
              new Notification("¡Nuevo Lead Recibido!", {
                body: `Nombre: ${lead.name}\nTe ha contactado desde tu portafolio digital.`,
                icon: "/favicon.ico" // Utilizar el favicon como ícono si existe
              });
            }
          }
        }
      });
    });

    return () => unsubscribe();
  }, [user]);

  return null;
}
