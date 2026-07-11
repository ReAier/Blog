# Aier's blogs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use test-driven development for behavior-bearing TypeScript utilities and execute tasks in order. Steps use checkbox syntax for tracking.

**Goal:** Build and deploy a Chinese-first Astro static blog with minimal-tech styling, restrained glassmorphism, persistent theme/accent settings, Markdown content, and atomic SSH deployment to `blog.reaier.top`.

**Architecture:** Astro 7 builds all public pages locally from typed content collections. Reusable pure TypeScript utilities cover theme validation, reading time, post sorting, tags, and release retention and are developed test-first with Vitest. A PowerShell deployment script uploads `dist/` into timestamped server releases and atomically switches an Nginx-backed `current` symlink.

**Tech Stack:** Astro 7.0.7, TypeScript 7.0.2, Vitest 4.1.10, `@astrojs/rss` 4.0.19, `@astrojs/sitemap` 3.7.3, handcrafted CSS, Nginx, PowerShell, OpenSSH.

## Global Constraints

- Site name is `Aier's blogs`; navigation mark is `AIER.`.
- Site URL is `http://blog.reaier.top` until ICP filing permits HTTPS.
- Primary language is Simplified Chinese.
- Accent choices are orange-red, teal, indigo, amber, and rose; rose is default.
- No database, SSR, server-side Node process, comments, analytics, search, login, or registration.
- Do not modify AstrBot application configuration or proxy behavior.
- Deployment must keep the previous release available for rollback.

---

### Task 1: Project and test harness

**Files:**
- Create: `package.json`
- Create: `astro.config.ts`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `vitest.config.ts`
- Create: `src/env.d.ts`

**Interfaces:**
- Produces npm scripts: `dev`, `check`, `test`, `build`, `preview`, `deploy`.

- [ ] Install pinned runtime and development dependencies.
- [ ] Add Astro configuration with `site: 'http://blog.reaier.top'`, static output, and sitemap integration.
- [ ] Add strict TypeScript configuration extending `astro/tsconfigs/strict`.
- [ ] Add Vitest Node test environment.
- [ ] Run `npm test -- --run` and confirm the empty suite exits successfully or add a harness smoke test if required.
- [ ] Run `npm run check` and `npm run build` after the first page exists in Task 4.
- [ ] Commit: `chore: scaffold Astro blog`.

### Task 2: Site configuration and preference utilities

**Files:**
- Test: `tests/preferences.test.ts`
- Create: `src/lib/preferences.ts`
- Create: `src/config.ts`

**Interfaces:**
- `ACCENTS`: readonly accent definition array.
- `isAccent(value: unknown): value is AccentName`.
- `resolveTheme(saved: unknown, prefersDark: boolean): 'light' | 'dark'`.
- `SITE`: centralized site metadata and navigation.

- [ ] Write failing tests proving unknown accents are rejected, all five configured accents are accepted, invalid saved theme follows system preference, and explicit light/dark values win.
- [ ] Run `npm test -- tests/preferences.test.ts --run`; verify failure because module/functions do not exist.
- [ ] Implement the minimal preference types, validators, and resolver.
- [ ] Re-run the focused test; verify pass.
- [ ] Add centralized site title, description, URL, author, navigation, and accent metadata.
- [ ] Run all tests.
- [ ] Commit: `feat: add site preferences and configuration`.

### Task 3: Content model and blog utilities

**Files:**
- Test: `tests/content-utils.test.ts`
- Create: `src/content.config.ts`
- Create: `src/lib/content.ts`
- Create: `src/content/blog/welcome.md`
- Create: `src/content/blog/markdown-guide.md`

**Interfaces:**
- `estimateReadingMinutes(text: string, charsPerMinute?: number): number`.
- `sortPostsNewestFirst(posts)`.
- `collectTags(posts): Array<{ name: string; count: number }>`.
- Content schema fields exactly match the approved design.

- [ ] Write failing tests for empty text minimum reading time, Chinese character counting, newest-first sorting, and case-preserving tag deduplication/counts.
- [ ] Verify the focused test fails for missing implementation.
- [ ] Implement minimal pure utilities and make tests pass.
- [ ] Add Astro content schema with required title, description, date, tags, draft and featured fields plus optional updated date and cover.
- [ ] Add the welcome and Markdown demonstration posts with valid frontmatter.
- [ ] Run tests and content validation.
- [ ] Commit: `feat: define blog content model`.

### Task 4: Global visual system and shared shell

**Files:**
- Create: `src/styles/global.css`
- Create: `src/layouts/BaseLayout.astro`
- Create: `src/components/SiteHeader.astro`
- Create: `src/components/SiteFooter.astro`
- Create: `src/components/PreferencePanel.astro`
- Create: `src/components/SeoHead.astro`
- Create: `src/pages/index.astro` (temporary functional home, refined in Task 5)

**Interfaces:**
- `BaseLayout` props: `title`, `description`, optional `image`, optional `article`.
- Preference controls use values defined in `ACCENTS` and persist `aier-theme` / `aier-accent`.

