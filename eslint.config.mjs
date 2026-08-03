import globals from 'globals'
import typescriptEslint from 'typescript-eslint'
import stylistic from '@stylistic/eslint-plugin'

export default [{
  ignores: ['dist', 'node_modules', 'test', '!**/test/scripts/'],
}, {
  files: ['**/*.ts'],
  plugins: {
    '@typescript-eslint': typescriptEslint.plugin,
    '@stylistic': stylistic
  },
  languageOptions: {
    parser: typescriptEslint.parser,
    ecmaVersion: 2022,
    sourceType: 'module',
    globals: {
      ...globals.node
    }
  },
  rules: {
    '@typescript-eslint/naming-convention': ['warn', { selector: 'import', format: ['camelCase', 'PascalCase'] }],
    '@stylistic/member-delimiter-style': [
      'error',
      {
        multiline: {
          delimiter: 'none',
          requireLast: false
        },
        singleline: {
          delimiter: 'comma',
          requireLast: false
        }
      }
    ],
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
