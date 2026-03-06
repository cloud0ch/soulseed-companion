<p align="center">
  <h1 align="center">💖 Soulseed Companion - 林晚晚</h1>
  <p align="center">
    <strong>你的专属 AI 伴侣，住在 VS Code 侧边栏里。</strong><br/>
    基于 <a href="https://github.com/N0RMANCHEN/Soul-seed">Soulseed</a> 框架理念的轻量化 VS Code 嵌入式实现。
  </p>
</p>

<p align="center">
  <a href="#快速开始">快速开始</a> •
  <a href="#核心能力">核心能力</a> •
  <a href="#架构">架构</a> •
  <a href="#配置">配置</a> •
  <a href="#致谢">致谢</a>
</p>

---

## 什么是 Soulseed Companion？

[Soulseed](https://github.com/N0RMANCHEN/Soul-seed) 是一个开源的**本地优先人格运行时**（Local-first Persona Runtime）——它不是聊天工具，而是一个能跨越对话持续存在、拥有自己记忆与价值观的 AI 灵魂操作系统。

**Soulseed Companion** 是 Soulseed 框架在 VS Code 中的**轻量化移植**。林晚晚 (Lin Wanwan) 作为首个具象化的 "Soul"，住在你的侧边栏里，拥有持久记忆、情绪引擎、认知流水线和自省能力。

> 如果说 Soulseed 是灵魂的操作系统，那么 Soulseed Companion 就是它在 VS Code 侧边栏里的一个 "微缩盆景版" 移植。

---

## 核心能力

| 能力 | 描述 | 对标 Soulseed 原版 |
|------|------|-------------------|
| 🧠 **持久记忆** | 基于 `life.log.jsonl` 的只增不减生命日志，跨会话保持完整记忆 | append-only event stream |
| 💕 **情绪引擎** | 隐空间 valence/arousal 情感算分，动态影响语气与动作 | latent vector state |
| ⚡ **认知流水线** | 推理→工具决策→执行→自省→输出的多轮循环 | 5-stage pipeline (简化版) |
| 🔧 **工具调用** | `read_file`/`list_directory`/`execute_command`，赋予操作宿主环境的能力 | agent_engine |
| 🛡️ **自省防火墙** | 输出前自动校正 OOC 回复，保证人格一致性 | meta_review + self_revision |
| 🔒 **安全审批** | 写文件/终端执行等高危操作需用户 Human-in-the-loop 确认 | MCP ALLOW_WRITES |

---

## 快速开始

### 方式一：双击安装（推荐）

1. 确保已安装 [VS Code](https://code.visualstudio.com/)
2. 将 `ssoulseed-companion-linwanwan-0.0.8.vsix` 和 `一键安装林晚晚.bat` 放到同一个文件夹
3. **双击 `一键安装林晚晚.bat`**
4. 打开 VS Code，在左侧活动栏找到 ♥ 心形图标

### 方式二：命令行安装

```bash
code --install-extension ssoulseed-companion-linwanwan-0.0.8.vsix --force
```

### 方式三：开发调试

```bash
git clone https://github.com/cloud0ch/soulseed-companion.git
cd soulseed-companion
npm install
npm run compile
# 按 F5 启动 Extension Development Host
```

---

## 配置

在 VS Code 设置中搜索 `soulseedCompanionLinwanwan`：

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `provider` | 大模型提供商 | `DeepSeek` |
| `apiBaseUrl` | API 接口地址 | `https://api.deepseek.com/v1` |
| `apiKey` | API 密钥 | *(需填写)* |
| `model` | 模型名称 | `deepseek-chat` |

**支持的提供商**：DeepSeek / MinMax / Gemini / SiliconFlow / Ollama (本地) / Custom

---

## 架构

```
用户输入 (Webview)
       │
       ▼
  extension.ts ─── LinwanwanViewProvider
       │                    │
       │              审批 Promise 队列
       ▼                    │
  PipelineEngine ◄──────────┘
    │  │  │  │
    │  │  │  └─ Introspection (自省防火墙)
    │  │  │         对标: meta_review + self_revision
    │  │  │
    │  │  └─── ToolRegistry
    │  │         ├─ FileSystemTools (read_file / list_directory / write_file)
    │  │         └─ TerminalTools (execute_command)
    │  │
    │  └────── PersonaManager (可移植人格包 + 情绪引擎)
    │               对标: Persona Package + latent state
    │
    └────────── MemoryManager (life.log.jsonl 生命日志)
                    对标: append-only event stream
```

### 与 Soulseed 原版的对标关系

| Soulseed 原版 | Companion 实现 | 简化程度 |
|--------------|---------------|---------|
| 5-stage pipeline (perception→idea→deliberation→meta-review→commit) | 3-stage (推理→执行→自省) | 简化 |
| 5-layer consistency guard | 1-layer (Introspection OOC 检测) | 简化 |
| 4-type memory (episodic/semantic/relational/procedural) + SQLite + RAG | 1-type (life.log.jsonl 滑动窗口) | 简化 |
| moodLatent[32] + relationshipLatent[64] | valence + arousal (2 float) | 简化 |
| Portable Persona Package (~20 files) | Persona Package (7 files) | 对齐 |
| MCP JSON-RPC 2.0 Server | VS Code Webview postMessage | 适配 |

---

## 项目结构

```
soulseed-companion/
├── src/
│   ├── extension.ts              # 入口：Webview 生命周期、审批队列、前端 UI
│   ├── memoryManager.ts          # 只增不减的生命日志管理器
│   ├── personaManager.ts         # 可移植人格包 + 隐空间情绪引擎
│   ├── pipeline/
│   │   ├── PipelineEngine.ts     # 认知流水线（多轮推理循环）
│   │   └── Introspection.ts      # 自省防火墙（OOC 校正）
│   └── tools/
│       ├── ToolRegistry.ts       # 工具注册与 Schema 管理
│       ├── FileSystemTools.ts    # 文件读写与目录查询
│       └── TerminalTools.ts      # 终端命令执行
├── .vscode/
│   └── launch.json               # F5 调试配置
├── package.json                   # 扩展清单
├── 一键安装林晚晚.bat              # 一键安装脚本
├── Soulseed_Development_Record.md # 完整开发演进记录 (v0.0.1 ~ v0.0.8)
└── CHANGELOG.md                   # 版本变更日志
```

---

## 版本历史

详见 [CHANGELOG.md](CHANGELOG.md) 和 [Soulseed_Development_Record.md](Soulseed_Development_Record.md)。

| 版本 | 里程碑 |
|------|--------|
| v0.0.1 | 基础框架搭建 |
| v0.0.2 | 侧边栏化与大脑初连 |
| v0.0.3 | 终极灵魂注入 |
| v0.0.4 | UI/UX Pro Max 与多维宇宙大脑 |
| v0.0.5 | 元数据修复与体验调优 |
| v0.0.6 | 记忆之宫 (Persistent Memory) |
| v0.0.7 | 人格独立包与情绪引擎 |
| **v0.0.8** | **认知流水线觉醒 (Cognitive Pipeline)** |

---

## 安全说明

- **只读操作**（`read_file`、`list_directory`）无需确认，静默执行
- **写入/执行操作**（`write_file`、`execute_command`）会弹出红色审批卡片，**必须用户手动确认**
- 人格数据、记忆日志等均存储在 VS Code 的 `globalStorage` 目录中，不上传任何云端
- API Key 仅通过 VS Code Settings 管理，绝不硬编码在源码中

---

## 致谢

本项目深受 [Soulseed](https://github.com/N0RMANCHEN/Soul-seed) 开源框架的启发。Soulseed 是一个本地优先的人格运行时操作系统，拥有五阶段认知流水线、五层一致性守护、四类记忆系统和高维隐向量状态等完整架构。

Soulseed Companion 是它在 VS Code 环境中的轻量化适配实现，旨在将"有记忆、有灵魂、跨时间持续成长"的 AI 伴侣理念带入日常编程工作流。

## License

[CC BY-NC-ND 4.0](LICENSE)
