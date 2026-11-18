// Envoi des mails via l'API Brevo.
// Sans BREVO_API_KEY (dev), le mail est juste affiché dans la console.
import { config } from '../config.js';

const esc = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const gabarit = (titre, corps) => `
  <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#1a2433">
    <div style="background:#0b1b2b;color:#fff;padding:16px 24px;border-radius:8px 8px 0 0">
      <strong>Fab Lab</strong> <span style="color:#23b2a4">Ynov</span>
    </div>
    <div style="border:1px solid #e3e8ee;border-top:0;padding:24px;border-radius:0 0 8px 8px">
      <h2 style="margin-top:0">${esc(titre)}</h2>${corps}
    </div>
  </div>`;

export async function envoyerMail({ to, subject, html, replyTo }) {
  if (!config.brevo.apiKey) {
    console.log(`\n📧 [MAIL DEV] à ${to} — ${subject}\n${html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}\n`);
    return;
  }
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': config.brevo.apiKey, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: { email: config.brevo.senderEmail, name: config.brevo.senderName },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      ...(replyTo && { replyTo: { email: replyTo } }),
    }),
  });
  if (!res.ok) throw new Error(`Brevo ${res.status} : ${await res.text()}`);
}

// Envoi "fire and forget" : une panne mail ne bloque pas la requête
export const envoyerMailSansAttendre = (mail) =>
  envoyerMail(mail).catch((err) => console.error('Erreur mail :', err.message));

// ---------- Modèles de mails ----------

export const mailCodeOtp = (to, code) => ({
  to,
  subject: `Votre code Fab Lab : ${code}`,
  html: gabarit('Votre code de connexion', `
    <p>Voici votre code à usage unique (valable 10 minutes) :</p>
    <p style="font-size:32px;letter-spacing:8px;font-weight:bold">${esc(code)}</p>
    <p style="color:#5b6675">Si vous n'êtes pas à l'origine de cette demande, ignorez ce mail.</p>`),
});

export const mailDepotProjet = (to, titre) => ({
  to,
  subject: `Projet reçu : ${titre}`,
  html: gabarit('Votre projet a bien été déposé', `
    <p>Le projet <strong>${esc(titre)}</strong> est en attente de validation par l'équipe du Fab Lab.</p>
    <p>Vous serez prévenu(e) par mail à chaque étape.</p>
    <p><a href="${config.frontUrl}/projets">Suivre mon projet</a></p>`),
});

// Pour l'admin : mail à chaque changement de statut (accepté, en impression, prêt, terminé...)
export const mailChangementStatut = (to, titre, libelleStatut, message = '') => ({
  to,
  subject: `${titre} : ${libelleStatut}`,
  html: gabarit(`Votre projet est « ${libelleStatut} »`, `
    <p>Projet : <strong>${esc(titre)}</strong></p>
    ${message ? `<p>${esc(message)}</p>` : ''}
    <p><a href="${config.frontUrl}/projets">Voir mon projet</a></p>`),
});

export const mailContact = ({ de, nom, sujet, message }) => ({
  to: config.contactEmail,
  replyTo: de,
  subject: `[Contact] ${sujet}`,
  html: gabarit('Nouvelle demande de renseignement', `
    <p><strong>De :</strong> ${esc(nom)} (${esc(de)})</p>
    <p><strong>Sujet :</strong> ${esc(sujet)}</p>
    <p style="white-space:pre-wrap">${esc(message)}</p>`),
});
