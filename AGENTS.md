# Repository Guidelines

## Project Structure & Module Organization

This is an Astro 7 static blog. Application code lives in `src/`: reusable UI in `components/`, page shells in `layouts/`, routes in `pages/`, shared TypeScript helpers in `lib/`, browser scripts in `scripts/`, and global styling in `styles/global.css`. Blog posts are Markdown files under `src/content/blog/`; reusable code clips live in `src/content/clips/`. Static files belong in `public/`. Tests are in `tests/`, deployment tooling is in `scripts/`, and generated output (`dist/`, `.astro/`, `.deploy/`) should not be edited or committed.

## Build, Test, and Development Commands

- `npm install` installs dependencies from `package-lock.json`.
- `npm run dev` starts the Astro development server.
- `npm run check` runs Astro and TypeScript validation.
- `npm test -- --run` runs Vitest once; use `npm test` for watch mode.
- `npm run build` validates and generates the production site in `dist/`.
- `npm run preview` serves the production build locally.
- `npm run deploy -- -DryRun` validates the PowerShell deployment flow without switching the live release.

## Coding Style & Naming Conventions

Use TypeScript with Astro's strict configuration. Match existing formatting: two-space indentation, single quotes in TypeScript, semicolons, and trailing commas in multiline structures. Name Astro components in PascalCase (`PostCard.astro`), functions and variables in camelCase, and route/content files with descriptive lowercase names, preferably kebab-case. Keep site metadata in `src/config.ts`; avoid duplicating configuration across components. No formatter or linter is configured; preserve nearby style and rely on `npm run check`.

## Testing Guidelines

Vitest runs in the Node environment. Add tests in `tests/` using the `*.test.ts` pattern and descriptive `describe`/`it` blocks. Cover utility behavior, generated markup contracts, accessibility policies, and production output when changing related features. Run both `npm test -- --run` and `npm run build` before submitting changes.

## Commit & Pull Request Guidelines

Recent history follows Conventional Commit-style subjects such as `feat: add ICP registration to footer`, `fix: expand article card hover gradient`, and `test: verify motion accessibility and output`. Use an imperative, scoped summary and keep each commit focused. Pull requests should explain the change, list verification commands, link relevant issues, and include screenshots for visible UI changes. Call out content-schema, deployment, or configuration changes explicitly.

## Security & Configuration Tips

Do not commit `.env*`, logs, deployment archives, credentials, or server details. Treat `npm run deploy` as a production operation; use `-DryRun` first and verify the intended SSH target and generated build.
