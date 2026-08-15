# AI REST API 使用指南

Aier Blog 提供受限的 `/api/v1` 机器接口，供 AI 客户端、自动化脚本和编辑辅助工具读取或编写内容。它与浏览器管理会话完全分离，使用个人访问令牌（Personal Access Token）认证。

该接口的设计目标是“辅助编辑，而不是自动发布”：机器客户端可以创建草稿、更新正文、管理独立代码片段和上传图片，但不能发布、删除、恢复、迁移 slug、操作备份或管理其他令牌。

## 创建和撤销令牌

1. 登录管理后台。
2. 打开 **API 与安全**。
3. 填写令牌名称、有效期和所需权限。
4. 创建后立即复制 `aier_pat_...` 明文令牌。
5. 将令牌保存到调用方的 Secret Manager 或环境变量中。

明文令牌只显示一次。数据库仅保存 SHA-256 哈希和用于识别的短前缀，无法从后台恢复原始令牌。默认有效期为 30 天，允许范围为 1–365 天。撤销或过期后会立即停止工作。

不要把令牌写入 Git、Markdown 内容、浏览器前端代码、构建日志或聊天记录。

## 权限矩阵

| Scope | 允许的操作 |
| --- | --- |
| `posts:read` | 列出文章、读取文章正文和当前 revision |
| `posts:write` | 创建草稿、更新已有文章内容 |
| `clips:read` | 列出和读取独立代码片段 |
| `clips:write` | 创建和更新独立代码片段 |
| `images:read` | 列出图片及其元数据和引用 |
| `images:write` | 上传 JPEG、PNG 或 WebP 图片 |

写权限不会隐式授予读权限。调用方需要分别申请实际使用的 Scope。

## 认证

所有 `/api/v1` 请求都使用 Bearer Token：

```http
Authorization: Bearer aier_pat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

示例环境变量：

```bash
export AIER_API_ORIGIN='https://admin.blog.reaier.top'
export AIER_API_TOKEN='aier_pat_...'
```

## OpenAPI 3.1

OpenAPI 文档本身也需要有效令牌：

```bash
curl --fail-with-body \
  -H "Authorization: Bearer $AIER_API_TOKEN" \
  "$AIER_API_ORIGIN/api/v1/openapi.json"
```

文档请求 Schema 与 Fastify 实际路由 Schema 使用同一组 TypeScript 定义，避免接口文档和运行时校验分离。

## 文章接口

### 列出文章

```bash
curl --fail-with-body \
  -H "Authorization: Bearer $AIER_API_TOKEN" \
  "$AIER_API_ORIGIN/api/v1/posts?status=draft&page=1"
```

### 读取文章

```bash
curl --fail-with-body \
  -H "Authorization: Bearer $AIER_API_TOKEN" \
  "$AIER_API_ORIGIN/api/v1/posts/example-post"
```

响应中的 `revision` 用于后续并发更新。

### 创建文章草稿

```bash
curl --fail-with-body \
  -X POST \
  -H "Authorization: Bearer $AIER_API_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{
    "slug": "ai-assisted-draft",
    "title": "AI 辅助草稿",
    "description": "等待人工审核的草稿。",
    "publishedAt": "2026-08-15",
    "tags": ["AI"],
    "draft": false,
    "featured": true,
    "body": "# 正文\n"
  }' \
  "$AIER_API_ORIGIN/api/v1/posts"
```

无论请求中传入什么值，服务端都会强制：

```json
{
  "draft": true,
  "featured": false
}
```

### 更新文章

更新必须携带当前 revision：

```bash
curl --fail-with-body \
  -X PUT \
  -H "Authorization: Bearer $AIER_API_TOKEN" \
  -H "If-Match: CURRENT_REVISION" \
  -H 'Content-Type: application/json' \
  --data '{
    "title": "更新后的标题",
    "description": "更新后的摘要。",
    "publishedAt": "2026-08-15",
    "tags": ["AI", "Draft"],
    "body": "更新后的正文。\n"
  }' \
  "$AIER_API_ORIGIN/api/v1/posts/example-post"
```

机器接口不能修改文章 slug、`draft` 或 `featured` 状态。缺少 `If-Match` 返回 `428 PRECONDITION_REQUIRED`；revision 已过期返回 `409 REVISION_CONFLICT`。

## 代码片段接口

支持：

- `GET /api/v1/clips`
- `GET /api/v1/clips/{slug}`
- `POST /api/v1/clips`
- `PUT /api/v1/clips/{slug}`

创建代码片段：

```bash
curl --fail-with-body \
  -X POST \
  -H "Authorization: Bearer $AIER_API_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{
    "slug": "binary-search",
    "title": "Binary search",
    "description": "独立代码片段",
    "language": "typescript",
    "file": "binary-search.ts",
    "createdAt": "2026-08-15",
    "code": "export function search() {}\n"
  }' \
  "$AIER_API_ORIGIN/api/v1/clips"
```

更新同样必须提供 `If-Match`。机器接口不能通过更新操作修改 clip slug 或后端源文件名。

## 图片接口

列出图片：

```bash
curl --fail-with-body \
  -H "Authorization: Bearer $AIER_API_TOKEN" \
  "$AIER_API_ORIGIN/api/v1/images?page=1"
```

上传图片：

```bash
curl --fail-with-body \
  -X POST \
  -H "Authorization: Bearer $AIER_API_TOKEN" \
  -F 'file=@./cover.png;type=image/png' \
  "$AIER_API_ORIGIN/api/v1/images"
```

服务端只接受 JPEG、PNG 和 WebP，并会统一处理为受控 WebP 资源。

## 错误结构

JSON 错误统一返回：

```json
{
  "code": "API_SCOPE_REQUIRED",
  "message": "The API token requires the posts:write scope.",
  "details": {
    "requiredScope": "posts:write"
  },
  "requestId": "req-123"
}
```

常见状态码：

| 状态码 | 含义 |
| --- | --- |
| `400` | 请求未通过 JSON Schema 或上传校验 |
| `401` | 缺少、无效、过期或已撤销的令牌 |
| `403` | 令牌缺少所需 Scope |
| `409` | revision 冲突或资源重复 |
| `413` | Markdown、代码或图片超过限制 |
| `428` | 更新请求缺少 `If-Match` |
| `429` | Token 超过速率限制 |

记录 `requestId`，可以将客户端错误与服务端日志关联起来。

## 限流与审计

- 常规请求：每个 Token 每分钟 120 次。
- 图片上传：每个 Token 每分钟 20 次。
- 响应包含 `X-RateLimit-Limit`、`X-RateLimit-Remaining` 和 `X-RateLimit-Reset`。
- 超限响应包含 `Retry-After`。

审计日志记录 Token ID、Token 名称、来源 IP、操作、资源标识和更新后的 revision。审计日志不会记录 Token 明文或完整请求正文。

## 明确禁止的能力

`/api/v1` 不提供以下接口：

- 发布或触发静态构建
- 删除或恢复文章、代码片段、图片
- 修改文章发布状态或精选状态
- slug 迁移
- 备份导入、应用或下载
- 查看管理日志
- 创建、列出或撤销其他 Token
- 管理管理员凭据、TOTP 或会话

公开站点版本仍只能由已登录管理员在 **发布与日志** 页面人工发布。
