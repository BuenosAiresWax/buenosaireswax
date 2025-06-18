import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  base: './', // <<--- Esta línea es clave para rutas relativas en producción
  plugins: [react()],
})
