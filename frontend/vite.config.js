// Vite : en dev, /api, /uploads et /socket.io sont redirigés vers le back (port 3000)
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const back = 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': back,
      '/uploads': back,
      '/socket.io': { target: back, ws: true },
    },
  },
});
