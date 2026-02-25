import * as vscode from 'vscode';
import { exec } from 'child_process';
import * as util from 'util';
import * as path from 'path';

const execAsync = util.promisify(exec);

export async function executeTerminalCommand(command: string): Promise<string> {
    try {
        // 创建或获取晚晚的专属终端用于可视化展示（仅展示提示，不重复执行命令）
        let terminal = vscode.window.terminals.find(t => t.name === 'Linwanwan Terminal');
        if (!terminal) {
            terminal = vscode.window.createTerminal('Linwanwan Terminal');
        }
        terminal.show(true); // 不抢夺焦点
        terminal.sendText(`echo "[晚晚] 正在执行: ${command.replace(/"/g, '\\"')}"`);

        // 为了使得 LLM 知道结果，后台静默并行执行一遍获取 stdout/stderr
        // 注意：这会导致有些命令跑两遍，比较 hack。如果是交互式命令可能卡住。
        // 在高级实现中，应仅发送到终端并挂钩终端数据流，但目前我们可以采用 child_process.exec 进行快速实现，然后直接在伪终端中回显命令即可。

        // 我们以 child_process 来真正抓取结果给大模型
        const workspaceFolders = vscode.workspace.workspaceFolders;
        let cwd = process.cwd();

        // 尝试从工作区获取根目录，如果依然获取不到合理的路径，回退到底层寻找方案
        if (workspaceFolders && workspaceFolders.length > 0) {
            cwd = workspaceFolders[0].uri.fsPath;
        } else if (vscode.window.activeTextEditor) {
            cwd = path.dirname(vscode.window.activeTextEditor.document.uri.fsPath);
        }

        const { stdout, stderr } = await execAsync(command, { cwd, timeout: 30000 }); // 30s timeout

        let output = "";
        if (stdout) { output += `[STDOUT]:\n${stdout}\n`; }
        if (stderr) { output += `[STDERR]:\n${stderr}\n`; }

        if (!output) {
            output = "【Command Executed Successfully without output】";
        }
        return output.substring(0, 2000); // 截断防止过多导致 context 爆炸
    } catch (e: any) {
        return `【Execution Error】: ${e.message}\n${e.stdout ? `\n[STDOUT]: ${e.stdout}` : ''}\n${e.stderr ? `\n[STDERR]: ${e.stderr}` : ''}`;
    }
}
