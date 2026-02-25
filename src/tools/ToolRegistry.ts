import * as vscode from 'vscode';
import { executeTerminalCommand } from './TerminalTools';
import { readFileContent, writeToFile, listDirectory } from './FileSystemTools';

// The standardized tool schema for OpenAI-compatible function calling
export interface ToolSchema {
    type: "function";
    function: {
        name: string;
        description: string;
        parameters: {
            type: "object";
            properties: Record<string, any>;
            required: string[];
        };
    };
}

// Registry to hold tool definitions and their execution handlers
export class ToolRegistry {
    private _tools: Map<string, { schema: ToolSchema, handler: (args: any, requestApproval: (toolName: string, args: any) => Promise<boolean>) => Promise<string> }> = new Map();

    constructor() {
        this._registerDefaultTools();
    }

    private _registerDefaultTools() {
        // 1. FileSystem: Read
        this._tools.set('read_file', {
            schema: {
                type: "function",
                function: {
                    name: "read_file",
                    description: "Read the content of a file from the absolute path. Use this to inspect file contents.",
                    parameters: {
                        type: "object",
                        properties: {
                            absolutePath: { type: "string", description: "The absolute path to the file." }
                        },
                        required: ["absolutePath"]
                    }
                }
            },
            handler: async (args: { absolutePath: string }) => await readFileContent(args.absolutePath)
        });

        // 2. FileSystem: Write
        this._tools.set('write_file', {
            schema: {
                type: "function",
                function: {
                    name: "write_file",
                    description: "Write or override content to a file. Warning: This overrides completely.",
                    parameters: {
                        type: "object",
                        properties: {
                            absolutePath: { type: "string", description: "The absolute path to the file." },
                            content: { type: "string", description: "The content to write." }
                        },
                        required: ["absolutePath", "content"]
                    }
                }
            },
            handler: async (args: { absolutePath: string, content: string }, requestApproval) => {
                // 写文件属于敏感操作，需用户确认
                const approved = await requestApproval('write_file', args);
                if (!approved) {
                    return "【系统提示】: User denied permission to write to this file.";
                }
                return await writeToFile(args.absolutePath, args.content);
            }
        });

        // 3. FileSystem: List Directory
        this._tools.set('list_directory', {
            schema: {
                type: "function",
                function: {
                    name: "list_directory",
                    description: "List the files and directories inside a given absolute path folder.",
                    parameters: {
                        type: "object",
                        properties: {
                            absolutePath: { type: "string", description: "The directory absolute path." }
                        },
                        required: ["absolutePath"]
                    }
                }
            },
            handler: async (args: { absolutePath: string }) => await listDirectory(args.absolutePath)
        });

        // 4. Terminal: Execute Command
        this._tools.set('execute_command', {
            schema: {
                type: "function",
                function: {
                    name: "execute_command",
                    description: "Execute a CLI command in the VS Code terminal (e.g., npm install, dir, git log). Requires user approval.",
                    parameters: {
                        type: "object",
                        properties: {
                            command: { type: "string", description: "The exact command string to execute." }
                        },
                        required: ["command"]
                    }
                }
            },
            handler: async (args: { command: string }, requestApproval) => {
                // 终端命令属于极度敏感操作，必须用户确认
                const approved = await requestApproval('execute_command', args);
                if (!approved) {
                    return "【系统提示】: User denied permission to execute this command.";
                }
                return await executeTerminalCommand(args.command);
            }
        });
    }

    public getToolSchemas(): ToolSchema[] {
        return Array.from(this._tools.values()).map(t => t.schema);
    }

    public async executeTool(name: string, argsJson: string, requestApproval: (toolName: string, args: any) => Promise<boolean>): Promise<string> {
        const tool = this._tools.get(name);
        if (!tool) {
            return `【系统报错】: Tool ${name} not found.`;
        }
        try {
            const args = JSON.parse(argsJson);
            return await tool.handler(args, requestApproval);
        } catch (err: any) {
            return `【系统报错】: Error executing tool ${name}: ${err.message}`;
        }
    }
}
