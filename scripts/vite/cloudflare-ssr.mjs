export const CLOUDFLARE_SSR_VITE_CONFIG = {
  optimizeDeps: {
    include: [
      'react',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      'react-dom',
      'react-dom/server',
      'astro/assets/services/noop',
      'astro/logger/json',
    ],
    // Astro exposes these as virtual modules during development.
    // The cold SSR gate protects this version-sensitive workaround.
    exclude: ['astro:i18n', 'astro/virtual-modules/i18n.js'],
  },
  resolve: { dedupe: ['react', 'react-dom'] },
};
