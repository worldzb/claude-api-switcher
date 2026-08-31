# ZMAI

`zmai` 是一个本机多 Agent 工作台：统一扫描 Claude Code、Codex 和 OpenCode，管理历史会话、跨 Agent 迁移、托管会话进度，以及 plugins、Skills、MCP。它同时保留 Claude API 配置切换能力。

## 安装

```bash
npm install -g zmai
```

## Agent 扫描

```bash
zmai agents
```

扫描命令、版本、历史目录以及 Claude Code、Codex、OpenCode 的可用能力。未安装或不在 `PATH` 的工具会明确标记为未安装。

## 历史会话

```bash
zmai history
zmai history --agent claude --page-size 30
zmai history --plain
```

`zmai history` 在交互终端中使用 React + Ink 渲染：彩色 Agent 标识、会话标题、工作目录、相对时间和短会话 ID 会集中显示。快捷键：上下方向键选择、左右方向键翻页、Enter 打开操作、`r` 刷新、`q` 退出。非交互终端或 `--plain` 自动回退到文本分页输出。

选中会话后选择用于继续的 Agent，默认是原 Agent：

- 选择原 Agent：使用其原生命令续接会话。
- 选择其他 Agent：创建新会话，导入转换后的历史上下文；原会话保持不变。

## 当前窗口启动

从 `zmai history` 选择续接或迁移后，zmai 会退出历史界面并在**当前终端窗口**直接启动目标 Agent，不依赖 `tmux`。退出 Agent 后会回到 shell。

`zmai sessions`、`zmai watch` 与 `zmai stop` 仅用于旧版已创建的 tmux 托管会话。

## 迁移会话

```bash
zmai migrate codex:<session-id> --to claude
```

迁移会：

1. 读取来源会话并转换为可移植 Markdown 上下文；
2. 复制可读取且不超过 20MB 的图片和文件到 `~/.zmai/migrations/`；
3. 写入带 SHA-256 校验的迁移清单；
4. 创建一个新的目标 Agent 会话。

不会修改来源 Agent 的内部历史格式或删除原会话。无法读取的附件会显示迁移提示。

## Plugins、Skills 与 MCP

```bash
zmai integrations
zmai integrations --agent claude --project /path/to/project
zmai integrations --agent claude --install-plugin plugin@marketplace
zmai integrations --remove claude:plugin:plugin-name
```

命令汇总用户级和项目级 plugins、Skills、MCP。安装和移除前均需逐次确认；插件和 MCP 优先调用各 Agent 的原生命令。不会自动执行远程安装脚本。

## Claude API 配置

```bash
zmai add -n "官方 API" -k "sk-ant-api03-xxx" -u "https://api.anthropic.com"
eval $(zmai switch -n "官方 API" -t --eval)
zmai switch -n "官方 API"
```

## 数据位置

| 数据 | 位置 |
| --- | --- |
| Claude API 配置 | `~/.claude-switch-config/claude-configs.json` |
| 托管会话 | `~/.zmai/sessions.json` |
| 托管会话输出 | `~/.zmai/logs/` |
| 迁移上下文和附件 | `~/.zmai/migrations/` |

## 开发

```bash
npm install
npm run check
npm test
npm run build
```

源码位于 `src/`，构建产物位于 `dist/`。

## 许可证

MIT
