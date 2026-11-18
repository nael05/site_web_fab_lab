// Routes de l'appli. Admin -> /admin/*, client -> les 4 onglets + messagerie.
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth, accueilPour } from './context/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import Connexion from './pages/Connexion.jsx';
import Portfolio from './pages/Portfolio.jsx';
import MesProjets from './pages/MesProjets.jsx';
import NouveauProjet from './pages/NouveauProjet.jsx';
import Avis from './pages/Avis.jsx';
import Contact from './pages/Contact.jsx';
import Messagerie from './pages/Messagerie.jsx';
import AdminAccueil from './pages/admin/AdminAccueil.jsx';
import Introuvable from './pages/Introuvable.jsx';

// Bloque l'accès si pas connecté ou mauvais rôle
function Protege({ role, children }) {
  const { user, chargement } = useAuth();
  if (chargement) return <p className="chargement" role="status">Chargement…</p>;
  if (!user) return <Navigate to="/connexion" replace />;
  if (role && user.role !== role) return <Navigate to={accueilPour(user)} replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/connexion" element={<Connexion />} />

      {/* Interface client */}
      <Route element={<Protege role="client"><Layout /></Protege>}>
        <Route path="/" element={<Navigate to="/portfolio" replace />} />
        <Route path="/portfolio" element={<Portfolio />} />
        <Route path="/projets" element={<MesProjets />} />
        <Route path="/projets/nouveau" element={<NouveauProjet />} />
        <Route path="/avis" element={<Avis />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/messagerie" element={<Messagerie />} />
      </Route>

      {/* Interface admin : à compléter (pages dans src/pages/admin/) */}
      <Route path="/admin/*" element={<Protege role="admin"><AdminAccueil /></Protege>} />

      <Route path="*" element={<Introuvable />} />
    </Routes>
  );
}
