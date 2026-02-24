import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export interface MemoryEvent {
    timestamp: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export class MemoryManager {
    private _logFilePath: string;
    private _memories: MemoryEvent[] = [];
    private _maxHistoryContext = 20; // 提交给大模型的最大上下文树 (防止过载)

    constructor(context: vscode.ExtensionContext) {
        // 使用 VS Code 提供的标准全局存储路径
        // 该目录在删除扩展时可选择保留，对用户而言也相对独立安全
        const storageUri = context.globalStorageUri;
        if (!fs.existsSync(storageUri.fsPath)) {
            fs.mkdirSync(storageUri.fsPath, { recursive: true });
        }

        // 生命日志：记录林晚晚的所有记忆流水
        this._logFilePath = path.join(storageUri.fsPath, 'life.log.jsonl');
        this.loadMemories();
    }

    /**
     * 将事件写入只增不减 (append-only) 的生命日志流水文件中
     */
    private _appendToLifeLog(event: MemoryEvent) {
        try {
            const line = JSON.stringify(event) + '\n';
            fs.appendFileSync(this._logFilePath, line, 'utf-8');
        } catch (err) {
            console.error('Failed to append to life.log.jsonl:', err);
        }
    }

    /**
     * 读取历史档案，唤醒记忆
     */
    public loadMemories() {
        this._memories = [];
        if (!fs.existsSync(this._logFilePath)) {
            return;
        }

        try {
            const fileContent = fs.readFileSync(this._logFilePath, 'utf-8');
            const lines = fileContent.split('\n').filter(line => line.trim().length > 0);

            lines.forEach(line => {
                try {
                    const event: MemoryEvent = JSON.parse(line);
                    this._memories.push(event);
                } catch (e) { }
            });
            console.log(`[MemoryManager] 已成功从长期记忆中唤醒 ${this._memories.length} 条人生片段.`);
        } catch (err) {
            console.error('Failed to read memories:', err);
        }
    }

    /**
     * 记录新事件入库
     */
    public appendMemory(role: 'user' | 'assistant' | 'system', content: string) {
        const event: MemoryEvent = {
            timestamp: new Date().toISOString(),
            role: role,
            content: content
        };
        this._memories.push(event);
        this._appendToLifeLog(event);
    }

    /**
     * 提取供 LLM 当前推理阶段使用的上下文 (滑动窗口，提取尾部最新若干记录，加上前置 System Prompt)
     */
    public getRecentContextWindow(systemPrompt: string): { role: string, content: string }[] {
        const context = [];

        // 永远保持系统设定在最前端
        context.push({ role: 'system', content: systemPrompt });

        // 取出内存中尾部的记录，丢掉那些可能已经被 "压缩/遗忘" 的太久远常规流水
        const recentMemories = this._memories.slice(-this._maxHistoryContext);

        recentMemories.forEach(m => {
            if (m.role !== 'system') {
                context.push({ role: m.role, content: m.content });
            }
        });

        return context;
    }

    /**
     * 临时清空当前生命日志 (用于除错和重置)
     */
    public clearAllMemories() {
        this._memories = [];
        if (fs.existsSync(this._logFilePath)) {
            fs.unlinkSync(this._logFilePath);
        }
    }

    /**
     * 获取生命日志所在的绝对路径，可以提供给用户查看
     */
    public getArchiveLocation(): string {
        return this._logFilePath;
    }
}
