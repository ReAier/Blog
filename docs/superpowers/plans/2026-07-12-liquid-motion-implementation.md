# Liquid Motion System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add restrained liquid motion to every major blog interaction while preserving static deployment, reading clarity, graceful fallback, and mobile performance.

**Architecture:** Mount Astro's `ClientRouter` and a persistent motion shell in `BaseLayout.astro`. Keep policy in a pure TypeScript module, WebGL in one controller, and DOM interactions in an idempotent controller reinitialized on `astro:page-load` with `AbortController` cleanup.

**Tech Stack:** Astro 7, TypeScript, native CSS/View Transitions, WebGL 1, Vitest, IntersectionObserver, requestAnimationFrame.

## Global Constraints

- No backend, database, server process, Three.js, GSAP, video, 3D model, or texture asset.
- New compressed JS below 150KB; first-load addition below 300KB; page transition 350–500ms.
- Desktop targets 60 FPS; mobile caps at 30 FPS and DPR 1.25.
- Fluid intensity: home 1, posts .7, article .3, tags/archive .6, about .55.
- Reduced motion, WebGL failure, hidden tabs, and unsupported browsers preserve full usability.
- Initializers must be idempotent across Astro swaps and clean previous listeners.
- Existing content, URLs, storage keys, tests, and deployment remain compatible.

## File Map

**Create:**
- `src/lib/motion.ts`: pure motion policy helpers.
- `src/components/MotionShell.astro`: persistent canvas, veil, progress and live region.
- `src/scripts/fluid-background.ts`: WebGL lifecycle and shader.
- `src/scripts/motion-controller.ts`: page lifecycle and DOM interactions.
- `tests/motion-policy.test.ts`, `tests/motion-contract.test.ts`.

**Modify:** `BaseLayout.astro`, `PostLayout.astro`, `SiteHeader.astro`, `PreferencePanel.astro`, `CodeEnhancer.astro`, `TableOfContents.astro`, `PostCard.astro`, primary pages, `global.css`, and existing contract/build tests.

---

### Task 1: Motion Policy Primitives

**Files:** Create `src/lib/motion.ts`, `tests/motion-policy.test.ts`.

**Produces:** `PageKind`, `MotionProfile`, `resolvePageKind`, `resolveMotionProfile`, `isEnhancedNavigation`, `createFrameGate`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { createFrameGate, isEnhancedNavigation, resolveMotionProfile, resolvePageKind } from '../src/lib/motion';

