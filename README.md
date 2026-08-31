# ZMAI

`zmai` 是一个本机多 Agent 历史会话工作台，同时提供 Claude API 配置管理能力。

支持发现和管理本机的 **Claude Code**、**Codex**、**OpenCode**：浏览历史会话、按项目和 Agent 分类、续接会话、跨 Agent 导入历史、迁移附件，以及查看 plugins、Skills、MCP。

## 安装

```bash
npm install -g @worldzb/zmai
```

安装后使用 `zmai` 命令。

> 需要 Node.js 18 或更高版本。

## 核心功能

| 功能 | 说明 |
| --- | --- |
| Agent 发现 | 扫描 Claude Code、Codex、OpenCode 的安装状态、版本与本地数据目录 |
| 历史会话 | 统一读取三个 Agent 的本地会话，按时间排序、分类和分页浏览 |
| 项目筛选 | 区分当前项目会话与全部会话 |
| Agent 筛选 | 按全部、Claude、Codex、OpenCode 分类显示 |
| 会话续接 | 用原 Agent 继续历史会话 |
| 跨 Agent 迁移 | 将历史转换为可移植上下文，并在目标 Agent 中创建新会话 |
| 附件迁移 | 复制可读取的图片/文件，生成带校验值的迁移清单 |
| 集成管理 | 查看 plugins、Skills、MCP，并调用 Agent 原生命令安装或移除 |
| API 配置 | 管理 Claude API Key、Base URL、默认配置和临时环境变量 |

## 扫描 Agent

```bash
zmai agents
```

输出每个 Agent 的：

- 是否已安装及可执行命令路径
- 版本号
- 本地历史目录
- 支持的会话、集成与配置能力

## 历史会话

```bash
zmai history
```

交互界面由 React + Ink 渲染。初次加载会动态显示 Claude Code、Codex、OpenCode 的扫描进度。

### 范围与分类

- `Tab`、左方向键：当前项目 / 全部会话之间切换
- 右方向键：切换至全部会话
- `1`：全部 Agent
- `2`：Claude Code 会话
- `3`：Codex 会话
- `4`：OpenCode 会话

### 会话操作

- 上下方向键：选择会话；在列表首尾可自动跨页
- `Ctrl+U` 或 `-`：上一页
- `Ctrl+D` 或 `=`：下一页
- `Enter`：打开会话操作
- `r`：重新扫描本地历史
- `q`：退出

非交互环境可使用文本输出：

```bash
zmai history --plain
zmai history --plain --agent claude --page-size 30
```

## 续接与跨 Agent 迁移

在历史会话中按 `Enter` 后：

- **选择原 Agent**：在当前终端直接续接原生会话。
- **选择其他 Agent**：创建迁移目录，转换旧会话内容，然后在当前终端启动目标 Agent。

迁移时会：

1. 将用户、助手与工具消息转换为可移植 Markdown 上下文；
2. 复制可读取且不超过 20MB 的图片和文件；
3. 为附件生成 SHA-256 校验值；
4. 生成 `conversation.md` 和 `manifest.json`；
5. 将完整历史复制到剪贴板，并将上下文交给目标 Agent 新会话。

迁移文件保存于：

```text
~/.zmai/migrations/<migration-id>/
```

来源会话不会被修改或删除。

也可通过命令迁移：

```bash
zmai migrate codex:<session-id> --to claude
```

## Plugins、Skills 与 MCP

```bash
# 查看全部 Agent 的资源
zmai integrations

# 仅查看某个 Agent，并包含项目级资源
zmai integrations --agent claude --project /path/to/project

# 安装插件
zmai integrations --agent claude --install-plugin plugin@marketplace

# 移除资源
zmai integrations --remove claude:plugin:plugin-name
```

安装或移除前会要求明确确认。插件和 MCP 优先使用对应 Agent 的原生命令；不会自动执行未知远程脚本。

## Claude API 配置

```bash
# 交互式添加配置
zmai add -i

# 命令行添加配置
zmai add -n "官方 API" -k "sk-ant-api03-xxx" -u "https://api.anthropic.com"

# 查看配置
zmai list

# 当前终端临时使用
 eval $(zmai switch -n "官方 API" --temp --eval)

# 设为 Claude Code 默认配置
zmai switch -n "官方 API"

# 查看当前 Claude 配置
zmai current
```

默认配置会更新：

```text
~/.claude/settings.json
~/.claude-switch-config/.claude-env
```

## 数据目录

| 数据 | 路径 |
| --- | --- |
| Claude API 配置 | `~/.claude-switch-config/claude-configs.json` |
| 临时环境变量 | `~/.claude-switch-config/.claude-env` |
| Claude Code 设置 | `~/.claude/settings.json` |
| 会话迁移上下文与附件 | `~/.zmai/migrations/` |
| 旧版托管会话记录 | `~/.zmai/sessions.json` |

## 开发

```bash
npm install
npm run check
npm test
npm run build
```

源码在 `src/`，构建产物在 `dist/`。

## 许可证

MIT
