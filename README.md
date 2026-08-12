# Pilcrow

在浏览器中直接读写本地 Markdown 文件夹的 Chrome 扩展(MV3)。

## 关于名字

Pilcrow(¶)是排版记号「段落标记」,几百年来一直被排字工人用来标注段落的开始。取这个名字,是因为它既呼应 Markdown 的纯文本本质——段落、小节、分隔线,都是这个符号的领地;也寄托了对这款工具的期望:帮你把零散的念头,顺理成章地落成一段段干净的记录。

图标就是这个 ¶ 符号。

## 功能

- 通过 File System Access API 授权并读取本地文件夹
- 侧边栏文件树:新建 / 重命名 / 移动 / 删除 Markdown 文件与文件夹
- CodeMirror 6 分栏编辑器,自动保存 + `Ctrl+S` 手动保存
- markdown-it 实时预览:任务列表、脚注、定义列表、table、KaTeX 公式、highlight.js 代码高亮、Mermaid 图、WikiLinks
- 跨文件全文搜索(`Ctrl+Shift+F`)
- 顶栏回退/前进导航 + 最近打开文件下拉
- 磁盘冲突检测、明暗主题、最近打开文件记录

## 快速开始(直接加载到浏览器)

> 已构建好的产物在 `dist/` 目录,无需任何编译步骤。

1. 打开 Chrome/Edge,访问 `chrome://extensions`
2. 打开右上角「开发者模式」开关
3. 点「加载已解压的扩展程序」,选择本项目的 **`dist`** 目录(含 `manifest.json` 的那个)
4. 点击工具栏的 Pilcrow 图标打开扩展页面,首次会自动打开;允许「访问你的文件」即完成授权

> 若缺少 Node.js 环境,仓库里已附 `dist/`,直接加载即可。

## 从源码构建(可选)

需要 Node.js ≥ 18。

```bash
npm install
npm run build        # 产出全新 dist/
npm run watch        # 开发时监视改动自动重建
```

验证命令:

```bash
npm test             # 172 项单元测试
npm run typecheck    # TypeScript 类型检查
```

## 使用提示

- 首次点击页内「Select folder」选择你的 Markdown 文件夹
- 编辑区标记 `●` 表示有未保存修改;`Ctrl+S` 或失焦自动保存
- 磁盘上文件被外部修改时会弹冲突确认,可「覆盖」或「查看合并」
- 移动文件夹时,对你打开的文件路径与指向其内部文件的链接(WikiLinks/相对链接)会自动更新的文件重写
- 授权被撤销时页内提供「Re-grant access」重新授权

## 目录结构

```
src/
  background.ts    # service worker:点击图标/安装时打开 app 页
  main.tsx         # 入口,渲染 App
  fs/              # File System Access API 封装(文件/目录 CRUD)
  markdown/        # markdown-it 解析与渲染、WikiLinks 重命名感知
  editor/          # CodeMirror 6 编辑器
  search/          # 跨文件全文搜索
  store/           # @preact/signals 状态(workspace / settings)
  ui/              # Preact 组件(文件树、编辑器、预览、搜索、对话框)
tests/             # vitest 测试(含 mock FileSystemHandle)
```

`manifest.json` 需要 `background.js` 与页面资源打包在一起,构建脚本 `esbuild.config.mjs` 会把静态资源与字体一并复制进 `dist/`。