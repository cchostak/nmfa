/**
 * Ollama API integration.
 * Handles communication with local Ollama server for Gemma 270M inference.
 */
export class OllamaService {
  private baseUrl: string;
  private requestTimeoutMs: number;

  constructor(
    baseUrl: string = 'http://127.0.0.1:11434',
    requestTimeoutMs: number = 20000,
  ) {
    this.baseUrl = baseUrl;
    this.requestTimeoutMs = requestTimeoutMs;
  }

  /**
   * Generate completion for a prompt.
   */
  async generate(prompt: string, model: string = 'gemma:2b'): Promise<string> {
    try {
      const response = await this.postJson('/api/generate', {
        model: model,
        prompt: prompt,
        stream: false,
        options: {
          num_predict: 384,
        },
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const data = await response.json();
      return data.response || '';
    } catch (error) {
      console.error('Ollama generate error:', error);
      return this.formatError(error);
    }
  }

  /**
   * Generate a JSON-only response for tool-calling loops.
   */
  async generateJson(prompt: string, model: string = 'gemma:2b'): Promise<string> {
    try {
      const response = await this.postJson('/api/generate', {
        model: model,
        prompt: prompt,
        stream: false,
        format: 'json',
        options: {
          num_predict: 512,
          temperature: 0,
        },
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const data = await response.json();
      return data.response || '';
    } catch (error) {
      console.error('Ollama JSON generate error:', error);
      return this.formatError(error);
    }
  }

  /**
   * Chat with the model.
   */
  async chat(messages: Array<{role: string, content: string}>, model: string = 'gemma:2b'): Promise<string> {
    try {
      const response = await this.postJson('/api/chat', {
        model: model,
        messages: messages,
        stream: false,
        options: {
          num_predict: 384,
        },
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const data = await response.json();
      return data.message?.content || '';
    } catch (error) {
      console.error('Ollama chat error:', error);
      return this.formatError(error);
    }
  }

  private async postJson(
    endpoint: string,
    body: Record<string, unknown>,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);

    try {
      return await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  private formatError(error: unknown): string {
    if (error instanceof Error && error.name === 'AbortError') {
      return `Error: Ollama did not respond within ${Math.ceil(this.requestTimeoutMs / 1000)} seconds.`;
    }

    if (error instanceof Error) {
      return `Error: Could not get an Ollama response. ${error.message}`;
    }

    return 'Error: Could not connect to Ollama. Make sure it\'s running.';
  }
}
