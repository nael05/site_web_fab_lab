// Gabarit admin : bandeau + onglets (Suivi & Planning · Stock & Tarifs · Portfolio · Messagerie)
// Remplace l'ancienne page AdminAccueil.jsx. Les pages s'affichent dans <Outlet />.
import { useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import Logo from '../../components/Logo.jsx';
import '../../styles/admin.css';

const ONGLETS = [
  // "actif" : l'onglet reste allumé sur ses sous-pages (/admin/suivi/12, /admin/planning)
  { to: '/admin/suivi', label: 'Suivi & Planning', actif: ['/admin/suivi', '/admin/planning'] },
  { to: '/admin/stock', label: 'Stock & Tarifs' },
  { to: '/admin/portfolio', label: 'Portfolio' },
  { to: '/admin/messagerie', label: 'Messagerie' },
];

export default function AdminLayout() {
  const { user, deconnecter } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const mainRef = useRef(null);

  // Accessibilité : focus sur le contenu à chaque changement de page (comme côté client)
  useEffect(() => {
    mainRef.current?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [pathname]);

  const sortir = async () => {
    await deconnecter();
    navigate('/connexion');
  };

  return (
    <>
      <a href="#contenu" className="lien-evitement">Aller au contenu</a>
      <header className="entete">
        <div className="entete__haut conteneur">
          <NavLink to="/admin/suivi" className="entete__logo" aria-label="Back-office — accueil">
            <Logo sousTitre="Fab Lab · Admin" />
          </NavLink>
          <div className="entete__actions">
            <span className="entete__user ordi-seulement" title={user.email}>
              <span className="avatar" aria-hidden="true">{user.prenom?.[0] ?? '?'}</span>
              {user.prenom}
            </span>
            <button type="button" className="bouton bouton--fantome" onClick={sortir}>Déconnexion</button>
          </div>
        </div>

        {/* Pas de burger : sur mobile, les onglets défilent horizontalement */}
        <nav className="onglets conteneur" aria-label="Navigation admin">
          <ul>
            {ONGLETS.map((o) => {
              const actif = (o.actif ?? [o.to]).some((debut) => pathname.startsWith(debut));
              return (
                <li key={o.to}>
                  <NavLink
                    to={o.to}
                    className={`onglet ${actif ? 'active' : ''}`}
                    aria-current={actif ? 'page' : undefined}
                  >
                    {o.label}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>

      <main id="contenu" ref={mainRef} tabIndex={-1} className="conteneur contenu">
        <Outlet />
      </main>

      <footer className="pied">
        <div className="conteneur">Fab Lab Ynov Campus · Back-office</div>
      </footer>
    </>
  );
}

// Bascule « Projets / Planning » en haut des deux pages de l'onglet Suivi & Planning
export function SousNavSuivi() {
  return (
    <nav className="sous-nav" aria-label="Suivi et planning">
      <NavLink to="/admin/suivi" end className="sous-nav__lien">Projets</NavLink>
      <NavLink to="/admin/planning" className="sous-nav__lien">Planning</NavLink>
    </nav>
  );
}

// Onglets pas encore codés
export function AVenir({ titre }) {
  return (
    <>
      <h1>{titre}</h1>
      <p className="alerte alerte--info">Cet onglet arrive bientôt.</p>
    </>
  );
}
