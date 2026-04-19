export type TerminalCommand = {
  command: string;
  args: string[];
};

/**
 * Terminal integration policy for safe developer commands.
 */
export class TerminalIntegration {
  private readonly allowedNpmScripts = new Set([
    'build',
    'lint',
    'test',
    'smoke-test',
  ]);

  /**
   * Convert a script name into a safe npm command.
   */
  npmScript(script: string): TerminalCommand {
    if (!this.allowedNpmScripts.has(script)) {
      throw new Error(`npm script is not allowed: ${script}`);
    }

    return {
      command: 'npm',
      args: ['run', script],
    };
  }

  /**
   * Describe available verification commands.
   */
  availableScripts(): string[] {
    return Array.from(this.allowedNpmScripts);
  }
}
