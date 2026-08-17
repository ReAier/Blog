import { useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AppearanceControls } from './AppearanceControls';

const navigation = [
  { to: '/', label: '工作台', shortLabel: '首页', end: true },
  { to: '/posts', label: '文章' },
  { to: '/clips', label: '剪切板' },
  { to: '/images', label: '图片库' },
  { to: '/publish', label: '发布与日志', shortLabel: '发布' },
];

function NavItem({
  to,
  label,
  shortLabel,
  end,
}: {
  to: string;
  label: string;
  shortLabel?: string;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => `nav-item${isActive ? ' is-active' : ''}`}
    >
      <span className="nav-label-full">{label}</span>
      <span className="nav-label-short" aria-hidden="true">{shortLabel ?? label}</span>
    </NavLink>
  );
}

export function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const { logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const currentSection = navigation.find(
    (item) => item.to !== '/' && location.pathname.startsWith(item.to),
  )?.label ?? '工作台';

  useEffect(() => {
    setMenuOpen(false);
    setSettingsOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [menuOpen]);
  useEffect(() => {
    if (!settingsOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSettingsOpen(false);
    };
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!settingsRef.current?.contains(event.target as Node)) setSettingsOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
    };
  }, [settingsOpen]);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className={`workspace-shell${menuOpen ? ' menu-open' : ''}`}>
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <header className="admin-header">
        <div className="admin-header-inner">
          <NavLink className="admin-wordmark" to="/" aria-label="Aier Blog 后台首页">
            AIER<span>.</span>
          </NavLink>
          <button
            className="menu-button"
            type="button"
            aria-label="切换主导航"
            aria-expanded={menuOpen}
            aria-controls="admin-primary-navigation"
            onClick={() => setMenuOpen((value) => !value)}
          >
            <span /><span />
          </button>
          <nav id="admin-primary-navigation" className="admin-nav" aria-label="主导航">
            {navigation.map((item) => <NavItem key={item.to} {...item} />)}
          </nav>
          <div className="admin-utilities">
            <span className="admin-context" aria-label={'当前位置：' + currentSection}>{currentSection}</span>
            <AppearanceControls />
            <div className="settings-control" ref={settingsRef}>
              <button
                className="settings-trigger"
                type="button"
                aria-label="设置"
                aria-expanded={settingsOpen}
                aria-controls="admin-settings-menu"
                onClick={() => setSettingsOpen((value) => !value)}
              >
                <svg aria-hidden="true" viewBox="0 0 24 24">
                  <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" />
                  <path d="m19.4 15 .1.1a1.8 1.8 0 0 1-2.5 2.5l-.1-.1a1.8 1.8 0 0 0-3 .9v.2a1.8 1.8 0 0 1-3.6 0v-.2a1.8 1.8 0 0 0-3-.9l-.1.1a1.8 1.8 0 1 1-2.5-2.5l.1-.1a1.8 1.8 0 0 0-.9-3h-.2a1.8 1.8 0 0 1 0-3h.2a1.8 1.8 0 0 0 .9-3l-.1-.1a1.8 1.8 0 1 1 2.5-2.5l.1.1a1.8 1.8 0 0 0 3-.9v-.2a1.8 1.8 0 0 1 3.6 0v.2a1.8 1.8 0 0 0 3 .9l.1-.1a1.8 1.8 0 1 1 2.5 2.5l-.1.1a1.8 1.8 0 0 0 .9 3h.2a1.8 1.8 0 0 1 0 3h-.2a1.8 1.8 0 0 0-.9 3Z" />
                </svg>
                <span>设置</span>
              </button>
              {settingsOpen && (
                <nav id="admin-settings-menu" className="settings-menu" aria-label="设置菜单">
                  <NavLink to="/trash" className={({ isActive }) => 'settings-menu-item' + (isActive ? ' is-active' : '')}>回收站</NavLink>
                  <NavLink to="/backups" className={({ isActive }) => 'settings-menu-item' + (isActive ? ' is-active' : '')}>备份</NavLink>
                  <NavLink to="/security" className={({ isActive }) => 'settings-menu-item' + (isActive ? ' is-active' : '')}>API 与安全</NavLink>
                  <div className="settings-menu-divider" aria-hidden="true" />
                  <button className="settings-menu-item settings-menu-logout" type="button" onClick={handleLogout}>退出登录</button>
                </nav>
              )}
            </div>
          </div>
        </div>
      </header>
      <div className="workspace-main">
        <main id="main-content" className="content-canvas" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function SectionCard({ title, eyebrow, action, children, className = '' }: {
  title: string;
  eyebrow?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`paper-card ${className}`}>
      <header className="card-heading">
        <div>{eyebrow && <span>{eyebrow}</span>}<h2>{title}</h2></div>
        {action}
      </header>
      {children}
    </section>
  );
}
