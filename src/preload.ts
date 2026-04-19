import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  openFile: () => ipcRenderer.invoke('open-file'),
  openFolder: () => ipcRenderer.invoke('open-folder'),
  saveFile: (content: string, filePath: string) => ipcRenderer.invoke('save-file', content, filePath),
  readFile: (filePath: string) => ipcRenderer.invoke('read-file', filePath),
  executeAgenticInstruction: (instruction: string, context: any) => ipcRenderer.invoke('execute-agentic-instruction', instruction, context),
  startModel: () => ipcRenderer.invoke('start-model'),
  getModelStatus: () => ipcRenderer.invoke('get-model-status'),
  getVersion: () => ipcRenderer.invoke('get-version'),
});
