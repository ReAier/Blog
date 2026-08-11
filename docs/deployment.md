# 部署与运维

本文同时覆盖当前生产服务器的发布流程，以及不绑定具体服务器的静态托管方式。项目构建和目录说明见[项目 README](../README.md)与[架构说明](architecture.md)。

## 静态部署契约

项目在 `astro.config.ts` 中使用 `output: 'static'`。任何部署平台都应遵循同一契约：

| 项目 | 值 |
| --- | --- |
| 依赖安装 | `npm install` |
| 生产构建 | `npm run build` |
| 发布目录 | `dist` |
| 运行时服务 | 无 |
| 必需数据库 | 无 |
| SPA 回退 | 不需要 |

构建会生成目录式页面，例如 `/posts/welcome/` 对应 `dist/posts/welcome/index.html`。托管服务应直接提供生成文件，并在不存在的路径上返回 404，而不是把所有请求重写到首页。

部署前统一运行：

```powershell
npm run check
npm test -- --run
npm run build
```

可使用以下命令本地预览构建结果：

```powershell
npm run preview
```

`dist/` 是可删除、可重新生成的产物，不应手工修改或提交。

## 当前生产部署

当前生产方案由 `scripts/deploy.ps1` 实现：

```text
本地检查与构建
      │
      ▼
将 dist/ 打包为 .deploy/aier-blog-<UTC 时间>.tar.gz
      │
      ▼
通过 scp 上传到服务器 /tmp/
      │
      ▼
解压到 /var/www/aier-blog/releases/<版本>/
      │
      ▼
原子切换 /var/www/aier-blog/current 软链接
      │
      ▼
nginx -t、reload、本机 Host 头健康检查
      │
      ├── 成功：清理旧版本，保留最近 5 个
      └── 失败：恢复 previous 链接并重新加载 Nginx
```

### 本地前置条件

- Windows PowerShell 能运行 `npm.cmd`、`tar.exe`、`scp.exe` 和 `ssh.exe`。
- 已安装项目依赖。
- 本机 SSH 配置中存在可用别名 `aliyun-aiopt`，或通过脚本参数指定其他别名。
- 当前用户能够向远端 `/tmp/` 上传文件，并能够维护站点目录与重新加载 Nginx。
- DNS 和 Nginx 已将 `blog.reaier.top` 指向该静态站点。

不要把主机密码、私钥、Token 或服务器地址写入脚本、文档或仓库。SSH 认证应由本机 SSH 配置和密钥代理负责。

### 服务器目录

```text
/var/www/aier-blog/
├── current -> releases/<当前版本>
└── releases/
    ├── 20260811T010000Z/
    ├── 20260810T120000Z/
    └── ...
```

脚本以 UTC 时间 `yyyyMMddTHHmmssZ` 生成版本号。`current` 是 Nginx 应指向的入口；每次部署创建新目录，不覆盖旧版本内容。

### 部署演练

先运行：

```powershell
npm run deploy -- -DryRun
```

演练仍会执行：

1. `npm run check`
2. `npm test -- --run`
3. `npm run build`
4. 将 `dist/` 打包到 `.deploy/`

演练不会执行上传、远端解压、软链接切换或 Nginx 重载。终端会显示归档文件和目标地址，可用于确认即将部署的版本。

指定其他 SSH 别名：

```powershell
npm run deploy -- -DryRun -SshHost staging-blog
```

PowerShell 会把 `-DryRun` 和 `-SshHost` 传给 `scripts/deploy.ps1`。

### 正式部署

```powershell
npm run deploy
```

脚本失败时会以非零状态退出。不要在未阅读错误输出的情况下重复运行；先确定失败发生在本地检查、上传、远端切换、Nginx 验证还是健康检查阶段。

### 原子切换与自动回滚

远端脚本会：

1. 保存 `current` 原来指向的版本。
2. 解压新归档并确认 `index.html` 非空。
3. 创建 `current.next` 并使用 `mv -Tf` 切换为 `current`。
4. 执行 `nginx -t`。
5. 重新加载 Nginx。
6. 使用 `Host: blog.reaier.top` 请求本机 `http://127.0.0.1/`。

如果 Nginx 配置验证失败，脚本恢复之前的 `current`。如果健康检查失败，脚本恢复旧版本并再次验证、加载 Nginx。

部署成功后，脚本按版本名倒序保留最近五个版本，并额外保护当前版本，避免当前软链接指向的目录被清理。

### 手动回滚

登录服务器：

```powershell
ssh aliyun-aiopt
```

查看版本和当前目标：

```bash
ls -1dt /var/www/aier-blog/releases/*
readlink -f /var/www/aier-blog/current
```

确认目标版本完整后切换：

```bash
ln -sfn /var/www/aier-blog/releases/版本目录 /var/www/aier-blog/current.next
mv -Tf /var/www/aier-blog/current.next /var/www/aier-blog/current
nginx -t && systemctl reload nginx
```

然后执行本机健康检查：

```bash
curl -fsS --max-time 15 -H 'Host: blog.reaier.top' http://127.0.0.1/ >/dev/null
```

手动回滚前应记录原 `current` 目标，以便在选错版本时再次恢复。

## 通用 Nginx 静态托管

如果不使用仓库自带的版本发布脚本，可以将 `dist/` 同步到任意目录并由 Nginx 直接提供。

