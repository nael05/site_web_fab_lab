// Temps réel (Socket.IO). Chaque socket rejoint :
//   - "utilisateur:<id>" (ses notifs perso)
//   - "admins" si c'est un admin
// Événements envoyés au front :
//   "message:nouveau" (chat)   "projet:maj" (statut / % / bilan changé)
import { Server } from 'socket.io';
import { utilisateurDepuisToken, COOKIE } from './middleware/auth.js';
import { config } from './config.js';

let io;

const lireCookie = (header = '', nom) =>
  header.split(';').map((c) => c.trim().split('=')).find(([k]) => k === nom)?.[1];

export function initRealtime(httpServer) {
  io = new Server(httpServer, { cors: { origin: config.frontUrl, credentials: true } });

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token || lireCookie(socket.handshake.headers.cookie, COOKIE);
    const user = await utilisateurDepuisToken(token && decodeURIComponent(token)).catch(() => null);
    if (!user) return next(new Error('Non connecté'));
    socket.data.user = user;
    next();
  });

  io.on('connection', (socket) => {
    const { id_utilisateur, role } = socket.data.user;
    socket.join(`utilisateur:${id_utilisateur}`);
    if (role === 'admin') socket.join('admins');
  });
}

// Prévenir un utilisateur précis (ex : le client dont le projet a changé)
export const emitToUser = (idUtilisateur, event, data) => io?.to(`utilisateur:${idUtilisateur}`).emit(event, data);

// Prévenir tous les admins connectés
export const emitToAdmins = (event, data) => io?.to('admins').emit(event, data);
