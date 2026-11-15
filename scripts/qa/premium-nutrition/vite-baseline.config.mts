import type { ConfigEnv } from 'vite'
import original from '../../../vite.config.ts'

/** Solo lectura: git archive 20057df en .artifacts/premium-baseline, puerto propio. */
export default async (env: ConfigEnv) => {
  const config = await original(env)
  return { ...config, cacheDir: '.artifacts/vite-premium-before', server: { ...config.server, hmr: false } }
}