describe('motion policy', () => {
  it.each([['/','home'],['/posts/','posts'],['/posts/welcome/','article'],['/tags/','taxonomy'],['/archive/','taxonomy'],['/about/','about'],['/x/','default']] as const)('maps %s', (path, kind) => expect(resolvePageKind(path)).toBe(kind));
  it('disables motion when reduced', () => expect(resolveMotionProfile({ mobile:false, reduced:true, pageKind:'home' })).toEqual({ enabled:false, fps:0, dpr:1, intensity:0 }));
  it('caps mobile article motion', () => expect(resolveMotionProfile({ mobile:true, reduced:false, pageKind:'article' })).toEqual({ enabled:true, fps:30, dpr:1.25, intensity:.3 }));
  it('only enhances same-origin page links', () => {
    const origin='http://localhost:4321';
    expect(isEnhancedNavigation({href:`${origin}/posts/`,origin,target:'',download:false,modified:false})).toBe(true);
    expect(isEnhancedNavigation({href:'https://github.com/ReAier/Blog',origin,target:'',download:false,modified:false})).toBe(false);
    expect(isEnhancedNavigation({href:`${origin}/rss.xml`,origin,target:'',download:false,modified:false})).toBe(false);
  });
  it('throttles frames', () => { const gate=createFrameGate(30); expect(gate(0)).toBe(true); expect(gate(10)).toBe(false); expect(gate(34)).toBe(true); });
});
```

- [ ] **Step 2: Verify RED**

```powershell
npm test -- --run tests/motion-policy.test.ts
```

Expected: module-not-found failure.

- [ ] **Step 3: Implement `src/lib/motion.ts`**

```ts
export type PageKind='home'|'posts'|'article'|'taxonomy'|'about'|'default';
export interface MotionProfile { enabled:boolean; fps:0|30|60; dpr:number; intensity:number; }
const intensity:Record<PageKind,number>={home:1,posts:.7,article:.3,taxonomy:.6,about:.55,default:.45};
export function resolvePageKind(path:string):PageKind {
  if(path==='/') return 'home';
  if(/^\/posts\/[^/]+\/$/.test(path)) return 'article';
  if(path.startsWith('/posts/')) return 'posts';
  if(path.startsWith('/tags/')||path.startsWith('/archive/')) return 'taxonomy';
  if(path.startsWith('/about/')) return 'about';
  return 'default';
}
export function resolveMotionProfile(i:{mobile:boolean;reduced:boolean;pageKind:PageKind}):MotionProfile {
  if(i.reduced) return {enabled:false,fps:0,dpr:1,intensity:0};
  return {enabled:true,fps:i.mobile?30:60,dpr:i.mobile?1.25:1.75,intensity:intensity[i.pageKind]};
}
export function isEnhancedNavigation(i:{href:string;origin:string;target:string;download:boolean;modified:boolean}) {
  const url=new URL(i.href,i.origin);
  return !i.modified&&!i.download&&(!i.target||i.target==='_self')&&url.origin===i.origin&&!url.pathname.endsWith('/rss.xml');
}
export function createFrameGate(fps:30|60){const interval=1000/fps;let previous=-Infinity;return(time:number)=>{if(time-previous<interval)return false;previous=time;return true;};}
```

- [ ] **Step 4: Verify GREEN and commit**

```powershell
npm test -- --run tests/motion-policy.test.ts
git add src/lib/motion.ts tests/motion-policy.test.ts
git commit -m "feat: add motion performance policy"
```

---

### Task 2: Persistent Motion Shell and Router

**Files:** Create `src/components/MotionShell.astro`, `tests/motion-contract.test.ts`; modify `BaseLayout.astro`, `global.css`, `ui-contract.test.ts`.

**Produces hooks:** `data-fluid-canvas`, `data-transition-veil`, `data-reading-progress`, `data-motion-status`, `data-page-kind`.

- [ ] **Step 1: Write failing contracts**

```ts
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
const read=(path:string)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
describe('motion shell',()=>{
  it('mounts router and shell',async()=>{const x=await read('src/layouts/BaseLayout.astro');expect(x).toContain("from 'astro:transitions'");expect(x).toContain('<ClientRouter');expect(x).toContain('<MotionShell');expect(x).toContain('data-page-kind');});
  it('provides persistent layers',async()=>{const x=await read('src/components/MotionShell.astro');for(const token of ['data-fluid-canvas','data-transition-veil','data-reading-progress','aria-live="polite"','transition:persist'])expect(x).toContain(token);});
});
```

Extend `ui-contract.test.ts` to require `::view-transition-old(root)` and `::view-transition-new(root)`.

- [ ] **Step 2: Verify RED**

```powershell
npm test -- --run tests/motion-contract.test.ts tests/ui-contract.test.ts
```

- [ ] **Step 3: Create the shell**

```astro
---
interface Props { pageKind:string; }
const { pageKind }=Astro.props;
---
<div class="motion-shell" data-motion-shell data-page-kind={pageKind} transition:persist="motion-shell">
  <canvas class="fluid-canvas" data-fluid-canvas aria-hidden="true"></canvas>
  <div class="transition-veil" data-transition-veil aria-hidden="true"></div>
  <div class="reading-progress" data-reading-progress aria-hidden="true"><span></span></div>
  <p class="sr-only" data-motion-status aria-live="polite"></p>