- [ ] Create a failing static contract test in `tests/ui-contract.test.ts` that expects required CSS custom properties, skip link, semantic header/main/footer markers, five accent controls, and reduced-motion media query.
- [ ] Verify the contract test fails because files are absent.
- [ ] Implement the base layout, SEO head, glass navigation, footer, preference panel, pre-paint theme script, and global CSS.
- [ ] Make the contract test pass.
- [ ] Run `npm run check`, `npm test -- --run`, and `npm run build`.
- [ ] Commit: `feat: build minimal glass blog shell`.

### Task 5: Blog components and public routes

**Files:**
- Create: `src/components/PostCard.astro`
- Create: `src/components/PostMeta.astro`
- Create: `src/components/TableOfContents.astro`
- Create: `src/layouts/PostLayout.astro`
- Modify: `src/pages/index.astro`
- Create: `src/pages/posts/index.astro`
- Create: `src/pages/posts/[...slug].astro`
- Create: `src/pages/tags/index.astro`
- Create: `src/pages/tags/[tag].astro`
- Create: `src/pages/archive.astro`
- Create: `src/pages/about.astro`
- Create: `src/pages/404.astro`
- Create: `src/pages/rss.xml.ts`

**Interfaces:**
- All route loaders exclude drafts in production.
- Post pages consume the Astro `render()` result, headings, and reading-time utility.

- [ ] Add failing route-output assertions to `tests/build-output.test.ts` for the required route set, RSS XML, canonical metadata, and exclusion of drafts.
- [ ] Run the test against the current build and verify missing-route failures.
- [ ] Implement reusable cards, metadata, post layout, TOC, home sections, list pages, tag routes, archive, about, 404 and RSS.
- [ ] Build the site, then rerun route-output tests until green.
- [ ] Run `npm run check`, all tests, and production build.
- [ ] Commit: `feat: add blog pages and feeds`.

### Task 6: Accessibility, responsive behavior, and documentation

**Files:**
- Modify: `src/styles/global.css`
- Modify: shared components as required
- Create: `README.md`
- Create: `public/robots.txt`
- Create: `public/favicon.svg`

**Interfaces:**
- README documents article creation, draft preview, configuration, local commands, deployment and rollback.

- [ ] Add failing UI contract assertions for visible focus, mobile navigation, no-motion handling, code overflow, and labeled preference controls.
- [ ] Verify failure before CSS/component changes.
- [ ] Implement responsive and accessibility refinements.
- [ ] Add favicon, robots policy, and complete author documentation.
- [ ] Run check, tests and build.
- [ ] Commit: `docs: add writing and operations guide`.

### Task 7: Atomic deployment script

**Files:**
- Test: `tests/deploy-helpers.test.ts`
- Create: `src/lib/releases.ts`
- Create: `scripts/deploy.ps1`
- Modify: `package.json`

**Interfaces:**
- `selectReleasesToDelete(releases: string[], current: string, keep: number): string[]` never deletes current and retains the newest requested count.
- `npm run deploy` invokes PowerShell with alias `aliyun-aiopt`.

- [ ] Write failing tests for release sorting, current-release preservation, and keeping five releases.
- [ ] Verify focused test failure.
- [ ] Implement release-selection helper and pass tests.
- [ ] Implement deployment script: check, test, build, archive, SCP, remote extract, symlink switch, Nginx validation, health check and rollback.
- [ ] Add a `-DryRun` option that performs local validation/build and prints remote actions without changing the server.
- [ ] Run `npm run deploy -- -DryRun` and confirm success.
- [ ] Commit: `feat: add atomic deployment workflow`.

### Task 8: Server Nginx setup and first release

**Server files:**
- Create: `/etc/nginx/conf.d/blog.conf`
- Create: `/var/www/aier-blog/releases/<timestamp>/`
- Create/update symlink: `/var/www/aier-blog/current`
- Backup under: `/root/ops-backups/<timestamp>/`

- [ ] Record current Nginx configs, listeners, AstrBot health and system resources.
- [ ] Back up `/etc/nginx` relevant configs and current blog paths if present.
- [ ] Upload the first built release without switching live state.
- [ ] Create `blog.conf` with static caching, security headers, custom 404 and `try_files`.
- [ ] Run `nginx -t`; verify success before reload.
- [ ] Atomically switch `current`, reload Nginx and request localhost with `Host: blog.reaier.top`.
- [ ] Recheck `astrbot.reaier.top`, UFW, Docker, memory and failed services.
- [ ] Commit any deployment-script fixes only after reproducing them with a failing test.

### Task 9: Final verification and handoff

- [ ] Run `npm run check`, `npm test -- --run`, and `npm run build` with clean output.
- [ ] Inspect desktop and mobile pages using a local browser.
- [ ] Verify all three theme modes and five accent options persist after reload.
- [ ] Verify RSS and sitemap XML.
- [ ] Verify server Host-header response, Nginx config, AstrBot isolation and no new resident process.
- [ ] Record release path, backup path, deployment command and rollback command.
- [ ] Request final code review before declaring completion.
