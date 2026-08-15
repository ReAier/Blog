import { useEffect, useId, useRef, useState } from 'react';
import { api } from '../api/client';
import { BlogSelect } from '../components/BlogSelect';
import { Dialog } from '../components/Dialog';
import { SectionCard } from '../components/AppShell';
import { EmptyBlock, ErrorBlock, LoadingBlock, PageHeader, formatDate } from '../components/ui';
import { useConfirmDialog } from '../context/ConfirmDialogContext';
import type { ApiTokenCreation, ApiTokenRecord, ApiTokenScope } from '../types';

const scopeOptions: Array<{ scope: ApiTokenScope; label: string; detail: string }> = [
  { scope: 'posts:read', label: '读取文章', detail: '列出和读取文章正文与修订版本。' },
  { scope: 'posts:write', label: '编写文章', detail: '创建草稿并更新已有文章内容。' },
  { scope: 'clips:read', label: '读取代码片段', detail: '列出和读取独立代码片段。' },
  { scope: 'clips:write', label: '编写代码片段', detail: '创建和更新代码片段。' },
  { scope: 'images:read', label: '读取图片', detail: '查看图片元数据与引用关系。' },
  { scope: 'images:write', label: '上传图片', detail: '上传 JPEG、PNG 或 WebP 图片。' },
];

function dateFromTimestamp(value?: number): string {
  return value ? formatDate(new Date(value).toISOString()) : '从未使用';
}

export function SecurityPage() {
  const confirmAction = useConfirmDialog();
  const [tokens, setTokens] = useState<ApiTokenRecord[]>();
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [name, setName] = useState('');
  const [expiresInDays, setExpiresInDays] = useState(30);
  const [scopes, setScopes] = useState<ApiTokenScope[]>(['posts:read']);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<ApiTokenCreation>();
  const secretRef = useRef<HTMLButtonElement>(null);
  const dialogTitleId = useId();
  const dialogDescriptionId = useId();

  const reload = async () => {
    setError(undefined);
    try {
      setTokens(await api.listApiTokens());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '无法读取 API 令牌。');
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  const toggleScope = (scope: ApiTokenScope) => {
    setScopes((current) => current.includes(scope)
      ? current.filter((item) => item !== scope)
      : [...current, scope]);
  };

  const createApiToken = async () => {
    if (!name.trim() || scopes.length === 0) return;
    setBusy(true);
    setMessage(undefined);
    try {
      const result = await api.createApiToken({
        name: name.trim(),
        scopes,
        expiresInDays,
      });
      setCreated(result);
      setName('');
      setScopes(['posts:read']);
      await reload();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : '创建 API 令牌失败。');
    } finally {
      setBusy(false);
    }
  };

  const revokeApiToken = async (token: ApiTokenRecord) => {
    const accepted = await confirmAction({
      eyebrow: 'API security',
      title: '撤销这个 API 令牌？',
      message: `“${token.name}” 将立即失去所有 API 访问权限，且无法恢复。`,
      confirmLabel: '撤销令牌',
      tone: 'danger',
    });
    if (!accepted) return;
    setBusy(true);
    try {
      await api.revokeApiToken(token.id);
      setMessage(`已撤销“${token.name}”。`);
      await reload();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : '撤销 API 令牌失败。');
    } finally {
      setBusy(false);
    }
  };

  const copySecret = async () => {
    if (!created) return;
    await navigator.clipboard.writeText(created.token);
    setMessage('令牌已复制到剪贴板。');
  };

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Access control"
        title="API 与安全"
        description="为 AI 客户端创建范围受限、可撤销且不能发布内容的个人访问令牌。"
      />

      {message && <div className="inline-notice" role="status">{message}<button type="button" onClick={() => setMessage(undefined)}>关闭</button></div>}

      <SectionCard title="创建 API 令牌" eyebrow="Machine access" className="token-create-card">
        <div className="token-form-grid">
          <label className="field">
            <span>令牌名称</span>
            <input value={name} maxLength={100} onChange={(event) => setName(event.target.value)} placeholder="例如：文章草稿助手" />
          </label>
          <div className="field">
            <span>有效期</span>
            <BlogSelect
              ariaLabel="有效期"
              value={String(expiresInDays)}
              options={[
                { value: '7', label: '7 天' },
                { value: '30', label: '30 天' },
                { value: '90', label: '90 天' },
                { value: '365', label: '365 天' },
              ]}
              onChange={(value) => setExpiresInDays(Number(value))}
            />
          </div>
        </div>
        <fieldset className="token-scope-grid">
          <legend>授权范围</legend>
          {scopeOptions.map((option) => (
            <label key={option.scope} className="token-scope-option">
              <input
                type="checkbox"
                checked={scopes.includes(option.scope)}
                onChange={() => toggleScope(option.scope)}
              />
              <span><strong>{option.label}</strong><small>{option.scope} · {option.detail}</small></span>
            </label>
          ))}
        </fieldset>
        <div className="token-form-actions">
          <p>令牌只能读写草稿内容，不能删除、恢复、备份或执行发布。</p>
          <button className="primary-button" type="button" disabled={busy || !name.trim() || !scopes.length} onClick={() => void createApiToken()}>
            {busy ? '正在创建…' : '创建令牌'}
          </button>
        </div>
      </SectionCard>

      <SectionCard title="现有令牌" eyebrow="Token registry">
        {tokens === undefined && !error ? <LoadingBlock label="正在读取令牌…" /> : error ? (
          <ErrorBlock message={error} onRetry={reload} />
        ) : !tokens?.length ? (
          <EmptyBlock title="还没有 API 令牌" detail="创建令牌后，AI 客户端才能访问受限的 /api/v1 接口。" />
        ) : (
          <div className="data-table-wrap token-table-wrap">
            <table className="data-table">
              <thead><tr><th>名称</th><th>权限</th><th>最后使用</th><th>到期</th><th><span className="sr-only">操作</span></th></tr></thead>
              <tbody>{tokens.map((token) => (
                <tr key={token.id} className={token.revokedAt ? 'is-revoked' : ''}>
                  <td><strong>{token.name}</strong><span className="cell-subtitle">{token.tokenPrefix}…</span></td>
                  <td><div className="token-scope-list">{token.scopes.map((scope) => <code key={scope}>{scope}</code>)}</div></td>
                  <td>{dateFromTimestamp(token.lastUsedAt)}</td>
                  <td>{dateFromTimestamp(token.expiresAt)}</td>
                  <td>{token.revokedAt ? <span className="status-pill failed">已撤销</span> : <button className="danger-text" type="button" disabled={busy} onClick={() => void revokeApiToken(token)}>撤销</button>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {created && (
        <Dialog
          onClose={() => setCreated(undefined)}
          ariaLabelledBy={dialogTitleId}
          ariaDescribedBy={dialogDescriptionId}
          initialFocusRef={secretRef}
          closeOnBackdrop={false}
        >
          <header className="dialog-heading">
            <div><span>One-time secret</span><h2 id={dialogTitleId}>保存新的 API 令牌</h2></div>
          </header>
          <p id={dialogDescriptionId}>明文令牌只显示这一次。关闭窗口后，服务端无法再次显示或恢复它。</p>
          <code className="token-secret">{created.token}</code>
          <div className="dialog-actions">
            <button ref={secretRef} className="secondary-button" type="button" onClick={() => void copySecret()}>复制令牌</button>
            <button className="primary-button" type="button" onClick={() => setCreated(undefined)}>我已安全保存</button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