</div>
```

- [ ] **Step 4: Mount in `BaseLayout.astro`**

Import `ClientRouter`, `MotionShell`, and `resolvePageKind`; compute `pageKind=props.article?'article':resolvePageKind(Astro.url.pathname)`. Put `<ClientRouter />` in `<head>`, `<MotionShell pageKind={pageKind}/>` first in `<body>`, and set `body data-page-kind={pageKind}`.

- [ ] **Step 5: Add shell/view-transition CSS**

```css
:root{--motion-fast:160ms;--motion-base:280ms;--motion-page:440ms;--motion-ease:cubic-bezier(.22,1,.36,1)}
.motion-shell{position:fixed;inset:0;z-index:-1;pointer-events:none;overflow:hidden}.fluid-canvas{position:absolute;inset:0;width:100%;height:100%;opacity:.52}.transition-veil{position:absolute;width:44vmax;aspect-ratio:1;left:var(--veil-x,50%);top:var(--veil-y,50%);border-radius:42% 58% 55% 45%;background:radial-gradient(circle,rgba(var(--accent-rgb),.26),transparent 68%);filter:blur(28px);transform:translate(-50%,-50%) scale(0);opacity:0}.reading-progress{position:fixed;z-index:80;inset:0 0 auto;height:2px;opacity:0}.reading-progress span{display:block;width:100%;height:100%;background:var(--accent);transform:scaleX(var(--reading-progress,0));transform-origin:left}body[data-page-kind="article"] .reading-progress{opacity:1}
::view-transition-old(root){animation:page-out var(--motion-page) var(--motion-ease) both}::view-transition-new(root){animation:page-in var(--motion-page) var(--motion-ease) both}@keyframes page-out{to{opacity:0;transform:scale(.985);filter:blur(4px)}}@keyframes page-in{from{opacity:0;transform:translateY(12px);filter:blur(3px)}}
```

- [ ] **Step 6: Verify and commit**

```powershell
npm test -- --run tests/motion-contract.test.ts tests/ui-contract.test.ts
npm run check
git add src/components/MotionShell.astro src/layouts/BaseLayout.astro src/styles/global.css tests/motion-contract.test.ts tests/ui-contract.test.ts
git commit -m "feat: add persistent page motion shell"
```

---

### Task 3: Adaptive Fluid WebGL Background

**Files:** Create `src/scripts/fluid-background.ts`; modify `MotionShell.astro`, `src/env.d.ts`, `motion-contract.test.ts`.

**Consumes:** motion policy helpers. **Produces:** `startFluidBackground(canvas):()=>void`.

- [ ] **Step 1: Add failing source contract**

```ts
it('implements pausable WebGL with fallback',async()=>{const x=await read('src/scripts/fluid-background.ts');for(const token of ["canvas.getContext('webgl'","document.visibilityState === 'hidden'","prefers-reduced-motion","webglcontextlost",'requestAnimationFrame','aier:preference-change'])expect(x).toContain(token);});
```

- [ ] **Step 2: Verify RED**

```powershell
npm test -- --run tests/motion-contract.test.ts
```

- [ ] **Step 3: Implement the controller**

Use these shaders:

```ts
const VERTEX=`attribute vec2 position;void main(){gl_Position=vec4(position,0.,1.);}`;
const FRAGMENT=`precision mediump float;uniform vec2 resolution,pointer;uniform float time,intensity;uniform vec3 accent;float wave(vec2 p){return sin(p.x*2.1+time*.18)+sin(p.y*2.7-time*.14)+sin((p.x+p.y)*1.4+time*.11);}void main(){vec2 uv=(gl_FragCoord.xy-.5*resolution.xy)/min(resolution.x,resolution.y);float field=wave(uv+pointer*.08)*.166;float glow=smoothstep(.72,.05,length(uv-pointer*.22)+field*.12);vec3 paper=vec3(.94,.92,.89);vec3 color=mix(paper,accent,.12+.16*glow+.06*field);gl_FragColor=vec4(color,intensity*(.16+.24*glow));}`;
```

`startFluidBackground` must compile/link safely; draw a fullscreen strip; read `--accent-rgb`; interpolate pointer input; resize with `ResizeObserver`; cap DPR/profile; throttle mobile frames; recompute page kind on `astro:page-load`; pause while hidden; set `data-fluid-fallback="true"` on failure/context loss; and return cleanup that removes listeners, observer, RAF and GL resources.

- [ ] **Step 4: Initialize once from `MotionShell.astro`**

```astro
<script>
  import { startFluidBackground } from '../scripts/fluid-background';
  const canvas=document.querySelector<HTMLCanvasElement>('[data-fluid-canvas]');
  if(canvas&&!window.__aierFluidCleanup) window.__aierFluidCleanup=startFluidBackground(canvas);
