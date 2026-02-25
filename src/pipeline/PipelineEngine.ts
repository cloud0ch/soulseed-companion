import * as vscode from 'vscode';
import { MemoryManager } from '../memoryManager';
import { PersonaManager } from '../personaManager';
import { ToolRegistry } from '../tools/ToolRegistry';
import { Introspection } from './Introspection';

export class PipelineEngine {
    private _toolRegistry: ToolRegistry;
    private _introspection: Introspection;

    constructor(
        private _memoryManager: MemoryManager,
        private _personaManager: PersonaManager,
        private _context: vscode.ExtensionContext,
        private _sendToWebview: (type: string, payload: any) => void,
        private _requestApproval: (toolName: string, args: any) => Promise<boolean>
    ) {
        this._toolRegistry = new ToolRegistry();
        this._introspection = new Introspection(_context);
    }

    public async runPipeline(userText: string) {
        // 1. 保存用户侧历史
        this._memoryManager.appendMemory('user', userText);

        // 2. 情绪刻画机制
        await this._personaManager.tickMoodAndRelationship(userText);
        const dynamicPrompt = this._personaManager.assembleSystemPrompt();

        const config = vscode.workspace.getConfiguration('soulseedCompanionLinwanwan');
        const provider = config.get<string>('provider') || 'DeepSeek';
        const customBaseUrl = config.get<string>('apiBaseUrl') || '';
        let apiKey = config.get<string>('apiKey') || '';
        const model = config.get<string>('model') || 'deepseek-chat';

        let endpoint = this._resolveEndpoint(provider, customBaseUrl);
        let headers: any = { 'Content-Type': 'application/json' };
        if (apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`;
        } else if (provider !== 'Ollama' && provider !== 'Custom') {
            this._sendToWebview('receiveMessage', { text: `亲爱的，你还没在 VS Code 设置里填上 ${provider} 的 \`apiKey\` 呢🥺` });
            return;
        }

        // 获取上下文（我们此时将使用一份临时拷贝给请求体，而遇到 ToolCall 会动态 push 进临时上下文后再进行多轮推理）
        let messages: any[] = this._memoryManager.getRecentContextWindow(dynamicPrompt);
        const toolsSchema = this._toolRegistry.getToolSchemas();

        try {
            let limit = 5; // 最多允许连续执行5次工具调用防死循环
            let finalReply = "";

            while (limit > 0) {
                limit--;
                this._sendToWebview('thinking', {});

                const body: any = {
                    model: model,
                    messages: messages,
                    temperature: 0.7,
                    tools: toolsSchema,
                    tool_choice: "auto"
                };

                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify(body)
                });

                if (!response.ok) {
                    const errorData = await response.text();
                    throw new Error(`[${response.status}] ${errorData}`);
                }

                const data: any = await response.json();
                const responseMessage = data.choices[0].message;
                messages.push(responseMessage); // 将助手回复或工具调用意图推入临时上下文

                if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
                    // 有工具需要调用
                    for (const toolCall of responseMessage.tool_calls) {
                        const functionName = toolCall.function.name;
                        const functionArgs = toolCall.function.arguments;

                        this._sendToWebview('statusUpdate', { text: `晚晚正在尝试使用工具: ${functionName}...` });

                        // 执行工具并请求可能的用户授权
                        const functionResponse = await this._toolRegistry.executeTool(
                            functionName,
                            functionArgs,
                            this._requestApproval
                        );

                        // 将工具执行结果推入上下文中
                        messages.push({
                            tool_call_id: toolCall.id,
                            role: "tool",
                            name: functionName,
                            content: functionResponse,
                        });
                    }
                    // 继续 while 循环，让模型拿到底层运行结果再次思考
                } else {
                    // 没有更多工具调用，生成了最终文本
                    finalReply = responseMessage.content || "";
                    break;
                }
            }

            if (!finalReply && limit === 0) {
                finalReply = "唔... 晚晚想得太久了脑袋有点晕，亲爱的能再说一遍吗？";
            }

            // 【自省机制】在输出前过一遍 Introspection
            this._sendToWebview('statusUpdate', { text: "晚晚正在自省整理思绪..." });
            const revisedReply = await this._introspection.introspect(finalReply, endpoint, headers, model);

            // 存入全局的真正记忆（仅保存对话文本流，工具调用的中间流暂不污染长期人生档案）
            this._memoryManager.appendMemory('assistant', revisedReply);

            // 下发渲染
            this._sendToWebview('statusUpdate', { text: "" }); // 清除状态提示
            this._sendToWebview('receiveMessage', { text: revisedReply });

        } catch (error: any) {
            console.error('Pipeline Error:', error);
            this._sendToWebview('receiveMessage', {
                text: `呜呜…流水线运行出错了：${error.message}`
            });
        }
    }

    private _resolveEndpoint(provider: string, customBaseUrl: string): string {
        switch (provider) {
            case 'Ollama': return 'http://127.0.0.1:11434/v1/chat/completions';
            case 'SiliconFlow': return 'https://api.siliconflow.cn/v1/chat/completions';
            case 'MinMax': return 'https://api.minimax.chat/v1/text/chatcompletion_v2';
            case 'Gemini':
            case 'Custom':
                return customBaseUrl.endsWith('/') ? `${customBaseUrl}chat/completions` : `${customBaseUrl}/chat/completions`;
            case 'DeepSeek':
            default: return 'https://api.deepseek.com/v1/chat/completions';
        }
    }
}
