// Formulaire de contact -> mail à l'équipe (CONTACT_EMAIL)
//   POST /api/contact   { sujet, message }
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../middleware/auth.js';
import { envoyerMail, mailContact } from '../services/mail.js';

const router = Router();

router.post('/', rateLimit({ windowMs: 60 * 60 * 1000, limit: 5 }), requireAuth, async (req, res) => {
  const sujet = String(req.body.sujet || '').trim().slice(0, 150);
  const message = String(req.body.message || '').trim().slice(0, 5000);
  if (!sujet || !message) return res.status(400).json({ erreur: 'Sujet et message obligatoires' });

  await envoyerMail(mailContact({
    de: req.user.email,
    nom: [req.user.prenom, req.user.nom].filter(Boolean).join(' '),
    sujet,
    message,
  }));
  res.json({ ok: true });
});

export default router;
