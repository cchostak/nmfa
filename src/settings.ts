export type AppSettings = {
  ollamaBaseUrl: string;
  ollamaModel: string;
  requestTimeoutMs: number;
  maxAgentSteps: number;
  workspaceMaxFileBytes: number;
};

/**
 * Configuration management backed by environment variables.
 */
export class SettingsManager {
  private readonly defaults: AppSettings = {
    ollamaBaseUrl: 'http://127.0.0.1:11434',
    ollamaModel: 'gemma:2b',
    requestTimeoutMs: 45000,
    maxAgentSteps: 8,
    workspaceMaxFileBytes: 5 * 1024 * 1024,
  };

  /**
   * Load and validate application settings.
   */
  load(env: NodeJS.ProcessEnv = process.env): AppSettings {
    return {
      ollamaBaseUrl: env.NMFA_OLLAMA_BASE_URL ||
        this.defaults.ollamaBaseUrl,
      ollamaModel: env.NMFA_OLLAMA_MODEL || this.defaults.ollamaModel,
      requestTimeoutMs: this.readPositiveInteger(
        env.NMFA_REQUEST_TIMEOUT_MS,
        this.defaults.requestTimeoutMs,
      ),
      maxAgentSteps: this.readPositiveInteger(
        env.NMFA_MAX_AGENT_STEPS,
        this.defaults.maxAgentSteps,
      ),
      workspaceMaxFileBytes: this.readPositiveInteger(
        env.NMFA_MAX_FILE_BYTES,
        this.defaults.workspaceMaxFileBytes,
      ),
    };
  }

  private readPositiveInteger(
    value: string | undefined,
    fallback: number,
  ): number {
    if (!value) {
      return fallback;
    }

    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
}
