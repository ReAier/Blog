import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(process.cwd(), 'admin', 'client');
const read = (relativePath: string) => readFile(join(root, relativePath), 'utf8');

describe('admin app shell behavior', () => {
  it('renders all destinations as route links in the persistent top navigation', async () => {
    const shell = await read('src/components/AppShell.tsx');

    expect(shell).toContain('<header className="admin-header">');
    expect(shell).toContain('<nav id="admin-primary-navigation" className="admin-nav" aria-label="主导航">');
    expect(shell).toContain('<NavLink');
    expect(shell).toContain('useEffect(() => setMenuOpen(false), [location.pathname])');
    expect(shell).not.toContain('menu-scrim');
  });

  it('keeps editor initialization stable across parent renders', async () => {
    const editor = await read('src/components/MarkdownEditor.tsx');

    expect(editor).toContain('const defaultExtensions: Extension[] = []');
    expect(editor).toContain('extensions = defaultExtensions');
    expect(editor).toContain('const onReadyRef = useRef(onReady)');
    expect(editor).toContain('onReadyRef.current = onReady');
    expect(editor).toContain('}, [ariaLabel, extensions, language]);');
    expect(editor).not.toContain('}, [ariaLabel, extensions, onReady]);');
  });
});

describe('admin navigation copy', () => {
  it('labels the clip destination as 剪切板', async () => {
    const shell = await read('src/components/AppShell.tsx');

    expect(shell).toContain("{ to: '/clips', label: '剪切板' }");
    expect(shell).not.toContain("label: 'Clips'");
  });
});

describe('admin authentication expiry handling', () => {
  it('clears the active user when the API transport broadcasts a 401', async () => {
    const auth = await read('src/context/AuthContext.tsx');

    expect(auth).toContain("window.addEventListener('admin:auth-required'");
    expect(auth).toContain('setUser(undefined)');
    expect(auth).toContain("window.removeEventListener('admin:auth-required'");
  });
});
