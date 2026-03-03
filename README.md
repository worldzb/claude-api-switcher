# Claude API Switcher (zcs)

一个现代化的 Node.js 命令行工具，用于在多个 Claude API 配置之间快速切换。

命令：`zcs` (Claude Switch)

## 📂 配置文件位置速查

| 文件 | 位置 | 说明 |
|------|------|------|
| **配置目录** | `~/.claude-switch-config/` | 所有配置文件的存储目录 |
| **主配置文件** | `~/.claude-switch-config/claude-configs.json` | 存储所有 API 配置 |
| **环境变量文件** | `~/.claude-switch-config/.claude-env` | Shell 环境变量（临时使用） |
| **Claude 配置** | `~/.claude/settings.json` | Claude Code 默认配置（设为默认时修改） |

> 💡 **提示**：`~` 代表用户主目录（macOS/Linux 上通常是 `/Users/你的用户名/`）

## ✨ 功能特性

- 🎨 **美观的交互界面** - 使用 @clack/prompts 提供现代化的 CLI 体验
- 🔑 **多配置管理** - 支持管理多个 Claude API 配置
- ⚡ **快速切换** - 在不同配置间快速切换
- 🔒 **安全显示** - API Key 自动遮蔽，保护隐私
- 💡 **智能提示** - 表单验证和友好的错误提示
- 🎯 **双模式操作** - 支持交互式和命令行两种方式
- 🔹 **临时切换** - 使用 `eval` 立即在当前终端生效
- 🟢 **默认配置** - 修改 `~/.claude/settings.json` 持久化
- 💾 **环境变量管理** - 自动生成环境配置文件

## 📦 安装

```bash
# 1. 克隆或下载项目到本地
cd claude-api-switcher

# 2. 安装依赖
npm install

# 3. 全局安装（可选，推荐）
npm link
```

## 🚀 快速开始

```bash
# 1. 添加配置
zcs add -i

# 2. 临时切换（当前终端立即生效）
eval $(zcs switch -n "官方API" -t --eval)

# 3. 或设为默认（重启 Claude Code 后生效）
zcs switch -n "官方API"
```

### 推荐配置：添加 shell 函数

在 `~/.zshrc` 或 `~/.bashrc` 中添加：

```bash
# 临时切换 Claude API 配置
use_claude() {
  eval $(zcs switch -n "$1" -t --eval)
}
```

然后就可以使用：
```bash
use_claude "官方API"   # 临时切换
use_claude "代理API"   # 快速切换
```

## 📖 详细用法

### 添加配置

**交互式添加**（推荐）：
```bash
zcs add -i
```

**命令行添加**：
```bash
zcs add -n "官方API" -k "sk-ant-api03-xxx" -u "https://api.anthropic.com"
```

### 列出所有配置

```bash
zcs list
# 或
zcs ls
```

输出示例：
```
📋 可用配置：

🟢  zd-claude (当前默认)
   🔑 API Key: sk-fa243...9adb
   🌐 Base URL: https://api-proxy.cyole.dev

⚪  glm
   🔑 API Key: 5e55cf1e...75w6
   🌐 Base URL: https://open.bigmodel.cn/api/anthropic
```

### 切换配置

工具支持两种切换模式：

#### 🔹 临时使用模式（推荐，当前终端立即生效）

**方式 1：使用 eval（推荐）**
```bash
eval $(zcs switch -n "官方API" -t --eval)
```

**方式 2：使用 shell 函数（更方便）**
```bash
# 在 ~/.zshrc 中添加
use_claude() {
  eval $(zcs switch -n "$1" -t --eval)
}

# 然后可以直接使用
use_claude "官方API"
use_claude "代理API"
```

**方式 3：交互式选择**
```bash
zcs switch -i
# 然后选择 "临时使用" 模式
```

**特点**：
- ✅ 立即在当前终端生效
- ✅ 不修改默认配置
- ✅ 重启终端后自动恢复
- ✅ 适合临时测试

#### 🟢 设为默认模式（全局配置）

**使用方法**：
```bash
# 命令行直接指定（默认行为）
zcs switch -n "官方API"

# 或交互式选择
zcs switch -i
# 然后选择 "设为默认" 模式
```

**特点**：
- ✅ 修改 `~/.claude/settings.json`
- ✅ 所有新终端和 Claude Code 都会使用
- ⚠️ 需要重启 Claude Code 才能生效
- ✅ 适合长期使用

#### 配置状态说明

