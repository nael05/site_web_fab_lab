// Onglet 3 : mur des avis + formulaire (si au moins un projet terminé sans avis)
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { CATEGORIES, dateFr } from '../utils/format.js';
import { Etoiles, ChoixEtoiles } from '../components/Etoiles.jsx';

export default function Avis() {
  const [params] = useSearchParams();
  const [avis, setAvis] = useState(null);
  const [eligibles, setEligibles] = useState([]);
  const [form, setForm] = useState({ id_projet: params.get('projet') || '', note: 0, commentaire: '' });
  const [message, setMessage] = useState(null);

  const charger = () => {
    api('/avis').then(setAvis).catch((e) => setMessage({ type: 'erreur', texte: e.message }));
    api('/avis/eligibles').then((liste) => {
      setEligibles(liste);
      setForm((f) => ({ ...f, id_projet: liste.some((p) => String(p.id_projet) === f.id_projet) ? f.id_projet : String(liste[0]?.id_projet ?? '') }));
    }).catch(() => {});
  };
  useEffect(() => { charger(); }, []);

  const moyenne = avis?.length ? avis.reduce((t, a) => t + a.note, 0) / avis.length : 0;

  const envoyer = async (e) => {
    e.preventDefault();
    if (!form.note) return setMessage({ type: 'erreur', texte: 'Choisissez une note.' });
    try {
      await api('/avis', { method: 'POST', body: form });
      setMessage({ type: 'succes', texte: 'Merci pour votre avis !' });
      setForm({ id_projet: '', note: 0, commentaire: '' });
      charger();
    } catch (err) {
      setMessage({ type: 'erreur', texte: err.message });
    }
  };

  return (
    <>
      <div className="titre-page">
        <div>
          <h1>Avis</h1>
          <p className="texte-doux">Les retours des créateurs sur leurs projets.</p>
        </div>
        {avis?.length > 0 && (
          <div className="moyenne">
            <strong>{moyenne.toFixed(1).replace('.', ',')}</strong>
            <Etoiles note={Math.round(moyenne)} />
            <span className="texte-doux">{avis.length} avis</span>
          </div>
        )}
      </div>

      {message && (
        <p className={`alerte alerte--${message.type}`} role={message.type === 'erreur' ? 'alert' : 'status'}>{message.texte}</p>
      )}

      <div className="avis-layout">
        <section className="carte bloc-form avis-form" aria-labelledby="titre-donner-avis">
          <h2 id="titre-donner-avis">Donner mon avis</h2>
          {eligibles.length === 0 ? (
            <p className="texte-doux">
              Vous pourrez laisser un avis dès qu’un de vos projets sera au statut « Terminé ».
            </p>
          ) : (
            <form onSubmit={envoyer}>
              <div className="champ">
                <label htmlFor="projet-avis">Projet</label>
                <select id="projet-avis" value={form.id_projet} onChange={(e) => setForm({ ...form, id_projet: e.target.value })}>
                  {eligibles.map((p) => <option key={p.id_projet} value={p.id_projet}>{p.titre}</option>)}
                </select>
              </div>
              <ChoixEtoiles valeur={form.note} onChange={(note) => setForm({ ...form, note })} />
              <div className="champ">
                <label htmlFor="commentaire">Commentaire</label>
                <textarea id="commentaire" rows={4} maxLength={2000} value={form.commentaire}
                  onChange={(e) => setForm({ ...form, commentaire: e.target.value })} />
              </div>
              <button className="bouton bouton--primaire">Publier</button>
            </form>
          )}
        </section>

        <section aria-label="Tous les avis" className="mur-avis">
          {!avis && <p role="status">Chargement…</p>}
          {avis?.length === 0 && <p className="vide">Aucun avis pour le moment.</p>}
          {avis?.map((a) => (
            <article key={a.id_avis} className="carte avis">
              <header className="avis__entete">
                <span className="avatar" aria-hidden="true">{a.prenom?.[0]}</span>
                <div>
                  <strong>{a.prenom} {a.initiale_nom}.</strong>
                  <p className="surtitre">{a.titre} · {CATEGORIES[a.categorie]}</p>
                </div>
                <Etoiles note={a.note} />
              </header>
              {a.commentaire && <p>{a.commentaire}</p>}
              <p className="texte-doux petit">{dateFr(a.date_avis)}</p>
            </article>
          ))}
        </section>
      </div>
    </>
  );
}
