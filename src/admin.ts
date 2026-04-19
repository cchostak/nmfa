export type AdminTask = {
  name: string;
  description: string;
  run: () => Promise<string>;
};

/**
 * Registry for one-off administrative tasks.
 */
export class AdminProcesses {
  private readonly tasks = new Map<string, AdminTask>();

  /**
   * Register a named admin task.
   */
  register(task: AdminTask): void {
    if (this.tasks.has(task.name)) {
      throw new Error(`admin task already registered: ${task.name}`);
    }

    this.tasks.set(task.name, task);
  }

  /**
   * List registered tasks with descriptions.
   */
  list(): Array<Pick<AdminTask, 'name' | 'description'>> {
    return Array.from(this.tasks.values()).map((task) => ({
      name: task.name,
      description: task.description,
    }));
  }

  /**
   * Run a registered task once.
   */
  async run(name: string): Promise<string> {
    const task = this.tasks.get(name);
    if (!task) {
      throw new Error(`unknown admin task: ${name}`);
    }

    return await task.run();
  }
}