在 `list` 命令中，配置会显示不同状态：

- 🟢 **使用中** / **当前默认** - 当前实际正在使用的配置
- 🔵 **已设为默认** - 已在 settings.json 中设置
- ⚪ **未使用** - 未激活的配置

### 查看当前配置

```bash
zcs current
```

### 删除配置

```bash
zcs delete -n "配置名称"
# 或交互式
zcs delete -i
```

## 📋 命令参考

| 命令 | 别名 | 说明 |
|------|------|------|
| `add` | - | 添加新配置 |
| `list` | `ls` | 列出所有配置 |
| `switch` | `use` | 切换配置（支持临时和默认模式） |
| `delete` | `rm` | 删除配置 |
| `current` | - | 查看当前配置 |

### 选项说明

| 选项 | 说明 |
|------|------|
| `-i, --interactive` | 交互式模式 |
| `-n, --name <name>` | 指定配置名称 |
| `-t, --temp` | 临时使用模式 |
| `-d, --default` | 设为默认模式 |
| `-e, --eval` | 输出 eval 可执行命令（配合 -t 使用） |
| `-k, --key <key>` | API Key |
| `-u, --url <url>` | Base URL |

## 💡 使用技巧

### 1. 快速临时切换

在 `~/.zshrc` 中添加：
```bash
# 临时切换 Claude API 配置
use_claude() {
  eval $(zcs switch -n "$1" -t --eval)
}

# Tab 补全支持
_use_claude() {
  local -a configs
  configs=($(zcs ls 2>/dev/null | grep '⚪\|🟢\|🔵' | awk '{print $2}' | sed 's/[(*]*.*[)]*//g'))
  _describe 'configs' configs
}
compdef _use_claude use_claude
```

使用：
```bash
use_claude "官方<TAB>"  # 自动补全配置名
```

### 2. 查看当前生效的配置

```bash
# 查看 zcs 管理的配置
zcs current

# 查看实际的环境变量
echo $ANTHROPIC_API_KEY
echo $ANTHROPIC_BASE_URL

# 查看 Claude Code 配置
cat ~/.claude/settings.json | grep ANTHROPIC
```

### 3. 不同场景的使用建议

**场景 1：日常开发**
```bash
# 设为默认配置，重启 Claude Code
zcs switch -n "官方API"
```

**场景 2：临时测试**
```bash
# 快速临时切换
eval $(zcs switch -n "测试API" -t --eval)
```

**场景 3：多项目切换**
```bash
# 项目 A
use_claude "项目A配置"

# 项目 B
use_claude "项目B配置"
```

## 📁 配置文件位置

工具会在用户主目录下创建 `~/.claude-switch-config/` 目录来存储所有配置文件。

### 主配置文件
**位置**：`~/.claude-switch-config/claude-configs.json`

**文件结构示例**：
```json
{
  "configs": [
    {
      "name": "官方API",
      "apiKey": "sk-ant-api03-xxx",
      "baseUrl": "https://api.anthropic.com",
      "createdAt": "2025-03-03T12:00:00.000Z"
    },
    {
      "name": "代理API",
      "apiKey": "sk-ant-api03-yyy",
      "baseUrl": "https://proxy.example.com",
      "createdAt": "2025-03-03T13:00:00.000Z"
    }
  ],
  "current": "官方API"
}
```

### Claude Code 配置文件
**位置**：`~/.claude/settings.json`

**文件结构示例**：
```json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "sk-ant-api03-xxx",
    "ANTHROPIC_BASE_URL": "https://api.anthropic.com",
    "API_TIMEOUT_MS": "3000000",
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1"
  },
  "skipDangerousModePermissionPrompt": true
}
```

## 🔐 安全提示

- **API Key 保护**：以部分遮蔽方式显示（只显示前8位和后4位）
- **配置文件位置**：
  - 配置目录：`~/.claude-switch-config/`
  - 主配置：`~/.claude-switch-config/claude-configs.json`
  - 环境变量：`~/.claude-switch-config/.claude-env`
- **文件权限**：建议设置 `chmod 700` 目录，`chmod 600` 文件
- **版本控制**：`.gitignore` 已配置，不会提交配置文件
- **备份建议**：定期备份 `~/.claude-switch-config/` 目录

## 🎯 技术栈

- **@clack/prompts** - 美观的交互式提示
- **commander** - 命令行参数解析
- **chalk** - 终端颜色输出
- **Node.js ES Modules** - 现代化的模块系统

## 📄 许可证

MIT
