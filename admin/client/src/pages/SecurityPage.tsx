import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { BlogSelect } from '../components/BlogSelect';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../components/ui';
import type {
  AdminKeyRecord,
  AdminPermission,
  AdminRole,
  ApiTokenRecord,
  ApiTokenScope,
} from '../types';

type SecurityTab = 'admin' | 'automation';
type ExpiryDays = 7 | 30 | 365 | null;

const adminRoles: AdminRole[] = ['viewer', 'editor', 'publisher', 'owner', 'custom'];
const aiScopes: ApiTokenScope[] = [
  'posts:read',
  'posts:write',
  'clips:read',
  'clips:write',
  'images:read',
  'images:write',
];

const roleLabels: Record<AdminRole, string> = {
  viewer: '只读者',
  editor: '编辑者',
  publisher: '发布者',
  owner: '所有者',
  custom: '自定义',
};

const expiryOptions: Array<{ label: string; value: ExpiryDays }> = [
  { label: '7 天', value: 7 },
  { label: '30 天', value: 30 },
  { label: '365 天', value: 365 },
  { label: '永久', value: null },
];

const permissionLabels: Record<string, string> = {
  'dashboard:read': '查看工作台',
  'posts:read': '查看文章',
  'posts:create': '创建文章',
  'posts:update': '编辑文章',
  'posts:delete': '删除文章',
  'posts:import': '导入文章',
  'posts:download': '下载文章',
  'posts:history:read': '查看文章历史',
  'posts:history:restore': '恢复文章历史',
  'posts:slug:update': '修改文章地址',
  'clips:read': '查看剪切板',
  'clips:create': '创建剪切板内容',
  'clips:update': '编辑剪切板内容',
  'clips:delete': '删除剪切板内容',
  'clips:import': '导入剪切板内容',
  'clips:download': '下载剪切板内容',
  'clips:link': '关联文章',
  'clips:slug:update': '修改剪切板地址',
  'images:read': '查看图片',
  'images:upload': '上传图片',
  'images:delete': '删除图片',
  'preview:render': '生成即时预览',
  'trash:read': '查看回收站',
  'trash:restore': '恢复回收站内容',
  'trash:purge': '永久删除内容',
  'publish:read': '查看发布状态',
  'publish:run': '执行发布',
  'logs:read': '查看发布日志',
  'backups:read': '查看备份',
  'backups:create': '创建备份',
  'backups:download': '下载备份',
  'backups:validate': '验证备份',
  'backups:apply': '应用整站备份',
  'ai-keys:read': '查看自动化密钥',
  'ai-keys:create': '创建自动化密钥',
  'ai-keys:update': '修改自动化密钥',
  'ai-keys:revoke': '吊销自动化密钥',
  'admin-keys:read': '查看后台密钥',
  'admin-keys:create': '创建后台密钥',
  'admin-keys:update': '修改后台密钥',
  'admin-keys:revoke': '吊销后台密钥',
};

const permissionGroups: Array<{ title: string; prefixes: string[] }> = [
  { title: '工作台', prefixes: ['dashboard:'] },
  { title: '文章', prefixes: ['posts:'] },
  { title: '剪切板', prefixes: ['clips:'] },
  { title: '图片与预览', prefixes: ['images:', 'preview:'] },
  { title: '回收站', prefixes: ['trash:'] },
  { title: '发布与日志', prefixes: ['publish:', 'logs:'] },
  { title: '备份', prefixes: ['backups:'] },
  { title: '密钥管理', prefixes: ['ai-keys:', 'admin-keys:'] },
];

const scopeLabels: Record<ApiTokenScope, string> = {
  'posts:read': '读取文章',
  'posts:write': '创建和修改文章',
  'clips:read': '读取剪切板内容',
  'clips:write': '创建和修改剪切板内容',
  'images:read': '读取图片信息',
  'images:write': '上传图片',
};

function formatTimestamp(value?: number) {
  return value ? formatDate(new Date(value).toISOString()) : '—';
}

function expiryValue(value: ExpiryDays) {
  return value === null ? 'permanent' : String(value);
}

function parseExpiry(value: string): ExpiryDays {
  return value === 'permanent' ? null : Number(value) as 7 | 30 | 365;
}

