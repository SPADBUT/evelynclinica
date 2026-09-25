import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Free GitHub Pages URL: https://spadbut.github.io/evelynclinica/
export default defineConfig({
  base: '/evelynclinica/',
  plugins: [react(), tailwindcss()],
})
