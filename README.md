# ZMAI

`zmai` 是一个本机多 Agent 历史会话工作台，同时提供 Claude API 配置管理能力。

支持发现和管理本机的 **Claude Code**、**Codex**、**OpenCode**：浏览历史会话、按项目和 Agent 分类、续接会话、跨 Agent 导入历史、迁移附件，以及查看 plugins、Skills、MCP。

## 安装

```bash
npm install -g @worldzb/agent-sync
```

包名为 `@worldzb/agent-sync`，安装后仍使用 `zmai` 命令。

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
| 模型同步 | `zmai model` 把配置中的自定义模型批量设置到各 Agent，或恢复系统默认撤回配置 |

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
- `Space`：选中或取消选中当前会话；可跨页多选
- `x`：永久删除所有已选会话（需二次确认）
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

## MCP、Skills 与 Plugins

三个资源类型均采用与 `history` 一致的 React + Ink 交互界面：顶部显示资源类型和数量，第一行按范围切换，第二行按 Agent 分类，列表支持上下选择，`-` / `+` 翻页，Enter 打开操作菜单，选中资源可复制、启用/禁用或卸载，`q` 退出。

- 左右方向键：当前项目 / 全局切换
- `1` / `2`：当前项目 / 全局
- `1` / `2` / `3` / `4`：全部 / Claude / Codex / OpenCode（在 Agent 分类上下文中）
- `-` / `+`：上一页 / 下一页

`mcps` 和 `skills` 默认显示“当前项目”；项目范围来自 `--project`，未指定时使用当前工作目录。

```bash
# 查看资源（交互界面）
zmai mcps
zmai skills
zmai plugins

# 通过 Agent 分类查看
# 1 全部 · 2 Claude · 3 Codex · 4 OpenCode
zmai mcps --agent claude --project /path/to/project
zmai skills --agent codex --project /path/to/project
zmai plugins --agent opencode

# 安装资源（仍需确认）
zmai mcps --agent claude --install github --config '{"command":"npx","args":["-y","server"]}'
zmai skills --agent codex --install ./skills/my-skill --scope user
zmai plugins --agent claude --install plugin@marketplace

# 移除资源（交互界面使用 x，命令行使用 --remove）
zmai mcps --remove claude:github
zmai skills --remove codex:my-skill
zmai plugins --remove claude:plugin-name
```

脚本或管道中可使用 `--plain` 输出文本。不同 Agent 的配置格式和认证信息不会自动互相复制。

## Claude API 配置

API 配置属于辅助功能，统一收拢在 `zmai api` 二级命令下：

```bash
# 交互式添加配置
zmai api add -i

# 命令行添加配置
zmai api add -n "官方 API" -k "sk-ant-api03-xxx" -u "https://api.anthropic.com"

# 查看配置
zmai api list

# 当前终端临时使用
 eval $(zmai api switch -n "官方 API" --temp --eval)

# 设为 Claude Code 默认配置
zmai api switch -n "官方 API"

# 查看当前 Claude 配置
zmai api current

# 删除配置
zmai api delete -n "官方 API"
```

API 配置不再作为一级命令提供。`list` 仍支持 `ls`，`switch` 仍支持 `use`，`delete` 仍支持 `rm`。

默认配置会更新：

```text
~/.claude/settings.json
~/.claude-switch-config/.claude-env
```

## 模型同步

`zmai model` 把配置（`~/.claude-switch-config/claude-configs.json` 的 `customModels`）中的自定义模型批量设置到各 Agent；恢复系统默认则撤回这些配置：

```bash
# 交互式：先选择 Agent，再选择「同步」或「恢复默认」
zmai model

# 直接指定 Agent（跳过 Agent 选择）
zmai model -a opencode   # 别名 --agent
zmai model -a claude
zmai model -a codex
zmai model -a all        # 依次处理全部 Agent

# 恢复系统默认：撤回已同步的模型配置
zmai model --reset -a claude
zmai model --reset       # 交互式选择要恢复默认的 Agent
```