export function SecurityPage() {
  const { hasPermission } = useAuth();
  const canUseAdmin = hasPermission('admin-keys:read') || hasPermission('admin-keys:create');
  const canUseAutomation = hasPermission('ai-keys:read') || hasPermission('ai-keys:create');
  const [activeTab, setActiveTab] = useState<SecurityTab>(canUseAdmin ? 'admin' : 'automation');
  const [adminKeys, setAdminKeys] = useState<AdminKeyRecord[]>([]);
  const [automationKeys, setAutomationKeys] = useState<ApiTokenRecord[]>([]);
  const [permissions, setPermissions] = useState<AdminPermission[]>([]);
  const [rolePermissions, setRolePermissions] = useState<Record<string, AdminPermission[]>>({});
  const [secret, setSecret] = useState<string>();
  const [error, setError] = useState<string>();

  const [adminName, setAdminName] = useState('');
  const [adminRole, setAdminRole] = useState<AdminRole>('viewer');
  const [adminPermissions, setAdminPermissions] = useState<AdminPermission[]>([]);
  const [adminExpiry, setAdminExpiry] = useState<ExpiryDays>(30);
  const [editingAdmin, setEditingAdmin] = useState<AdminKeyRecord>();

  const [automationName, setAutomationName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<ApiTokenScope[]>(['posts:read']);
  const [automationExpiry, setAutomationExpiry] = useState<ExpiryDays>(30);
  const [editingAutomation, setEditingAutomation] = useState<ApiTokenRecord>();

  const reload = useCallback(async () => {
    const [admins, automation, options] = await Promise.all([
      hasPermission('admin-keys:read') ? api.listAdminKeys() : Promise.resolve([]),
      hasPermission('ai-keys:read') ? api.listApiTokens() : Promise.resolve([]),
      hasPermission('admin-keys:read') ? api.adminKeyOptions() : Promise.resolve(undefined),
    ]);
    setAdminKeys(admins);
    setAutomationKeys(automation);
    if (options) {
      setPermissions(options.permissions);
      setRolePermissions(options.roles);
      setAdminPermissions((current) => current.length ? current : [...options.roles.viewer]);
    }
  }, [hasPermission]);

  useEffect(() => {
    reload().catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)));
  }, [reload]);

  const groupedPermissions = useMemo(() => permissionGroups.map((group) => ({
    ...group,
    permissions: permissions.filter((permission) => group.prefixes.some((prefix) => permission.startsWith(prefix))),
  })).filter((group) => group.permissions.length), [permissions]);

  const resetAdminForm = () => {
    setEditingAdmin(undefined);
    setAdminName('');
    setAdminRole('viewer');
    setAdminPermissions([...(rolePermissions.viewer ?? [])]);
    setAdminExpiry(30);
  };

  const resetAutomationForm = () => {
    setEditingAutomation(undefined);
    setAutomationName('');
    setSelectedScopes(['posts:read']);
    setAutomationExpiry(30);
  };

  const changeRole = (value: string) => {
    const nextRole = value as AdminRole;
    setAdminRole(nextRole);
    if (nextRole !== 'custom') setAdminPermissions([...(rolePermissions[nextRole] ?? [])]);
  };

  const togglePermission = (permission: AdminPermission) => {
    setAdminRole('custom');
    setAdminPermissions((current) => current.includes(permission)
      ? current.filter((item) => item !== permission)
      : [...current, permission]);
  };

  const toggleScope = (scope: ApiTokenScope) => {
    setSelectedScopes((current) => current.includes(scope)
      ? current.filter((item) => item !== scope)
      : [...current, scope]);
  };

  const saveAdmin = async () => {
    setError(undefined);
    try {
      if (editingAdmin) {
        await api.updateAdminKey(editingAdmin.id, {
          name: adminName.trim(),
          role: adminRole,
          permissions: adminPermissions,
        });
      } else {
        const created = await api.createAdminKey({
          name: adminName.trim(),
          role: adminRole,
          permissions: adminPermissions,
          expiresInDays: adminExpiry,
        });
        setSecret(created.key);
      }
      resetAdminForm();
      await reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  };

  const saveAutomation = async () => {
    setError(undefined);
    try {
      if (editingAutomation) {
        await api.updateApiToken(editingAutomation.id, {
          name: automationName.trim(),
          scopes: selectedScopes,
        });
      } else {
        const created = await api.createApiToken({
          name: automationName.trim(),
          scopes: selectedScopes,
          expiresInDays: automationExpiry,
        });
        setSecret(created.token);
      }
      resetAutomationForm();
      await reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  };

  const editAdmin = (key: AdminKeyRecord) => {
    setActiveTab('admin');
    setEditingAdmin(key);
    setAdminName(key.name);
    setAdminRole(key.role);
    setAdminPermissions([...key.permissions]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const editAutomation = (key: ApiTokenRecord) => {
    setActiveTab('automation');
    setEditingAutomation(key);
    setAutomationName(key.name);
    setSelectedScopes([...key.scopes]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const revokeAdmin = async (id: string) => {
    await api.revokeAdminKey(id);
    await reload();
  };

  const revokeAutomation = async (id: string) => {
    await api.revokeApiToken(id);
    await reload();
  };

  return (
    <div className="page-stack security-page">
      <header className="security-intro">
        <div>
          <p className="eyebrow">访问控制</p>
          <h1>密钥管理</h1>
          <p>分别管理后台登录和自动化访问。</p>
        </div>
        <div className="security-summary" aria-label="密钥数量">
          {canUseAdmin && <span><strong>{adminKeys.length}</strong> 后台密钥</span>}
          {canUseAutomation && <span><strong>{automationKeys.length}</strong> 自动化密钥</span>}
        </div>
      </header>

      {error && <div className="inline-alert" role="alert">{error}</div>}
      {secret && (
        <section className="secret-reveal" aria-live="polite">
          <div>
            <span>新密钥已创建</span>
            <strong>请立即复制，明文只显示一次</strong>
          </div>
          <code>{secret}</code>
          <div className="secret-actions">
            <button className="secondary-button" type="button" onClick={() => navigator.clipboard.writeText(secret)}>复制</button>
            <button className="text-button" type="button" onClick={() => setSecret(undefined)}>关闭</button>
          </div>
        </section>
      )}

      <div className="security-tabs" role="tablist" aria-label="密钥类型">
        {canUseAdmin && (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'admin'}
            className={activeTab === 'admin' ? 'is-active' : ''}
            onClick={() => setActiveTab('admin')}
          >
            后台密钥
          </button>
        )}
        {canUseAutomation && (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'automation'}
            className={activeTab === 'automation' ? 'is-active' : ''}
            onClick={() => setActiveTab('automation')}
          >
            自动化密钥
          </button>
        )}
      </div>

      {activeTab === 'admin' && canUseAdmin && (
        <div className="security-workspace">
          {(hasPermission('admin-keys:create') || editingAdmin) && (
            <section className="security-form-card">
              <div className="security-section-heading">
                <div>
                  <span>{editingAdmin ? '修改设置' : '新增访问凭据'}</span>
                  <h2>{editingAdmin ? '编辑后台密钥' : '创建后台密钥'}</h2>
                </div>
                {editingAdmin && <button className="text-button" type="button" onClick={resetAdminForm}>取消编辑</button>}
              </div>

              <label className="field">
                <span>名称</span>
                <input
                  value={adminName}
                  placeholder="例如：日常编辑"
                  onChange={(event) => setAdminName(event.target.value)}
                />
              </label>
              <div className="security-form-row">
                <div className="field">
                  <span>角色模板</span>
                  <BlogSelect
                    ariaLabel="角色模板"
                    value={adminRole}
                    options={adminRoles.map((role) => ({ value: role, label: roleLabels[role] }))}
                    onChange={changeRole}
                  />
                </div>
                {!editingAdmin && (
                  <div className="field">
                    <span>有效期</span>
                    <BlogSelect
                      ariaLabel="有效期"
                      value={expiryValue(adminExpiry)}
                      options={expiryOptions.map((option) => ({ value: expiryValue(option.value), label: option.label }))}
                      onChange={(value) => setAdminExpiry(parseExpiry(value))}
                    />
                  </div>
                )}
              </div>

              <div className="permission-heading">
                <div>
                  <strong>权限设置</strong>
                  <span>已选择 {adminPermissions.length} 项</span>
                </div>
                <button type="button" className="text-button" onClick={() => setAdminPermissions([])}>清空</button>
              </div>
              <div className="permission-groups">
                {groupedPermissions.map((group) => {
                  const selectedCount = group.permissions.filter((permission) => adminPermissions.includes(permission)).length;
                  return (
                    <details className="permission-group" key={group.title}>
                      <summary>
                        <span>{group.title}</span>
                        <small>{selectedCount}/{group.permissions.length}</small>
                      </summary>
                      <div className="permission-options">
                        {group.permissions.map((permission) => (
                          <label key={permission} className="permission-option">
                            <input
                              type="checkbox"
                              checked={adminPermissions.includes(permission)}
                              onChange={() => togglePermission(permission)}
                            />
                            <span>{permissionLabels[permission] ?? '其他权限'}</span>
                          </label>
                        ))}
                      </div>
                    </details>
                  );
                })}
              </div>
              <button
                className="primary-button security-save"
                type="button"
                disabled={!adminName.trim() || !adminPermissions.length}
                onClick={saveAdmin}
              >
                {editingAdmin ? '保存修改' : '创建后台密钥'}
              </button>
            </section>
          )}

          {hasPermission('admin-keys:read') && (
            <KeyList
              title="已有后台密钥"
              emptyText="还没有后台密钥。"
              keys={adminKeys}
              kind="admin"
              canEdit={hasPermission('admin-keys:update')}
              canRevoke={hasPermission('admin-keys:revoke')}
              onEdit={(key) => editAdmin(key as AdminKeyRecord)}
              onRevoke={revokeAdmin}
            />
          )}
        </div>
      )}

      {activeTab === 'automation' && canUseAutomation && (
        <div className="security-workspace">
          {(hasPermission('ai-keys:create') || editingAutomation) && (
            <section className="security-form-card">
              <div className="security-section-heading">
                <div>
                  <span>{editingAutomation ? '修改设置' : '新增访问凭据'}</span>
                  <h2>{editingAutomation ? '编辑自动化密钥' : '创建自动化密钥'}</h2>
                </div>
                {editingAutomation && <button className="text-button" type="button" onClick={resetAutomationForm}>取消编辑</button>}
              </div>

              <label className="field">
                <span>名称</span>
                <input
                  value={automationName}
                  placeholder="例如：文章草稿助手"
                  onChange={(event) => setAutomationName(event.target.value)}
                />
              </label>
              {!editingAutomation && (
                <div className="field">
                  <span>有效期</span>
                  <BlogSelect
                    ariaLabel="有效期"
                    value={expiryValue(automationExpiry)}
                    options={expiryOptions.map((option) => ({ value: expiryValue(option.value), label: option.label }))}
                    onChange={(value) => setAutomationExpiry(parseExpiry(value))}
                  />
                </div>
              )}

              <div className="permission-heading">
                <div>
                  <strong>访问范围</strong>
                  <span>已选择 {selectedScopes.length} 项</span>
                </div>
              </div>
              <div className="scope-options">
                {aiScopes.map((scope) => (
                  <label className="permission-option" key={scope}>
                    <input type="checkbox" checked={selectedScopes.includes(scope)} onChange={() => toggleScope(scope)} />
                    <span>{scopeLabels[scope]}</span>
                  </label>
                ))}
              </div>
              <button
                className="primary-button security-save"
                type="button"
                disabled={!automationName.trim() || !selectedScopes.length}
                onClick={saveAutomation}
              >
                {editingAutomation ? '保存修改' : '创建自动化密钥'}
              </button>
            </section>
          )}

          {hasPermission('ai-keys:read') && (
            <KeyList
              title="已有自动化密钥"
              emptyText="还没有自动化密钥。"
              keys={automationKeys}
              kind="automation"
              canEdit={hasPermission('ai-keys:update')}
              canRevoke={hasPermission('ai-keys:revoke')}
              onEdit={(key) => editAutomation(key as ApiTokenRecord)}
              onRevoke={revokeAutomation}
            />
          )}
        </div>
      )}
    </div>
  );
}

interface KeyListProps {
  title: string;
  emptyText: string;
  keys: Array<AdminKeyRecord | ApiTokenRecord>;
  kind: 'admin' | 'automation';
  canEdit: boolean;
  canRevoke: boolean;
  onEdit: (key: AdminKeyRecord | ApiTokenRecord) => void;
  onRevoke: (id: string) => Promise<void>;
}

function KeyList({ title, emptyText, keys, kind, canEdit, canRevoke, onEdit, onRevoke }: KeyListProps) {
  return (
    <section className="security-list-card">
      <div className="security-section-heading">
        <div>
          <span>凭据列表</span>
          <h2>{title}</h2>
        </div>
        <strong className="key-count">{keys.length}</strong>
      </div>
      {!keys.length && <p className="security-empty">{emptyText}</p>}
      <div className="key-list">
        {keys.map((key) => {
          const isAdmin = 'permissions' in key;
          const prefix = isAdmin ? key.keyPrefix : key.tokenPrefix;
          const detail = isAdmin ? roleLabels[key.role] : `${key.scopes.length} 项访问范围`;
          const state = key.revokedAt ? '已吊销' : key.expiresAt && key.expiresAt <= Date.now() ? '已过期' : '有效';
          return (
            <article className="key-list-item" key={key.id}>
              <div className="key-main">
                <div>
                  <h3>{key.name}</h3>
                  <span>{detail}</span>
                </div>
                <span className={`key-state${state === '有效' ? ' is-active' : ''}`}>{state}</span>
              </div>
              <dl className="key-meta">
                <div><dt>识别前缀</dt><dd><code>{prefix}…</code></dd></div>
                <div><dt>到期时间</dt><dd>{key.expiresAt ? formatTimestamp(key.expiresAt) : '永久'}</dd></div>
                <div><dt>最后使用</dt><dd>{key.lastUsedAt ? formatTimestamp(key.lastUsedAt) : '未使用'}</dd></div>
              </dl>
              <div className="key-actions">
                {canEdit && !key.revokedAt && (
                  <button className="secondary-button" type="button" onClick={() => onEdit(key)}>编辑</button>
                )}
                {canRevoke && !key.revokedAt && (
                  <button className="danger-button" type="button" onClick={() => onRevoke(key.id)}>吊销</button>
                )}
              </div>
            </article>
          );
        })}
      </div>
      <span className="sr-only">{kind === 'admin' ? '后台密钥列表' : '自动化密钥列表'}</span>
    </section>
  );
}
