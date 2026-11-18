// Onglet 4 : infos du Fab Lab + formulaire de renseignement + lien vers le chat
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

// Infos à adapter
const HORAIRES = [
  ['Lundi – Jeudi', '9h00 – 18h00'],
  ['Vendredi', '9h00 – 16h00'],
  ['Week-end', 'Fermé'],
];

export default function Contact() {
  const [form, setForm] = useState({ sujet: '', message: '' });
  const [etat, setEtat] = useState(null);
  const [envoi, setEnvoi] = useState(false);

  const envoyer = async (e) => {
    e.preventDefault();
    setEnvoi(true);
    try {
      await api('/contact', { method: 'POST', body: form });
      setEtat({ type: 'succes', texte: 'Message envoyé, l’équipe vous répond par mail.' });
      setForm({ sujet: '', message: '' });
    } catch (err) {
      setEtat({ type: 'erreur', texte: err.message });
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <>
      <h1>Contact</h1>
      <p className="texte-doux">Une question sur le Fab Lab ? On est là.</p>

      <div className="contact-grille">
        <section className="carte bloc-form" aria-labelledby="titre-infos">
          <h2 id="titre-infos">Le Fab Lab</h2>
          <dl className="liste-def">
            <dt>Localisation</dt><dd>Ynov Campus — bâtiment principal, salle Fab Lab (RDC)</dd>
            <dt>E-mail</dt><dd><a href="mailto:fablab@ynov.com">fablab@ynov.com</a></dd>
          </dl>
          <h3>Horaires d’ouverture</h3>
          <table className="tableau">
            <caption className="visuellement-cache">Horaires d’ouverture du Fab Lab</caption>
            <tbody>
              {HORAIRES.map(([j, h]) => <tr key={j}><th scope="row">{j}</th><td>{h}</td></tr>)}
            </tbody>
          </table>
        </section>

        <section className="carte bloc-form" aria-labelledby="titre-charte">
          <h2 id="titre-charte">Charte de bonne conduite</h2>
          <ul className="charte">
            <li>Je ne lance pas de machine sans un membre de l’équipe.</li>
            <li>Je respecte les créneaux fixés dans la messagerie.</li>
            <li>Je range et nettoie mon poste après usage.</li>
            <li>Je porte les protections pour le ponçage et la peinture.</li>
            <li>Je signale tout problème matériel à l’équipe.</li>
          </ul>
          <div className="encart-chat">
            <p><strong>Besoin d’un créneau ou d’une réponse rapide ?</strong></p>
            <Link to="/messagerie" className="bouton bouton--primaire">💬 Ouvrir ma conversation</Link>
          </div>
        </section>

        <section className="carte bloc-form contact-form" aria-labelledby="titre-form-contact">
          <h2 id="titre-form-contact">Demande de renseignement</h2>
          {etat && <p className={`alerte alerte--${etat.type}`} role={etat.type === 'erreur' ? 'alert' : 'status'}>{etat.texte}</p>}
          <form onSubmit={envoyer}>
            <div className="champ">
              <label htmlFor="sujet">Sujet <span className="obligatoire">*</span></label>
              <input id="sujet" maxLength={150} value={form.sujet} onChange={(e) => setForm({ ...form, sujet: e.target.value })} required />
            </div>
            <div className="champ">
              <label htmlFor="message-contact">Message <span className="obligatoire">*</span></label>
              <textarea id="message-contact" rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} required />
            </div>
            <button className="bouton bouton--primaire" disabled={envoi}>{envoi ? 'Envoi…' : 'Envoyer'}</button>
          </form>
        </section>
      </div>
    </>
  );
}
