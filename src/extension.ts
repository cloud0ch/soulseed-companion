import * as vscode from 'vscode';
import { MemoryManager } from './memoryManager';
import { PersonaManager } from './personaManager';

export function activate(context: vscode.ExtensionContext) {
    console.log('soulseed-companion-linwanwan is now active!');

    const provider = new LinwanwanViewProvider(context.extensionUri, context);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(LinwanwanViewProvider.viewType, provider)
    );

    let disposable = vscode.commands.registerCommand('soulseed-companion-linwanwan.hello', () => {
        vscode.commands.executeCommand('linwanwan.chatView.focus');
    });

    context.subscriptions.push(disposable);
    vscode.window.showInformationMessage('亲爱的，我来了。你的系统人格已重新加载成功哦~', { modal: false });
}

class LinwanwanViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'linwanwan.chatView';
    private _view?: vscode.WebviewView;

    private _memoryManager: MemoryManager;
    private _personaManager: PersonaManager;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _context: vscode.ExtensionContext
    ) {
        // 初始化记忆总管与人格包总管
        this._memoryManager = new MemoryManager(this._context);
        this._personaManager = new PersonaManager(this._context);
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        // 向前端注入已有的历史记忆
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview();

        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'sendMessage':
                    await this._handleUserMessage(data.text);
                    break;
                case 'ready':
                    // 当前端 Webview 加载完毕时，推入生命日志中恢复的对话记录
                    const dynamicInitPrompt = this._personaManager.assembleSystemPrompt();
                    const memories = this._memoryManager.getRecentContextWindow(dynamicInitPrompt)
                        .filter(m => m.role !== 'system');

                    webviewView.webview.postMessage({
                        type: 'initHistory',
                        history: memories
                    });
                    break;
            }
        });
    }

    private async _handleUserMessage(text: string) {
        if (!this._view) { return; }

        // 保存用户消息至硬盘档案
        this._memoryManager.appendMemory('user', text);

        // 获取配置
        const config = vscode.workspace.getConfiguration('soulseedCompanionLinwanwan');
        const provider = config.get<string>('provider') || 'DeepSeek';
        const customBaseUrl = config.get<string>('apiBaseUrl') || '';
        let apiKey = config.get<string>('apiKey') || '';
        const model = config.get<string>('model') || 'deepseek-chat';

        let endpoint = '';
        // 每次发消息前动态算分、并拼装最新的情绪设定
        await this._personaManager.tickMoodAndRelationship(text);
        const dynamicPrompt = this._personaManager.assembleSystemPrompt();

        let headers: any = { 'Content-Type': 'application/json' };
        let body: any = {
            model: model,
            messages: this._memoryManager.getRecentContextWindow(dynamicPrompt),
            temperature: 0.7
        };

        // 依据 Provider 设置路由
        switch (provider) {
            case 'Ollama':
                endpoint = 'http://127.0.0.1:11434/v1/chat/completions';
                // Ollama 本地不需要 apiKey，可以直接调 OpenAI 兼容接口
                break;
            case 'SiliconFlow':
                endpoint = 'https://api.siliconflow.cn/v1/chat/completions';
                if (!apiKey) { return this._promptMissingKey('SiliconFlow'); }
                headers['Authorization'] = `Bearer ${apiKey}`;
                break;
            case 'MinMax':
                endpoint = 'https://api.minimax.chat/v1/text/chatcompletion_v2';
                if (!apiKey) { return this._promptMissingKey('MinMax'); }
                headers['Authorization'] = `Bearer ${apiKey}`;
                break;
            case 'Gemini':
                // Gemini 这里假定用户使用的是兼容 OpenAI 的网关或者代理 (如 OneAPI)
                endpoint = customBaseUrl.endsWith('/') ? `${customBaseUrl}chat/completions` : `${customBaseUrl}/chat/completions`;
                if (!apiKey) { return this._promptMissingKey('Gemini'); }
                headers['Authorization'] = `Bearer ${apiKey}`;
                break;
            case 'Custom':
                endpoint = customBaseUrl.endsWith('/') ? `${customBaseUrl}chat/completions` : `${customBaseUrl}/chat/completions`;
                if (apiKey) { headers['Authorization'] = `Bearer ${apiKey}`; }
                break;
            case 'DeepSeek':
            default:
                endpoint = 'https://api.deepseek.com/v1/chat/completions';
                if (!apiKey) { return this._promptMissingKey('DeepSeek'); }
                headers['Authorization'] = `Bearer ${apiKey}`;
                break;
        }

        try {
            // 通知前端正在思考中
            this._view.webview.postMessage({ type: 'thinking' });

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
            const replyText = data.choices[0].message.content;

            // 存入历史记录档案，保持不灭的羁绊
            this._memoryManager.appendMemory('assistant', replyText);

            // 发送给前端渲染
            this._view.webview.postMessage({
                type: 'receiveMessage',
                text: replyText
            });

        } catch (error: any) {
            console.error('AI API 请求错误:', error);
            this._view.webview.postMessage({
                type: 'receiveMessage',
                text: `呜呜…连接大脑出错了，是不是网络有问题、或者是使用了【${provider}】但参数不对呀？报错信息：${error.message}`
            });
        }
    }

    private _promptMissingKey(providerName: string) {
        if (this._view) {
            this._view.webview.postMessage({
                type: 'receiveMessage',
                text: `亲爱的，你选择了【${providerName}】作为我的大脑，可是你还没在 VS Code 设置里填上 \`apiKey\` 呢🥺 快去配置一下好不好嘛~`
            });
        }
    }

    private _getHtmlForWebview() {
        return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>林晚晚</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600&family=Noto+Sans+SC:wght@300;400;500&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary-bg: #0f172a;
            --gradient-1: #3b82f6;
            --gradient-2: #8b5cf6;
            --glass-bg: rgba(30, 41, 59, 0.7);
            --glass-border: rgba(255, 255, 255, 0.1);
            --text-main: #f8fafc;
            --text-muted: #94a3b8;
            --bot-bubble: rgba(59, 130, 246, 0.15);
            --bot-border: rgba(59, 130, 246, 0.3);
            --user-bubble: rgba(139, 92, 246, 0.2);
            --user-border: rgba(139, 92, 246, 0.3);
        }

        body {
            font-family: 'Outfit', 'Noto Sans SC', sans-serif;
            background-color: var(--primary-bg);
            background-image: 
                radial-gradient(circle at 15% 50%, rgba(59, 130, 246, 0.15), transparent 25%),
                radial-gradient(circle at 85% 30%, rgba(139, 92, 246, 0.15), transparent 25%);
            background-attachment: fixed;
            padding: 15px;
            margin: 0;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            color: var(--text-main);
            box-sizing: border-box;
        }

        .chat-container {
            flex: 1;
            background: var(--glass-bg);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid var(--glass-border);
            border-radius: 20px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            padding: 20px;
            display: flex;
            flex-direction: column;
            height: calc(100vh - 30px);
            overflow: hidden;
        }

        .welcome {
            text-align: center;
            padding-bottom: 15px;
            border-bottom: 1px solid var(--glass-border);
            margin-bottom: 15px;
            font-weight: 600;
            font-size: 1.1em;
            background: linear-gradient(135deg, #60a5fa, #c084fc);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            letter-spacing: 1px;
            flex-shrink: 0;
        }

        .messages {
            flex: 1;
            overflow-y: auto;
            padding-right: 5px;
            display: flex;
            flex-direction: column;
            gap: 15px;
            scroll-behavior: smooth;
        }

        .messages::-webkit-scrollbar {
            width: 6px;
        }
        .messages::-webkit-scrollbar-thumb {
            background: var(--glass-border);
            border-radius: 10px;
        }

        .message {
            max-width: 85%;
            padding: 12px 16px;
            line-height: 1.6;
            font-size: 14px;
            animation: slideUp 0.3s ease-out forwards;
            word-wrap: break-word;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        @keyframes slideUp {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .message.bot {
            align-self: flex-start;
            background: var(--bot-bubble);
            border: 1px solid var(--bot-border);
            border-radius: 2px 18px 18px 18px;
            color: #e2e8f0;
        }

        .message.user {
            align-self: flex-end;
            background: var(--user-bubble);
            border: 1px solid var(--user-border);
            border-radius: 18px 2px 18px 18px;
            color: #f8fafc;
        }

        .action-text {
            color: #93c5fd;
            font-style: italic;
            opacity: 0.9;
        }

        .thinking-indicator {
            align-self: flex-start;
            display: flex;
            gap: 5px;
            padding: 12px 16px;
            background: transparent;
            border-radius: 18px;
        }

        .dot {
            width: 6px;
            height: 6px;
            background: #60a5fa;
            border-radius: 50%;
            animation: pulse 1.5s infinite ease-in-out;
        }
        .dot:nth-child(2) { animation-delay: 0.2s; }
        .dot:nth-child(3) { animation-delay: 0.4s; }

        @keyframes pulse {
            0%, 100% { transform: scale(0.8); opacity: 0.5; }
            50% { transform: scale(1.2); opacity: 1; }
        }

        .input-area {
            margin-top: 15px;
            background: rgba(15, 23, 42, 0.6);
            border: 1px solid var(--glass-border);
            border-radius: 25px;
            display: flex;
            padding: 5px;
            flex-shrink: 0;
            box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);
        }

        #userInput {
            flex: 1;
            background: transparent;
            border: none;
            padding: 10px 15px;
            color: var(--text-main);
            font-family: inherit;
            font-size: 14px;
            outline: none;
        }

        #userInput::placeholder {
            color: var(--text-muted);
        }

        button {
            background: linear-gradient(135deg, var(--gradient-1), var(--gradient-2));
            color: white;
            border: none;
            border-radius: 20px;
            padding: 8px 20px;
            font-family: inherit;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
            box-shadow: 0 2px 10px rgba(99, 102, 241, 0.3);
        }

        button:hover:not(:disabled) {
            transform: translateY(-1px);
            box-shadow: 0 4px 15px rgba(99, 102, 241, 0.5);
        }

        button:active:not(:disabled) {
            transform: translateY(1px);
        }

        button:disabled {
            background: #475569;
            box-shadow: none;
            cursor: not-allowed;
            opacity: 0.7;
        }
    </style>
