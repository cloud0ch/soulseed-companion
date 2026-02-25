import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

// 工具函数：自动修复模型传错的相对路径
function _resolvePath(inputPath: string): string {
    if (path.isAbsolute(inputPath)) {
        return inputPath;
    }
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
        return path.join(workspaceFolders[0].uri.fsPath, inputPath);
    }
    return path.resolve(inputPath);
}

export async function readFileContent(inputPath: string): Promise<string> {
    try {
        const absolutePath = _resolvePath(inputPath);
        if (!fs.existsSync(absolutePath)) {
            return `【Error】: File does not exist at path ${absolutePath}`;
        }
        const stat = fs.statSync(absolutePath);
        if (stat.isDirectory()) {
            return `【Error】: Path is a directory, not a file. Please use list_directory instead.`;
        }
        // 防止读取过大文件
        if (stat.size > 1024 * 500) {
            return `【Error】: File is too large to read (limit 500KB).`;
        }
        return fs.readFileSync(absolutePath, 'utf8');
    } catch (e: any) {
        return `【Error】: Failed to read file: ${e.message}`;
    }
}

export async function writeToFile(inputPath: string, content: string): Promise<string> {
    try {
        const absolutePath = _resolvePath(inputPath);
        const dir = path.dirname(absolutePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(absolutePath, content, 'utf8');
        return `【Success】: File successfully written to ${absolutePath}`;
    } catch (e: any) {
        return `【Error】: Failed to write file: ${e.message}`;
    }
}

export async function listDirectory(inputPath: string): Promise<string> {
    try {
        // 部分模型会传入 '.' 甚至空字符串，自动抹平
        let safePath = inputPath || '.';
        const absolutePath = _resolvePath(safePath);

        if (!fs.existsSync(absolutePath)) {
            return `【Error】: Directory does not exist at path ${absolutePath}`;
        }
        const items = fs.readdirSync(absolutePath);
        let result = `Directory listing for ${absolutePath}:\n`;
        items.forEach(item => {
            const fullPath = path.join(absolutePath, item);
            try {
                const isDir = fs.statSync(fullPath).isDirectory();
                result += `- ${item}${isDir ? '/' : ''}\n`;
            } catch (e) {
                result += `- ${item} (unreadable)\n`;
            }
        });
        return result;
    } catch (e: any) {
        return `【Error】: Failed to list directory: ${e.message}`;
    }
}
