const postcssPresetEnv = require('postcss-preset-env');
const tailwindcss = require('tailwindcss');
const autoprefixer = require('autoprefixer');
const postcssNesting = require('postcss-nesting');

module.exports = {
  plugins: [
    postcssNesting(),
    postcssPresetEnv({
      stage: 3,
      features: {
        'nesting-rules': true,
        'custom-properties': false,
        'cascade-layers': false,
        'clamp': false
      }
    }),
    tailwindcss(),
    autoprefixer(),
  ],
};
