// Auth : JWT dans un cookie httpOnly "token" (ou header Authorization: Bearer pour Postman)
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { query } from '../db.js';

export const COOKIE = 'token';
const DUREE_JOURS = 7;

export function creerSession(res, utilisateur) {
  const token = jwt.sign({ id: utilisateur.id_utilisateur }, config.jwtSecret, { expiresIn: `${DUREE_JOURS}d` });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.prod,
    maxAge: DUREE_JOURS * 24 * 3600 * 1000,
  });
}

export function lireToken(req) {
    const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return req.cookies?.[COOKIE];
}

// Renvoie l'utilisateur du token, ou null (le rôle est relu en BDD à chaque fois)
export async function utilisateurDepuisToken(token) {
  if (!token) return null;
  let id;
  try {
    ({ id } = jwt.verify(token, config.jwtSecret));
  } catch {
    return null; // token invalide ou expiré
  }
  // Une erreur BDD remonte (500) au lieu de passer pour "non connecté"
  const { rows } = await query(
    'SELECT id_utilisateur, email, nom, prenom, role FROM utilisateur WHERE id_utilisateur = $1',
    [id],
    );
  return rows[0] || null;
}

// À mettre sur toute route qui demande d'être connecté -> remplit req.user
export async function requireAuth(req, res, next) {
  const user = await utilisateurDepuisToken(lireToken(req));
  if (!user) return res.status(401).json({ erreur: 'Non connecté' });
  req.user = user;
  next();
}

// À mettre APRÈS requireAuth sur les routes admin
export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ erreur: 'Réservé aux admins' });
  next();
}

// Routes client uniquement (un admin passe par /api/admin)
export function requireClient(req, res, next) {
  if (req.user?.role !== 'client') return res.status(403).json({ erreur: 'Réservé aux clients' });
  next();
}
