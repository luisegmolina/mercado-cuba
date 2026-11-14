import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.luis.mercadocuba',
  appName: 'Mercado Cuba',
  webDir: 'build',
  // La APK carga la web en vivo: los cambios de la web se ven sin
  // recompilar la APK. El backend ya permite capacitor://localhost.
  server: {
    url: 'https://mercado-cuba.pages.dev',
    cleartext: false
  }
};

export default config;
