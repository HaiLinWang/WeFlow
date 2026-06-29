# AGENTS.md

## 项目结构

- `src/`: React 19 + TypeScript 渲染进程代码；页面在 `src/pages/`，复用组件在 `src/components/`，状态在 `src/stores/`，前端服务封装在 `src/services/`。
- `electron/`: Electron 主进程、preload、worker 和本地能力；主入口是 `electron/main.ts`，窗口相关代码在 `electron/windows/`，主进程服务在 `electron/services/`。
- `shared/`: 渲染进程和主进程共享的静态数据。
- `resources/`: 打包时随应用分发的运行时、图标、安装脚本、密钥辅助程序、解密相关资源；改动前必须确认对应平台影响。
- `public/`: Vite 静态资源和应用图标。
- `docs/`: 用户和 API 文档，HTTP API 文档在 `docs/HTTP-API.md`。
- `.github/workflows/`: 发布、预览版、开发版构建流程；CI 使用 Node 24 和 npm。

## 运行命令

- 使用 npm，不要换成 pnpm/yarn；仓库有 `package-lock.json` 和 `.npmrc`。
- 安装依赖：`npm install`。注意 `postinstall` 会执行 `electron-builder install-app-deps` 和 `node scripts/prepare-electron-runtime.cjs`。
- 本地开发：`npm run dev`，Vite 默认从 `3000` 开始，端口占用时自动尝试下一个。
- Electron 开发模式：优先按 README 使用 `npm run dev`；需要显式 electron mode 时才用 `npm run electron:dev`。
- 预览已构建前端：`npm run preview`。
- 完整打包：`npm run build`，这会执行 `tsc && vite build && electron-builder`，只在需要验证安装包或发布配置时运行。

## 测试命令

- 没有 `npm test`、单元测试框架、ESLint 或 Prettier 脚本，不要假装存在。
- 常规验证必须至少跑：`npm run typecheck`。
- 涉及渲染、路由、资源加载或 Vite 配置时，加跑：`npx vite build`。
- 涉及 Electron 主进程、preload、worker、原生模块、打包资源或更新逻辑时，加跑：`npm run build`；如果因平台、证书、原生依赖或下载失败无法打包，要在结果里明确说明。
- 涉及 HTTP API 时，对照 `docs/HTTP-API.md` 检查接口字段和兼容性。

## 代码风格

- TypeScript 使用 `strict: true`；不要用 `any` 绕过类型，除非 Electron/第三方 API 没有可用类型且局部收敛。
- 继承现有格式：2 空格缩进、单引号、通常不写分号、React 函数组件、SCSS 与组件同目录或同页面命名。
- 路径别名只用于渲染进程 `@/* -> src/*`；Electron 侧保持相对导入，避免把 renderer alias 引入主进程构建。
- UI 改动优先复用 `src/components/`、`src/stores/`、`src/services/` 里的既有模式；图标优先用 `lucide-react`。
- 主进程能力通过 preload 暴露给 renderer；不要在 `src/` 里直接依赖 Node/Electron 主进程 API。
- 新增窗口、worker 或原生依赖时，同步检查 `vite.config.ts` 的 Electron entry、external、output 和 `package.json` 的 `build.files`/`extraResources`/`asarUnpack`。

## 禁止事项

- 不要修改 `package.json` 中的应用名、作者、appId、productName、发布 owner/repo，除非任务明确要求；文件里已有“二改不应改变此处的作者与应用信息”的约束。
- 不要提交或生成用户微信数据、导出的聊天记录、密钥、解密后的数据库、日志中的隐私内容。
- 不要把平台专用资源当作通用资源改动；`resources/key/`、`resources/runtime/`、`resources/wedecrypt/` 的变更必须说明影响 Windows/macOS/Linux 哪个平台。
- 不要用字符串拼接临时绕过 IPC、路径、文件访问或导出格式；优先使用已有 service/helper。
- 不要随意改自动更新通道、release workflow、安装器配置和 `minimumVersion`，这些会影响用户升级路径。
- 不要引入新的包管理器、格式化器或大规模重排文件，除非任务要求并同步配置。

## 完成标准

- 代码改动应限制在任务相关文件；无关重构、格式化和资源 churn 不算完成。
- 至少通过 `npm run typecheck`，或明确记录未运行/失败原因。
- 用户可见 UI 改动要在本地开发环境检查主要路径；桌面窗口、弹窗、导出、通知类改动要验证对应 Electron 流程。
- 改动数据结构、导出格式、HTTP API 或配置文件时，同步更新调用方、类型定义和相关文档。
- 涉及跨平台行为时，至少说明已验证的平台和未验证的平台风险。

## Review 标准

- 先看隐私和数据安全：是否泄露聊天内容、密钥、路径、日志，是否扩大本地文件访问范围。
- 再看 Electron 边界：renderer 是否绕过 preload，IPC 是否校验参数，主进程是否处理失败和取消。
- 检查打包影响：新增文件是否会进入 `dist`/`dist-electron`/`extraResources`，原生模块是否需要 `asarUnpack` 或 external。
- 检查平台差异：路径、权限、辅助程序可执行位、更新产物名、macOS/Windows/Linux 分支是否正确。
- 检查回归面：路由、窗口生命周期、worker 清理、导出中断/恢复、实时刷新、更新通道和 HTTP API 兼容性。
- 没有自动测试覆盖时，review 结论必须写明依赖了哪些手动或构建验证。
