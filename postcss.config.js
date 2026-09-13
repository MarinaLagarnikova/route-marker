export default {
  plugins: {
    '@tailwindcss/postcss': {},
    'postcss-preset-env': {
      stage: 0,
      browsers: 'chrome >= 91',
      autoprefixer: true,
      features: {
        'cascade-layers': true,
        'oklab-function': true,
        'color-mix': true,
      },
    },
  },
}
