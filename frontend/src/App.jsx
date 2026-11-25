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
import AdminLayout, { AVenir } from './pages/admin/AdminLayout.jsx';
import Suivi from './pages/admin/Suivi.jsx';
import ProjetAdmin from './pages/admin/ProjetAdmin.jsx';
import Planning from './pages/admin/Planning.jsx';
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

      {/* Interface admin (pages dans src/pages/admin/) */}
      <Route path="/admin" element={<Protege role="admin"><AdminLayout /></Protege>}>
        <Route index element={<Navigate to="suivi" replace />} />
        <Route path="suivi" element={<Suivi />} />
        <Route path="suivi/:id" element={<ProjetAdmin />} />
        <Route path="planning" element={<Planning />} />
        <Route path="stock" element={<AVenir titre="Stock & Tarifs" />} />
        <Route path="portfolio" element={<AVenir titre="Portfolio" />} />
        <Route path="messagerie" element={<AVenir titre="Messagerie" />} />
        <Route path="*" element={<Navigate to="suivi" replace />} />
      </Route>

      <Route path="*" element={<Introuvable />} />
    </Routes>
  );
}
