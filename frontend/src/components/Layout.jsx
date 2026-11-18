// Gabarit client : bandeau Ynov + 4 onglets + messagerie
// Ordinateur : onglets sous le bandeau. Mobile (< 768px) : menu burger.
import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Logo from './Logo.jsx';

const ONGLETS = [
  { to: '/portfolio', label: 'Portfolio', icone: '🖼️' },
  { to: '/projets', label: 'Mes projets', icone: '🛠️' },
  { to: '/avis', label: 'Avis', icone: '⭐' },
  { to: '/contact', label: 'Contact', icone: '📍' },
];

export default function Layout() {
  const { user, deconnecter } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const mainRef = useRef(null);
  const burgerRef = useRef(null);
  const menuRef = useRef(null);
  const [menuOuvert, setMenuOuvert] = useState(false);

  // Accessibilité : focus sur le contenu à chaque changement de page
  useEffect(() => {
    setMenuOuvert(false);
    mainRef.current?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [pathname]);

  // Menu ouvert : Échap pour fermer, page bloquée derrière, focus dans le menu
  useEffect(() => {
    if (!menuOuvert) return undefined;
    const fermerEchap = (e) => {
      if (e.key === 'Escape') {
        setMenuOuvert(false);
        burgerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', fermerEchap);
    document.body.classList.add('sans-defilement');
    menuRef.current?.querySelector('a')?.focus();
    return () => {
      document.removeEventListener('keydown', fermerEchap);
      document.body.classList.remove('sans-defilement');
    };
  }, [menuOuvert]);

  // Repasse en grand écran : on referme le menu
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 769px)');
    const ecoute = (e) => e.matches && setMenuOuvert(false);
    mq.addEventListener('change', ecoute);
    return () => mq.removeEventListener('change', ecoute);
  }, []);

  const sortir = async () => {
    await deconnecter();
    navigate('/connexion');
  };

  return (
    <>
      <a href="#contenu" className="lien-evitement">Aller au contenu</a>
      <header className="entete">
        <div className="entete__haut conteneur">
          <NavLink to="/portfolio" className="entete__logo" aria-label="Fab Lab Ynov — accueil">
            <Logo />
          </NavLink>

          {/* Ordinateur */}
          <div className="entete__actions ordi-seulement">
            <NavLink to="/messagerie" className="bouton bouton--chat">
              <span aria-hidden="true">💬</span> Messagerie
            </NavLink>
            <span className="entete__user" title={user.email}>
              <span className="avatar" aria-hidden="true">{user.prenom?.[0] ?? '?'}</span>
              {user.prenom}
            </span>
            <button type="button" className="bouton bouton--fantome" onClick={sortir}>Déconnexion</button>
          </div>

          {/* Mobile : raccourci chat + burger */}
          <div className="entete__actions mobile-seulement">
            <NavLink to="/messagerie" className="bouton-rond" aria-label="Messagerie">
              <span aria-hidden="true">💬</span>
            </NavLink>
            <button
              ref={burgerRef}
              type="button"
              className={`burger ${menuOuvert ? 'burger--ouvert' : ''}`}
              aria-expanded={menuOuvert}
              aria-controls="menu-mobile"
              aria-label={menuOuvert ? 'Fermer le menu' : 'Ouvrir le menu'}
              onClick={() => setMenuOuvert((o) => !o)}
            >
              <span /><span /><span />
            </button>
          </div>
        </div>

        <nav className="onglets conteneur ordi-seulement" aria-label="Navigation principale">
          <ul>
            {ONGLETS.map((o) => (
              <li key={o.to}>
                <NavLink to={o.to} className="onglet">{o.label}</NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      {/* Menu mobile (panneau qui glisse depuis la droite) */}
      <div className={`menu-fond ${menuOuvert ? 'menu-fond--visible' : ''}`} onClick={() => setMenuOuvert(false)} aria-hidden="true" />
      <nav
        id="menu-mobile"
        ref={menuRef}
        className={`menu-mobile ${menuOuvert ? 'menu-mobile--ouvert' : ''}`}
        aria-label="Menu principal"
        inert={!menuOuvert}
      >
        <div className="menu-mobile__user">
          <span className="avatar avatar--grand" aria-hidden="true">{user.prenom?.[0] ?? '?'}</span>
          <div>
            <strong>{[user.prenom, user.nom].filter(Boolean).join(' ')}</strong>
            <p className="menu-mobile__email">{user.email}</p>
          </div>
          <button
            type="button"
            className="menu-mobile__fermer"
            aria-label="Fermer le menu"
            onClick={() => { setMenuOuvert(false); burgerRef.current?.focus(); }}
          >
            ✕
          </button>
        </div>
        <ul>
          {[...ONGLETS, { to: '/messagerie', label: 'Messagerie', icone: '💬' }].map((o) => (
            <li key={o.to}>
              <NavLink to={o.to} className="menu-mobile__lien">
                <span aria-hidden="true">{o.icone}</span> {o.label}
              </NavLink>
            </li>
          ))}
        </ul>
        <button type="button" className="bouton bouton--secondaire bouton--plein" onClick={sortir}>
          Déconnexion
        </button>
      </nav>

      <main id="contenu" ref={mainRef} tabIndex={-1} className="conteneur contenu">
        <Outlet />
      </main>

      <footer className="pied">
        <div className="conteneur">Fab Lab Ynov Campus · Impression 3D & flocage · Projet Ydays</div>
      </footer>
    </>
  );
}
