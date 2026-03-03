# Claude API Switcher

一个现代化的 Node.js 命令行工具，用于在多个 Claude API 配置之间快速切换。

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
- 💾 **环境变量管理** - 自动生成环境配置文件

## 📦 安装

```bash
cd claude-api-switcher
npm install
```

全局安装（推荐）：
```bash
npm link
```

## 🚀 快速开始

```bash
# 1. 安装
cd /Users/worldzb/Desktop/Code/plugins/claude-api-switcher
npm install

# 2. 全局安装（可选）
npm link

# 3. 添加第一个配置
claude-switch add -i

# 4. 配置 shell 环境
echo 'source ~/.claude-switch-config/.claude-env' >> ~/.zshrc
source ~/.zshrc

# 5. 完成！现在可以使用了
claude-switch list
```

## 🚀 使用方法

### 添加配置

**交互式添加**（推荐，体验最佳）：
```bash
claude-switch add -i
```

交互式界面提供：
- ✅ 实时输入验证
- ✅ 配置预览确认
- ✅ 美观的视觉反馈

**命令行添加**：
```bash
claude-switch add -n "官方API" -k "sk-ant-api03-xxx" -u "https://api.anthropic.com"
```

### 列出所有配置

```bash
claude-switch list
# 或
claude-switch ls
```

输出示例：
```
📋 可用配置：

🟢  官方API (当前)
   🔑 API Key: sk-ant-a...3f4g
   🌐 Base URL: https://api.anthropic.com

⚪  代理API
   🔑 API Key: sk-ant-a...9k2m
   🌐 Base URL: https://proxy.example.com
```

### 切换配置

工具支持两种切换模式：

#### 🔹 临时使用模式（仅当前终端）

**特点**：
- ✅ 只在当前终端会话中生效
- ✅ 不修改默认配置
- ✅ 重启终端后自动恢复
- ✅ 适合临时测试

**使用方法**：
```bash
# 交互式选择
claude-switch switch -i
# 然后选择"临时使用"模式

# 命令行直接指定
claude-switch switch -n "官方API" -t
```

**临时使用后会输出设置命令**：
```bash
# 复制并在当前终端运行
export ANTHROPIC_API_KEY="sk-ant-xxx"
export ANTHROPIC_BASE_URL="https://api.anthropic.com"
```

#### 🟢 设为默认模式（全局配置）

**特点**：
- ✅ 修改 `~/.claude/settings.json`
- ✅ 所有新终端和 Claude Code 都会使用
- ⚠️ 需要重启 Claude Code 才能生效
- ✅ 适合长期使用

**使用方法**：
```bash
# 交互式选择
claude-switch switch -i
# 然后选择"设为默认"模式

# 命令行直接指定（默认行为）
claude-switch switch -n "官方API"

# 显式指定
claude-switch switch -n "官方API" -d
```

**切换后的文件**：
- `~/.claude/settings.json` - Claude Code 配置
- `~/.claude-switch-config/.claude-env` - Shell 环境变量

#### 配置状态说明

在 `list` 命令中，配置会显示不同状态：

- 🟢 **使用中** - 当前实际正在使用的配置
- 🔵 **已设为默认** - 已在 settings.json 中设置，但可能未生效
- ⚪ **未使用** - 未激活的配置

### 查看当前配置

```bash
claude-switch current
```

### 删除配置

**交互式删除**（推荐）：
```bash
claude-switch delete -i
```

**命令行删除**：
```bash
claude-switch delete -n "配置名称"
```

## 📋 命令参考

| 命令 | 别名 | 说明 |
|------|------|------|
| `add` | - | 添加新配置 |
| `list` | `ls` | 列出所有配置 |
| `switch` | `use` | 切换配置（支持临时和默认模式） |
| `delete` | `rm` | 删除配置 |
| `current` | - | 查看当前配置 |

## 🎨 交互式界面示例

### 添加配置
```
╔═══════════════════════════════════════╗
║   Claude API Configuration Switcher   ║
╚═══════════════════════════════════════╝

✔ 添加新配置

? 配置名称
  官方API

? API Key
  ••••••••

? 是否使用自定义 Base URL？
  Yes / No

┌──────────────────────────────────┐
│ 配置预览                           │
│ ───────────────────────────────── │
│ 名称: 官方API                      │
│ API Key: sk-ant-a...3f4g          │
│ Base URL: https://api.anthropic... │
└──────────────────────────────────┘

? 确认添加此配置？
  Yes / No

✅ 配置添加成功！
```

