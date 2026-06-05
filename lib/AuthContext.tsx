import React, { createContext, useContext, useEffect, useState } from "react";
import { User, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "./firebase";

export type UserProfile = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: 'owner' | 'invited_agent';
  ownerId?: string;
  subscription: {
    status: 'trial' | 'active' | 'past_due' | 'canceled';
    plan: 'free' | 'plus' | 'pro';
    trialEndsAt: number;
    currentPeriodEnd?: number;
    gracePeriodEndsAt?: number;
  };
};

type AuthContextType = {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType>({ user: null, userProfile: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      
      if (u) {
        try {
          const userDocRef = doc(db, "users", u.uid);
          const docSnap = await getDoc(userDocRef);
          
          if (!docSnap.exists()) {
             // Check if user is invited
             let role: 'owner' | 'invited_agent' = 'owner';
             let ownerId = undefined;
             let plan: 'free' | 'plus' | 'pro' = 'free';
             let status: 'trial' | 'active' | 'past_due' | 'canceled' = 'trial';
             const trialEndsAt = Date.now() + 15 * 24 * 60 * 60 * 1000;
             
             if (u.email) {
               const invitesQ = query(collection(db, "teamInvitations"), where("email", "==", u.email));
               const invitesSnap = await getDocs(invitesQ);
               if (!invitesSnap.empty) {
                 const inviteDoc = invitesSnap.docs[0];
                 const inviteData = inviteDoc.data();
                 role = 'invited_agent';
                 ownerId = inviteData.ownerId;
                 plan = 'pro'; // Inherits access from pro plan parent
                 status = 'active'; // Doesn't need trial
               }
             }

             const newProfile: UserProfile = {
               uid: u.uid,
               email: u.email,
               displayName: u.displayName || 'Agente Nuevo',
               photoURL: u.photoURL,
               role,
               ...(ownerId ? { ownerId } : {}),
               subscription: {
                 status,
                 plan,
                 trialEndsAt
               }
             };
             await setDoc(userDocRef, newProfile);
             setUserProfile(newProfile);
          } else {
             setUserProfile(docSnap.data() as UserProfile);
          }
        } catch (e) {
          console.error("Error fetching user profile", e);
        }
      } else {
        setUserProfile(null);
      }
      
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, userProfile, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