各 Agent 的同步方式：

- **Claude Code**：把配置中的 **claude 模型**批量写入 `~/.claude/settings.json` 的 `modelPicker`，全部出现在 Claude Code 的 `/model` 选择器中（追加在内置模型之后；需 Claude Code ≥ 2.1.242，旧版本自动忽略该字段）。Claude Code 的选择器没有单独的图片能力字段，已选择的多模态模型会由其 API 端点直接处理图片附件。激活哪个模型由你在 Claude Code 里用 `/model` 自己选择：`Enter` 保存为默认（写入同一文件的 `model` 字段），`s` 仅当前会话生效。zmai 不再替你设置单个模型。
- **OpenCode**：把配置中的自定义模型一次性注册到 `opencode.jsonc` 的 `provider.wxhand.models`（形如 `wxhand/gpt-5.6`）。新模型使用 1M 上下文窗口；此前由 zmai 生成的 400K 条目会在下次同步时升级。常见多模态模型会登记 `modalities.input: ["text", "image"]`，以支持图片附件；已注册的多模态模型缺少该字段时也会补齐，手工能力定义保持不变。claude 模型**不会**同步到 OpenCode（wxhand 中转接口不支持）。只补充缺失模型或图片能力，不删除任何现有模型。
- **Codex**：把配置中的 **codex 模型**批量写入 `~/.codex/zmai-models.json`，并在 `config.toml` 挂载 `model_catalog_json`，全部出现在 Codex 的 `/model` 选择器中（与官方内置模型并列显示；与内置重复的自动跳过，并为自定义模型克隆官方提示词模板）。常见多模态模型会登记 `input_modalities: ["text", "image"]`，以支持图片输入。激活哪个模型由你在 Codex 里用 `/model` 自己选择。需要 Codex CLI ≥ 0.152；检测不到可用的 codex 命令时仅同步自定义模型（内置列表会被替换）。

恢复系统默认（`--reset` 或交互式选择「恢复系统默认」）会撤回 zmai 同步的配置：

- **Claude Code**：清除 `model` 与 `modelPicker`。
- **OpenCode**：移除配置列表中已注册到 `provider.wxhand.models` 的模型（手动注册的不受影响），顶层 `model` 若指向被移除的模型则一并清除；provider 的 baseURL / apiKey 保留。
- **Codex**：移除 `model` 行与 `model_catalog_json` 挂载，删除 `zmai-models.json`，官方内置模型回归 `/model` 选择器。

同步与恢复后均需重启对应 Agent 生效（已运行的会话不会感知变更）。

说明：

- 自定义模型列表统一保存在 `~/.claude-switch-config/claude-configs.json` 的 `customModels`（claude / opencode / codex 三个列表），按需编辑后重新执行 `zmai model` 同步。
- OpenCode 写入会重排 JSON 格式（注释会丢失），请提前备份有注释的配置；模型挂在自定义的 `wxhand` provider 下（走中转接口），**不支持 claude 模型**。
- Codex 写入只在 `config.toml` 顶层新增/替换 `model_catalog_json` 行（其余内容原样保留），模型目录保存在同目录的 `zmai-models.json`；该目录会整体替换 Codex 内置模型列表，因此同步时已自动合并内置条目。

## 数据目录

| 数据 | 路径 |
| --- | --- |
| Claude API 配置 | `~/.claude-switch-config/claude-configs.json`（含 Claude / OpenCode / Codex 的自定义模型列表） |
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

### 发布

发布前确保 `package.json` 与 `package-lock.json` 中的包名和版本一致；如有变更，执行：

```bash
npm install --package-lock-only
npm run check
npm test
npm publish --access public --registry=https://registry.npmjs.org/
```

发布账号须拥有 `@worldzb` scope 的发布权限。首次在机器上发布前，先执行：

```bash
npm login --registry=https://registry.npmjs.org/
npm whoami --registry=https://registry.npmjs.org/
```

`whoami` 应显示有权发布该 scope 的 npm 账号。

## 许可证

MIT
