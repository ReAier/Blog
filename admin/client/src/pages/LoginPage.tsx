import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AppearanceControls } from '../components/AppearanceControls';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [secondFactor, setSecondFactor] = useState('totp');
  const [totp, setTotp] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(undefined);
    try {
      await login({
        username: username.trim(),
        password,
        ...(secondFactor === 'totp' ? { totp: totp.replace(/\s/g, '') } : { recoveryCode: recoveryCode.trim() }),
      });
      navigate('/', { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '登录失败，请检查凭据。');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="login-page">
      <header className="auth-utility-bar">
        <a className="auth-site-mark" href="https://blog.reaier.top" aria-label="返回 Aier Blog">
          Aier<span>.</span>Blog
        </a>
        <AppearanceControls />
      </header>
      <section className="login-editorial" aria-labelledby="login-title">
        <div className="login-rule"><span>PRIVATE EDITION</span><span>{new Date().toLocaleDateString('zh-CN')}</span></div>
        <div className="login-lead">
          <span className="edition-seal" aria-hidden="true">编</span>
          <p className="eyebrow">Aier Blog · 内部工作区</p>
          <h1 id="login-title">把想法整理成<br /><em>可被阅读的作品。</em></h1>
          <p>编辑文章、维护代码剪藏、管理图像，并在同一张桌面上完成发布。</p>
        </div>
        <blockquote>“文字的最后一道工序，是让每个细节都显得理所当然。”</blockquote>
      </section>
      <section className="login-panel" aria-label="登录表单">
        <form onSubmit={handleSubmit}>
          <div className="form-heading">
            <span className="eyebrow">Editor sign in</span>
            <h2>进入编辑部</h2>
            <p>需要账户密码与第二验证因素。</p>
          </div>
          {error && <div className="inline-alert" role="alert">{error}</div>}
          <label className="field">
            <span>用户名</span>
            <input name="username" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required autoFocus />
          </label>
          <label className="field">
            <span>密码</span>
            <input type="password" name="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>
          <fieldset className="factor-fieldset">
            <legend>第二验证因素</legend>
            <div className="segmented-control">
              <button type="button" className={secondFactor === 'totp' ? 'is-active' : ''} aria-pressed={secondFactor === 'totp'} onClick={() => setSecondFactor('totp')}>动态验证码</button>
              <button type="button" className={secondFactor === 'recovery' ? 'is-active' : ''} aria-pressed={secondFactor === 'recovery'} onClick={() => setSecondFactor('recovery')}>恢复码</button>
            </div>
            {secondFactor === 'totp' ? (
              <label className="field">
                <span>6 位动态验证码</span>
                <input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" value={totp} onChange={(event) => setTotp(event.target.value)} required />
              </label>
            ) : (
              <label className="field">
                <span>一次性恢复码</span>
                <input autoComplete="off" value={recoveryCode} onChange={(event) => setRecoveryCode(event.target.value)} required />
              </label>
            )}
          </fieldset>
          <button className="primary-button login-submit" type="submit" disabled={submitting}>
            {submitting ? '正在核验…' : '打开工作台'}
          </button>
          <p className="security-note"><span aria-hidden="true">◆</span> 会话仅使用同源安全 Cookie，不在浏览器持久保存凭据。</p>
        </form>
      </section>
    </main>
  );
}
