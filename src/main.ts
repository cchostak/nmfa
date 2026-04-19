import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import { constants as fsConstants } from 'fs';
import * as fs from 'fs/promises';

type ChatMessage = {role: string, content: string};

type WorkspaceTreeNode = {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: WorkspaceTreeNode[];
};

type AgentResponse = {
  message: string;
  content?: string;
  filePath?: string;
  workspace?: string | null;
  tree?: WorkspaceTreeNode;
};

type AgentStep = {
  thought?: string;
  action: string;
  args?: Record<string, unknown>;
};

type ToolResult = {
  observation: string;
  content?: string;
  filePath?: string;
  tree?: WorkspaceTreeNode;
};

type AgentLoopState = 'planning' | 'acting' | 'observing' | 'done';

type AgentActivityEvent = {
  requestId: string;
  state: AgentLoopState | 'error';
  step: number;
  title: string;
  detail?: string;
};

/**
 * Main entry point for the Electron application.
 * Handles window creation, local file access, and model startup.
 */
class MainApp {
  private mainWindow: BrowserWindow | null = null;
  private ollamaProcess: ChildProcess | null = null;
  private modelStartError: string | null = null;
  private modelReady = false;
  private workspaceRoot: string | null = null;
  private readonly maxTreeEntries = 500;
  private readonly maxAgentFileBytes = 12000;
  private readonly ignoredFolderNames = new Set([
    '.git',
    'build',
    'coverage',
    'dist',
    'node_modules',
  ]);
  private readonly supportedFileExtensions = new Set([
    '.cjs',
    '.css',
    '.html',
    '.js',
    '.jsx',
    '.json',
    '.md',
    '.mjs',
    '.ts',
    '.tsx',
  ]);
  private readonly agentActions = new Set([
    'append_file',
    'file_outline',
    'final',
    'list_files',
    'read_file',
    'replace_in_file',
    'run_npm_script',
    'search_files',
    'web_search',
    'write_file',
  ]);
  private readonly actionAliases = new Map([
    ['answer', 'final'],
    ['append', 'append_file'],
    ['cat', 'read_file'],
    ['create', 'write_file'],
    ['create_file', 'write_file'],
    ['edit', 'replace_in_file'],
    ['grep', 'search_files'],
    ['ls', 'list_files'],
    ['npm', 'run_npm_script'],
    ['open', 'read_file'],
    ['outline', 'file_outline'],
    ['patch', 'replace_in_file'],
    ['read', 'read_file'],
    ['respond', 'final'],
    ['rg', 'search_files'],
    ['ripgrep', 'search_files'],
    ['run_tests', 'run_npm_script'],
    ['search', 'search_files'],
    ['search_web', 'web_search'],
    ['show', 'read_file'],
    ['test', 'run_npm_script'],
    ['tree', 'list_files'],
    ['web', 'web_search'],
    ['write', 'write_file'],
  ]);

  constructor() {
    this.init();
  }

