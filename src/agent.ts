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
  private readonly aliases: Record<string, AgentAction> = {
    answer: 'final',
    append: 'append_file',
    cat: 'read_file',
    create: 'write_file',
    create_file: 'write_file',
    edit: 'replace_in_file',
    grep: 'search_files',
    ls: 'list_files',
    open: 'read_file',
    outline: 'file_outline',
    patch: 'replace_in_file',
    read: 'read_file',
    respond: 'final',
    rg: 'search_files',
    ripgrep: 'search_files',
    run_tests: 'run_npm_script',
    search: 'search_files',
    search_web: 'web_search',
    show: 'read_file',
    test: 'run_npm_script',
    tree: 'list_files',
    web: 'web_search',
    write: 'write_file',
  };

  /**
   * Parse one JSON tool step from model output.
   */
  parseStep(output: string): AgentStep | null {
    const jsonText = this.extractJson(output);
    if (!jsonText) {
      return null;
    }

    try {
      const parsed = JSON.parse(jsonText) as Record<string, unknown>;
      const action = this.parseAction(parsed);
      if (!action) {
        return null;
      }

      return {
        thought: typeof parsed.thought === 'string' ? parsed.thought : '',
        action,
        args: this.parseArgs(parsed),
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

  private parseAction(parsed: Record<string, unknown>): AgentAction | null {
    const primary = this.stringValue(parsed.action);
    const candidates = primary && primary !== 'tool_name' ?
      [primary] :
      [parsed.tool, parsed.tool_name, parsed.name, primary]
        .map((value) => this.stringValue(value))
        .filter((value): value is string => Boolean(value));

    for (const candidate of candidates) {
      const normalized = candidate.toLowerCase().trim().replace(/[\s-]+/g, '_');
      const action = this.aliases[normalized] || normalized;
      if (this.actions.includes(action as AgentAction)) {
        return action as AgentAction;
      }
    }

    return null;
  }

  private parseArgs(parsed: Record<string, unknown>): Record<string, unknown> {
    if (
      parsed.args &&
      typeof parsed.args === 'object' &&
      !Array.isArray(parsed.args)
    ) {
      return parsed.args as Record<string, unknown>;
    }

    const args: Record<string, unknown> = {};
    const metadataKeys = new Set([
      'action',
      'args',
      'name',
      'thought',
      'tool',
      'tool_name',
    ]);
    for (const [key, value] of Object.entries(parsed)) {
      if (!metadataKeys.has(key)) {
        args[key] = value;
      }
    }

    return args;
  }

  private stringValue(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }
}