</script>
```

Declare `Window.__aierFluidCleanup?:()=>void` in `src/env.d.ts`.

- [ ] **Step 5: Verify and commit**

```powershell
npm test -- --run tests/motion-policy.test.ts tests/motion-contract.test.ts
npm run check
npm run build
git add src/scripts/fluid-background.ts src/components/MotionShell.astro src/env.d.ts tests/motion-contract.test.ts
git commit -m "feat: add adaptive fluid WebGL background"
```

---

### Task 4: Idempotent Page Interaction Lifecycle

**Files:** Create `src/scripts/motion-controller.ts`; modify `MotionShell.astro`, `SiteHeader.astro`, `TableOfContents.astro`, `global.css`, `motion-contract.test.ts`.

**Produces:** `initializeMotionPage():()=>void`, reinitialized on `astro:page-load`.

- [ ] **Step 1: Add failing lifecycle contract**

```ts
it('reinitializes after Astro swaps',async()=>{const x=await read('src/scripts/motion-controller.ts');for(const token of ["astro:page-load",'AbortController','IntersectionObserver','data-reading-progress','aria-current'])expect(x).toContain(token);});
```

- [ ] **Step 2: Verify RED**

```powershell
npm test -- --run tests/motion-contract.test.ts
```

- [ ] **Step 3: Add header and TOC hooks**

Add `<span class="nav-indicator" data-nav-indicator aria-hidden="true"></span>` inside the nav. Remove the existing one-shot mobile-menu script. Add `data-toc` to the TOC nav and `data-toc-link` to its links.

- [ ] **Step 4: Implement lifecycle controller**

`initializeMotionPage()` creates one `AbortController`, binds with `{signal}`, and:

```ts
const controller=new AbortController();
const {signal}=controller;
document.body.dataset.pageKind=resolvePageKind(location.pathname);
```

It must observe `[data-reveal]`; update `--reading-progress` through one RAF-scheduled scroll handler only on article pages; observe `.prose h2[id],.prose h3[id]` and set matching TOC `aria-current="location"`; control mobile menu plus Escape; position nav indicator from `aria-current="page"`; set veil coordinates on eligible link pointerdown; set `html.dataset.transitioning='true'` on `astro:before-preparation`; clear it and announce the title on `astro:page-load`; and return `()=>controller.abort()`.

Module footer:

```ts
let cleanup=()=>{};
const boot=()=>{cleanup();cleanup=initializeMotionPage();};
document.addEventListener('astro:page-load',boot);
boot();
```

- [ ] **Step 5: Import controller and style states**

Import `../scripts/motion-controller` in `MotionShell.astro`. Add:

```css
[data-reveal]{opacity:0;transform:translateY(16px);transition:opacity var(--motion-base) var(--motion-ease),transform var(--motion-base) var(--motion-ease);transition-delay:var(--reveal-delay,0ms)}[data-reveal][data-revealed="true"]{opacity:1;transform:none}.nav-indicator{position:absolute;height:2px;bottom:6px;left:0;width:var(--nav-w,0);transform:translateX(var(--nav-x,0));background:var(--accent);transition:transform var(--motion-base),width var(--motion-base)}[data-toc-link][aria-current="location"]{color:var(--accent);transform:translateX(4px)}
```

- [ ] **Step 6: Verify and commit**

```powershell
npm test -- --run tests/motion-contract.test.ts tests/ui-contract.test.ts
npm run check
git add src/scripts/motion-controller.ts src/components/MotionShell.astro src/components/SiteHeader.astro src/components/TableOfContents.astro src/styles/global.css tests/motion-contract.test.ts
git commit -m "feat: coordinate page motion lifecycle"
```

---

### Task 5: Swap-Safe Preferences and Code Copy

**Files:** Modify `PreferencePanel.astro`, `CodeEnhancer.astro`, `global.css`, `preferences.test.ts`, `code-copy.test.ts`.

**Contracts:** preference changes dispatch `aier:preference-change`; code buttons use `data-copy-state=idle|success|error`; all initializers rerun safely on `astro:page-load`.

- [ ] **Step 1: Write failing contracts**

Add to code-copy test:

```ts
for(const token of ['data-code-enhanced',"dataset.copyState = 'success'","dataset.copyState = 'error'","astro:page-load"]) expect(component).toContain(token);
```

Add source assertions to preferences test:

```ts
for(const token of ["new CustomEvent('aier:preference-change'","astro:page-load","event.key === 'Escape'"]) expect(panel).toContain(token);
```

- [ ] **Step 2: Verify RED**

```powershell
npm test -- --run tests/code-copy.test.ts tests/preferences.test.ts
```

- [ ] **Step 3: Refactor code enhancer**

Create `enhanceCodeBlocks()` selecting `.prose pre:not([data-code-enhanced])`; mark before wrapping; create the existing button with `idle`; on clipboard success set `success`/`已复制 ✓` then reset after 1400ms; on failure set `error`/`复制失败` then reset after 1800ms. Run immediately and on `astro:page-load`.

- [ ] **Step 4: Refactor preferences**

Wrap current behavior in `initializePreferences()` with abort cleanup. Requery after every page load; apply stored values; dispatch `aier:preference-change` after applying; close on outside click, Escape, and `astro:before-preparation`; preserve all ARIA and storage behavior.

- [ ] **Step 5: Add feedback CSS**

```css
.code-copy{transition:color var(--motion-fast),background var(--motion-fast),transform var(--motion-fast)}.code-copy:active{transform:scale(.94)}.code-copy[data-copy-state="success"]{color:var(--accent)}.code-copy[data-copy-state="error"]{color:#c43d3d}.preference-panel{transform-origin:top right;transition:opacity var(--motion-base),transform var(--motion-base),visibility var(--motion-base)}.preference-panel[data-open="false"]{opacity:0;transform:translateY(-8px) scale(.96);visibility:hidden}.preference-panel[data-open="true"]{opacity:1;transform:none;visibility:visible}
```

- [ ] **Step 6: Verify and commit**

```powershell
npm test -- --run tests/code-copy.test.ts tests/preferences.test.ts tests/motion-contract.test.ts
npm run check
git add src/components/CodeEnhancer.astro src/components/PreferencePanel.astro src/styles/global.css tests/code-copy.test.ts tests/preferences.test.ts
git commit -m "feat: animate resilient interaction feedback"
```

---

### Task 6: Page-Specific Reveal and Microinteractions

**Files:** Modify `PostLayout.astro`, `PostCard.astro`, all primary pages, `motion-controller.ts`, `global.css`, `motion-contract.test.ts`.

**Hooks:** animated units use `data-reveal`; pointer cards use `data-motion-card`, `--pointer-x`, `--pointer-y`.

- [ ] **Step 1: Add failing coverage contract**

```ts
it('marks every page family for reveal',async()=>{for(const file of ['src/pages/index.astro','src/pages/posts/index.astro','src/pages/tags/index.astro','src/pages/archive.astro','src/pages/about.astro','src/layouts/PostLayout.astro'])expect(await read(file)).toContain('data-reveal');expect(await read('src/components/PostCard.astro')).toContain('data-motion-card');});
```

- [ ] **Step 2: Verify RED**

```powershell
npm test -- --run tests/motion-contract.test.ts
```

- [ ] **Step 3: Add semantic hooks**

Mark home eyebrow/title/aside, section headings/cards, page headers, grids/lists, article header/content/aside/footer, tag groups, archive groups, about and 404. Use delays `0ms`, `70ms`, `140ms`, capped at `210ms`; never animate each prose paragraph. Add `data-motion-card` to component and inline home cards.

- [ ] **Step 4: Add pointer-light behavior**

In the controller, when `(hover:none)` is false, bind pointermove to cards, calculate percentage coordinates from `getBoundingClientRect()`, set CSS variables, and reset both to `50%` on pointerleave.

- [ ] **Step 5: Add common microinteraction CSS**

```css
.post-card{position:relative;overflow:hidden;transition:transform var(--motion-base) var(--motion-ease),border-color var(--motion-base),box-shadow var(--motion-base)}.post-card::before{content:"";position:absolute;inset:-1px;pointer-events:none;background:radial-gradient(260px circle at var(--pointer-x,50%) var(--pointer-y,50%),rgba(var(--accent-rgb),.13),transparent 68%);opacity:0;transition:opacity var(--motion-base)}.post-card:hover{transform:translateY(-6px);border-color:rgba(var(--accent-rgb),.42)}.post-card:hover::before{opacity:1}.post-card:active{transform:translateY(-2px) scale(.992)}.text-link,.site-nav a,.tag{transition:color var(--motion-fast),transform var(--motion-fast),background var(--motion-fast)}.text-link:hover{transform:translateX(3px)}.tag:active,.icon-button:active,.choice-button:active{transform:scale(.94)}
```

Also add a one-shot hero sweep, archive timeline activation, mobile menu stagger, compact header transition, and smooth theme/accent variables. Keep prose links restrained.

- [ ] **Step 6: Verify and commit**

```powershell
npm test -- --run tests/motion-contract.test.ts tests/ui-contract.test.ts
npm run check
npm run build
git add src/layouts/PostLayout.astro src/components/PostCard.astro src/pages src/scripts/motion-controller.ts src/styles/global.css tests/motion-contract.test.ts
git commit -m "feat: animate primary blog interactions"
```

---

### Task 7: Accessibility, Integration, Performance, Deploy

**Files:** Modify `global.css`, `motion-contract.test.ts`, `build-output.test.ts`.

- [ ] **Step 1: Add failing final contracts**

```ts
it('fully disables spatial motion when requested',async()=>{const css=await read('src/styles/global.css');for(const token of ['@media (prefers-reduced-motion: reduce)','.fluid-canvas','animation-duration: .01ms','scroll-behavior: auto'])expect(css).toContain(token);});
```

Add build test:

```ts
it('ships the motion shell',async()=>{const html=await readFile(dist('index.html'),'utf8');expect(html).toContain('data-fluid-canvas');expect(html).toContain('data-transition-veil');});
```

- [ ] **Step 2: Verify RED if fallback is incomplete**

```powershell
npm test -- --run tests/motion-contract.test.ts tests/build-output.test.ts
```

- [ ] **Step 3: Complete fallback CSS**

```css
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;scroll-behavior:auto!important}.fluid-canvas,.transition-veil{display:none!important}[data-reveal]{opacity:1!important;transform:none!important}}html[data-fluid-fallback="true"] .fluid-canvas{display:none}@media(max-width:720px){.fluid-canvas{opacity:.34}.post-card:hover{transform:none}}
```

- [ ] **Step 4: Run complete verification**

```powershell
npm run check
npm test -- --run
npm run build
```

Expected: Astro 0 diagnostics, all tests pass, all routes build.

- [ ] **Step 5: Measure budget**

```powershell
$js=(Get-ChildItem dist\_astro -Filter *.js|Measure-Object Length -Sum).Sum
$all=(Get-ChildItem dist -Recurse -File|Measure-Object Length -Sum).Sum
"js_kb=$([math]::Round($js/1KB,1)) total_mb=$([math]::Round($all/1MB,2))"
```

If new JS exceeds 150KB, remove duplicate bundles or nonessential shader math; do not raise the budget.

- [ ] **Step 6: Local visual verification**

```powershell
npm run dev
```

Check desktop and mobile: nav transitions, back/forward, hero/card reveal, article progress/TOC, theme/accent shader update, copy after navigation, repeated mobile-menu use, reduced motion, and WebGL-disabled fallback.

- [ ] **Step 7: Rehearse, commit, deploy, verify and push**

```powershell
npm run deploy -- -DryRun
git add src/styles/global.css tests/motion-contract.test.ts tests/build-output.test.ts
git commit -m "test: verify motion accessibility and output"
npm run deploy
git push origin main
```

Expected: archive succeeds; atomic release, `nginx -t`, and health check pass; source-origin `/`, `/posts/`, `/posts/markdown-guide/` return 200 and contain `data-fluid-canvas`; local `main` equals `origin/main`.
