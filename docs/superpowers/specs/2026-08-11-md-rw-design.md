# md_rw — Chrome 本地 Markdown 读写插件设计文档

- **日期**:2026-08-11
- **状态**:Draft(待用户审查)
- **作者**:brainstorming session 产出

---

## 1. 背景与目标

在 Chrome 中以「文件夹」为单位读写本地 Markdown 笔记,提供一个轻量、可日常使用的浏览器内 MD 编辑器。

### 目标(v1)

1. 以文件夹形式访问本地 Markdown(基于 File System Access API)
2. 文件树侧边栏,支持完整文件管理(CRUD + 拖拽移动)
3. 分屏布局:左侧 CodeMirror 源码编辑器,右侧 markdown-it 实时预览
4. 完整 Markdown 语法支持:GFM、wikilinks、相对链接、代码高亮、KaTeX 数学、Mermaid 图表、callout/alert、脚注、TOC、YAML frontmatter
5. 工作区跨会话持久化(记住上次打开的文件夹)
6. 自动保存(防抖 1s)+ Ctrl+S 手动保存
7. 跨文件搜索(grep 风格)
8. 链接跳转 + 重命名/移动时自动更新 wikilinks 与相对链接引用
9. 明暗主题

### 非目标(v1,延后到 v2+)

- 多标签页(同时打开多个文件)
- 外部磁盘变更的实时热重载(v1 仅在保存时做 mtime 冲突检测)
- 剪贴板图片粘贴自动保存到文件夹
- 侧边栏(side panel)快捷记事伴侣
- 移动端 / 非 Chromium 浏览器适配

---

## 2. 现有方案调研结论

### md-reader(https://github.com/md-reader/md-reader)

- 414★,MIT 协议,但 2.x 已停止维护,3.x 转为闭源(仅通过官网发布)
- **覆盖项**:预览 `file://`/`http://`/`https://` 的 `.md/.mkd/.mdx/.markdown`;TOC 侧边栏;明暗主题;代码高亮;热重载;语法插件(emoji、数学、流程图、甘特图、TOC、callout)
- **未覆盖项**:**完全只读,无任何编辑能力**;无文件夹选择器(按 URL 工作);无跨文件夹的文件树(只有当前文档的标题 TOC)
- **结论**:md-reader 满足「读」的一半需求,但完全不覆盖「写」与「文件夹级管理」。我们的定位正好填补这一空缺

### 其他参考

- MarkText、Obsidian、Typora:均为桌面应用,非浏览器插件
- StackEdit:Web 应用,沙箱化,无法直接访问本地文件夹
- File System Access API(Chrome 86+):是浏览器内真正读写本地文件夹的唯一干净路径,无需额外原生组件

---

## 3. 架构概述

采用「分层单体」结构(Approach A),单一 Preact 应用,清晰的层间隔离,无 Web Worker(v1)。后续可在 `fs/` 与 `markdown/` 接口后插入 Worker 而不破坏调用方。

