import typescriptEslint from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'

export default [{
  ignores: ['**/out', '**/dist']
}, {
  plugins: {
    '@typescript-eslint': typescriptEslint
  },
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: 'module'
  },
  rules: {
    '@typescript-eslint/naming-convention': ['warn', { selector: 'import', format: ['camelCase', 'PascalCase'] }],
    'comma-dangle': ['error', 'never'],
    'eol-last': ['error', 'always'],
    'max-len': ['error', { code: 120 }],
    'no-throw-literal': 'warn',
    'no-trailing-spaces': 'error',
    'quote-props': ['error', 'as-needed'],
    curly: ['error', 'multi-or-nest'],
    eqeqeq: 'error',
    indent: ['error', 2],
    quotes: ['error', 'single', { allowTemplateLiterals: true }],
    semi: ['error', 'never']
  }
}]
