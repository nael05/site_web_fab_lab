// ===================== PARTIE ADMIN (à coder) =====================
// Page d'entrée admin. Remplace-la par ton layout admin + 4 onglets :
//   Suivi & Planning · Stock & Tarifs · Portfolio · Messagerie
// Réutilisables : api.js, useSocket (socket.js), utils/format.js,
//   components/StatutBadge, BilanResume, Logo, et les classes de styles/global.css
// Les routes back sont dans backend/src/routes/admin/ (préfixe /api/admin).
// ==================================================================
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import Logo from '../../components/Logo.jsx';

export default function AdminAccueil() {
  const { user, deconnecter } = useAuth();
  const navigate = useNavigate();

  return (
    <>
      <header className="entete">
        <div className="entete__haut conteneur">
          <Logo sousTitre="Fab Lab · Admin" />
          <button type="button" className="bouton bouton--fantome" onClick={async () => { await deconnecter(); navigate('/connexion'); }}>
            Déconnexion
          </button>
        </div>
      </header>
      <main className="conteneur contenu">
        <h1>Back-office admin</h1>
        <p>Connecté en tant que {user.email}.</p>
        <p className="alerte alerte--info">Espace admin en cours de développement.</p>
      </main>
    </>
  );
}