  private init(): void {
    app.whenReady().then(async () => {
      this.createWindow();
      this.setupIpcHandlers();
      try {
        await this.startModelIfNeeded();
      } catch (error) {
        console.error('Model startup failed:', error);
      }
    });

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.createWindow();
      }
    });

    app.on('before-quit', () => {
      this.shutdownModel();
    });
  }

  private createWindow(): void {
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
        preload: path.join(__dirname, 'preload.js'),
      },
    });

    const indexPath = path.join(__dirname, 'index.html');
    this.mainWindow.loadFile(indexPath);

    if (process.env.NODE_ENV === 'development') {
      this.mainWindow.webContents.openDevTools();
    }
  }

  private setupIpcHandlers(): void {
    ipcMain.handle('open-file', async () => {
      const result = await dialog.showOpenDialog(this.mainWindow!, {
        properties: ['openFile'],
        filters: [
          { name: 'TypeScript', extensions: ['ts', 'tsx'] },
          { name: 'JavaScript', extensions: ['js', 'jsx'] },
          { name: 'Web Files', extensions: ['html', 'css', 'json', 'md'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });

      if (!result.canceled && result.filePaths.length > 0) {
        const selectedPath = result.filePaths[0];
        try {
          const content = await this.readTextFile(selectedPath);
          this.workspaceRoot = path.dirname(selectedPath);
          const tree = await this.buildWorkspaceTree(this.workspaceRoot);
          return {
            success: true,
            content,
            filePath: selectedPath,
            workspace: this.workspaceRoot,
            tree,
          };
        } catch (error) {
          return { success: false, error: (error as Error).message };
        }
      }

      return { success: false, error: 'No file selected' };
    });

    ipcMain.handle('open-folder', async () => {
      const result = await dialog.showOpenDialog(this.mainWindow!, {
        properties: ['openDirectory'],
        filters: [{ name: 'All Files', extensions: ['*'] }],
      });

      if (!result.canceled && result.filePaths.length > 0) {
        const selectedPath = result.filePaths[0];
        try {
          this.workspaceRoot = selectedPath;
          const tree = await this.buildWorkspaceTree(selectedPath);
          const filePath = await this.findFirstSupportedFile(selectedPath);
          if (!filePath) {
            return {
              success: false,
              error: 'No supported text files found in folder',
            };
          }

          const content = await this.readTextFile(filePath);
          return {
            success: true,
            content,
            filePath,
            workspace: selectedPath,
            tree,
          };
        } catch (error) {
          return { success: false, error: (error as Error).message };
        }
      }

      return { success: false, error: 'No folder selected' };
    });

    ipcMain.handle('open-workspace-file', async (event, filePath: string) => {
      try {
        const normalizedPath = await this.resolveWorkspacePath(filePath);
        const content = await this.readTextFile(normalizedPath);
        return {
          success: true,
          content,
          filePath: normalizedPath,
          workspace: this.workspaceRoot,
        };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle('save-file', async (event, content: string, filePath: string) => {
      try {
        const normalizedPath = await this.resolveWorkspacePath(filePath);
        await fs.writeFile(normalizedPath, content, 'utf-8');
        return { success: true };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle('read-file', async (event, filePath: string) => {
      try {
        const normalizedPath = await this.resolveWorkspacePath(filePath);
        const content = await this.readTextFile(normalizedPath);
        return { success: true, content };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle(
      'chat-with-context',
      async (
        event,
        message: string,
        history: ChatMessage[],
        context: any,
        requestId: string,
      ) => {
        try {
          const response = await this.processChatWithContext(
            message,
            history,
            context,
            requestId,
          );
          return { success: true, response };
        } catch (error) {
          this.emitAgentActivity({
            requestId,
            state: 'error',
            step: 0,
            title: 'Agent error',
            detail: (error as Error).message,
          });
          return { success: false, error: (error as Error).message };
        }
      },
    );

    ipcMain.handle('execute-agentic-instruction', async (event, instruction: string, context: any) => {
      try {
        const response = await this.processAgenticInstruction(instruction, context);
        return { success: true, response };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle('start-model', async () => {
      try {
        await this.startModelIfNeeded();
        return { success: true, running: this.modelReady };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle('get-model-status', async () => {
      const running = await this.isOllamaReachable();
      if (!running) {
        this.modelReady = false;
      }

      return {
        running,
        pid: this.ollamaProcess?.pid ?? null,
        error: running ? null : this.modelStartError,
      };
    });

    ipcMain.handle('get-version', () => {
      return app.getVersion();
    });
  }

  private async processChatWithContext(
    message: string,
    history: ChatMessage[],
    context: any,
    requestId: string = this.createRequestId(),
  ): Promise<AgentResponse> {
    await this.startModelIfNeeded();

    const { OllamaService } = await import('./ollama');
    return await this.runAgentLoop(
      new OllamaService(undefined, 45000),
      message,
      history,
      context,
      requestId,
    );
  }

  private async runAgentLoop(
    ollama: InstanceType<typeof import('./ollama').OllamaService>,
    message: string,
    history: ChatMessage[],
    context: any,
    requestId: string,
  ): Promise<AgentResponse> {
    const observations: string[] = [];
    let lastToolResult: ToolResult | null = null;
    let state: AgentLoopState = 'planning';
    const maxSteps = 8;

    for (let stepIndex = 0; stepIndex < maxSteps; stepIndex += 1) {
      state = 'planning';
      this.emitAgentActivity({
        requestId,
        state,
        step: stepIndex + 1,
        title: 'Planning next tool call',
      });
      const prompt = await this.createAgentPrompt(
        message,
        history,
        context,
        observations,
        stepIndex,
      );
      const rawStep = await ollama.generateJson(prompt);
      let step = this.parseAgentStep(rawStep);

      if (!step) {
        state = 'observing';
        this.emitAgentActivity({
          requestId,
          state,
          step: stepIndex + 1,
          title: 'Model returned invalid tool JSON',
          detail: this.truncateObservation(rawStep),
        });
        observations.push(
          `Model returned invalid tool JSON: ${this.truncateObservation(rawStep)}`,
        );
        continue;
      }

      const originalAction = step.action;
      step = this.repairAgentStep(step, message, observations);
      if (step.action !== originalAction) {
        this.emitAgentActivity({
          requestId,
          state,
          step: stepIndex + 1,
          title: `Repaired ${originalAction} -> ${step.action}`,
          detail: this.formatToolArgs(step.args || {}),
        });
        observations.push(
          `Repaired unavailable action "${originalAction}" to "${step.action}".`,
        );
      }

      const policyObservation = this.validateToolPolicy(step, message);
      if (policyObservation) {
        state = 'observing';
        this.emitAgentActivity({
          requestId,
          state,
          step: stepIndex + 1,
          title: `Blocked ${step.action}`,
          detail: policyObservation,
        });
        observations.push(policyObservation);
        continue;
      }

      if (step.action === 'final') {
        state = 'done';
        this.emitAgentActivity({
          requestId,
          state,
          step: stepIndex + 1,
          title: 'Final answer ready',
          detail: String(step.args?.message || 'Done.'),
        });
        return {
          message: String(step.args?.message || 'Done.'),
          content: lastToolResult?.content,
          filePath: lastToolResult?.filePath,
          workspace: this.workspaceRoot,
          tree: lastToolResult?.tree,
        };
      }

      state = 'acting';
      this.emitAgentActivity({
        requestId,
        state,
        step: stepIndex + 1,
        title: `Running ${step.action}`,
        detail: this.formatToolArgs(step.args || {}),
      });
      const toolResult = await this.executeAgentTool(step);
      lastToolResult = toolResult;
      state = 'observing';
      this.emitAgentActivity({
        requestId,
        state,
        step: stepIndex + 1,
        title: `Observed ${step.action}`,
        detail: this.truncateObservation(toolResult.observation),
      });
      observations.push(this.truncateObservation(toolResult.observation));
    }

    return {
      message: [
        `I reached the tool-loop step limit while ${state}.`,
        'Here are the latest observations:',
        ...observations.slice(-4).map((observation) => `- ${observation}`),
      ].join('\n'),
      content: lastToolResult?.content,
      filePath: lastToolResult?.filePath,
      workspace: this.workspaceRoot,
      tree: lastToolResult?.tree,
    };
  }

  private async createAgentPrompt(
    message: string,
    history: ChatMessage[],
    context: any,
    observations: string[],
    stepIndex: number,
  ): Promise<string> {
    const activeFilePath = context?.filePath || 'none';
    const activeFile = activeFilePath === 'none' ? 'none' :
      path.relative(this.workspaceRoot || path.dirname(activeFilePath), activeFilePath);
    const activeCode = this.truncateForAgent(context?.code || '');
    const workspaceSummary = this.workspaceRoot ?
      await this.createToolWorkspaceSummary() :
      'No workspace is open.';
    const safeHistory = Array.isArray(history) ? history.slice(-6) : [];

    return [
      'You are NMFA, an agentic coding assistant inside a local IDE.',
      'You must operate by repeatedly choosing tools and observing results.',
      'Do not pretend you lack access: use tools to inspect files, create files,',
      'search the web, or gather repo structure.',
      '',
      'Return exactly one JSON object and no Markdown:',
      '{"thought":"inspect repo","action":"list_files","args":{"path":"."}}',
      'The action value must be one of the listed actions exactly.',
      '',
      'Available actions:',
      '- list_files: args {"path":"optional relative directory"}',
      '- read_file: args {"path":"relative or absolute workspace file"}',
      '- search_files: args {"query":"text or filename","path":"optional directory"}',
      '- file_outline: args {"path":"relative workspace file"}',
      '- write_file: args {"path":"relative workspace file","content":"full file content","overwrite":false}',
      '- replace_in_file: args {"path":"relative workspace file","find":"exact text","replace":"new text","expectedReplacements":1}',
      '- append_file: args {"path":"relative workspace file","content":"text to append"}',
      '- run_npm_script: args {"script":"build|lint|test|smoke-test"}',
      '- web_search: args {"query":"search query"}',
      '- final: args {"message":"answer for the user"}',
      '',
      'Developer flows:',
      '- Understand a file: file_outline, read_file, final.',
      '- Find code: search_files, read_file the best matches, final.',
      '- Make an edit: search_files/list_files, read_file, replace_in_file or',
      '  write_file, run_npm_script with lint/build/test when relevant, final.',
      '- Create a file: write_file, run_npm_script when relevant, final.',
      '- Explain repo architecture or diagrams: list_files, file_outline/read_file',
      '  key files, then final with Mermaid or explanation.',
      '- Current/external facts: web_search, then final with links or caveats.',
      '',
      'Correct examples:',
      '{"thought":"find chat flow","action":"search_files","args":{"query":"chat","path":"src"}}',
      '{"thought":"read main IPC","action":"read_file","args":{"path":"src/main.ts"}}',
      '{"thought":"answer with mermaid","action":"final","args":{"message":"```mermaid\\nsequenceDiagram\\n  User->>App: Ask\\n```"}}',
      '',
      'Rules for a small model:',
      '- Take one small tool step at a time.',
      '- Prefer search_files before guessing a path.',
      '- Never invent tools or use action/tool_name placeholders.',
      '- Do not use graphviz, dot, bash, shell, curl, or unlisted commands.',
      '- For diagrams, inspect files and return Mermaid text in final.',
      '- For local code, repo, file, flow, bug, edit, or architecture questions,',
      '  never use web_search. Use search_files, list_files, file_outline,',
      '  and read_file.',
      '- Use web_search only when the user explicitly asks for web/internet',
      '  search, external docs, current/latest information, or online facts.',
      '- Prefer replace_in_file for small edits; write_file for new files or',
      '  complete rewrites.',
      '- If a tool fails, adapt with another tool instead of apologizing.',
      '- Do not final until you have enough observations.',
      '- Keep final answers concise and include paths plus checks run.',
      '- Never write outside the open workspace.',
      '',
      `Step: ${stepIndex + 1}/${8}`,
      `Workspace: ${this.workspaceRoot || 'none'}`,
      `Active file: ${activeFile}`,
      '',
      'Workspace summary:',
      workspaceSummary,
      '',
      'Active editor contents:',
      activeCode || '[empty]',
      '',
      'Recent chat history:',
      JSON.stringify(safeHistory),
      '',
      'Tool observations so far:',
      observations.length > 0 ? observations.join('\n---\n') : '[none]',
      '',
      `User request: ${message}`,
    ].join('\n');
  }

  private emitAgentActivity(event: AgentActivityEvent): void {
    this.mainWindow?.webContents.send('agent-activity', event);
  }

  private createRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  private formatToolArgs(args: Record<string, unknown>): string {
    const redacted = Object.fromEntries(
      Object.entries(args).map(([key, value]) => {
        if (key === 'content' && typeof value === 'string') {
          return [key, `${value.slice(0, 120)}${value.length > 120 ? '...' : ''}`];
        }

        return [key, value];
      }),
    );
    return JSON.stringify(redacted);
  }

  private validateToolPolicy(step: AgentStep, userMessage: string): string | null {
    if (!this.agentActions.has(step.action)) {
      return [
        `Action "${step.action}" is unavailable.`,
        'Choose one listed action: list_files, read_file, search_files,',
        'file_outline, write_file, replace_in_file, append_file,',
        'run_npm_script, web_search, or final.',
      ].join(' ');
    }

    if (step.action !== 'web_search') {
      return null;
    }

    const normalizedMessage = userMessage.toLowerCase();
    const explicitWebRequest =
      normalizedMessage.includes('web search') ||
      normalizedMessage.includes('search the web') ||
      normalizedMessage.includes('internet') ||
      normalizedMessage.includes('online') ||
      normalizedMessage.includes('external docs') ||
      normalizedMessage.includes('latest') ||
      normalizedMessage.includes('current');

    if (explicitWebRequest) {
      return null;
    }

    return [
      'web_search is blocked for local workspace questions.',
      'Use search_files, file_outline, read_file, or list_files to inspect the repo.',
    ].join(' ');
  }

  private parseAgentStep(rawStep: string): AgentStep | null {
    const jsonText = this.extractJsonObject(rawStep);
    if (!jsonText) {
      return null;
    }

    try {
      const parsed = JSON.parse(jsonText) as Record<string, unknown>;
      const rawAction = this.extractActionName(parsed);
      if (!rawAction) {
        return null;
      }

      return {
        thought: typeof parsed.thought === 'string' ? parsed.thought : '',
        action: this.normalizeActionName(rawAction),
        args: this.extractStepArgs(parsed),
      };
    } catch {
      return null;
    }
  }

  private extractActionName(parsed: Record<string, unknown>): string | null {
    const action = this.extractString(parsed.action);
    if (action && action !== 'tool_name') {
      return action;
    }

    const fallbacks = [
      parsed.tool,
      parsed.tool_name,
      parsed.name,
    ];
    for (const candidate of fallbacks) {
      const name = this.extractString(candidate);
      if (name) {
        return name;
      }
    }

    return action;
  }

  private extractString(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private normalizeActionName(action: string): string {
    const normalized = action.toLowerCase().trim().replace(/[\s-]+/g, '_');
    return this.actionAliases.get(normalized) || normalized;
  }

  private extractStepArgs(parsed: Record<string, unknown>): Record<string, unknown> {
    if (
      parsed.args &&
      typeof parsed.args === 'object' &&
      !Array.isArray(parsed.args)
    ) {
      return parsed.args as Record<string, unknown>;
    }

    const args: Record<string, unknown> = {};
    const metadataKeys = new Set([
      'action',
      'args',
      'name',
      'thought',
      'tool',
      'tool_name',
    ]);
    for (const [key, value] of Object.entries(parsed)) {
      if (!metadataKeys.has(key)) {
        args[key] = value;
      }
    }

    return args;
  }

  private repairAgentStep(
    step: AgentStep,
    userMessage: string,
    observations: string[],
  ): AgentStep {
    if (this.agentActions.has(step.action)) {
      return step;
    }

    const action = step.action.toLowerCase();
    const message = userMessage.toLowerCase();
    const wantsDiagram =
      message.includes('diagram') ||
      message.includes('mermaid') ||
      message.includes('sequence');
    const inspectedWorkspace = observations.some((observation) =>
      observation.includes('Listed files under') ||
      observation.includes('Outline for') ||
      observation.includes('Read '),
    );

    if (wantsDiagram && !inspectedWorkspace) {
      return {
        thought: 'inspect workspace files before composing a Mermaid diagram',
        action: 'list_files',
        args: { path: '.' },
      };
    }

    if (
      action.includes('graphviz') ||
      action === 'dot' ||
      action.includes('shell') ||
      action.includes('bash') ||
      action.includes('command')
    ) {
      return {
        thought: 'external commands are unavailable; inspect the repo instead',
        action: inspectedWorkspace ? 'search_files' : 'list_files',
        args: inspectedWorkspace ?
          { query: this.inferSearchQuery(userMessage), path: '.' } :
          { path: '.' },
      };
    }

    return step;
  }

  private inferSearchQuery(userMessage: string): string {
    const compact = userMessage
      .replace(/[^A-Za-z0-9_./ -]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!compact) {
      return 'main';
    }

    const keywords = compact
      .split(' ')
      .filter((word) => word.length > 3)
      .slice(-4)
      .join(' ');
    return keywords || compact.slice(0, 80);
  }

  private extractJsonObject(rawText: string): string | null {
    const fencedMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fencedMatch?.[1] || rawText;
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
      return null;
    }

    return candidate.slice(start, end + 1);
  }

  private async executeAgentTool(step: AgentStep): Promise<ToolResult> {
    switch (step.action) {
      case 'list_files':
        return await this.toolListFiles(this.getStringArg(step, 'path'));
      case 'read_file':
        return await this.toolReadFile(this.requireStringArg(step, 'path'));
      case 'search_files':
        return await this.toolSearchFiles(
          this.requireStringArg(step, 'query'),
          this.getStringArg(step, 'path'),
        );
      case 'file_outline':
        return await this.toolFileOutline(this.requireStringArg(step, 'path'));
      case 'write_file':
        return await this.toolWriteFile(
          this.requireStringArg(step, 'path'),
          this.requireStringArg(step, 'content'),
          Boolean(step.args?.overwrite),
        );
      case 'replace_in_file':
        return await this.toolReplaceInFile(
          this.requireStringArg(step, 'path'),
          this.requireStringArg(step, 'find'),
          this.requireStringArg(step, 'replace'),
          this.getNumberArg(step, 'expectedReplacements'),
        );
      case 'append_file':
        return await this.toolAppendFile(
          this.requireStringArg(step, 'path'),
          this.requireStringArg(step, 'content'),
        );
      case 'run_npm_script':
        return await this.toolRunNpmScript(
          this.requireStringArg(step, 'script'),
        );
      case 'web_search':
        return {
          observation: await this.searchWeb(this.requireStringArg(step, 'query')),
        };
      default:
        return {
          observation: `Unknown action "${step.action}". Choose a listed tool.`,
        };
    }
  }

  private getStringArg(step: AgentStep, name: string): string | null {
    const value = step.args?.[name];
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private requireStringArg(step: AgentStep, name: string): string {
    const value = this.getStringArg(step, name);
    if (!value) {
      throw new Error(`Tool ${step.action} requires string arg "${name}".`);
    }

    return value;
  }

  private getNumberArg(step: AgentStep, name: string): number | null {
    const value = step.args?.[name];
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  private async toolListFiles(requestedPath: string | null): Promise<ToolResult> {
    if (!this.workspaceRoot) {
      return { observation: 'No workspace is open.' };
    }

    const root = requestedPath ?
      await this.resolveWorkspacePath(path.join(this.workspaceRoot, requestedPath)) :
      this.workspaceRoot;
    const tree = await this.buildWorkspaceTree(root);
    return {
      observation: [
        `Listed files under ${path.relative(this.workspaceRoot, root) || '.'}:`,
        this.formatTree(tree),
      ].join('\n'),
      tree: root === this.workspaceRoot ? tree : undefined,
    };
  }

  private async toolReadFile(requestedPath: string): Promise<ToolResult> {
    if (!this.workspaceRoot) {
      return { observation: 'No workspace is open.' };
    }

    const filePath = await this.resolveWorkspacePath(
      path.isAbsolute(requestedPath) ?
        requestedPath :
        path.join(this.workspaceRoot, requestedPath),
    );
    const content = await this.readTextFile(filePath);
    const relativePath = path.relative(this.workspaceRoot, filePath);
    return {
      observation: [
        `Read ${relativePath}:`,
        this.truncateObservation(content),
      ].join('\n'),
      content,
      filePath,
    };
  }

  private async toolSearchFiles(
    query: string,
    requestedPath: string | null,
  ): Promise<ToolResult> {
    if (!this.workspaceRoot) {
      return { observation: 'No workspace is open.' };
    }

    const root = requestedPath ?
      await this.resolveWorkspacePath(path.join(this.workspaceRoot, requestedPath)) :
      this.workspaceRoot;
    const files = await this.collectWorkspaceFiles(root);
    const normalizedQuery = query.toLowerCase();
    const matches: string[] = [];

    for (const filePath of files) {
      const relativePath = path.relative(this.workspaceRoot, filePath);
      if (relativePath.toLowerCase().includes(normalizedQuery)) {
        matches.push(`${relativePath}: filename match`);
        continue;
      }

      try {
        const content = await this.readTextFile(filePath);
        const lineMatches = this.findLineMatches(content, normalizedQuery)
          .slice(0, 3)
          .map((line) => `${relativePath}:${line.lineNumber}: ${line.text}`);
        matches.push(...lineMatches);
      } catch {
        // Ignore files that cannot be decoded as text.
      }

      if (matches.length >= 40) {
        break;
      }
    }

    return {
      observation: matches.length > 0 ?
        [`Search results for "${query}":`, ...matches].join('\n') :
        `No workspace matches found for "${query}".`,
    };
  }

  private findLineMatches(
    content: string,
    normalizedQuery: string,
  ): Array<{lineNumber: number, text: string}> {
    const results: Array<{lineNumber: number, text: string}> = [];
    const lines = content.split(/\r?\n/);

    lines.forEach((line, index) => {
      if (line.toLowerCase().includes(normalizedQuery)) {
        results.push({
          lineNumber: index + 1,
          text: line.trim().slice(0, 180),
        });
      }
    });

    return results;
  }

  private async toolFileOutline(requestedPath: string): Promise<ToolResult> {
    if (!this.workspaceRoot) {
      return { observation: 'No workspace is open.' };
    }

    const filePath = await this.resolveWorkspacePath(
      path.isAbsolute(requestedPath) ?
        requestedPath :
        path.join(this.workspaceRoot, requestedPath),
    );
    const content = await this.readTextFile(filePath);
    const relativePath = path.relative(this.workspaceRoot, filePath);
    const imports = this.extractMatches(
      content,
      /^\s*import\s+.+?from\s+['"](.+?)['"];?/gm,
    );
    const classes = this.extractMatches(
      content,
      /^\s*(?:export\s+)?class\s+([A-Za-z0-9_]+)/gm,
    );
    const functions = this.extractMatches(
      content,
      /^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_]+)/gm,
    );
    const methods = this.extractMatches(
      content,
      /^\s*(?:private|public|protected)?\s*(?:async\s+)?([A-Za-z0-9_]+)\([^)]*\)\s*[:{]/gm,
    ).filter((name) => !['if', 'for', 'while', 'switch'].includes(name));
    const ipcHandlers = this.extractMatches(
      content,
      /ipcMain\.handle\(\s*['"](.+?)['"]/gm,
    );

    return {
      observation: [
        `Outline for ${relativePath}:`,
        `imports: ${imports.slice(0, 12).join(', ') || 'none'}`,
        `classes: ${classes.slice(0, 12).join(', ') || 'none'}`,
        `functions: ${functions.slice(0, 12).join(', ') || 'none'}`,
        `methods: ${methods.slice(0, 20).join(', ') || 'none'}`,
        `ipc handlers: ${ipcHandlers.slice(0, 20).join(', ') || 'none'}`,
      ].join('\n'),
      content,
      filePath,
    };
  }

  private async toolWriteFile(
    requestedPath: string,
    content: string,
    overwrite: boolean,
  ): Promise<ToolResult> {
    if (!this.workspaceRoot) {
      return { observation: 'No workspace is open.' };
    }

    const filePath = await this.resolveWorkspacePath(
      path.isAbsolute(requestedPath) ?
        requestedPath :
        path.join(this.workspaceRoot, requestedPath),
    );
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, {
      encoding: 'utf-8',
      flag: overwrite ? 'w' : 'wx',
    });
    const tree = await this.buildWorkspaceTree(this.workspaceRoot);
    return {
      observation: `Wrote ${path.relative(this.workspaceRoot, filePath)}.`,
      content,
      filePath,
      tree,
    };
  }

  private async toolReplaceInFile(
    requestedPath: string,
    findText: string,
    replaceText: string,
    expectedReplacements: number | null,
  ): Promise<ToolResult> {
    if (!this.workspaceRoot) {
      return { observation: 'No workspace is open.' };
    }

    const filePath = await this.resolveWorkspacePath(
      path.isAbsolute(requestedPath) ?
        requestedPath :
        path.join(this.workspaceRoot, requestedPath),
    );
    const content = await this.readTextFile(filePath);
    const occurrences = this.countOccurrences(content, findText);
    if (occurrences === 0) {
      return {
        observation: `No exact match found in ${requestedPath}. Use read_file first and try an exact snippet.`,
      };
    }

    if (expectedReplacements !== null && occurrences !== expectedReplacements) {
      return {
        observation: `Expected ${expectedReplacements} replacements but found ${occurrences}. Refine the exact find text.`,
      };
    }

    const updatedContent = content.split(findText).join(replaceText);
    await fs.writeFile(filePath, updatedContent, 'utf-8');
    return {
      observation: `Replaced ${occurrences} occurrence(s) in ${path.relative(this.workspaceRoot, filePath)}.`,
      content: updatedContent,
      filePath,
    };
  }

  private countOccurrences(content: string, needle: string): number {
    if (!needle) {
      return 0;
    }

    return content.split(needle).length - 1;
  }

  private async toolAppendFile(
    requestedPath: string,
    content: string,
  ): Promise<ToolResult> {
    if (!this.workspaceRoot) {
      return { observation: 'No workspace is open.' };
    }

    const filePath = await this.resolveWorkspacePath(
      path.isAbsolute(requestedPath) ?
        requestedPath :
        path.join(this.workspaceRoot, requestedPath),
    );
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.appendFile(filePath, content, 'utf-8');
    const updatedContent = await this.readTextFile(filePath);
    const tree = await this.buildWorkspaceTree(this.workspaceRoot);
    return {
      observation: `Appended to ${path.relative(this.workspaceRoot, filePath)}.`,
      content: updatedContent,
      filePath,
      tree,
    };
  }

  private async toolRunNpmScript(script: string): Promise<ToolResult> {
    if (!this.workspaceRoot) {
      return { observation: 'No workspace is open.' };
    }

    const allowedScripts = new Set(['build', 'lint', 'test', 'smoke-test']);
    if (!allowedScripts.has(script)) {
      return {
        observation: `Script "${script}" is not allowed. Allowed scripts: ${Array.from(allowedScripts).join(', ')}.`,
      };
    }

    const packageJsonPath = path.join(this.workspaceRoot, 'package.json');
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
    if (!packageJson.scripts?.[script]) {
      return { observation: `package.json has no script named "${script}".` };
    }

    const result = await this.runProcess('npm', ['run', script], this.workspaceRoot, 120000);
    return {
      observation: [
        `npm run ${script} exited with code ${result.exitCode}.`,
        result.output,
      ].join('\n'),
    };
  }

  private async runProcess(
    command: string,
    args: string[],
    cwd: string,
    timeoutMs: number,
  ): Promise<{exitCode: number | null, output: string}> {
    return await new Promise((resolve) => {
      let timedOut = false;
      const child = spawn(command, args, {
        cwd,
        shell: false,
      });
      const chunks: string[] = [];
      const timeout = setTimeout(() => {
        timedOut = true;
        child.kill();
      }, timeoutMs);

      child.stdout?.on('data', (data: Buffer) => {
        chunks.push(data.toString());
      });
      child.stderr?.on('data', (data: Buffer) => {
        chunks.push(data.toString());
      });
      child.on('error', (error) => {
        clearTimeout(timeout);
        resolve({ exitCode: 1, output: error.message });
      });
      child.on('exit', (code) => {
        clearTimeout(timeout);
        resolve({
          exitCode: code,
          output: this.truncateObservation(
            timedOut ?
              `${chunks.join('')}\nProcess timed out after ${timeoutMs}ms.` :
              chunks.join(''),
          ),
        });
      });
    });
  }

  private async createToolWorkspaceSummary(): Promise<string> {
    if (!this.workspaceRoot) {
      return 'No workspace is open.';
    }

    const files = await this.collectWorkspaceFiles(this.workspaceRoot);
    const relativeFiles = files
      .map((filePath) => path.relative(this.workspaceRoot!, filePath))
      .slice(0, 80);
    return relativeFiles.map((filePath) => `- ${filePath}`).join('\n');
  }

  private truncateObservation(content: string): string {
    const maxLength = 5000;
    if (content.length <= maxLength) {
      return content;
    }

    return `${content.slice(0, maxLength)}\n[truncated]`;
  }

  private async searchWeb(query: string): Promise<string> {
    if (!query) {
      return 'Tell me what to search for, for example: web search Electron IPC.';
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const url = new URL('https://api.duckduckgo.com/');
      url.searchParams.set('q', query);
      url.searchParams.set('format', 'json');
      url.searchParams.set('no_html', '1');
      url.searchParams.set('skip_disambig', '1');
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`Search failed with HTTP ${response.status}`);
      }

      const data = await response.json() as any;
      const results = this.formatSearchResults(query, data);
      return results || `No useful web results found for "${query}".`;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return `Web search failed for "${query}": ${detail}`;
    } finally {
      clearTimeout(timeout);
    }
  }

  private formatSearchResults(query: string, data: any): string {
    const lines = [`Web search results for "${query}":`];
    if (data.AbstractText) {
      lines.push(`- ${data.AbstractText}`);
      if (data.AbstractURL) {
        lines.push(`  ${data.AbstractURL}`);
      }
    }

    const relatedTopics = Array.isArray(data.RelatedTopics) ?
      data.RelatedTopics :
      [];
    for (const topic of relatedTopics.slice(0, 5)) {
      if (topic.Text) {
        lines.push(`- ${topic.Text}`);
        if (topic.FirstURL) {
          lines.push(`  ${topic.FirstURL}`);
        }
      }
    }

    return lines.length > 1 ? lines.join('\n') : '';
  }

  private extractMatches(content: string, pattern: RegExp): string[] {
    const matches: string[] = [];
    for (const match of content.matchAll(pattern)) {
      if (match[1]) {
        matches.push(match[1]);
      }
    }

    return matches;
  }

  private async processAgenticInstruction(instruction: string, context: any): Promise<string> {
    const response = await this.processChatWithContext(
      instruction,
      [],
      context,
    );
    return response.message;
  }

  private async startModelIfNeeded(): Promise<void> {
    if (this.modelReady) {
      if (await this.isOllamaReachable()) {
        return;
      }

      this.modelReady = false;
    }

    this.modelStartError = null;

    if (await this.isOllamaReachable()) {
      this.modelReady = true;
      return;
    }

    await this.startOllamaServer();
  }

  private async isOllamaReachable(): Promise<boolean> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1000);

    try {
      const response = await fetch('http://127.0.0.1:11434', {
        signal: controller.signal,
      });
      return response.ok || response.status === 404;
    } catch {
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async startOllamaServer(): Promise<void> {
    if (this.ollamaProcess) {
      await this.waitForOllamaStartup(this.ollamaProcess);
      return;
    }

    const command = await this.resolveOllamaCommand();
    const server = spawn(command, ['serve'], {
      stdio: 'ignore',
      shell: false,
    });

    this.ollamaProcess = server;
    await this.waitForOllamaStartup(server);
  }

  private async waitForOllamaStartup(server: ChildProcess): Promise<void> {
    const timeoutMs = 15000;

    await new Promise<void>((resolve, reject) => {
      let interval: ReturnType<typeof setInterval> | null = null;
      let timeout: ReturnType<typeof setTimeout> | null = null;

      const cleanup = () => {
        if (interval) {
          clearInterval(interval);
        }
        if (timeout) {
          clearTimeout(timeout);
        }
        server.off('error', onError);
        server.off('exit', onExit);
      };

      const fail = (error: Error) => {
        cleanup();
        this.modelStartError = error.message;
        this.modelReady = false;
        if (this.ollamaProcess === server) {
          this.ollamaProcess = null;
        }
        reject(error);
      };

      const onError = (error: Error) => {
        fail(new Error(`Could not start Ollama: ${error.message}`));
      };

      const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
        fail(new Error(
          `Ollama exited before it was ready (code: ${code ?? 'none'}, ` +
          `signal: ${signal ?? 'none'}).`,
        ));
      };

      const poll = async () => {
        if (await this.isOllamaReachable()) {
          cleanup();
          this.modelReady = true;
          this.modelStartError = null;
          server.once('exit', () => {
            if (this.ollamaProcess === server) {
              this.ollamaProcess = null;
              this.modelReady = false;
            }
          });
          resolve();
        }
      };

      server.once('error', onError);
      server.once('exit', onExit);
      interval = setInterval(() => {
        void poll();
      }, 300);
      timeout = setTimeout(() => {
        fail(new Error(
          'Ollama server could not be started in time. Please verify ' +
          'Ollama is installed and can run `ollama serve`.',
        ));
      }, timeoutMs);
      void poll();
    });
  }

  private async resolveOllamaCommand(): Promise<string> {
    const configuredPath = process.env.NMFA_OLLAMA_PATH ||
      process.env.OLLAMA_PATH;
    if (configuredPath) {
      await this.assertExecutable(configuredPath);
      return configuredPath;
    }

    const fromPath = await this.findExecutableInPath('ollama');
    if (fromPath) {
      return fromPath;
    }

    for (const candidate of [
      '/usr/local/bin/ollama',
      '/opt/homebrew/bin/ollama',
      '/usr/bin/ollama',
      '/bin/ollama',
    ]) {
      if (await this.isExecutable(candidate)) {
        return candidate;
      }
    }

    throw new Error(
      'Ollama executable was not found. Install Ollama or set ' +
      'NMFA_OLLAMA_PATH to the full executable path.',
    );
  }

  private async findExecutableInPath(command: string): Promise<string | null> {
    const pathValue = process.env.PATH || '';
    const extensions = process.platform === 'win32' ? ['.exe', '.cmd', ''] :
      [''];

    for (const directory of pathValue.split(path.delimiter)) {
      if (!directory) {
        continue;
      }

      for (const extension of extensions) {
        const candidate = path.join(directory, `${command}${extension}`);
        if (await this.isExecutable(candidate)) {
          return candidate;
        }
      }
    }

    return null;
  }

  private async assertExecutable(filePath: string): Promise<void> {
    if (await this.isExecutable(filePath)) {
      return;
    }

    throw new Error(`Ollama executable is not runnable: ${filePath}`);
  }

  private async isExecutable(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath, fsConstants.X_OK);
      return true;
    } catch {
      return false;
    }
  }

  private async readTextFile(filePath: string): Promise<string> {
    const fileStat = await fs.stat(filePath);
    if (!fileStat.isFile()) {
      throw new Error('Selected path is not a file');
    }

    if (fileStat.size > 5 * 1024 * 1024) {
      throw new Error('Selected file is too large to open safely');
    }

    return await fs.readFile(filePath, 'utf-8');
  }

  private async resolveWorkspacePath(filePath: string): Promise<string> {
    if (!filePath || typeof filePath !== 'string') {
      throw new Error('Invalid file path');
    }

    const normalizedPath = path.resolve(filePath);
    if (!this.workspaceRoot) {
      return normalizedPath;
    }

    const workspacePath = path.resolve(this.workspaceRoot);
    const relativePath = path.relative(workspacePath, normalizedPath);
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      throw new Error('File is outside the active workspace');
    }

    return normalizedPath;
  }

  private truncateForAgent(content: string): string {
    const maxLength = Math.min(this.maxAgentFileBytes, 6000);
    if (content.length <= maxLength) {
      return content;
    }

    return content.slice(0, maxLength) +
      '\n\n[Content truncated for context size]';
  }

  private async collectWorkspaceFiles(
    directoryPath: string,
    depth: number = 0,
    files: string[] = [],
  ): Promise<string[]> {
    if (depth > 6 || files.length >= this.maxTreeEntries) {
      return files;
    }

    const entries = await fs.readdir(directoryPath, { withFileTypes: true });
    const sortedEntries = entries.sort((left, right) =>
      left.name.localeCompare(right.name));

    for (const entry of sortedEntries) {
      const entryPath = path.join(directoryPath, entry.name);
      if (entry.isFile() &&
          this.supportedFileExtensions.has(
            path.extname(entry.name).toLowerCase(),
          )) {
        files.push(entryPath);
      } else if (entry.isDirectory() &&
          !this.ignoredFolderNames.has(entry.name)) {
        await this.collectWorkspaceFiles(entryPath, depth + 1, files);
      }

      if (files.length >= this.maxTreeEntries) {
        break;
      }
    }

    return files;
  }

  private async buildWorkspaceTree(
    rootPath: string,
    depth: number = 0,
    counter: {count: number} = { count: 0 },
  ): Promise<WorkspaceTreeNode> {
    const stats = await fs.stat(rootPath);
    const node: WorkspaceTreeNode = {
      name: path.basename(rootPath) || rootPath,
      path: rootPath,
      type: stats.isDirectory() ? 'directory' : 'file',
    };

    if (!stats.isDirectory() || depth > 6 || counter.count >= this.maxTreeEntries) {
      return node;
    }

    const entries = await fs.readdir(rootPath, { withFileTypes: true });
    const sortedEntries = entries.sort((left, right) => {
      if (left.isDirectory() !== right.isDirectory()) {
        return left.isDirectory() ? -1 : 1;
      }

      return left.name.localeCompare(right.name);
    });

    node.children = [];
    for (const entry of sortedEntries) {
      if (this.ignoredFolderNames.has(entry.name)) {
        continue;
      }

      if (!entry.isDirectory() &&
          !this.supportedFileExtensions.has(
            path.extname(entry.name).toLowerCase(),
          )) {
        continue;
      }

      counter.count += 1;
      if (counter.count > this.maxTreeEntries) {
        break;
      }

      node.children.push(await this.buildWorkspaceTree(
        path.join(rootPath, entry.name),
        depth + 1,
        counter,
      ));
    }

    return node;
  }

  private formatTree(node: WorkspaceTreeNode, depth: number = 0): string {
    const prefix = depth === 0 ? '' : `${'  '.repeat(depth - 1)}- `;
    const suffix = node.type === 'directory' ? '/' : '';
    const lines = [`${prefix}${node.name}${suffix}`];

    for (const child of node.children || []) {
      lines.push(this.formatTree(child, depth + 1));
    }

    return lines.join('\n');
  }

  private async findFirstSupportedFile(
    directoryPath: string,
    depth: number = 0,
  ): Promise<string | null> {
    if (depth > 6) {
      return null;
    }

    const entries = await fs.readdir(directoryPath, { withFileTypes: true });
    const sortedEntries = entries.sort((left, right) =>
      left.name.localeCompare(right.name));

    for (const entry of sortedEntries) {
      if (entry.isFile() &&
          this.supportedFileExtensions.has(
            path.extname(entry.name).toLowerCase(),
          )) {
        return path.join(directoryPath, entry.name);
      }
    }

    for (const entry of sortedEntries) {
      if (!entry.isDirectory() || this.ignoredFolderNames.has(entry.name)) {
        continue;
      }

      const filePath = await this.findFirstSupportedFile(
        path.join(directoryPath, entry.name),
        depth + 1,
      );
      if (filePath) {
        return filePath;
      }
    }

    return null;
  }

  private shutdownModel(): void {
    if (this.ollamaProcess) {
      this.ollamaProcess.kill();
      this.ollamaProcess = null;
      this.modelReady = false;
    }
  }
}

// Start the application
new MainApp();
