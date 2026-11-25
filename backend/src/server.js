// Point d'entrée du back : API REST + Socket.IO
import express from 'express';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { pool } from './db.js';
import { initRealtime } from './realtime.js';

import authRoutes from './routes/auth.js';
import produitsRoutes from './routes/produits.js';
import projetsRoutes from './routes/projets.js';
import portfolioRoutes from './routes/portfolio.js';
import avisRoutes from './routes/avis.js';
import chatRoutes from './routes/chat.js';
import contactRoutes from './routes/contact.js';
import adminRoutes from './routes/admin/index.js';

const app = express();
app.set('trust proxy', 1);
app.use(helmet());
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// ⚠️ ROUTE DE DEV : donne un token pour l'utilisateur :id. Désactivée en production.
if (!config.prod) {
    app.get('/api/dev/token/:id', (req, res) => {
        const id = Number(req.params.id);
        const token = jwt.sign({ id }, config.jwtSecret, { expiresIn: '7d' });
        res.json({ id, token });
    });
}

// Photos du portfolio (publiques une fois connecté côté front)
app.use('/uploads/portfolio', express.static(path.join(config.uploadDir, 'portfolio'), {
  setHeaders: (res) => res.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'"),
}));

app.get('/api/sante', async (req, res) => {
  await pool.query('SELECT 1');
  res.json({ ok: true });
});

app.use('/api/auth', authRoutes);
app.use('/api/produits', produitsRoutes);
app.use('/api/projets', projetsRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/avis', avisRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/admin', adminRoutes);

app.use('/api', (req, res) => res.status(404).json({ erreur: 'Route inconnue' }));

// En prod : le back sert aussi le front buildé (npm run build dans frontend/)
if (fs.existsSync(config.frontDist)) {
  app.use(express.static(config.frontDist));
  app.get('/{*page}', (req, res) => res.sendFile(path.join(config.frontDist, 'index.html')));
}

// Gestion d'erreurs centralisée : toujours { erreur: '...' }
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Fichier trop lourd' : err.field || err.message;
    return res.status(400).json({ erreur: msg });
  }
  if (err.status) return res.status(err.status).json({ erreur: err.message });
  // Erreurs PostgreSQL : 23505 = doublon, 23514 = CHECK, 23503 = clé étrangère
  if (err.code === '23505') return res.status(409).json({ erreur: 'Cet élément existe déjà' });
  if (err.code === '23514' || err.code === '23503' || err.code === '22P02') {
    return res.status(400).json({ erreur: 'Données invalides', detail: err.constraint });
  }
  console.error(err);
  res.status(500).json({ erreur: 'Erreur serveur' });
});

const server = http.createServer(app);
initRealtime(server);
server.listen(config.port, () => console.log(`✅ API Fab Lab sur http://localhost:${config.port}`));
