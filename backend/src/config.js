// Config centralisée : tout vient du fichier .env (voir .env.example)
import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const liste = (v) => (v || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

export const config = {
  port: Number(process.env.PORT) || 3000,
  prod: process.env.NODE_ENV === 'production',
  databaseUrl: process.env.DATABASE_URL || 'postgres://fablab:fablab@localhost:5440/fablab',
  jwtSecret: process.env.JWT_SECRET,
  frontUrl: process.env.FRONT_URL || 'http://localhost:5173',
  // Liste blanche : ces mails deviennent admin à la connexion
  adminEmails: liste(process.env.ADMIN_EMAILS),
  brevo: {
    apiKey: process.env.BREVO_API_KEY || '', // vide = mails affichés dans la console
    senderEmail: process.env.BREVO_SENDER_EMAIL || 'fablab@ynov.com',
    senderName: process.env.BREVO_SENDER_NAME || 'Fab Lab Ynov',
  },
  contactEmail: process.env.CONTACT_EMAIL || 'fablab@ynov.com',
  uploadDir: path.join(racine, 'uploads'),
  frontDist: path.join(racine, '..', 'frontend', 'dist'),
};

if (!config.jwtSecret) {
  throw new Error('JWT_SECRET manquant : copie .env.example en .env');
}
