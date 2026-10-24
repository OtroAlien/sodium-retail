import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// base relativo para poder publicar la demo en cualquier subcarpeta (ej. GitHub Pages)
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
})