```
┌──────────────────────────────────────────────────────────────┐
│  Chrome MV3 Extension(action.onClicked -> 开全屏标签页)      │
├──────────────────────────────────────────────────────────────┤
│  src/                                                        │
│  ├─ fs/              File System Access API 包装层           │
│  │   ├─ directory.ts   选择/打开/持久化目录句柄              │
│  │   ├─ files.ts       CRUD:读/写/建/删/移                   │
│  │   └─ watch.ts       (v2)外部变更监听                      │
│  ├─ markdown/        解析 + 渲染 + 插件                      │
│  │   ├─ parser.ts      markdown-it 实例 + 全套插件           │
│  │   ├─ wikilinks.ts   [[x]] 解析/解析/反向链接              │
│  │   └─ render.ts      HTML 渲染 + 高亮 + KaTeX              │
│  ├─ editor/          CodeMirror 6 源码编辑器                 │
│  │   └─ cm.ts          CM 实例 + MD 模式 + 键绑定            │
│  ├─ search/          跨文件 grep                             │
│  │   └─ grep.ts        遍历/正则/排序                        │
│  ├─ store/           Preact signals(状态)                  │
│  │   └─ workspace.ts   当前文件夹/打开文件/脏标记/最近文件   │
│  ├─ ui/              Preact 组件                             │
│  │   ├─ App.tsx         布局壳                               │
│  │   ├─ FileTree.tsx    文件树 + CRUD + 拖拽                 │
│  │   ├─ EditorPane.tsx  封装 CodeMirror                      │
│  │   ├─ PreviewPane.tsx 封装渲染 HTML                        │
│  │   ├─ SearchPanel.tsx 搜索 UI                              │
│  │   └─ CommandBar.tsx  顶部工具栏 + 快捷键                  │
│  └─ background.ts    MV3 service worker(图标点击处理)      │
├──────────────────────────────────────────────────────────────┤
│  分层规则:ui/ -> store/ -> {fs/, markdown/, editor/,        │
│  search/}。下层永远不导入 ui/。纯逻辑层(fs/, markdown/,     │
│  search/)不依赖 Preact,可独立单测。                         │
└──────────────────────────────────────────────────────────────┘
```

### 关键架构规则

- **MV3 service worker 极薄**:只处理 `action.onClicked` -> 打开全屏 App 标签页。业务逻辑全部在 App 标签页内(SW 随时可能被回收,不可放业务)
- **状态用 Preact signals**(`@preact/signals`),不层层 props 透传。单一 `workspace` store 持有:目录句柄、文件树、当前打开文件路径、内容、脏标记、最近文件列表
- **持久化分层**:目录句柄 + 最近文件 + 设置 -> IndexedDB(FileSystemDirectoryHandle 可被 IndexedDB 序列化);**文件内容永不缓存**,打开时永远从磁盘读最新,保存时写回
- **ESLint 规则强制分层**:禁止下层导入 `ui/`,保证纯逻辑层可独立测试

---

## 4. 组件清单

### 4.1 `fs/directory.ts` — 目录句柄生命周期

- `pickDirectory(): Promise<FileSystemDirectoryHandle>` — 包装 `showDirectoryPicker()`
- `persistHandle(handle)` / `loadHandle()` — IndexedDB 存取。加载时调用 `handle.requestPermission({ mode: 'readwrite' })`;用户拒绝则 App 显示「重新授权」界面而非重选
- `listTree(handle, maxDepth?)` — 递归遍历,返回可序列化的树结构(path / kind / size / mtime)。用于渲染文件树,不持有打开的文件句柄

### 4.2 `fs/files.ts` — 文件 CRUD

全部异步,返回 `null` 或 `Result` 而非抛异常。

- `readFile(handle, path): Promise<string>`
- `writeFile(handle, path, content)` — 原子写:写入 `<name>.tmp` 再 `move()` 覆盖目标(Chrome 111+ 支持 `FileSystemFileHandle.move`)
- `createFile(handle, path)` / `createDirectory(handle, path)`
- `deleteFile(handle, path)` / `deleteDirectory(handle, path, recursive)`
- `moveEntry(handle, srcPath, destPath)` — 文件树拖拽移动
- `exists(handle, path)`

### 4.3 `markdown/parser.ts` — 单例 markdown-it

配置一次,启用插件:

