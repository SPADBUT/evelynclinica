import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Custom domain (evelynclinica.com.br) serves from site root.
export default defineConfig({
  base: '/',
  plugins: [react(), tailwindcss()],
})
