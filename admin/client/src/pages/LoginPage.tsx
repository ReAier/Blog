import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppearanceControls } from '../components/AppearanceControls';
import { useAuth } from '../context/AuthContext';

export function LoginPage() {
  const [key, setKey] = useState('');
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const submit = async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(undefined);
    try {
      await login({ key: key.trim() });
      setKey('');
      navigate('/', { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '登录失败，请检查后台 Key。');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="login-page">
      <header className="auth-utility-bar">
        <a className="auth-site-mark" href="https://blog.reaier.top">Aier<span>.</span>Blog</a>
        <AppearanceControls />
      </header>
      <section className="login-editorial" aria-label="Aier Blog 内部工作区">
        <div className="login-rule">
          <span>PRIVATE EDITION</span>
          <span>{new Date().toLocaleDateString('zh-CN')}</span>
        </div>
        <div className="login-lead">
          <span className="edition-seal" aria-hidden="true">编</span>
          <p className="eyebrow">Aier Blog · 编辑工作区</p>
          <h1>继续写<span>。</span></h1>
        </div>
      </section>
      <section className="login-panel" aria-label="登录表单">
        <form onSubmit={submit}>
          <div className="form-heading">
            <span className="eyebrow">Key sign in</span>
            <h1>进入编辑部</h1>
          </div>
          {error && <div className="inline-alert" role="alert">{error}</div>}
          <label className="field">
            <span>后台 Key</span>
            <input
              type="password"
              name="key"
              autoComplete="off"
              placeholder="er-…"
              value={key}
              onChange={(event) => setKey(event.target.value)}
              required
              autoFocus
            />
          </label>
          <button className="primary-button login-submit" type="submit" disabled={submitting}>
            {submitting ? '正在核验…' : '打开工作台'}
          </button>
        </form>
      </section>
    </main>
  );
}
