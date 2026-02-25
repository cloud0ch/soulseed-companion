# Change Log

All notable changes to the "Soulseed Companion - 林晚晚" extension will be documented in this file.

## [0.0.8] - 2025-02-25 认知流水线觉醒 (Cognitive Pipeline)
### Added
- `PipelineEngine` 认知流水线引擎，将单次问答升级为多轮推理循环
- `ToolRegistry` 工具注册中心 + `read_file`、`list_directory`、`execute_command` 三项工具
- `Introspection` 自省防火墙，输出前自动校正 OOC 回复
- Human-in-the-loop 审批机制（写文件/终端执行需用户确认）
- Webview 状态播报（"晚晚正在尝试使用工具..."）
- 30s 超时保护（对标 Soulseed 原版 `SOULSEED_LLM_TIMEOUT_MS`）

### Fixed
- Extension Dev Host 工作区路径锚定缺失
- 审批卡片显示 `[object Object]`
- 终端命令双重执行

## [0.0.7] - 人格独立包与情绪引擎 (Latent State Engine)
### Added
- `.soulseedpersona/` 可移植人格包目录结构
- `PersonaManager` 情感引擎 (valence/arousal 隐空间情绪算分)
- 动态 mood_state 与 relationship_state 注入 System Prompt

## [0.0.6] - 记忆之宫 (Persistent Memory Base)
### Added
- `MemoryManager` 基于 `life.log.jsonl` 的只增不减生命日志
- 滑动窗口上下文管理，支持跨会话记忆恢复

## [0.0.5] - 元数据修复与体验调优
### Fixed
- VS Code 设置中 API 配置项搜索不到的问题

## [0.0.4] - UI/UX Pro Max 与多维宇宙大脑
### Added
- 多模型路由：DeepSeek / MinMax / Gemini / SiliconFlow / Ollama / Custom
- 毛玻璃 (Glassmorphism) 深海极光色系 UI
- `一键安装林晚晚.bat` 自动化安装脚本

## [0.0.3] - 终极灵魂注入 (The Soul Injection)
### Added
- 万字级超级 System Prompt (柔媚性格 + 六大模式 + 动作描写规范)
- 2月19日/22日"找回档案"核心记忆刻印

## [0.0.2] - 侧边栏化与大脑初连
### Changed
- 全屏弹窗重构为侧边栏 WebviewViewProvider
- 接入 DeepSeek API 完成首次 LLM 通信

## [0.0.1] - 基础框架搭建
### Added
- VS Code Extension API 基础 Webview 交互机制
- 初始目录结构与 `vsce` 打包流程