// Temps réel (Socket.IO). Connexion ouverte une fois l'utilisateur connecté.
// Dans un composant : useSocket('projet:maj', () => recharger())
import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

let socket = null;

export function connecterSocket() {
  if (!socket) socket = io({ withCredentials: true });
  else if (!socket.active) socket.connect(); // refusé avant connexion -> on retente
  return socket;
}

export function deconnecterSocket() {
  socket?.disconnect();
  socket = null;
}

export function useSocket(evenement, handler) {
  const ref = useRef(handler);
  ref.current = handler;

  useEffect(() => {
    const s = connecterSocket();
    const ecoute = (data) => ref.current(data);
    s.on(evenement, ecoute);
    return () => s.off(evenement, ecoute);
  }, [evenement]);
}
