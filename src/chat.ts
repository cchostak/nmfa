export type AgentActivity = {
  requestId: string;
  state: string;
  step: number;
  title: string;
  detail?: string;
};

/**
 * Chat panel implementation.
 * Provides AI chat interface backed by the main-process agent.
 */
export class ChatPanel {
  private messages: Array<{role: string, content: string}> = [];
  private container: HTMLElement;
  private pending = false;
  private activeRequestId: string | null = null;
  private activeActivityList: HTMLElement | null = null;
  private activeAssistantText: Text | null = null;
  private onMessage: (
    message: string,
    history: Array<{role: string, content: string}>,
    requestId: string,
  ) => Promise<string>;

  constructor(
    container: HTMLElement,
    onMessage: (
      message: string,
      history: Array<{role: string, content: string}>,
      requestId: string,
    ) => Promise<string>,
  ) {
    this.container = container;
    this.onMessage = onMessage;
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
      if (!message || this.pending) return;

      this.pending = true;
      input.disabled = true;
      sendButton.disabled = true;
      this.addMessage('user', message);
      input.value = '';
      const requestId = this.createRequestId();
      this.activeRequestId = requestId;
      this.addAssistantActivityMessage();

      try {
        const response = await this.withTimeout(
          this.onMessage(message, this.messages, requestId),
          180000,
        );
        this.messages.push({ role: 'user', content: message });
        this.messages.push({ role: 'assistant', content: response });
        this.updateLastMessage(response);
      } catch (error) {
        this.updateLastMessage(
          error instanceof Error ? error.message :
            'Sorry, I encountered an error.',
        );
      } finally {
        this.pending = false;
        this.activeRequestId = null;
        this.activeActivityList = null;
        this.activeAssistantText = null;
        input.disabled = false;
        sendButton.disabled = false;
        input.focus();
      }
    };

    sendButton.addEventListener('click', sendMessage);
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        void sendMessage();
      }
    });
  }

  /**
   * Append one live agent activity item if it belongs to the active request.
   */
  public addActivity(event: AgentActivity): void {
    if (event.requestId !== this.activeRequestId || !this.activeActivityList) {
      return;
    }

    const item = document.createElement('div');
    item.style.marginTop = '6px';
    item.style.color = this.colorForState(event.state);
    item.textContent = `Step ${event.step}: ${event.title}`;
    if (event.detail) {
      const detail = document.createElement('div');
      detail.style.marginTop = '2px';
      detail.style.paddingLeft = '10px';
      detail.style.color = '#b8b8b8';
      detail.style.fontSize = '12px';
      detail.style.whiteSpace = 'pre-wrap';
      detail.textContent = event.detail.length > 900 ?
        `${event.detail.slice(0, 900)}\n[truncated]` :
        event.detail;
      item.appendChild(detail);
    }

    this.activeActivityList.appendChild(item);
    this.scrollToBottom();
  }

  private createRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  private addAssistantActivityMessage(): void {
    const messagesDiv = this.container.querySelector('#chat-messages')!;
    const messageDiv = document.createElement('div');
    messageDiv.style.marginBottom = '10px';
    messageDiv.style.padding = '8px';
    messageDiv.style.borderRadius = '4px';
    messageDiv.style.background = '#2d2d2d';
    messageDiv.style.whiteSpace = 'pre-wrap';

    const label = document.createElement('strong');
    label.textContent = 'AI: ';
    messageDiv.appendChild(label);
    this.activeAssistantText = document.createTextNode('Working...');
    messageDiv.appendChild(this.activeAssistantText);

    const activityList = document.createElement('div');
    activityList.style.marginTop = '8px';
    activityList.style.borderTop = '1px solid #444';
    activityList.style.paddingTop = '6px';
    activityList.style.fontSize = '12px';
    messageDiv.appendChild(activityList);

    messagesDiv.appendChild(messageDiv);
    this.activeActivityList = activityList;
    this.scrollToBottom();
  }

  private colorForState(state: string): string {
    if (state === 'acting') {
      return '#9bd1ff';
    }
    if (state === 'observing') {
      return '#c7e59c';
    }
    if (state === 'error') {
      return '#ff9b9b';
    }
    if (state === 'done') {
      return '#ffffff';
    }

    return '#d0d0d0';
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
  ): Promise<T> {
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const timeoutPromise = new Promise<T>((_, reject) => {
      timeout = setTimeout(() => {
        reject(new Error(
          'The agent loop is taking too long to respond. Try a smaller task ' +
          'or ask it to inspect fewer files.',
        ));
      }, timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }

  private addMessage(role: string, content: string): void {
    const messagesDiv = this.container.querySelector('#chat-messages')!;
    const messageDiv = document.createElement('div');
    messageDiv.style.marginBottom = '10px';
    messageDiv.style.padding = '8px';
    messageDiv.style.borderRadius = '4px';
    messageDiv.style.background = role === 'user' ? '#007acc' : '#2d2d2d';
    messageDiv.style.whiteSpace = 'pre-wrap';

    const label = document.createElement('strong');
    label.textContent = role === 'user' ? 'You: ' : 'AI: ';
    messageDiv.appendChild(label);
    messageDiv.appendChild(document.createTextNode(content));
    messagesDiv.appendChild(messageDiv);
    this.scrollToBottom();
  }

  private updateLastMessage(content: string): void {
    const messagesDiv = this.container.querySelector('#chat-messages')!;
    const lastMessage = messagesDiv.lastElementChild as HTMLElement;
    if (lastMessage) {
      if (this.activeAssistantText) {
        this.activeAssistantText.textContent = content;
        this.scrollToBottom();
        return;
      }

      lastMessage.textContent = '';

      const label = document.createElement('strong');
      label.textContent = 'AI: ';
      lastMessage.appendChild(label);
      lastMessage.appendChild(document.createTextNode(content));
    }
  }

  private scrollToBottom(): void {
    const messagesDiv = this.container.querySelector('#chat-messages')!;
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }
}
