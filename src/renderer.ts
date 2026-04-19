import * as monaco from 'monaco-editor';
import { ChatPanel } from './chat';
import { CompletionProvider } from './completion';

/**
 * Renderer process for the IDE.
 * Initializes Monaco Editor and handles UI interactions.
 */
class RendererApp {
  private editor: monaco.editor.IStandaloneCodeEditor | null = null;
  private chatPanel: ChatPanel | null = null;
  private completionProvider: CompletionProvider | null = null;
  private currentFilePath: string | null = null;

  constructor() {
    this.init();
  }

  private init(): void {
    window.addEventListener('DOMContentLoaded', () => {
      this.createChatPanel();
      this.createEditor();
      this.setupToolbar();
      this.refreshModelStatus();
    });
  }

  private createEditor(): void {
    const container = document.getElementById('editor');
    if (!container) {
      console.error('Editor container not found');
      return;
    }

    try {
      this.editor = monaco.editor.create(container, {
        value: `// Welcome to NMFA IDE - Local AI-Powered Editor
// Try these features:
// 1. Click "Open File" to load a TypeScript/JavaScript file
// 2. Use the chat panel to ask questions or give instructions
// 3. Try agentic commands like "refactor this code" or "add error handling"

function greet(name: string): string {
  return \`Hello, \${name}!\`;
}

console.log(greet("World"));`,
        language: 'typescript',
        theme: 'vs-dark',
        fontSize: 14,
        minimap: { enabled: false },
      });
      this.setupCompletion();
    } catch (error) {
      console.error('Monaco initialization failed:', error);
      this.createFallbackEditor();
    }
  }

  private createFallbackEditor(): void {
    const container = document.getElementById('editor');
    if (!container) {
      return;
    }

    container.innerHTML = `
      <textarea id="fallback-editor" style="width: 100%; height: 100%; background: #1e1e1e; color: white; border: none; padding: 12px; font-family: monospace; font-size: 13px; resize: none;"></textarea>
    `;
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
      this.chatPanel = new ChatPanel(container, async (instruction: string) => {
        await this.handleAgenticInstruction(instruction);
      });
    }
  }

  private setupCompletion(): void {
    this.completionProvider = new CompletionProvider();
    this.completionProvider.register();
  }

  private setupToolbar(): void {
    const openButton = document.getElementById('open-file') as HTMLButtonElement;
    const openFolderButton = document.getElementById('open-folder') as HTMLButtonElement;
    const startModelButton = document.getElementById('start-model') as HTMLButtonElement;
    const saveButton = document.getElementById('save-file') as HTMLButtonElement;

    openButton.addEventListener('click', () => this.openFile());
    openFolderButton.addEventListener('click', () => this.openFolder());
    startModelButton.addEventListener('click', () => this.startModel());
    saveButton.addEventListener('click', () => this.saveFile());
  }

  private async openFile(): Promise<void> {
    try {
      const result = await (window as any).electronAPI.openFile();
      if (result.success) {
        this.currentFilePath = result.filePath;
        this.setEditorValue(result.content);
        this.updateFileStatus(result.filePath, result.workspace);
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
        this.currentFilePath = result.filePath;
        this.setEditorValue(result.content);
        this.updateFileStatus(result.filePath, result.workspace);
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

  private async handleAgenticInstruction(instruction: string): Promise<void> {
    const code = this.editor?.getValue() || '';
    const context = {
      code: code,
      filePath: this.currentFilePath,
      language: 'typescript'
    };

    try {
      const result = await (window as any).electronAPI.executeAgenticInstruction(instruction, context);
      if (result.success) {
        // Show the AI's suggestion in the chat
        this.chatPanel?.addAISuggestion(result.response);
      } else {
        this.chatPanel?.addError('Failed to execute instruction: ' + result.error);
      }
    } catch (error) {
      this.chatPanel?.addError('Error executing agentic instruction: ' + error);
    }
  }
}

// Start the renderer app
new RendererApp();