## ⚙️ 环境变量设置

切换配置后，工具会在 `~/.claude-switch-config/.claude-env` 文件中生成环境变量。

**环境变量文件位置**：`~/.claude-switch-config/.claude-env`

在你的 shell 配置文件中添加：

**Zsh** (`~/.zshrc`):
```bash
source ~/.claude-switch-config/.claude-env
```

**Bash** (`~/.bashrc`):
```bash
source ~/.claude-switch-config/.claude-env
```

然后运行：
```bash
source ~/.zshrc  # 或 source ~/.bashrc
```

## 📁 配置文件位置

工具会在用户主目录下创建 `~/.claude-switch-config/` 目录来存储所有配置文件。

### 1. 配置目录
**位置**：`~/.claude-switch-config/`

- 所有配置文件的统一存储目录
- 自动创建，无需手动创建

**完整路径**：
```bash
# macOS/Linux
/Users/你的用户名/.claude-switch-config/
```

### 2. 主配置文件
**位置**：`~/.claude-switch-config/claude-configs.json`

- 存储所有 API 配置信息
- 包含配置名称、API Key、Base URL 等
- JSON 格式，便于查看和编辑

**完整路径**：
```bash
# macOS/Linux
/Users/你的用户名/.claude-switch-config/claude-configs.json
```

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

### 3. 环境变量文件
**位置**：`~/.claude-switch-config/.claude-env`

- 当前选中配置的环境变量
- 每次切换配置时自动更新
- 需要在 shell 配置中 source 此文件

**完整路径**：
```bash
# macOS/Linux
/Users/你的用户名/.claude-switch-config/.claude-env
```

### 4. Claude Code 配置文件
**位置**：`~/.claude/settings.json`

- Claude Code 的全局配置文件
- 使用"设为默认"模式时会修改此文件
- 包含 API Key 和 Base URL 等配置

**完整路径**：
```bash
# macOS/Linux
/Users/你的用户名/.claude/settings.json
```

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

**文件内容示例**：
```bash
export ANTHROPIC_API_KEY="sk-ant-api03-xxx"
export ANTHROPIC_BASE_URL="https://api.anthropic.com"
```

### 5. 项目目录文件
```
claude-api-switcher/
├── index.js              # 主程序（可执行）
├── package.json          # 项目配置
├── README.md             # 文档
├── .gitignore            # Git 忽略文件
├── claude-configs.json   # API 配置存储（运行后生成）
└── node_modules/         # 依赖包
```

### 6. 配置文件查看命令

查看配置目录和文件：
```bash
# 查看配置目录
ls -la ~/.claude-switch-config/

# 查看主配置文件
cat ~/.claude-switch-config/claude-configs.json

# 查看环境变量文件
cat ~/.claude-switch-config/.claude-env

# 查看 Claude Code 配置
cat ~/.claude/settings.json
```

### 7. 备份和迁移

**备份配置**：
```bash
# 备份整个配置目录
cp -r ~/.claude-switch-config ~/.claude-switch-config.backup

# 或备份特定文件
cp ~/.claude-switch-config/claude-configs.json ~/backup/
```

**迁移配置**：
```bash
# 在新机器上创建配置目录（工具会自动创建）
# 然后复制配置文件
mkdir -p ~/.claude-switch-config
cp ~/backup/claude-configs.json ~/.claude-switch-config/
```

### 8. 文件权限建议

```bash
# 设置配置目录为只有所有者可访问
chmod 700 ~/.claude-switch-config

# 设置配置文件为只有所有者可读写（保护 API Key）
chmod 600 ~/.claude-switch-config/claude-configs.json
chmod 600 ~/.claude-switch-config/.claude-env
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

## 📝 示例工作流

```bash
# 1. 添加第一个配置
claude-switch add -i

# 2. 添加更多配置
claude-switch add -i

# 3. 查看所有配置
claude-switch list

# 4. 切换到指定配置
claude-switch switch -i

# 5. 使环境变量生效
source ~/.claude-switch-config/.claude-env

# 6. 验证当前配置
claude-switch current
```

## 📄 许可证

MIT
