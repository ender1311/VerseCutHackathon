import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // The studio renders to <canvas> and previews Blob/object-URL assets; the
      // Next <Image> optimizer doesn't apply to these, so plain <img> is correct.
      '@next/next/no-img-element': 'off',
      // Fetch-on-open / clamp-on-change effects are intentional here; keep as a
      // hint rather than a hard gate failure.
      'react-hooks/set-state-in-effect': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'node_modules/**',
    'src/lib/iconCatalog.ts',
    'src/lib/bible/appLanguages.ts',
  ]),
]);

export default eslintConfig;