- `markdown-it-gfm`(表格 / 任务列表 / 删除线 / 自动链接)
- `markdown-it-wikilinks`
- `markdown-it-footnote`
- `markdown-it-deflist`
- `markdown-it-attrs`
- `markdown-it-front-matter`
- `markdown-it-anchor`(TOC)
- `markdown-it-container`(callout / alert)
- `markdown-it-katex`(数学)
- 代码高亮:注册 `highlight.js` 到 markdown-it 的 `highlight` 选项
- Mermaid:` ```mermaid ` 代码块在 markdown-it 阶段保留为带 class 的 `<pre>`,由 `render.ts` 在渲染后异步渲染(mermaid 太重,不可每次按键同步渲染)

### 4.4 `markdown/wikilinks.ts`

- `resolveWikilink(name, tree): string | null` — `[[x]]` 模糊匹配:先按 basename,再按路径子串。歧义时返回首个命中(v1 简化,不弹歧义选择器;v2 可加 disambiguation picker);无任何命中返回 null
- `findBacklinks(targetPath, tree): Promise<Match[]>` — 扫描全 vault,找出引用目标的所有 `[[target]]` 与相对链接
- `updateReferences(tree, oldPath, newPath): Promise<Edit[]>` — 返回重命名/移动时需要做的全部文件编辑清单;UI 在单次确认后批量应用

**类型定义**:

```ts
type Edit = {
  path: string;                              // 受影响的文件
  replacements: Array<{ match: string; replace: string }>;  // 该文件内的字符串替换
};
type Match = { path: string; line: number; lineText: string };
```

### 4.5 `editor/cm.ts` — CodeMirror 6

扩展包:

- `@codemirror/lang-markdown` + `@codemirror/language-data`(fenced code)
- `@codemirror/autocomplete` + 自定义补全源:输入 `[[` 触发 wikilink 补全,输入 `(/` 触发相对路径补全,候选来自当前文件树
- `@codemirror/search` + `@codemirror/commands`(Ctrl+S / Ctrl+F)
- `EditorView.lineWrapping`
- 主题随 App 明暗切换

暴露薄接口:`createEditor(parent: HTMLElement, opts): { update(text), getValue(), destroy(), onFocus(cb) }`。Preact 不直接操作 CM 内部。

**`EditorOpts` 形状**:

```ts
type EditorOpts = {
  initialText: string;
  theme: 'light' | 'dark';
  onDirty: () => void;       // 内容变化时回调(用于设 isDirty)
  onSave: () => void;        // Ctrl+S 时回调
};
```

### 4.6 `search/grep.ts`

- `search(query: { pattern, isRegex, caseSensitive, fileGlob }, handle): Promise<SearchHit[]>`
- 并发读取(限制 8),返回 `{ path, line, lineText, matchStart, matchEnd }[]`
- 首次搜索缓存文件内容 30 秒,任何写操作清空缓存

### 4.7 `store/workspace.ts` — Preact signals 状态

**Signals**:`directoryHandle` / `tree` / `openFilePath` / `openFileContent` / `isDirty` / `recentFiles` / `searchOpen` / `theme`

**Actions**:`openWorkspace()` / `openFile(path)` / `saveCurrent()` / `createFile(path)` / `deleteFile(path)` / `moveFile(src, dest)` / `runSearch(query)`

**强制不变量**:

1. 当前文件脏时,`openFile` 必须先弹确认(保存 / 不保存 / 取消)
2. `saveCurrent` 成功后清 `isDirty` 并刷新 tree 中该文件的 mtime
3. `moveFile` 必须先触发 `updateReferences`,弹出受影响文件清单给用户确认后才执行

### 4.8 UI 组件

- `App.tsx` — 布局壳:`[ FileTree | EditorPane | PreviewPane ]`,可拖拽分隔条(CSS grid + pointermove)。顶栏:工作区名 / 面包屑 / 搜索开关 / 主题开关 / 保存状态
- `FileTree.tsx` — 虚拟化树(只渲染可见节点,signals 管理 expand/collapse)。HTML5 拖拽移动。右键菜单:新建文件 / 新建文件夹 / 重命名 / 删除 / 移动
- `EditorPane.tsx` — `useEffect` 挂载 CodeMirror,signal <-> CM 内容双向同步,CM `docChanged` -> `isDirty` + 防抖自动保存
- `PreviewPane.tsx` — `openFileContent` 变化时防抖 250ms 重新渲染。Mermaid 块在 paint 后渲染。DOMPurify 消毒后注入
- `SearchPanel.tsx` — 浮层或侧栏;列出 `SearchHit[]`;点击跳转到文件 + 行 + 滚动编辑器
- `CommandBar.tsx` — 顶部工具栏,集中快捷键入口
- `ErrorBoundary.tsx` — 兜底崩溃边界

---

## 5. 数据流

### 5.1 启动流程

1. 用户点击插件图标 -> service worker `action.onClicked` -> 打开 `index.html` 全屏标签页
2. App 启动 -> 从 IndexedDB 读取上次目录句柄
3. 调用 `requestPermission({ mode: 'readwrite' })`
   - 同意 -> 进入工作区,后台扫描文件树
   - 拒绝 -> 显示「重新授权」按钮
   - 无句柄 -> 显示「选择文件夹」按钮,调用 `showDirectoryPicker()`
4. 文件树就绪 -> 默认打开最近编辑的文件(或第一个 .md)

### 5.2 打开文件流程

1. 用户点击文件树项
2. 检查当前文件脏状态 -> 脏则弹确认(保存 / 不保存 / 取消)
3. 从磁盘读取内容 -> 写入 `openFileContent` signal
4. CodeMirror 收到新内容 -> 刷新编辑器
5. 预览面板收到新内容 -> 防抖 250ms 重新渲染
6. 加入「最近文件」列表 -> 写入 IndexedDB

### 5.3 编辑 + 自动保存流程

1. 用户打字 -> CM 触发 `docChanged`
2. EditorPane 监听 -> `isDirty = true`,顶栏显示「未保存」
3. 启动 1 秒防抖计时器
   - 持续打字 -> 重置
   - 1 秒无变化 -> 触发自动保存 -> `writeFile()` -> `isDirty = false`
4. Ctrl+S -> 立即保存(取消等待中的防抖)
5. 写文件采用「写 `.tmp` + `move()` 覆盖」原子模式,防中途崩溃损坏原文件

### 5.4 链接跳转流程

1. 用户在预览面板点击 `[[笔记A]]` 或 `[文本](./other.md)`
2. PreviewPane 拦截点击,阻止默认跳转
3. 解析目标路径(`resolveWikilink` 或相对路径计算)
   - 找到 -> 走「打开文件流程」
   - 找不到 -> 弹框「该链接指向的文件不存在,是否创建?」;用户确认后,以链接文本(去掉 `[[ ]]` 或 `[]()` 语法)作为 H1 标题创建新文件,内容形如 `# <链接文本>\n`,然后走「打开文件流程」进入编辑
4. 编辑器内支持 Ctrl+点击 链接跳转

### 5.5 重命名 / 移动文件流程(含 wikilink 更新)

1. 用户右键重命名或拖拽移动
2. 调用 `updateReferences(oldPath, newPath)` 扫描全 vault
3. 弹出确认框:「将修改 N 个文件中的引用,是否继续?」列出受影响文件
4. 用户确认 -> 批量修改并保存受影响文件 -> `moveEntry()` 移动原文件 -> 刷新文件树
5. 用户取消 -> 不做任何改动

### 5.6 跨文件搜索流程

1. 用户按 Ctrl+Shift+F 或点击搜索按钮 -> 打开 SearchPanel
2. 输入关键词(支持正则、大小写、文件名 glob)
3. `grep.ts` 并发读取所有 .md 文件(限制 8),收集命中行
4. 首次搜索缓存内容 30 秒,任何写入清空缓存
5. 点击结果 -> 打开文件 -> 编辑器滚动到命中行并高亮

---

## 6. 错误处理

### 6.1 权限与文件系统错误

- **权限被吊销**:捕获 `NotAllowedError`,App 退回「重新授权」界面,内存中的已编辑内容保留,授权后可继续保存
- **文件被外部删除/移动**:读取/保存时报 `NotFoundError`,提示「该文件已不存在」,刷新文件树,当前文件标记为「未保存的新内容」让用户另存
- **磁盘满 / 写入失败**:捕获 `QuotaExceededError`,提示「保存失败,磁盘空间不足」,保持 `isDirty = true`,内容不丢
- **文件名非法**(`/ \ : * ? " < > |`):前端拦截,不允许提交

### 6.2 Markdown 渲染错误

- **单个插件崩溃**(KaTeX 公式错误、Mermaid 语法错误):try/catch 包裹单个块,失败时该位置显示「渲染失败: <错误信息>」,不影响其他内容
- **恶意 HTML 注入**:DOMPurify 在注入前清洗,移除 `<script>` / `on*` 事件属性 / `javascript:` 链接
- **超大文件(> 1MB)**:CodeMirror 仍可编辑,预览面板跳过渲染并提示「文件过大,预览已禁用,可点击手动渲染」

### 6.3 编辑器冲突保护

- 保存前先读取磁盘最新 mtime,与打开时的 mtime 对比
  - 不一致 -> 弹出冲突解决对话框(三选一,非 git 式三方合并):保留本地版本 / 覆盖为磁盘版本 / 并排对比手动合并
  - 一致 -> 正常保存
- v1 仅在保存时检测;完整的实时外部变更监听(`FileSystemObserver` 或 mtime 轮询)留到 v2

### 6.4 搜索 / 批量操作错误

- 搜索中某个文件读取失败:跳过,继续搜索其他文件,结果底部显示「跳过 N 个无法读取的文件」
- 批量 wikilink 更新中途失败:已成功修改的保留,失败的在确认框标红列出,可重试或取消

### 6.5 全局兜底

- App 顶层 `ErrorBoundary`:子组件崩溃不白屏,显示「出错了:<信息>」+「重新加载」+「复制错误信息」
- 未捕获的 Promise rejection 记入内存日志(最近 100 条),命令栏「显示日志」可查看

---

## 7. 测试策略

参考 `page-to-md`,使用 **vitest + jsdom**,分三层。

### 7.1 纯逻辑层(目标覆盖率 ~80%)

无 Preact、无 DOM、无真实文件系统。

- `fs/files.ts` — Mock `FileSystemDirectoryHandle`,测 CRUD 边界:不存在、目录非空、移动到自身、跨目录移动
- `markdown/parser.ts` — 喂各种 markdown 字符串,断言 HTML:GFM 表格、任务列表、wikilink、相对链接、frontmatter、KaTeX、callout、脚注、代码高亮
- `markdown/wikilinks.ts` — `resolveWikilink` 优先级、`findBacklinks` 跨文件扫描、`updateReferences` 各种引用形态(`[[x]]` / `[[x|别名]]` / `[t](./x.md)` / `[t](./x.md#锚点)`)
- `search/grep.ts` — Mock 文件树,测正则、大小写、glob 过滤、并发、缓存失效

### 7.2 集成层(中等覆盖)

- `store/workspace.ts` — Mock fs 层,测状态机:打开脏文件确认、保存后 isDirty 清零、moveFile 触发 updateReferences、并发 openFile 边界
- CodeMirror 实例化 + 内容同步:真实 CM + jsdom,测 `createEditor` 接口
- PreviewPane 渲染管线:markdown -> parser -> DOMPurify -> DOM,测 mermaid 延迟渲染、KaTeX 失败降级

### 7.3 UI 层(轻量冒烟)

- `@testing-library/preact` 渲染组件,断言关键交互:点击文件树打开、Ctrl+S 保存、点击 wikilink 跳转、拖拽移动、搜索结果跳转
- 不测样式 / 动画,只测「行为是否发生」

### 7.4 测试夹具

- `tests/fixtures/mini-vault/` 下放迷你 vault(5-8 个 .md,涵盖各种语法),集成与 UI 测试共用
- `tests/mocks/fs.ts` 提供 `FileSystemDirectoryHandle` Mock 工厂,所有测试复用

### 7.5 不测什么(明确排除)

- CodeMirror 内部行为(成熟库,有自己的测试)
- markdown-it 插件本身(同理)
- 真实浏览器 File System Access API(CI 不稳定,留作手动验证)
- MV3 service worker(逻辑太薄,仅一行)

### 7.6 手动验证清单

放 `docs/manual-checklist.md`,发版前过一遍:真实文件夹选择、跨会话恢复、外部修改后保存触发冲突提示、Mermaid/KaTeX 渲染、超大文件、权限吊销后恢复等。

---

## 8. 技术栈

| 类别 | 选型 |
|---|---|
| 构建 | esbuild(参考 page-to-md) |
| 语言 | TypeScript 5.5+ |
| 框架 | Preact 10 + `@preact/signals` |
| 编辑器 | CodeMirror 6(`lang-markdown` + `language-data` + `autocomplete` + `search` + `commands`) |
| Markdown | markdown-it + 全套插件 |
| 代码高亮 | highlight.js |
| 数学 | KaTeX |
| 图表 | mermaid(按需异步) |
| HTML 消毒 | DOMPurify |
| 测试 | vitest + jsdom + @testing-library/preact |
| Manifest | MV3 |

### Manifest 关键配置

- `"manifest_version": 3`
- `"action": { "default_title": "md_rw" }`(无 default_popup,点击触发 `onClicked`)
- `"permissions": []`(File System Access API 不需要声明 permission)
- 无 `host_permissions`
- `background.service_worker` 指向 `background.ts` 编译产物

---

## 9. 项目结构

```
md_rw/
├─ src/
│  ├─ background.ts            MV3 SW:action.onClicked -> 开标签页
│  ├─ index.html               全屏 App 入口
│  ├─ main.tsx                 Preact 挂载点
│  ├─ fs/                      {directory.ts, files.ts, watch.ts(v2)}
│  ├─ markdown/                {parser.ts, wikilinks.ts, render.ts}
│  ├─ editor/                  {cm.ts}
│  ├─ search/                  {grep.ts}
│  ├─ store/                   {workspace.ts, settings.ts}
│  └─ ui/                      {App.tsx, FileTree.tsx, EditorPane.tsx,
│                              │ PreviewPane.tsx, SearchPanel.tsx,
│                              │ CommandBar.tsx, ErrorBoundary.tsx}
├─ tests/
│  ├─ fixtures/mini-vault/     测试用迷你 vault
│  ├─ mocks/fs.ts              FileSystemDirectoryHandle Mock
│  └─ ...                      各层测试
├─ docs/
│  ├─ superpowers/specs/       设计文档
│  └─ manual-checklist.md      发版前手动验证清单
├─ esbuild.config.mjs
├─ package.json
├─ tsconfig.json
├─ vitest.config.ts
└─ manifest.json
```

---

## 10. v1 范围 vs v2+ 范围

| 功能 | v1 | v2+ |
|---|---|---|
| 文件夹选择(File System Access API) | ✅ | |
| 文件树 + CRUD + 拖拽移动 | ✅ | |
| 分屏:CodeMirror 源码 + 实时预览 | ✅ | |
| GFM + wikilinks + 链接 + 高亮 | ✅ | |
| KaTeX + Mermaid + callout + 脚注 + TOC | ✅ | |
| YAML frontmatter | ✅ | |
| 工作区持久化(跨会话恢复) | ✅ | |
| 自动保存 + Ctrl+S | ✅ | |
| 跨文件搜索 | ✅ | |
| 链接跳转 + 重命名感知 wikilink 更新 | ✅ | |
| 明暗主题 | ✅ | |
| 多标签页(同时打开多文件) | | ✅ |
| 外部变更监听(磁盘热重载) | | ✅ |
| 剪贴板图片粘贴 -> 存入文件夹 | | ✅ |
| 侧边栏快捷记事伴侣 | | ✅ |

---

## 11. 开放问题

无。v1 范围已通过 brainstorming 全部明确。

如实现期发现以下问题需重新协商:

- CodeMirror 6 + Preact 在 jsdom 下的集成测试稳定性
- mermaid 在浏览器扩展 CSP 下的 worker 加载策略
- `FileSystemFileHandle.move` 在目标已存在时的覆盖语义(需在实现期验证 Chrome 实际行为)
