import { OllamaService } from './ollama';

/**
 * Chat panel implementation.
 * Provides AI chat interface with streaming responses.
 */
export class ChatPanel {
  private ollama: OllamaService;
  private messages: Array<{role: string, content: string}> = [];
  private container: HTMLElement;
  private onAgenticInstruction?: (instruction: string) => Promise<void>;

  constructor(container: HTMLElement, onAgenticInstruction?: (instruction: string) => Promise<void>) {
    this.container = container;
    this.ollama = new OllamaService();
    this.onAgenticInstruction = onAgenticInstruction;
    this.init();
  }

  private init(): void {
    this.container.innerHTML = `
      <div id="chat-panel" style="display: flex; flex-direction: column; height: 100%; background: #1e1e1e; color: white;">
        <div id="chat-messages" style="flex: 1; overflow-y: auto; padding: 10px;"></div>
        <div id="chat-input-area" style="padding: 10px; border-top: 1px solid #333;">
          <input type="text" id="chat-input" placeholder="Ask questions or give instructions like 'refactor this code'..." style="width: 80%; padding: 8px; background: #2d2d2d; color: white; border: 1px solid #555;">
          <button id="chat-send" style="width: 18%; padding: 8px; background: #007acc; color: white; border: none; cursor: pointer;">Send</button>
        </div>
      </div>
    `;

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    const input = this.container.querySelector('#chat-input') as HTMLInputElement;
    const sendButton = this.container.querySelector('#chat-send') as HTMLButtonElement;

    const sendMessage = async () => {
      const message = input.value.trim();
      if (!message) return;

      this.addMessage('user', message);
      input.value = '';

      // Check if this is an agentic instruction
      if (this.isAgenticInstruction(message)) {
        await this.handleAgenticInstruction(message);
      } else {
        // Regular chat
        this.addMessage('assistant', 'Thinking...');

        try {
          this.messages.push({ role: 'user', content: message });
          const response = await this.ollama.chat(this.messages);
          this.messages.push({ role: 'assistant', content: response });

          this.updateLastMessage(response);
        } catch (error) {
          this.updateLastMessage('Sorry, I encountered an error.');
        }
      }
    };

    sendButton.addEventListener('click', sendMessage);
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        sendMessage();
      }
    });
  }

  private isAgenticInstruction(message: string): boolean {
    const agenticKeywords = ['refactor', 'add', 'fix', 'optimize', 'implement', 'create', 'modify', 'change'];
    return agenticKeywords.some(keyword => message.toLowerCase().includes(keyword));
  }

  private async handleAgenticInstruction(instruction: string): Promise<void> {
    if (this.onAgenticInstruction) {
      this.addMessage('assistant', 'Processing your instruction...');
      await this.onAgenticInstruction(instruction);
    }
  }

  private addMessage(role: string, content: string): void {
    const messagesDiv = this.container.querySelector('#chat-messages')!;
    const messageDiv = document.createElement('div');
    messageDiv.style.marginBottom = '10px';
    messageDiv.style.padding = '8px';
    messageDiv.style.borderRadius = '4px';
    messageDiv.style.background = role === 'user' ? '#007acc' : '#2d2d2d';
    messageDiv.innerHTML = `<strong>${role === 'user' ? 'You' : 'AI'}:</strong> ${content}`;
    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  private updateLastMessage(content: string): void {
    const messagesDiv = this.container.querySelector('#chat-messages')!;
    const lastMessage = messagesDiv.lastElementChild as HTMLElement;
    if (lastMessage) {
      lastMessage.innerHTML = `<strong>AI:</strong> ${content}`;
    }
  }

  public addAISuggestion(suggestion: string): void {
    this.addMessage('assistant', `Here's my suggestion:\n\n${suggestion}\n\nYou can apply this by replacing your code in the editor.`);
  }

  public addError(error: string): void {
    this.addMessage('assistant', `Error: ${error}`);
  }
}