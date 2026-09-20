# Mermaid 写作与验收

博客文章和后台即时预览支持 Mermaid 图表，资源由本站提供，包含图表时才加载。

公开页面支持主题切换和站内导航；渲染失败时保留源码。后台预览保持无脚本沙箱隔离。图表较宽时可以横向滚动。

将下面的章节插入现有《Markdown 写作示例》文章的代码块章节后，保存并从后台发布台发布。不要用本地整篇文章覆盖线上正文。

## Mermaid 图表

将代码块的语言标记为 `mermaid`，就能用文本绘制图表。文章和后台即时预览都会渲染，并跟随深浅主题切换。语法错误时保留源码，方便检查。

### 流程图

写法：

````markdown
```mermaid
flowchart TD
    A[开始写作] --> B[编写 Markdown]
    B --> C{预览满意吗？}
    C -->|继续修改| B
    C -->|确认| D[从发布台发布]
    D --> E[读者浏览文章]
```
````

效果：

```mermaid
flowchart TD
    A[开始写作] --> B[编写 Markdown]
    B --> C{预览满意吗？}
    C -->|继续修改| B
    C -->|确认| D[从发布台发布]
    D --> E[读者浏览文章]
```

### 时序图

写法：

````markdown
```mermaid
sequenceDiagram
    participant A as 作者
    participant B as 管理后台
    participant C as 博客
    A->>B: 保存文章
    B-->>A: 返回即时预览
    A->>B: 在发布台发布
    B->>C: 构建并更新静态页面
    C-->>A: 文章上线
```
````

效果：

```mermaid
sequenceDiagram
    participant A as 作者
    participant B as 管理后台
    participant C as 博客
    A->>B: 保存文章
    B-->>A: 返回即时预览
    A->>B: 在发布台发布
    B->>C: 构建并更新静态页面
    C-->>A: 文章上线
```

