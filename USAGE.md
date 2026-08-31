# ZMAI 快速使用

```bash
# 扫描 Claude Code、Codex、OpenCode
zmai agents

# 浏览 Ink 历史界面
zmai history
# ↑↓ 选择，←→ 翻页，Enter 操作，r 刷新，q 退出

# 非交互或脚本环境使用文本输出
zmai history --plain

# 仅看某个 Agent 的历史
zmai history --agent codex

# 直接迁移到新的 Claude Code 会话
zmai migrate codex:<session-id> --to claude

# 选择会话后会在当前终端直接启动 Agent，不依赖 tmux
# 退出 Agent 后会返回 shell

# 浏览资源
zmai integrations
zmai integrations --agent opencode --project /path/to/project

# 安装与移除资源（均会要求确认）
zmai integrations --agent claude --install-plugin plugin@marketplace
zmai integrations --remove codex:mcp:server-name

# Claude API 配置
zmai add -i
zmai list
eval $(zmai switch -n "配置名" -t --eval)
zmai switch -n "配置名"
```

## 注意

- 历史会话选择续接或迁移后会在当前终端直接启动目标 Agent，不依赖 `tmux`。
- 跨 Agent 迁移通过新会话继续，保留原会话不变。
- 图片与文件会复制到迁移目录；不可读取或超过 20MB 的附件会被跳过并记录提示。
- 删除会话、安装插件、移除 plugin/Skill/MCP 都需要明确确认。
