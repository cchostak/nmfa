import { contextBridge, ipcRenderer } from 'electron';

const electronAPI = {
  openFile: () => ipcRenderer.invoke('open-file'),
  openFolder: () => ipcRenderer.invoke('open-folder'),
  openWorkspaceFile: (filePath: string) =>
    ipcRenderer.invoke('open-workspace-file', filePath),
  saveFile: (content: string, filePath: string) =>
    ipcRenderer.invoke('save-file', content, filePath),
  readFile: (filePath: string) => ipcRenderer.invoke('read-file', filePath),
  chatWithContext: (
    message: string,
    history: any[],
    context: any,
    requestId: string,
  ) => ipcRenderer.invoke('chat-with-context', message, history, context, requestId),
  onAgentActivity: (callback: (event: any) => void) => {
    const listener = (_event: any, payload: any) => callback(payload);
    ipcRenderer.on('agent-activity', listener);
    return () => ipcRenderer.removeListener('agent-activity', listener);
  },
  executeAgenticInstruction: (instruction: string, context: any) =>
    ipcRenderer.invoke('execute-agentic-instruction', instruction, context),
  startModel: () => ipcRenderer.invoke('start-model'),
  getModelStatus: () => ipcRenderer.invoke('get-model-status'),
  getVersion: () => ipcRenderer.invoke('get-version'),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Renderer code is loaded from preload so the browser page can keep Node.js
// disabled while still using the compiled CommonJS modules produced by tsc.
(window as unknown as {electronAPI: typeof electronAPI}).electronAPI =
  electronAPI;

void import('./renderer').catch((error) => {
  console.error('Unable to load renderer:', error);
});
