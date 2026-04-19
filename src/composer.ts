export type FileEdit = {
  path: string;
  before: string;
  after: string;
};

export type EditSummary = {
  changedFiles: string[];
  insertions: number;
  deletions: number;
};

/**
 * Multi-file editing helpers for composer-style agent changes.
 */
export class Composer {
  /**
   * Build an exact replacement edit.
   */
  replace(path: string, content: string, find: string, replace: string): FileEdit {
    if (!find) {
      throw new Error('find text cannot be empty');
    }

    if (!content.includes(find)) {
      throw new Error(`exact text not found in ${path}`);
    }

    return {
      path,
      before: content,
      after: content.split(find).join(replace),
    };
  }

  /**
   * Summarize a set of file edits.
   */
  summarize(edits: FileEdit[]): EditSummary {
    let insertions = 0;
    let deletions = 0;
    for (const edit of edits) {
      const beforeLines = edit.before.split(/\r?\n/);
      const afterLines = edit.after.split(/\r?\n/);
      insertions += Math.max(0, afterLines.length - beforeLines.length);
      deletions += Math.max(0, beforeLines.length - afterLines.length);
    }

    return {
      changedFiles: edits.map((edit) => edit.path),
      insertions,
      deletions,
    };
  }
}
