// Connexion unique : mail @ynov.com -> code OTP -> redirection admin ou client
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth, accueilPour } from '../context/AuthContext.jsx';
import Logo from '../components/Logo.jsx';

export default function Connexion() {
  const { user, connecter } = useAuth();
  const navigate = useNavigate();
  const [etape, setEtape] = useState('email'); // 'email' puis 'code'
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [erreur, setErreur] = useState('');
  const [info, setInfo] = useState('');
  const [envoi, setEnvoi] = useState(false);

  if (user) return <Navigate to={accueilPour(user)} replace />;

  const demanderCode = async (e) => {
    e?.preventDefault();
    setErreur('');
    setEnvoi(true);
    try {
      await api('/auth/demander-code', { method: 'POST', body: { email } });
      setEtape('code');
      setInfo(`Un code à 6 chiffres a été envoyé à ${email.trim().toLowerCase()}.`);
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnvoi(false);
    }
  };

  const verifierCode = async (e) => {
    e.preventDefault();
    setErreur('');
    setEnvoi(true);
    try {
      const { utilisateur } = await api('/auth/verifier-code', { method: 'POST', body: { email, code } });
      connecter(utilisateur);
      navigate(accueilPour(utilisateur), { replace: true });
    } catch (err) {
      setErreur(err.message);
      setEnvoi(false);
    }
  };

  return (
    <div className="connexion">
      <div className="connexion__visuel" aria-hidden="true">
        <Logo />
        <p className="connexion__accroche">Impression 3D & flocage de tee-shirts pour tous les étudiants du campus.</p>
      </div>

      <main className="connexion__panneau">
        <div className="carte connexion__carte">
          <h1>Connexion</h1>
          <p className="texte-doux">Inscription et connexion avec votre adresse <strong>@ynov.com</strong>.</p>

          {erreur && <p className="alerte alerte--erreur" role="alert">{erreur}</p>}
          {info && etape === 'code' && <p className="alerte alerte--info" role="status">{info}</p>}

          {etape === 'email' ? (
            <form onSubmit={demanderCode} noValidate>
              <div className="champ">
                <label htmlFor="email">Adresse e-mail Ynov</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="prenom.nom@ynov.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <button className="bouton bouton--primaire bouton--plein" disabled={envoi}>
                {envoi ? 'Envoi…' : 'Recevoir mon code'}
              </button>
            </form>
          ) : (
            <form onSubmit={verifierCode} noValidate>
              <div className="champ">
                <label htmlFor="code">Code reçu par e-mail</label>
                <input
                  id="code"
                  className="champ-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="\d{6}"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  aria-describedby="code-aide"
                  required
                  autoFocus
                />
                <p id="code-aide" className="aide">Valable 10 minutes, 5 essais maximum.</p>
              </div>
              <button className="bouton bouton--primaire bouton--plein" disabled={envoi || code.length !== 6}>
                {envoi ? 'Vérification…' : 'Se connecter'}
              </button>
              <div className="connexion__liens">
                <button type="button" className="lien" onClick={() => { setEtape('email'); setCode(''); setErreur(''); }}>
                  Changer d’adresse
                </button>
                <button type="button" className="lien" onClick={demanderCode} disabled={envoi}>
                  Renvoyer le code
                </button>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
