# Claude API Switcher (zcs)

一个全局 CLI 工具，用于快速切换多个 Claude API 配置。

## 📦 安装

```bash
npm install -g claude-api-switcher
```

安装后即可使用 `zcs` 命令。

## 📋 命令参考

| 命令 | 别名 | 说明 |
|------|------|------|
| `add` | - | 添加新配置 |
| `list` | `ls` | 列出所有配置 |
| `switch` | `use` | 切换配置 |
| `delete` | `rm` | 删除配置 |
| `current` | - | 查看当前配置 |

### 选项说明

| 选项 | 说明 |
|------|------|
| `-i, --interactive` | 交互式模式 |
| `-n, --name <name>` | 指定配置名称 |
| `-t, --temp` | 临时使用模式 |
| `--eval` | 输出 eval 可执行命令 |
| `-k, --key <key>` | API Key |
| `-u, --url <url>` | Base URL |

## 🚀 快速开始

```bash
# 1. 添加配置
zcs add -i

# 2. 临时切换（当前终端生效）
eval $(zcs switch -n "配置名" -t --eval)

# 3. 或设为默认（全局生效）
zcs switch -n "配置名"
```

### 推荐配置：添加 shell 函数

在 `~/.zshrc` 或 `~/.bashrc` 中添加：

```bash
use_claude() {
  eval $(zcs switch -n "$1" -t --eval)
}
```

使用：
```bash
use_claude "官方API"
```

## 📖 使用示例

### 添加配置
```bash
# 交互式添加（推荐）
zcs add -i

# 命令行添加
zcs add -n "官方API" -k "sk-ant-api03-xxx" -u "https://api.anthropic.com"
```

### 列出配置
```bash
zcs list
```

### 切换配置

**临时切换**（当前终端生效，重启后恢复）：
```bash
eval $(zcs switch -n "配置名" -t --eval)
```

**设为默认**（全局生效，需重启 Claude Code）：
```bash
zcs switch -n "配置名"
```

**交互式切换**：
```bash
zcs switch -i
```

### 删除配置
```bash
zcs delete -n "配置名"
```

## 💡 使用技巧

### Tab 补全支持

在 `~/.zshrc` 中添加：
```bash
use_claude() {
  eval $(zcs switch -n "$1" -t --eval)
}

_use_claude() {
  local -a configs
  configs=($(zcs ls 2>/dev/null | grep '⚪\|🟢\|🔵' | awk '{print $2}' | sed 's/[(*]*.*[)]*//g'))
  _describe 'configs' configs
}
compdef _use_claude use_claude
```

使用：
```bash
use_claude "官方<TAB>"  # 自动补全
```

### 不同场景建议

**日常开发**：设为默认配置
```bash
zcs switch -n "官方API"
```

**临时测试**：快速临时切换
```bash
eval $(zcs switch -n "测试API" -t --eval)
```

**多项目切换**：使用 shell 函数
```bash
use_claude "项目A配置"
use_claude "项目B配置"
```

## 📂 配置文件

| 文件 | 位置 |
|------|------|
| 配置目录 | `~/.claude-switch-config/` |
| 主配置 | `~/.claude-switch-config/claude-configs.json` |
| Claude 配置 | `~/.claude/settings.json` |

## 🔐 安全提示

- API Key 以部分遮蔽方式显示
- 建议设置 `chmod 700` 配置目录，`chmod 600` 配置文件
- 定期备份 `~/.claude-switch-config/` 目录

## 📄 许可证

MIT
