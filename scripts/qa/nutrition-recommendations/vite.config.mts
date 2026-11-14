import type { ConfigEnv } from 'vite';
import original from '../../../vite.config';

/** Servidor del harness: configuración del producto, sin ruido de WebSocket HMR. */
export default async (env: ConfigEnv) => {
  const config = await original(env);
  return { ...config, server: { ...config.server, hmr: false } };
};
