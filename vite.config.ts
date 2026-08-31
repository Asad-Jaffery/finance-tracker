import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { localDataPlugin } from './vite-plugin-local-data.ts'

export default defineConfig({
  plugins: [react(), localDataPlugin()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
})
