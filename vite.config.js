import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/FX30-Hyperfocale-Cadrage-Calcul-instantan-/',
  build: { outDir: 'docs' }
})
