# 快速使用指南

## 🚀 基础用法

### 1. 添加配置
```bash
zcs add -i
```

### 2. 查看所有配置
```bash
zcs list
```

### 3. 临时切换（当前终端立即生效）
```bash
eval $(zcs switch -n "配置名" -t --eval)
```

### 4. 设为默认（需要重启 Claude Code）
```bash
zcs switch -n "配置名"
```

## 💡 推荐配置

在 `~/.zshrc` 中添加以下函数，使用更方便：

```bash
# 临时切换 Claude API 配置
use_claude() {
  eval $(zcs switch -n "$1" -t --eval)
}
```

使用示例：
```bash
source ~/.zshrc  # 重新加载配置
use_claude "官方API"   # 临时切换到官方 API
use_claude "代理API"   # 临时切换到代理 API
```

## 🔥 常用命令

| 命令 | 说明 |
|------|------|
| `zcs add -i` | 交互式添加配置 |
| `zcs list` | 列出所有配置 |
| `zcs switch -i` | 交互式切换 |
| `eval $(zcs switch -n "配置名" -t --eval)` | 临时切换 |
| `zcs switch -n "配置名"` | 设为默认 |
| `zcs current` | 查看当前配置 |
| `zcs delete -n "配置名"` | 删除配置 |

## 📝 配置文件位置

- **主配置**：`~/.claude-switch-config/claude-configs.json`
- **Claude 配置**：`~/.claude/settings.json`
- **环境变量**：`~/.claude-switch-config/.claude-env`
