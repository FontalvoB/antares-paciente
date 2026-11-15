import type { ConfigEnv } from 'vite'
import original from '../../../vite.config.ts'

/** Caché/HMR aislados para no interrumpir el preview compartido de 3.20. */
export default async (env: ConfigEnv) => {
  const config = await original(env)
  return { ...config, cacheDir: '.artifacts/vite-qa410', server: { ...config.server, hmr: false } }
}
