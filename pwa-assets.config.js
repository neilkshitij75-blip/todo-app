import {
  defineConfig,
  minimal2023Preset,
  createAppleSplashScreens,
} from '@vite-pwa/assets-generator/config'

// Generates favicon, PWA icons (192/512 + maskable), apple-touch-icon,
// and iOS splash screens from a single 512x512 source SVG.
export default defineConfig({
  headLinkOptions: {
    preset: '2023',
  },
  preset: {
    ...minimal2023Preset,
    // The source is already a full-bleed purple square, so render the
    // "regular" icons at full bleed too (no extra transparent padding).
    transparent: {
      sizes: [64, 192, 512],
      favicons: [[48, 'favicon.ico']],
      padding: 0,
    },
    maskable: {
      sizes: [512],
      padding: 0,
      resizeOptions: { background: '#863bff' },
    },
    apple: {
      sizes: [180],
      padding: 0,
      resizeOptions: { background: '#863bff' },
    },
    // iOS splash screens (portrait + landscape) on the brand background.
    appleSplashScreens: createAppleSplashScreens(
      {
        padding: 0.4,
        resizeOptions: { fit: 'contain', background: '#863bff' },
        darkResizeOptions: { fit: 'contain', background: '#863bff' },
        linkMediaOptions: { log: true, addMediaScreen: true, basePath: '/' },
      },
      ['iPhone 16 Pro Max', 'iPhone 15 Pro', 'iPhone 14', 'iPhone SE 4.7"', 'iPad Pro 11"'],
    ),
  },
  images: ['pwa-assets/icon.svg'],
})
