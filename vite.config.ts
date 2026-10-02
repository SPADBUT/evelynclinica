import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/**
 * Dual-host base path:
 * - Vercel (root):        VITE_BASE_PATH=/
 * - GitHub Pages (subpath): VITE_BASE_PATH=/evelynclinica/
 * Default keeps GitHub Pages / local preview paths working when unset.
 */
function resolveViteBase(raw: string | undefined): string {
  const trimmed = (raw ?? '/evelynclinica/').trim()
  if (!trimmed || trimmed === '/') return '/'
  return trimmed.endsWith('/') ? trimmed : `${trimmed}/`
}

export default defineConfig({
  base: resolveViteBase(process.env.VITE_BASE_PATH),
  plugins: [react(), tailwindcss()],
})
