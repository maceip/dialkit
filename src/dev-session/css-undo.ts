export interface CssUndoEntry {
  selector: string;
  property: string;
  previousValue: string;
  nextValue: string;
}

export class CssUndoStack {
  private undoStack: CssUndoEntry[] = [];
  private redoStack: CssUndoEntry[] = [];
  private limit = 200;

  push(entry: CssUndoEntry): void {
    this.undoStack.push(entry);
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack = [];
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  undo(): CssUndoEntry | null {
    const entry = this.undoStack.pop();
    if (!entry) return null;
    this.redoStack.push(entry);
    return entry;
  }

  redo(): CssUndoEntry | null {
    const entry = this.redoStack.pop();
    if (!entry) return null;
    this.undoStack.push(entry);
    return entry;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
}

export const globalCssUndo = new CssUndoStack();
