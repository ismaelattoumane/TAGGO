import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

/**
 * Vitest configuration.
 *
 * `exclude` MUST keep the default ignores plus the temporary Agent Manager
 * git worktrees (`.kilo/worktrees/**`). Those directories contain a full
 * stale copy of the project, and the default glob collected it: the suite then
 * executed duplicated, outdated tests (an older commit without orders, profile
 * or lifecycle coverage), and the reported test count changed every time a
 * worktree was created or removed. Excluding them makes the suite deterministic
 * and keeps every count tied to the current source tree.
 *
 * `scripts/**` est exclu de la même façon : ces fichiers sont des outils
 * (`scripts/rls-http.test.mjs` est le scénario HTTP de l'étape 13.1, lancé par
 * `npm run test:db` et non par vitest). Sans cette exclusion, vitest les
 * collectedait et échouait sur « No test suite found ».
 */
const testExclude = [
  '**/node_modules/**',
  '**/dist/**',
  '**/.{idea,git,cache,output,temp}/**',
  '**/.kilo/worktrees/**',
  '**/scripts/**',
]

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    exclude: testExclude,
  },
})