示例：

```nginx
server {
    listen 80;
    server_name example.com;

    root /var/www/example-blog;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    error_page 404 /404.html;
}
```

部署步骤示例：

```powershell
npm install
npm run build
scp -r .\dist\* user@example.com:/var/www/example-blog/
```

实际生产环境建议使用版本目录或同步工具，避免复制过程中用户读到不完整文件。配置 TLS、缓存、压缩和权限时遵循服务器现有运维规范。

这个站点不是单页应用，不要配置 `try_files $uri /index.html` 一类全站首页回退，否则真正的 404 可能被错误返回为首页。

Nginx 指令细节以 [Nginx 官方文档](https://nginx.org/en/docs/)为准。

## Cloudflare Pages

Cloudflare Pages 可以直接从 Git 仓库构建静态站点。创建项目时使用：

| 设置 | 值 |
| --- | --- |
| Framework preset | Astro（若界面提供） |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | 仓库根目录 |

部署流程：

1. 将仓库连接到 Pages 项目。
2. 设置构建命令与输出目录。
3. 触发首次构建并检查日志。
4. 在预览域名检查首页、文章、标签、RSS、sitemap、404 和 clip 下载。
5. 验证后绑定自定义域名。

项目是纯静态输出，不需要为 Pages 添加 Astro SSR adapter 或 Pages Functions。不要给 `/clips/` 添加公开列表；这些页面虽然带 `noindex`，但仍可通过 URL 访问。

Cloudflare 控制台和构建环境可能调整，实施时应核对 [Cloudflare Pages 的 Astro 指南](https://developers.cloudflare.com/pages/framework-guides/deploy-an-astro-site/)和当前构建日志，不在仓库中固化套餐限制或控制台截图。

## Netlify

在 Netlify 创建 Git 项目时使用：

| 设置 | 值 |
| --- | --- |
| Build command | `npm run build` |
| Publish directory | `dist` |
| Base directory | 仓库根目录 |

项目不需要 SPA 重写规则，也不需要运行 Astro 服务端 adapter。部署后至少验证：

- `/`
- `/posts/`
- 一篇文章路径
- `/tags/`
- `/archive/`
- `/rss.xml`
- `/sitemap-index.xml`
- `/404.html`
- 一个 `/clips/<slug>/` 和对应 `.txt`

平台配置方式和 Astro 集成可能变化，实施时以 [Netlify Astro 文档](https://docs.netlify.com/frameworks/astro/)为准。

## 域名、SEO 与缓存

部署到不同正式域名时，必须同步修改：

- `astro.config.ts` 中的 `site`。
- `src/config.ts` 中的 `SITE.url`。
- Nginx 健康检查或平台自定义域名配置。

否则 canonical、Open Graph URL 和 sitemap 可能继续指向旧域名。

HTML、RSS 和 sitemap 应允许及时刷新；带内容哈希的构建资源可以使用更长缓存。具体缓存策略由托管平台或 Nginx 配置管理，仓库当前不生成平台专用缓存规则。

## 部署故障排查

### 本地检查或测试失败

不要上传。先按错误信息修复内容 schema、测试或构建问题。注意生产产物测试依赖已存在的 `dist/`；完整验证顺序应先构建，再运行最终测试，或按项目维护指南中的顺序执行并保证 `dist/` 已更新。

### `tar.exe`、`scp.exe` 或 `ssh.exe` 不存在

确认命令位于 `PATH`。Windows 可通过系统自带 OpenSSH 客户端提供 `scp.exe` 和 `ssh.exe`。

### SSH 别名无法连接

单独验证：

```powershell
ssh aliyun-aiopt
```

检查本机 SSH 配置、密钥权限、网络和远端用户，不要把凭据改写到仓库脚本中。

### 远端解压失败

检查 `/tmp/` 与 `/var/www/aier-blog/releases/` 的磁盘空间、目录权限和归档完整性。

### `nginx -t` 失败

服务器配置有语法或引用错误。脚本会尝试恢复旧 `current`，但仍应登录服务器检查 `nginx -t` 的完整输出。

### 健康检查失败

检查：

- Nginx `root` 是否指向 `/var/www/aier-blog/current`。
- Host 名称是否仍为 `blog.reaier.top`。
- `current` 目标中是否存在 `index.html`。
- 文件权限是否允许 Nginx 读取。
- 本机 HTTP 监听地址和端口是否与脚本一致。

### 平台构建失败

确认平台位于仓库根目录、成功执行 `npm install`、使用 `npm run build`，并将发布目录设置为 `dist`。然后将平台日志中的 Astro 或 TypeScript 错误在本地复现。

## 安全约束

- 不提交 `.env*`、部署归档、日志、SSH 配置、私钥或服务器凭据。
- `.deploy/` 只用于本地临时归档。
- clip 页面和原始文本是公开内容，不用于保存秘密。
- 正式部署前先执行 `-DryRun` 并检查 SSH 目标。
- 不使用 `npm audit fix --force` 等命令在部署过程中自动升级依赖；依赖升级应作为独立变更验证。

## 相关文档

- [项目 README](../README.md)
- [架构说明](architecture.md)
- [内容创作指南](content-authoring.md)
- [维护与测试指南](maintenance.md)
- [云剪切板使用说明](cloud-clipboard.md)