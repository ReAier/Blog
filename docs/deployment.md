# 部署与运维

本文同时覆盖当前生产服务器的系统升级与后台发布流程，以及不绑定具体服务器的静态托管方式。项目构建和目录说明见[项目 README](../README.md)与[架构说明](architecture.md)。

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

## 当前生产系统升级与后台发布

生产环境严格分离两条链路：

- `npm run upgrade` 通过 SSH 升级 `/opt/aier-blog/current` 中的博客代码和管理后台。
- 管理后台“发布台”负责验证持久内容、构建 Astro 静态站点，并通过受限特权助手切换 `/var/www/aier-blog/current`。

SSH 升级不会构建或切换公开站点。升级完成后，访客继续看到升级前的静态版本，直到管理员在后台手动发布。

### SSH 系统升级流程

`scripts/upgrade.ts` 在 Windows、macOS 和 Linux 上执行以下流程：

```text
本地检查、测试和构建验证
      │
      ▼
创建不含私有内容、依赖和生成产物的源码归档
      │
      ▼
通过 scp 上传到服务器 /tmp/
      │
      ▼
安装锁定依赖并构建管理后台
      │
      ▼
备份、迁移并校验持久内容
      │
      ▼
原子切换 /opt/aier-blog/current
      │
      ▼
重启并健康检查后台服务
      │
      ├── 成功：保留公开静态版本，等待后台手动发布
      └── 失败：回滚代码和迁移前内容
```

本地需要 Node.js、npm，以及 PATH 中可用的 `tar`、`scp` 和 `ssh`，并配置 SSH 别名 `aliyun-aiopt`。Windows 会自动使用对应的 `.cmd` 或 `.exe` 命令。认证由本机 SSH 配置和密钥代理负责，不得写入仓库。

先执行演练：

```powershell
npm run upgrade -- --dry-run
```

演练会执行本地检查、测试、后台构建、内容校验和博客构建，并创建源码归档，但不会上传或切换代码。指定其他 SSH 别名：

```powershell
npm run upgrade -- --dry-run --ssh-host staging-blog
```

正式升级：

```powershell
npm run upgrade
```

升级前后可记录并比较公开版本，确认 SSH 没有触碰它：

```bash
readlink -f /var/www/aier-blog/current
```

代码升级失败时，`deployment/install-code.sh` 恢复原 `/opt/aier-blog/current`；如果已执行内容迁移，也会恢复迁移前备份。

### 后台认证迁移与恢复

部署分类型 Key 认证的版本会立即清除旧 `aier_pat_...` Token、旧浏览器会话，并停用密码、TOTP 和恢复码登录。升级完成后必须通过 SSH 在生产数据库中创建新的永久 Owner Key：

```bash
cd /opt/aier-blog/current
sudo -u aier-blog -- npm run admin:key -- create --data-root /var/lib/aier-blog --role owner --expires permanent --name "Primary owner"
```

命令必须输出 `Admin database: /var/lib/aier-blog/state/admin.sqlite`。如果输出的是项目目录下的 `.admin-data/state/admin.sqlite`，说明 Key 创建在开发数据库中，无法登录生产后台。明文 Key 只显示一次，应立即保存到安全的凭据管理器；若所有后台 Key 丢失，只能再次通过该 SSH 流程恢复。

### 后台公开发布流程

管理员在后台发布台启动任务后，服务会创建位于 `/var/lib/aier-blog/jobs` 的隔离快照，依次运行内容校验、`npm run check` 和生产构建。代码单元测试只在 SSH 系统升级前运行，因为后台持久内容不是仓库测试夹具，不应决定代码测试是否通过。快照会创建独立、可写的 `node_modules` 目录：普通依赖文件优先使用硬链接复用，目录本身不再指向代码版本中的只读 `node_modules`，跨文件系统时则回退为复制。Astro 内容缓存写入快照自己的 `.astro`，Vite 依赖缓存写入 `.astro/vite`。这样既不会修改代码版本中的依赖目录，也避免同一模块同时出现 release 路径和 workspace 路径。

构建成功后，后台只向 `/var/lib/aier-blog/publish-requests` 写入受限请求。root-owned systemd path/service 校验构建路径后调用 `aier-blog-publish-release`，原子切换 `/var/www/aier-blog/current`、更新重定向、验证 Nginx 并执行健康检查。失败时保持或恢复上一公开版本。

文章、Clip、图片、重定向以及博客模板新版本的公开上线都必须经过这条后台发布链路。

### 手动回滚公开版本

若必须紧急回滚，先登录服务器并检查版本：

```bash
ls -1dt /var/www/aier-blog/releases/*
readlink -f /var/www/aier-blog/current
```

确认目标版本完整后再原子切换链接，并运行 `nginx -t`、reload 和站点健康检查。正常内容更新不要使用 SSH 手工发布。

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
- 正式部署前先执行 `--dry-run` 并检查 SSH 目标。
- 不使用 `npm audit fix --force` 等命令在部署过程中自动升级依赖；依赖升级应作为独立变更验证。

## 相关文档

- [项目 README](../README.md)
- [架构说明](architecture.md)
- [内容创作指南](content-authoring.md)
- [维护与测试指南](maintenance.md)
- [云剪切板使用说明](cloud-clipboard.md)
