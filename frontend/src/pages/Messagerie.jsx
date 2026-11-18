// Chat privé : le client parle à toute l'équipe admin (temps réel)
import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../socket.js';
import { dateFr, heureFr } from '../utils/format.js';

const estImage = (chemin) => /\.(png|jpe?g|webp)$/i.test(chemin || '');

export default function Messagerie() {
  const { user } = useAuth();
  const [messages, setMessages] = useState(null);
  const [texte, setTexte] = useState('');
  const [piece, setPiece] = useState(null);
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const filRef = useRef(null);
  const fichierRef = useRef(null);

  useEffect(() => {
    api('/chat/messages').then((d) => setMessages(d.messages)).catch((e) => setErreur(e.message));
  }, []);

  // Ajout sans doublon (le message arrive aussi par socket)
  const ajouter = (m) => setMessages((old) => (old?.some((x) => x.id_message === m.id_message) ? old : [...(old || []), m]));
  useSocket('message:nouveau', ajouter);

  useEffect(() => {
    // Descend en bas du fil (sans faire bouger la page)
    if (filRef.current) filRef.current.scrollTop = filRef.current.scrollHeight;
  }, [messages]);

  const envoyer = async (e) => {
    e.preventDefault();
    if (!texte.trim() && !piece) return;
    const form = new FormData();
    form.append('contenu', texte);
    if (piece) form.append('piece_jointe', piece);
    setEnvoi(true);
    try {
      ajouter(await api('/chat/messages', { method: 'POST', form }));
      setTexte('');
      setPiece(null);
      if (fichierRef.current) fichierRef.current.value = '';
      setErreur('');
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnvoi(false);
    }
  };

  let jourPrecedent = '';

  return (
    <>
      <h1>Messagerie</h1>
      <p className="texte-doux">Votre conversation privée avec l’équipe du Fab Lab (créneaux, questions, photos…).</p>

      <section className="carte chat" aria-label="Conversation avec l’équipe">
        <div ref={filRef} className="chat__fil" role="log" aria-live="polite" aria-relevant="additions">
          {!messages && !erreur && <p role="status">Chargement…</p>}
          {messages?.length === 0 && <p className="vide">Aucun message. Écrivez à l’équipe !</p>}
          {messages?.map((m) => {
            const moi = m.auteur.id === user.id_utilisateur;
            const jour = dateFr(m.date_envoi);
            const separateur = jour !== jourPrecedent;
            jourPrecedent = jour;
            return (
              <div key={m.id_message}>
                {separateur && <p className="chat__jour">{jour}</p>}
                <div className={`bulle ${moi ? 'bulle--moi' : 'bulle--equipe'}`}>
                  <p className="bulle__auteur">{moi ? 'Moi' : `${m.auteur.prenom} · Équipe Fab Lab`}</p>
                  {m.contenu && <p className="bulle__texte">{m.contenu}</p>}
                  {m.a_piece_jointe && (estImage(m.piece_jointe) ? (
                    <a href={`/api/chat/pieces/${m.id_message}`} target="_blank" rel="noreferrer">
                      <img className="bulle__image" src={`/api/chat/pieces/${m.id_message}`} alt="Image envoyée" />
                    </a>
                  ) : (
                    <a className="bulle__fichier" href={`/api/chat/pieces/${m.id_message}`} target="_blank" rel="noreferrer">
                      📎 Pièce jointe
                    </a>
                  ))}
                  <p className="bulle__heure">{heureFr(m.date_envoi)}</p>
                </div>
              </div>
            );
          })}
        </div>

        {erreur && <p className="alerte alerte--erreur" role="alert">{erreur}</p>}

        <form className="chat__saisie" onSubmit={envoyer}>
          <label htmlFor="piece" className="bouton bouton--icone" title="Joindre un fichier">
            <span aria-hidden="true">📎</span><span className="visuellement-cache">Joindre un fichier</span>
          </label>
          <input id="piece" ref={fichierRef} type="file" className="visuellement-cache"
            accept=".png,.jpg,.jpeg,.webp,.pdf,.stl" onChange={(e) => setPiece(e.target.files[0] || null)} />
          <label htmlFor="texte-chat" className="visuellement-cache">Votre message</label>
          <textarea
            id="texte-chat"
            rows={1}
            placeholder={piece ? `📎 ${piece.name} — ajouter un message…` : 'Écrire un message…'}
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) envoyer(e); }}
          />
          <button className="bouton bouton--primaire" disabled={envoi || (!texte.trim() && !piece)}>Envoyer</button>
        </form>
      </section>
    </>
  );
}
