// Auth par code OTP envoyé par mail (comptes @ynov.com uniquement)
//   POST /api/auth/demander-code   { email }
//   POST /api/auth/verifier-code   { email, code }
//   GET  /api/auth/moi
//   POST /api/auth/deconnexion
import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { query, transaction } from '../db.js';
import { config } from '../config.js';
import { creerSession, requireAuth, COOKIE } from '../middleware/auth.js';
import { envoyerMail, mailCodeOtp } from '../services/mail.js';

const router = Router();

const OTP_MINUTES = 10;
const OTP_MAX_TENTATIVES = 5;
const EMAIL_YNOV = /^[a-z0-9._%+-]+@ynov\.com$/;

const limiteur = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, message: { erreur: 'Trop de tentatives, réessayez plus tard' } });
router.use(['/demander-code', '/verifier-code'], limiteur);

const normaliser = (email) => String(email || '').trim().toLowerCase();

// "prenom.nom@ynov.com" -> { prenom: 'Prenom', nom: 'Nom' }
function nomDepuisEmail(email) {
  const maj = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : null);
  const [prenom, nom] = email.split('@')[0].split('.');
  return { prenom: maj(prenom), nom: maj(nom) };
}

router.post('/demander-code', async (req, res) => {
  const email = normaliser(req.body.email);
  if (!EMAIL_YNOV.test(email)) return res.status(400).json({ erreur: 'Utilisez votre adresse @ynov.com' });

  // Rôle recalculé à chaque connexion depuis la liste blanche ADMIN_EMAILS
  const role = config.adminEmails.includes(email) ? 'admin' : 'client';
  const { prenom, nom } = nomDepuisEmail(email);

  const { rows } = await query(
    `INSERT INTO utilisateur (email, prenom, nom, role) VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role
     RETURNING id_utilisateur`,
    [email, prenom, nom, role],
  );
  const idUtilisateur = rows[0].id_utilisateur;

  // Anti-spam : 1 code par minute max
  const recent = await query(
    `SELECT 1 FROM code_otp WHERE id_utilisateur = $1 AND NOT est_utilise
       AND date_expiration > now() + make_interval(mins => $2)`,
    [idUtilisateur, OTP_MINUTES - 1],
  );
  if (recent.rowCount) return res.status(429).json({ erreur: 'Un code vient d’être envoyé, patientez une minute' });

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  await transaction(async (db) => {
    // Un seul code valide à la fois
    await db.query('UPDATE code_otp SET est_utilise = true WHERE id_utilisateur = $1 AND NOT est_utilise', [idUtilisateur]);
    await db.query(
      `INSERT INTO code_otp (id_utilisateur, code_hash, date_expiration)
       VALUES ($1, $2, now() + make_interval(mins => $3))`,
      [idUtilisateur, await bcrypt.hash(code, 10), OTP_MINUTES],
    );
  });

  await envoyerMail(mailCodeOtp(email, code));
  res.json({ ok: true });
});

router.post('/verifier-code', async (req, res) => {
  const email = normaliser(req.body.email);
  const code = String(req.body.code || '').trim();

  const { rows } = await query(
    `SELECT o.id_otp, o.code_hash, o.nb_tentatives, u.id_utilisateur
       FROM code_otp o JOIN utilisateur u USING (id_utilisateur)
      WHERE u.email = $1 AND NOT o.est_utilise AND o.date_expiration > now()
      ORDER BY o.id_otp DESC LIMIT 1`,
    [email],
  );
  const otp = rows[0];
  if (!otp) return res.status(400).json({ erreur: 'Code expiré ou inexistant, demandez-en un nouveau' });

  if (!(await bcrypt.compare(code, otp.code_hash))) {
    const tentatives = otp.nb_tentatives + 1;
    await query('UPDATE code_otp SET nb_tentatives = $2, est_utilise = $3 WHERE id_otp = $1', [
      otp.id_otp, tentatives, tentatives >= OTP_MAX_TENTATIVES,
    ]);
    const reste = OTP_MAX_TENTATIVES - tentatives;
    return res.status(400).json({
      erreur: reste > 0 ? `Code incorrect (${reste} essai(s) restant(s))` : 'Trop d’erreurs, demandez un nouveau code',
    });
  }

  const user = await transaction(async (db) => {
    await db.query('UPDATE code_otp SET est_utilise = true WHERE id_otp = $1', [otp.id_otp]);
    const { rows: u } = await db.query(
      `UPDATE utilisateur SET est_verifie = true WHERE id_utilisateur = $1
       RETURNING id_utilisateur, email, nom, prenom, role`,
      [otp.id_utilisateur],
    );
    // Chaque client a sa conversation avec les admins
    if (u[0].role === 'client') {
      await db.query('INSERT INTO conversation (id_client) VALUES ($1) ON CONFLICT DO NOTHING', [otp.id_utilisateur]);
    }
    return u[0];
  });

  creerSession(res, user);
  res.json({ utilisateur: user });
});

router.get('/moi', requireAuth, (req, res) => res.json({ utilisateur: req.user }));

router.post('/deconnexion', (req, res) => {
  res.clearCookie(COOKIE);
  res.json({ ok: true });
});

export default router;
