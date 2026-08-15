# 独立 Clip 与图片资源库实施计划

**日期：** 2026-08-14
**目标：** 将 Clip 和图片从文章所有权模型中彻底拆分，允许独立创建、未引用存在和多文章复用，同时保持静态博客发布流程与旧链接兼容。

## 一、目标数据模型

- 文章继续以文章 slug 作为文件名、路由和历史记录标识。
- Clip 使用自己的 slug，不再拥有 `postSlug`、`ownerPostSlug` 或 `postRevision`。
- 一个 Clip 可以不被任何文章引用，也可以被多篇文章引用。
- 图片没有文章所有者，上传时不要求文章 slug。
- 引用关系从文章内容动态扫描；资源本身不保存单一所有者。
- 删除被引用的 Clip 或图片时必须阻止操作并返回引用文章列表。
- Clip 与图片仍随博客正常构建和发布，不采用即时公开旁路。

## 二、图片资源库

1. 将图片从 `src/content/images/<post-slug>/<file>` 迁移为 `src/content/images/<normalized-name>-<sha12>.webp`。
2. 上传 API 只接收图片文件，不再接收或校验文章 slug。
3. 图片模型移除 `ownerPostSlug`，保留动态计算的 `references`。
4. 列表页显示引用文章与“未使用”状态，并支持按引用文章筛选。
5. 图片上传窗口只负责选择文件，不显示文章 slug。
6. 删除图片前扫描封面和正文引用；存在引用时拒绝删除。
7. 文章改名或删除不移动、不级联删除图片。
8. 为旧图片 URL 生成重定向，避免历史链接失效。
9. 相同内容按哈希去重；重复上传返回已有资源。

## 三、Clip 资源库

1. 将 Clip 重排为：

   ```text
   src/content/clips/<clip-slug>/meta.json
   src/content/clips/<clip-slug>/<source-file>
   ```

2. `meta.json` 使用版本化结构：

   ```json
   {
     "version": 1,
     "title": "售货员的难题",
     "description": "使用状态压缩 DP 解决洛谷 P1171 的 AC 代码。",
     "language": "cpp",
     "file": "p1171.cpp",
     "createdAt": "2026-08-03T00:00:00.000Z",
     "updatedAt": "2026-08-03T00:00:00.000Z"
   }
   ```

3. Clip slug 由目录名决定，元数据和源码拥有独立 revision。
4. Clip 创建、编辑、改名和删除不依赖文章。
5. 删除被引用 Clip 时拒绝操作并返回全部引用文章。
6. Clip 改名时重写所有文章引用，并保留旧公开 URL 重定向。
7. 未引用 Clip 仍生成 `/clips/:slug/` 与 `/clips/:slug.txt` 页面。

## 四、文章引用语法

旧的完整元数据 fenced block：

````markdown
```clip
title: 售货员的难题
source: p1171.cpp
...
```
````

迁移为只保存引用：

````markdown
```clip
slug: p1171
```
````

- remark 插件通过 Clip registry 解析卡片元数据。
- 同一 Clip 可被多篇文章引用。
- 文章移除卡片只移除引用，不删除 Clip。
- 缺失 Clip 的引用在内容校验和发布时阻止构建。

## 五、API 与后台交互

### Clip API

- `POST /api/clips`：独立创建 Clip。
- `GET /api/clips/:slug`：读取 Clip、源码、revision 和引用列表。
- `PUT /api/clips/:slug`：独立更新元数据或源码。
- `DELETE /api/clips/:slug`：仅在无引用时删除。
- `POST /api/posts/:postSlug/clip-references`：向文章插入已有或新建 Clip 引用。
- `DELETE /api/posts/:postSlug/clip-references/:clipSlug`：只移除文章引用。

### 图片 API

- `POST /api/images`：直接上传文件。
- `GET /api/images?referencedBy=<postSlug>`：按引用文章筛选。
- 删除接口在有引用时返回冲突及引用列表。

### 后台界面

- Clip 编辑页顶部显示独立资源信息与所有引用文章，不显示“所属文章”。
- 文章编辑器提供“插入 Clip”窗口，可选择已有 Clip 或创建后插入。
- 图片上传窗口删除文章 slug 输入框。
- 图片列表显示引用状态，未引用图片仍可复制路径和删除。

## 六、迁移工具

新增命令：

```text
npm run admin:migrate-independent-assets -- -DryRun
npm run admin:migrate-independent-assets
```

迁移步骤：

1. 扫描并校验全部旧 Clip fence、源码和图片路径。
2. 在写入前生成备份、迁移清单和内容哈希。
3. 为每个 Clip 建立目录与 `meta.json`，移动源码并重写文章 fence。
4. 将图片扁平化并按内容哈希命名，重写封面和正文引用。
5. 对相同图片去重，并生成旧路径到新路径的重定向。
6. 全部写入成功后才移除旧目录和旧文件。
7. 运行内容校验、测试和构建；任一步失败则不替换原内容。
8. `-DryRun` 不修改文件，只输出计划和冲突。
9. 迁移命令保持幂等，重复执行不会产生额外改动。
10. 迁移期间允许旧格式只读，完成后内容校验严格要求新格式。

## 七、测试与验收

### 图片

- 无 slug 上传成功并生成扁平哈希路径。
- 相同内容重复上传复用已有文件。
- 同一图片可被多篇文章引用。
- 被引用图片不可删除，响应包含引用文章。
- 文章改名不会移动图片。
- 旧图片 URL 能重定向到新路径。

### Clip

- 独立创建未引用 Clip 成功并生成公开页面。
- 同一 Clip 可插入多篇文章。
- 修改 Clip 后所有引用文章渲染新内容。
- 从文章移除引用不会删除 Clip。
- 被引用 Clip 不可删除。
- Clip 改名重写全部文章引用并生成旧 URL 重定向。
- 缺失 Clip 引用会阻止内容校验和发布。

### 迁移与发布

- `-DryRun` 不产生文件变更。
- 冲突在任何内容变更前失败。
- 迁移前后 Clip、图片和引用数量一致。
- 迁移后不存在旧 Clip fence 或按文章分组的图片目录。
- `npm run check`、`npm test -- --run`、`npm run build` 和 `npm run deploy -- -DryRun` 全部通过。

## 八、明确约束

- 文章 slug 仍是文章固有标识。
- Clip 使用独立 slug，可有零到多个文章引用。
- 图片没有所有者或文章 slug。
- 删除文章不级联删除 Clip 或图片。
- 采用彻底目录重排，不只兼容新资源。
- 所有资源随博客正常发布。
- Clip 公开 URL 保持不变；旧图片 URL 通过重定向兼容。
