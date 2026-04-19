module.exports = {
  parser: '@typescript-eslint/parser',
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended'
  ],
  plugins: ['@typescript-eslint'],
  rules: {
    // Google style rules
    'indent': ['error', 2],
    'quotes': ['error', 'single'],
    'semi': ['error', 'always'],
    'no-var': 'error',
    'prefer-const': 'error',
    'max-len': ['error', { 'code': 80 }],
    // Add more as needed
  },
  env: {
    node: true,
    es2020: true
  }
};