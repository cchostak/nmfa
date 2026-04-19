import * as monaco from 'monaco-editor';
import { OllamaService } from './ollama';

/**
 * Inline completion provider.
 * Handles code completion suggestions with debouncing.
 */
export class CompletionProvider {
  private ollama: OllamaService;
  private debounceTimer: NodeJS.Timeout | null = null;
  private debounceDelay: number = 500;

  constructor() {
    this.ollama = new OllamaService();
  }

  /**
   * Register the completion provider with Monaco.
   */
  register(): void {
    monaco.languages.registerCompletionItemProvider('typescript', {
      provideCompletionItems: async (model, position) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };

        // Get context around the cursor
        const context = this.getContext(model, position);

        // Debounce the API call
        return new Promise((resolve) => {
          if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
          }

          this.debounceTimer = setTimeout(async () => {
            try {
              const suggestions = await this.getSuggestions(context);
              resolve({
                suggestions: suggestions.map(suggestion => ({
                  label: suggestion,
                  kind: monaco.languages.CompletionItemKind.Text,
                  insertText: suggestion,
                  range: range,
                })),
              });
            } catch (error) {
              resolve({ suggestions: [] });
            }
          }, this.debounceDelay);
        });
      },
    });
  }

  private getContext(model: monaco.editor.ITextModel, position: monaco.IPosition): string {
    const lines = model.getLinesContent();
    const currentLine = lines[position.lineNumber - 1];
    const beforeCursor = currentLine.substring(0, position.column - 1);

    // Get some context lines
    const startLine = Math.max(0, position.lineNumber - 3);
    const endLine = Math.min(lines.length, position.lineNumber + 2);
    const contextLines = lines.slice(startLine, endLine);

    return contextLines.join('\n') + '\n' + beforeCursor;
  }

  private async getSuggestions(context: string): Promise<string[]> {
    try {
      const prompt = `Complete this TypeScript code:\n\n${context}\n\nProvide 3-5 completion suggestions, one per line:`;
      const response = await this.ollama.generate(prompt);

      // Parse the response into individual suggestions
      return response.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0 && !line.startsWith('```'))
        .slice(0, 5);
    } catch (error) {
      console.error('Completion error:', error);
      return [];
    }
  }
}