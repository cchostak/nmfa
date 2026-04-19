export type AgentAction =
  'list_files' |
  'read_file' |
  'search_files' |
  'file_outline' |
  'write_file' |
  'replace_in_file' |
  'append_file' |
  'run_npm_script' |
  'web_search' |
  'final';

export type AgentState = 'planning' | 'acting' | 'observing' | 'done';

export type AgentStep = {
  thought: string;
  action: AgentAction;
  args: Record<string, unknown>;
};

/**
 * Agentic workflow helper for planning prompts and parsing tool steps.
 */
export class AgentEngine {
  readonly actions: AgentAction[] = [
    'list_files',
    'read_file',
    'search_files',
    'file_outline',
    'write_file',
    'replace_in_file',
    'append_file',
    'run_npm_script',
    'web_search',
    'final',
  ];

  /**
   * Parse one JSON tool step from model output.
   */
  parseStep(output: string): AgentStep | null {
    const jsonText = this.extractJson(output);
    if (!jsonText) {
      return null;
    }

    try {
      const parsed = JSON.parse(jsonText) as Partial<AgentStep>;
      if (!parsed.action || !this.actions.includes(parsed.action)) {
        return null;
      }

      return {
        thought: typeof parsed.thought === 'string' ? parsed.thought : '',
        action: parsed.action,
        args: parsed.args && typeof parsed.args === 'object' ?
          parsed.args :
          {},
      };
    } catch {
      return null;
    }
  }

  /**
   * Render a compact tool list for a small local model.
   */
  renderToolGuide(): string {
    return [
      'Use one JSON tool call at a time.',
      'Inspect before editing. Verify after editing.',
      `Actions: ${this.actions.join(', ')}`,
    ].join('\n');
  }

  private extractJson(output: string): string | null {
    const fenced = output.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fenced?.[1] || output;
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    return start >= 0 && end > start ? candidate.slice(start, end + 1) : null;
  }
}
