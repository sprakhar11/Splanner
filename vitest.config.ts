import { defineConfig } from 'vitest/config'
import path from 'path'

/**
 * Scoped deliberately to the pure layer.
 *
 * The logic worth testing here is the stuff with real branching that is easy to
 * get subtly wrong — spaced repetition ladders, streak counting with skip
 * bridging, day boundaries. Those live in `lib/` and `shared/` as dependency-free
 * modules, so they need no DOM, no database, and no jsdom.
 *
 * Components and routes are verified by running the app, which is why there is no
 * jsdom here and no setup file.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      '@client': path.resolve(import.meta.dirname, './src/client'),
      '@server': path.resolve(import.meta.dirname, './src/server'),
      '@shared': path.resolve(import.meta.dirname, './src/shared'),
    },
  },
  test: {
    environment: 'node',
    include: [
      'src/shared/**/*.test.ts',
      'src/client/lib/**/*.test.ts',
      'src/server/services/**/*.test.ts',
    ],
  },
})
