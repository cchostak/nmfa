/**
 * Ollama API integration.
 * Handles communication with local Ollama server for Gemma 270M inference.
 */
export class OllamaService {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:11434') {
    this.baseUrl = baseUrl;
  }

  /**
   * Generate completion for a prompt.
   */
  async generate(prompt: string, model: string = 'gemma:2b'): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          prompt: prompt,
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const data = await response.json();
      return data.response || '';
    } catch (error) {
      console.error('Ollama generate error:', error);
      return 'Error: Could not connect to Ollama. Make sure it\'s running.';
    }
  }

  /**
   * Chat with the model.
   */
  async chat(messages: Array<{role: string, content: string}>, model: string = 'gemma:2b'): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          messages: messages,
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const data = await response.json();
      return data.message?.content || '';
    } catch (error) {
      console.error('Ollama chat error:', error);
      return 'Error: Could not connect to Ollama. Make sure it\'s running.';
    }
  }
}