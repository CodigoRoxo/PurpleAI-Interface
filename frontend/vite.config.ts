import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  // Reaproveita o .env do backend para que o proxy envie o token da API, se configurado
  const backendEnv = loadEnv(mode, path.resolve(__dirname, '../backend'), '');
  const apiToken = process.env.PURPLEAI_API_TOKEN || backendEnv.PURPLEAI_API_TOKEN || '';
  const backendPort = backendEnv.PORT || '3001';

  return {
    plugins: [react()],
    server: {
      port: 3000,
      proxy: {
        '/api': {
          target: `http://127.0.0.1:${backendPort}`,
          headers: apiToken ? { 'x-purpleai-token': apiToken } : undefined,
        },
      },
    },
  };
});
