import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { AppearanceControls } from '../components/AppearanceControls';
import { useAuth } from '../context/AuthContext';
import type {
  AdminSetupChallenge,
  AdminSetupConfirmation,
  AdminSetupStatus,
} from '../types';

interface SetupPageProps {
  status: AdminSetupStatus;
}

function tokenFromHash(): string {
  const values = new URLSearchParams(window.location.hash.replace(/^#/u, ''));
  return values.get('token')?.trim() ?? '';
}

function downloadRecoveryCodes(username: string, codes: readonly string[]): void {
  const text = [
    'Aier Blog 管理后台恢复码',
    `管理员：${username}`,
    `生成时间：${new Date().toISOString()}`,
    '',
    ...codes,
    '',
    '每个恢复码只能使用一次，请离线保存。',
  ].join('\n');
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `aier-blog-recovery-codes-${new Date().toISOString().slice(0, 10)}.txt`;
  link.click();
  URL.revokeObjectURL(url);
}

export function SetupPage({ status }: SetupPageProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [token, setToken] = useState(tokenFromHash);
  const [username, setUsername] = useState('owner');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [challenge, setChallenge] = useState<AdminSetupChallenge>();
  const [totpCode, setTotpCode] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [confirmation, setConfirmation] = useState<AdminSetupConfirmation>();
  const [acknowledged, setAcknowledged] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const { acceptSetupSession, refreshSetupStatus } = useAuth();
  const navigate = useNavigate();

  const tokenReady = status.tokenReady || token.length > 0;
  const progress = useMemo(() => [
    { value: 1, label: '创建管理员' },
    { value: 2, label: '绑定验证器' },
    { value: 3, label: '保存恢复码' },
  ], []);

  useEffect(() => {
    if (!challenge) return;
    let active = true;
    QRCode.toDataURL(challenge.otpauthUri, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 280,
      color: { dark: '#171816', light: '#fffefa' },
    }).then((value) => {
      if (active) setQrDataUrl(value);
    }).catch((reason) => {
      if (active) setError(reason instanceof Error ? reason.message : '二维码生成失败。');
    });
    return () => { active = false; };
  }, [challenge]);

  const begin = async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(undefined);
    if (password.length < 14) {
      setError('密码至少需要 14 个字符。');
      return;
    }
    if (password !== passwordConfirmation) {
      setError('两次输入的密码不一致。');
      return;
    }
    setSubmitting(true);
    try {
      const result = await api.beginSetup({
        token: token.trim(),
        username: username.trim(),
        password,
      });
      setChallenge(result);
      setToken('');
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
      setStep(2);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '初始化请求失败。');
      await refreshSetupStatus().catch(() => undefined);
    } finally {
      setSubmitting(false);
    }
  };

  const confirm = async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!challenge) return;
    setError(undefined);
    setSubmitting(true);
    try {
      const result = await api.confirmSetup({
        challenge: challenge.challenge,
        totpCode: totpCode.replace(/\s/gu, ''),
      });
      setConfirmation(result);
      setStep(3);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '动态验证码校验失败。');
    } finally {
      setSubmitting(false);
    }
  };

  const copyRecoveryCodes = async () => {
    if (!confirmation) return;
    await navigator.clipboard.writeText(confirmation.recoveryCodes.join('\n'));
    setCopied(true);
  };

  const finish = () => {
    if (!confirmation || !acknowledged) return;
    acceptSetupSession({
      username: confirmation.username,
      csrfToken: confirmation.csrfToken,
    });
    navigate('/', { replace: true });
  };

  return (
    <main className="setup-page">
      <header className="auth-utility-bar">
        <a className="auth-site-mark" href="https://blog.reaier.top" aria-label="返回 Aier Blog">
          Aier<span>.</span>Blog
        </a>
        <AppearanceControls />
      </header>
      <section className="setup-intro" aria-labelledby="setup-title">
        <div className="setup-intro-inner">
          <p className="eyebrow">Private desk · first edition</p>
          <span className="edition-seal" aria-hidden="true">初</span>
          <h1 id="setup-title">建立你的<br /><em>单人编辑部。</em></h1>
          <p>这是仅在服务器尚无管理员时开放的一次性初始化流程。完成后不会再出现注册入口。</p>
          <ol className="setup-progress" aria-label="初始化进度">
            {progress.map((item) => (
              <li
                key={item.value}
                className={step === item.value ? 'is-current' : step > item.value ? 'is-complete' : ''}
                aria-current={step === item.value ? 'step' : undefined}
              >
                <span>{String(item.value).padStart(2, '0')}</span>
                {item.label}
              </li>
            ))}
          </ol>
        </div>
      </section>
      <section className="setup-workspace" aria-live="polite">
        {error && <div className="inline-alert" role="alert">{error}</div>}

        {step === 1 && (
          <form className="setup-card" onSubmit={begin}>
            <div className="form-heading">
              <span className="eyebrow">Step 01 / Account</span>
              <h2>创建管理员</h2>
              <p>令牌由服务器命令生成，只能用于这一次初始化。</p>
            </div>
            {!status.tokenReady && !token && (
              <div className="setup-guidance">
                <strong>服务器尚未准备初始化令牌</strong>
                <p>请先在服务器执行 <code>npm run admin:prepare-setup</code>，再打开命令输出的链接。</p>
              </div>
            )}
            <label className="field">
              <span>一次性初始化令牌</span>
              <input
                type="password"
                autoComplete="off"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                required
              />
            </label>
            <label className="field">
              <span>管理员用户名</span>
              <input
                name="username"
                autoComplete="username"
                maxLength={64}
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
              />
            </label>
            <label className="field">
              <span>密码（至少 14 个字符）</span>
              <input
                type="password"
                autoComplete="new-password"
                minLength={14}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
            <label className="field">
              <span>确认密码</span>
              <input
                type="password"
                autoComplete="new-password"
                minLength={14}
                value={passwordConfirmation}
                onChange={(event) => setPasswordConfirmation(event.target.value)}
                required
              />
            </label>
            <button className="primary-button setup-primary" type="submit" disabled={submitting || !tokenReady}>
              {submitting ? '正在创建安全挑战…' : '继续绑定验证器'}
            </button>
          </form>
        )}

        {step === 2 && challenge && (
          <form className="setup-card setup-card-wide" onSubmit={confirm}>
            <div className="form-heading">
              <span className="eyebrow">Step 02 / TOTP</span>
              <h2>扫描 TOTP 二维码</h2>
              <p>使用 1Password、Bitwarden、Google Authenticator 等验证器扫码，再输入当前 6 位验证码。</p>
            </div>
            <div className="totp-setup-grid">
              <div className="totp-qr-frame">
                {qrDataUrl ? <img src={qrDataUrl} alt="TOTP 配置二维码" /> : <span className="loader" />}
              </div>
              <div className="totp-manual">
                <span>无法扫码时手动输入</span>
                <code>{challenge.totpSecret}</code>
                <dl>
                  <div><dt>发行者</dt><dd>Aier Blog</dd></div>
                  <div><dt>算法</dt><dd>SHA-1 · 6 位 · 30 秒</dd></div>
                </dl>
              </div>
            </div>
            <label className="field totp-code-field">
              <span>6 位动态验证码</span>
              <input
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                autoComplete="one-time-code"
                value={totpCode}
                onChange={(event) => setTotpCode(event.target.value.replace(/\D/gu, ''))}
                required
                autoFocus
              />
            </label>
            <button className="primary-button setup-primary" type="submit" disabled={submitting || totpCode.length !== 6}>
              {submitting ? '正在校验…' : '确认并创建管理员'}
            </button>
          </form>
        )}

        {step === 3 && confirmation && (
          <section className="setup-card setup-card-wide recovery-card">
            <div className="form-heading">
              <span className="eyebrow">Step 03 / Recovery</span>
              <h2>恢复码只显示这一次</h2>
              <p>每个恢复码只能使用一次。请下载或复制后离线保存，不要与密码放在同一位置。</p>
            </div>
            <div className="recovery-codes" aria-label="一次性恢复码">
              {confirmation.recoveryCodes.map((code, index) => (
                <code key={code}><span>{String(index + 1).padStart(2, '0')}</span>{code}</code>
              ))}
            </div>
            <div className="recovery-actions">
              <button className="secondary-button" type="button" onClick={copyRecoveryCodes}>
                {copied ? '已复制' : '复制恢复码'}
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={() => downloadRecoveryCodes(confirmation.username, confirmation.recoveryCodes)}
              >
                下载 TXT
              </button>
            </div>
            <label className="recovery-acknowledgement">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(event) => setAcknowledged(event.target.checked)}
              />
              <span>我已安全保存恢复码，并理解离开后无法再次查看。</span>
            </label>
            <button className="primary-button setup-primary" type="button" disabled={!acknowledged} onClick={finish}>
              进入编辑部工作台
            </button>
          </section>
        )}
      </section>
    </main>
  );
}
