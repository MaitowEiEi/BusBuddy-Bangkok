import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/ชื่อ-repository-ของคุณ/', // ตัวอย่างเช่น '/busbuddy-bangkok/'
});

