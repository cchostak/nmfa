import { AgentActivity, ChatPanel } from './chat';

type WorkspaceTreeNode = {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: WorkspaceTreeNode[];
};

/**
 * Renderer process for the IDE.
 * Initializes the editor shell and handles UI interactions.
 */
class RendererApp {
  private editor: {
    getValue: () => string;
    setValue: (value: string) => void;
  } | null = null;
  private chatPanel: ChatPanel | null = null;
  private currentFilePath: string | null = null;
  private workspaceRoot: string | null = null;
  private workspaceTree: WorkspaceTreeNode | null = null;

  constructor() {
    this.init();
  }

  private init(): void {
    const initialize = () => {
      this.createChatPanel();
      this.createEditor();
      this.setupToolbar();
      this.refreshModelStatus();
    };

    if (document.readyState === 'loading') {
      window.addEventListener('DOMContentLoaded', initialize, { once: true });
      return;
    }

    initialize();
  }

  private createEditor(): void {
    const container = document.getElementById('editor');
    if (!container) {
      console.error('Editor container not found');
      return;
    }

    this.createFallbackEditor(`// Welcome to NMFA IDE - Local AI-Powered Editor
// Try these features:
// 1. Click "Open File" to load a TypeScript/JavaScript file
// 2. Use the chat panel to ask questions or give instructions
// 3. Try agentic commands like "refactor this code" or "add error handling"

function greet(name: string): string {
  return \`Hello, \${name}!\`;
}

console.log(greet("World"));`);
  }

  private createFallbackEditor(initialValue: string = ''): void {
    const container = document.getElementById('editor');
    if (!container) {
      return;
    }

    container.innerHTML = `
      <textarea id="fallback-editor" style="width: 100%; height: 100%; background: #1e1e1e; color: white; border: none; padding: 12px; font-family: monospace; font-size: 13px; resize: none;"></textarea>
    `;

    const textarea = document.getElementById(
      'fallback-editor',
    ) as HTMLTextAreaElement;
    textarea.value = initialValue;
    this.editor = {
      getValue: () => textarea.value,
      setValue: (value: string) => {
        textarea.value = value;
      },
    };
  }

  private getEditorValue(): string {
    if (this.editor) {
      return this.editor.getValue();
    }

    const fallback = document.getElementById('fallback-editor') as HTMLTextAreaElement;
    return fallback ? fallback.value : '';
  }

  private setEditorValue(value: string): void {
    if (this.editor) {
      this.editor.setValue(value);
      return;
    }

    const fallback = document.getElementById('fallback-editor') as HTMLTextAreaElement;
    if (fallback) {
      fallback.value = value;
    }
  }

  private createChatPanel(): void {
    const container = document.getElementById('chat-container');
    if (container) {
      this.chatPanel = new ChatPanel(container, async (
        message,
        history,
        requestId,
      ) => {
        return await this.handleChatMessage(message, history, requestId);
      });
      const api = (window as any).electronAPI;
      if (api.onAgentActivity) {
        api.onAgentActivity((event: AgentActivity) => {
          this.chatPanel?.addActivity(event);
        });
      }
    }
  }

  private setupToolbar(): void {
    const openButton = document.getElementById('open-file') as HTMLButtonElement;
    const openFolderButton = document.getElementById('open-folder') as HTMLButtonElement;
    const startModelButton = document.getElementById('start-model') as HTMLButtonElement;
    const saveButton = document.getElementById('save-file') as HTMLButtonElement;

    if (!openButton || !openFolderButton || !startModelButton || !saveButton) {
      console.error('Toolbar controls are missing from the document');
      return;
    }

    openButton.addEventListener('click', () => this.openFile());
    openFolderButton.addEventListener('click', () => this.openFolder());
    startModelButton.addEventListener('click', () => this.startModel());
    saveButton.addEventListener('click', () => this.saveFile());
  }

  private async openFile(): Promise<void> {
    try {
      const result = await (window as any).electronAPI.openFile();
      if (result.success) {
        this.loadFileResult(result);
      } else {
        alert('Failed to open file: ' + result.error);
      }
    } catch (error) {
      alert('Error opening file: ' + error);
    }
  }

  private async openFolder(): Promise<void> {
    try {
      const result = await (window as any).electronAPI.openFolder();
      if (result.success) {
        this.loadFileResult(result);
      } else {
        alert('Failed to open folder: ' + result.error);
      }
    } catch (error) {
      alert('Error opening folder: ' + error);
    }
  }

  private async saveFile(): Promise<void> {
    if (!this.currentFilePath) {
      alert('No file is currently open');
      return;
    }

    try {
      const content = this.getEditorValue();
      const result = await (window as any).electronAPI.saveFile(content, this.currentFilePath);
      if (result.success) {
        alert('File saved successfully');
      } else {
        alert('Failed to save file: ' + result.error);
      }
    } catch (error) {
      alert('Error saving file: ' + error);
    }
  }

