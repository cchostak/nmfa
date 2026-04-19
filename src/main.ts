import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';

/**
 * Main entry point for the Electron application.
 * Handles window creation, local file access, and model startup.
 */
class MainApp {
  private mainWindow: BrowserWindow | null = null;
  private ollamaProcess: ChildProcess | null = null;
  private modelReady = false;

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
        nodeIntegration: true,
        contextIsolation: true,
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
          { name: 'All Files', extensions: ['*'] },
        ],
      });

      if (!result.canceled && result.filePaths.length > 0) {
        const selectedPath = result.filePaths[0];
        try {
          const content = await fs.readFile(selectedPath, 'utf-8');
          return { success: true, content, filePath: selectedPath };
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
          const entries = await fs.readdir(selectedPath);
          const sourceFile = entries.find((entry) =>
            entry.endsWith('.ts') ||
            entry.endsWith('.tsx') ||
            entry.endsWith('.js') ||
            entry.endsWith('.jsx')
          );

          if (!sourceFile) {
            return { success: false, error: 'No supported source files found in folder' };
          }

          const filePath = path.join(selectedPath, sourceFile);
          const content = await fs.readFile(filePath, 'utf-8');
          return { success: true, content, filePath, workspace: selectedPath };
        } catch (error) {
          return { success: false, error: (error as Error).message };
        }
      }

      return { success: false, error: 'No folder selected' };
    });

    ipcMain.handle('save-file', async (event, content: string, filePath: string) => {
      try {
        await fs.writeFile(filePath, content, 'utf-8');
        return { success: true };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle('read-file', async (event, filePath: string) => {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        return { success: true, content };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

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

    ipcMain.handle('get-model-status', () => {
      return { running: this.modelReady, pid: this.ollamaProcess?.pid ?? null };
    });

    ipcMain.handle('get-version', () => {
      return app.getVersion();
    });
  }

  private async processAgenticInstruction(instruction: string, context: any): Promise<string> {
    const { OllamaService } = await import('./ollama');
    const ollama = new OllamaService();

    let prompt = '';

    if (instruction.toLowerCase().includes('refactor')) {
      prompt = `Refactor this code to be more readable and maintainable:\n\n${context.code}\n\nProvide the refactored version:`;
    } else if (instruction.toLowerCase().includes('add') && instruction.toLowerCase().includes('function')) {
      prompt = `Add a ${instruction.split('add')[1].trim()} to this code:\n\n${context.code}\n\nProvide the updated code:`;
    } else if (instruction.toLowerCase().includes('fix') || instruction.toLowerCase().includes('bug')) {
      prompt = `Fix any bugs in this code:\n\n${context.code}\n\nProvide the fixed version:`;
    } else if (instruction.toLowerCase().includes('optimize')) {
      prompt = `Optimize this code for performance:\n\n${context.code}\n\nProvide the optimized version:`;
    } else {
      prompt = `${instruction}\n\nCode context:\n${context.code}\n\nProvide the result:`;
    }

    return await ollama.generate(prompt);
  }

  private async startModelIfNeeded(): Promise<void> {
    if (this.modelReady) {
      return;
    }

    if (await this.isOllamaReachable()) {
      this.modelReady = true;
      return;
    }

    await this.startOllamaServer();
  }

  private async isOllamaReachable(): Promise<boolean> {
    try {
      const response = await fetch('http://127.0.0.1:11434');
      return response.ok || response.status === 404;
    } catch {
      return false;
    }
  }

  private async startOllamaServer(): Promise<void> {
    if (this.ollamaProcess) {
      return;
    }

    const server = spawn('ollama', ['serve'], {
      stdio: 'ignore',
      shell: false,
    });

    this.ollamaProcess = server;

    const start = Date.now();
    const timeout = 7000;
    while (Date.now() - start < timeout) {
      if (await this.isOllamaReachable()) {
        this.modelReady = true;
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    throw new Error('Ollama server could not be started in time. Please verify it is installed.');
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
