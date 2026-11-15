import type { ConfigEnv } from 'vite'
import original from '../../../vite.config.ts'

/** Preview propio: sin HMR para capturas aisladas y sin modificar otros previews. */
export default async (env: ConfigEnv) => {
  const config = await original(env)
  return { ...config, cacheDir: '.artifacts/vite-premium', server: { ...config.server, hmr: false } }
}
