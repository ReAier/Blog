# 云剪切板使用说明

云剪切板用于保存不适合直接放进博客正文的大段代码。代码保存在本地 Git 仓库中，构建时生成只读详情页和原始文本下载，不需要数据库或后台服务。文章的其他字段与 Markdown 语法见[内容创作指南](content-authoring.md)。

## 保存源码

源码文件直接放在 `src/content/clips/` 根目录，不再创建 slug 子目录，也不再使用 `meta.json`：

```text
src/content/clips/
├── oauth-callback.ts
├── bitdp-p1171.cpp
└── astro.config.ts
```

文件名必须是根目录下的单个文件名，不支持子目录或 `../` 路径。没有被已发布文章声明的源码文件会被忽略，不生成详情页或下载地址。

## 在文章中声明和引用

所有文章继续使用普通 `.md` 文件，无需导入组件。剪切板元数据直接写在 `clip` 代码围栏中：

````markdown
```clip
title: OAuth 回调处理
description: 处理授权码交换和登录状态写入。
language: typescript
file: oauth-callback.ts
createdAt: 2026-08-03
updatedAt: 2026-08-03
```
````

字段说明：

- `title`：必填，代码页和引用卡片标题。
- `description`：可选，一两句话说明代码用途。
- `language`：必填，交给 Shiki 进行语法高亮，例如 `typescript`、`javascript`、`cpp`、`python`、`bash`、`json`。
- `file`：必填，`src/content/clips/` 根目录下的源码文件名，同时用于自动生成详情页 slug。
- `createdAt`：必填，格式必须是 `YYYY-MM-DD`。
- `updatedAt`：可选，格式同上，且不能早于创建日期。

每行使用 `key: value` 格式，并按第一个冒号分隔，因此标题和简介中可以继续包含冒号。`slug` 不再填写：系统会移除 `file` 的扩展名、转为小写，并把非字母数字分隔符规范为连字符，例如 `astro.config.ts` 生成 `astro-config`，`bitdp-p1171.cpp` 生成 `bitdp-p1171`。无法生成有效 slug、缺失、空值、重复、未知字段以及旧的单行 slug 语法都会使检查或构建失败。

每个 slug 在全部已发布文章中只能声明一次。`draft: true` 文章里的围栏不会注册剪切板，也不会生成可公开访问的详情页。

## 本地检查和预览

新建或修改源码及围栏后运行：

```powershell
npm run check
npm test -- --run
npm run dev
```

假设 slug 是 `oauth-callback`，本地详情页为：

```text
http://localhost:4321/clips/oauth-callback/
```

原始代码下载地址为：

```text
http://localhost:4321/clips/oauth-callback.txt
```

构建阶段会扫描非草稿 Markdown、校验围栏字段、读取对应的扁平源码文件，并自动计算行数与 UTF-8 文件大小。正文 HTML 不包含完整源码；读者点击“复制代码”时才请求 `.txt` 文件。

## 修改和删除

- 修改代码：直接编辑 `src/content/clips/` 中的源码文件，必要时更新围栏内的 `updatedAt`。
- 修改标题或描述：编辑声明该剪切板的 `clip` 围栏。
- 修改 slug：重命名源码文件并同步修改围栏中的 `file`；旧详情页链接不会自动跳转。
- 删除：移除文章中的围栏；不再使用的源码文件可以一并删除，也可以保留为未引用文件。

正式部署仍使用：

```powershell
npm run deploy
```

## 可见性与安全

剪切板不会出现在导航或公开列表中，并带有 `noindex, nofollow`，同时从 sitemap 排除。但它仍然是公开网页：任何知道或猜到 URL 的人都可以读取和下载代码。

**不要在剪切板中保存密码、API Key、访问 Token、私钥、Cookie、个人隐私或其他敏感信息。** Git 历史也可能保留已经删除的内容；如果敏感信息曾被提交，应立即撤销相应凭据，而不是只删除文件。

## 相关文档

- [项目 README](../README.md)
- [架构说明](architecture.md)
- [内容创作指南](content-authoring.md)
- [部署与运维](deployment.md)
- [维护与测试指南](maintenance.md)