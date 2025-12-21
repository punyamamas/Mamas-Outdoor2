import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
  },
  // Define process.env to prevent crashes in libraries expecting Node environment
  define: {
    'process.env': {}
  }
});