  private async startModel(): Promise<void> {
    try {
      const result = await (window as any).electronAPI.startModel();
      if (result.success) {
        this.updateModelStatus(result.running ? 'Model started and ready' : 'Model starting...');
      } else {
        this.updateModelStatus('Model failed to start: ' + result.error);
      }
    } catch (error) {
      this.updateModelStatus('Error starting model: ' + error);
    }
  }

  private async refreshModelStatus(): Promise<void> {
    try {
      const status = await (window as any).electronAPI.getModelStatus();
      this.updateModelStatus(status.running ? 'Model running' : 'Model not started');
    } catch (error) {
      this.updateModelStatus('Model status unavailable');
    }
  }

  private updateModelStatus(message: string): void {
    const statusElement = document.getElementById('model-status');
    if (statusElement) {
      statusElement.textContent = message;
    }
  }

  private updateFileStatus(filePath: string, workspace?: string): void {
    const fileStatus = document.getElementById('current-file')!;
    const fileName = filePath.split('/').pop() || filePath;
    if (workspace) {
      const workspaceName = workspace.split('/').pop() || workspace;
      fileStatus.textContent = `Workspace: ${workspaceName} • Editing: ${fileName}`;
      return;
    }

    fileStatus.textContent = `Editing: ${fileName}`;
  }

  private loadFileResult(result: any): void {
    this.currentFilePath = result.filePath;
    this.workspaceRoot = result.workspace || this.workspaceRoot;
    this.setEditorValue(result.content);
    this.updateFileStatus(result.filePath, result.workspace);

    if (result.tree) {
      this.workspaceTree = result.tree;
      this.renderWorkspaceTree();
    } else {
      this.updateActiveTreeItem();
    }
  }

  private renderWorkspaceTree(): void {
    const treeContainer = document.getElementById('file-tree');
    if (!treeContainer) {
      return;
    }

    treeContainer.textContent = '';
    if (!this.workspaceTree) {
      const empty = document.createElement('div');
      empty.className = 'file-tree-empty';
      empty.textContent = 'Open a folder to browse files';
      treeContainer.appendChild(empty);
      return;
    }

    treeContainer.appendChild(this.createTreeNode(this.workspaceTree, 0));
    this.updateActiveTreeItem();
  }

  private createTreeNode(
    node: WorkspaceTreeNode,
    depth: number,
  ): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'tree-node-wrapper';

    const row = document.createElement('button');
    row.type = 'button';
    row.className = `tree-node tree-node-${node.type}`;
    row.dataset.path = node.path;
    row.style.paddingLeft = `${8 + depth * 14}px`;
    row.textContent = `${node.type === 'directory' ? '[D]' : '[F]'} ${node.name}`;

    if (node.type === 'file') {
      row.addEventListener('click', () => {
        void this.openWorkspaceFile(node.path);
      });
    } else {
      row.disabled = true;
    }

    wrapper.appendChild(row);

    for (const child of node.children || []) {
      wrapper.appendChild(this.createTreeNode(child, depth + 1));
    }

    return wrapper;
  }

  private async openWorkspaceFile(filePath: string): Promise<void> {
    try {
      const result = await (window as any).electronAPI.openWorkspaceFile(
        filePath,
      );
      if (result.success) {
        this.loadFileResult(result);
        return;
      }

      alert('Failed to open file: ' + result.error);
    } catch (error) {
      alert('Error opening file: ' + error);
    }
  }

  private updateActiveTreeItem(): void {
    const treeContainer = document.getElementById('file-tree');
    if (!treeContainer) {
      return;
    }

    const rows = treeContainer.querySelectorAll('.tree-node');
    rows.forEach((row) => {
      const element = row as HTMLElement;
      element.classList.toggle(
        'active',
        element.dataset.path === this.currentFilePath,
      );
    });
  }

  private async handleChatMessage(
    message: string,
    history: Array<{role: string, content: string}>,
    requestId: string,
  ): Promise<string> {
    const context = {
      code: this.getEditorValue(),
      filePath: this.currentFilePath,
      language: 'typescript',
      workspace: this.workspaceRoot,
    };

    const result = await (window as any).electronAPI.chatWithContext(
      message,
      history,
      context,
      requestId,
    );
    if (result.success) {
      const response = result.response;
      if (response && typeof response === 'object') {
        if (response.filePath && typeof response.content === 'string') {
          this.loadFileResult(response);
        } else if (response.tree) {
          this.workspaceTree = response.tree;
          this.renderWorkspaceTree();
        }

        return response.message || 'Done.';
      }

      return response;
    }

    return 'Error: ' + result.error;
  }
}

// Start the renderer app
new RendererApp();
