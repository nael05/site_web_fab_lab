// Utilisateur connecté, dispo partout : const { user, connecter, deconnecter } = useAuth()
import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api.js';
import { deconnecterSocket } from '../socket.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [chargement, setChargement] = useState(true);

  // Au démarrage : session déjà ouverte ? (cookie)
  useEffect(() => {
    if (import.meta.env.VITE_DEMO_MODE === 'true') {
      // Mode démo : utilisateur fake pour tester le front sans BDD
      setUser({ id_utilisateur: 1, email: 'demo@ynov.com', nom: 'Demo', prenom: 'User', role: 'client' });
      setChargement(false);
    } else {
      api('/auth/moi')
        .then((d) => setUser(d.utilisateur))
        .catch(() => setUser(null))
        .finally(() => setChargement(false));
    }
  }, []);

  const connecter = (utilisateur) => {
    deconnecterSocket(); // nouveau socket avec le nouveau cookie
    setUser(utilisateur);
  };

  const deconnecter = async () => {
    await api('/auth/deconnexion', { method: 'POST' }).catch(() => {});
    deconnecterSocket();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, chargement, connecter, deconnecter }}>{children}</AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

// Page d'accueil selon le rôle (routage admin / client)
export const accueilPour = (user) => (user?.role === 'admin' ? '/admin' : '/portfolio');
