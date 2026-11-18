// Upload de fichiers (multer). Fichiers rangés dans uploads/<dossier>/<uuid>.<ext>
// En BDD on stocke le chemin relatif : "projets/abc.stl"
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { config } from '../config.js';

const IMAGES = ['.png', '.jpg', '.jpeg', '.webp'];

function creerUpload(dossier, extensions, maxMo) {
  const dest = path.join(config.uploadDir, dossier);
  fs.mkdirSync(dest, { recursive: true });

  return multer({
    storage: multer.diskStorage({
      destination: dest,
      filename: (req, file, cb) => cb(null, crypto.randomUUID() + path.extname(file.originalname).toLowerCase()),
    }),
    limits: { fileSize: maxMo * 1024 * 1024, files: 10 },
    fileFilter: (req, file, cb) => {
      // multer lit les noms en latin1 : on remet en UTF-8 pour les accents
      file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
      const ok = extensions.includes(path.extname(file.originalname).toLowerCase());
      cb(ok ? null : new multer.MulterError('LIMIT_UNEXPECTED_FILE', `Format refusé (${extensions.join(', ')})`), ok);
    },
  });
}

export const uploadProjet = creerUpload('projets', ['.stl', ...IMAGES, '.pdf'], 50);
export const uploadChat = creerUpload('chat', [...IMAGES, '.pdf', '.stl'], 20);
export const uploadPortfolio = creerUpload('portfolio', IMAGES, 10); // pour l'admin

// Chemin relatif à stocker en BDD
export const cheminRelatif = (file) => path.relative(config.uploadDir, file.path).split(path.sep).join('/');

// Chemin absolu à partir de la valeur BDD (protégé contre "../")
export function cheminAbsolu(relatif) {
  const abs = path.resolve(config.uploadDir, relatif);
  if (!abs.startsWith(config.uploadDir + path.sep)) throw new Error('Chemin invalide');
  return abs;
}

// Supprime les fichiers uploadés si la requête échoue
export function supprimerFichiers(files = []) {
  for (const f of files) fs.unlink(f.path, () => {});
}
