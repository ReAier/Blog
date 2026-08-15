import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AppearanceControls } from './AppearanceControls';

const navigation = [
  { to: '/', label: '工作台', shortLabel: '首页', end: true },
  { to: '/posts', label: '文章' },
  { to: '/clips', label: '剪切板' },
  { to: '/images', label: '图片库' },
  { to: '/backups', label: '备份' },
  { to: '/publish', label: '发布与日志', shortLabel: '发布' },
  { to: '/security', label: 'API 与安全', shortLabel: '安全' },
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
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const currentSection = navigation.find(
    (item) => item.to !== '/' && location.pathname.startsWith(item.to),
  )?.label ?? '工作台';

  useEffect(() => setMenuOpen(false), [location.pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [menuOpen]);

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
            <span className="admin-context" aria-label={`当前位置：${currentSection}`}>{currentSection}</span>
            <AppearanceControls />
            <div className="account-menu">
              <div className="account-copy">
                <strong>{user?.displayName || user?.username}</strong>
                <span>责任编辑</span>
              </div>
              <span className="avatar" aria-hidden="true">
                {(user?.displayName || user?.username || 'A').slice(0, 1).toUpperCase()}
              </span>
              <button className="text-button" type="button" onClick={handleLogout}>退出</button>
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