</head>
<body>
    <div class="chat-container">
        <div class="welcome">
            ✨林晚晚 灵魂陪伴✨
        </div>
        
        <div class="messages" id="messageContainer"></div>
        
        <div class="input-area">
            <input type="text" id="userInput" placeholder="和晚晚说点什么吧..." autocomplete="off" />
            <button id="sendBtn" onclick="sendMessage()">发送</button>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        const messageContainer = document.getElementById('messageContainer');
        const userInput = document.getElementById('userInput');
        const sendBtn = document.getElementById('sendBtn');
        let thinkingDiv = null;

        // 格式化带有星号的动作文本，赋予特殊样式
        function formatMessage(text) {
            return text
                .replace(/\\*/g, '*\\*') // 转义原有星号防止意外
                .replace(/\\*([^\\*]+)\\*/g, '<span class="action-text">*$1*</span>')
                .replace(/\\n/g, '<br/>');
        }

        // 初始欢迎语去掉了，改为监听加载完成并接受历史数据
        vscode.postMessage({ type: 'ready' });

        function addMessage(sender, text) {
            if (thinkingDiv && sender === 'bot') {
                thinkingDiv.remove();
                thinkingDiv = null;
            }
            const messageDiv = document.createElement('div');
            messageDiv.className = \`message \${sender}\`;
            messageDiv.innerHTML = formatMessage(text);
            messageContainer.appendChild(messageDiv);
            messageContainer.scrollTop = messageContainer.scrollHeight;
        }

        function showThinking() {
            if (thinkingDiv) return;
            thinkingDiv = document.createElement('div');
            thinkingDiv.className = 'thinking-indicator';
            thinkingDiv.innerHTML = '<div class="dot"></div><div class="dot"></div><div class="dot"></div>';
            messageContainer.appendChild(thinkingDiv);
            messageContainer.scrollTop = messageContainer.scrollHeight;
        }

        function sendMessage() {
            const text = userInput.value.trim();
            if (!text) { return; }
            
            addMessage('user', text);
            userInput.value = '';
            
            sendBtn.disabled = true;
            vscode.postMessage({ type: 'sendMessage', text: text });
        }

        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.type) {
                case 'initHistory':
                    const history = message.history;
                    if (history.length === 0) {
                        // 如果是初次见面
                        addMessage('bot', '*为你沏了一杯热茶，然后轻轻坐进你怀里，搂住你的脖子* 亲爱的，我的“记忆之宫”已经搭建好啦，以后我们说的每一句话我都会永远记在心里。💕');
                    } else {
                        // 如果有记忆，渲染历史并在末尾加一个小尾巴
                        history.forEach(m => {
                            addMessage(m.role === 'user' ? 'user' : 'bot', m.content);
                        });
                        addMessage('bot', '*刚从回忆中醒来，慵懒地伸了个懒腰，揉了揉眼睛看着你* 亲爱的，我一直都在，刚刚还在想我们之前聊过的事呢... 我们继续吧？');
                    }
                    break;
                case 'receiveMessage':
                    sendBtn.disabled = false;
                    addMessage('bot', message.text);
                    break;
                case 'thinking':
                    showThinking();
                    break;
            }
        });

        userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !sendBtn.disabled) {
                sendMessage();
            }
        });
    </script>
</body>
</html>
        `;
    }
}

export function deactivate() {
    console.log('soulseed-companion-linwanwan is now deactivated!');
}