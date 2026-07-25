import { CreativeDrawingFormat } from '../model/cdf.schema';

export class HistoryManager {
  private undoStack: CreativeDrawingFormat[] = [];
  private redoStack: CreativeDrawingFormat[] = [];
  private readonly maxSteps = 20;

  public save(state: CreativeDrawingFormat): void {
    // Clone sâu trạng thái để tránh tham chiếu đến đối tượng cũ
    const stateClone = JSON.parse(JSON.stringify(state));
    
    // Nếu trạng thái mới giống trạng thái trên cùng của stack, bỏ qua
    if (this.undoStack.length > 0) {
      const lastState = this.undoStack[this.undoStack.length - 1];
      if (JSON.stringify(lastState) === JSON.stringify(stateClone)) {
        return;
      }
    }

    this.undoStack.push(stateClone);
    this.redoStack = []; // Xóa redo stack khi có thao tác mới

    if (this.undoStack.length > this.maxSteps) {
      this.undoStack.shift(); // Loại bỏ bước cũ nhất nếu vượt quá giới hạn
    }
  }

  public undo(currentState: CreativeDrawingFormat): CreativeDrawingFormat | null {
    if (this.undoStack.length === 0) return null;

    const previousState = this.undoStack.pop()!;
    this.redoStack.push(JSON.parse(JSON.stringify(currentState)));
    return previousState;
  }

  public redo(currentState: CreativeDrawingFormat): CreativeDrawingFormat | null {
    if (this.redoStack.length === 0) return null;

    const nextState = this.redoStack.pop()!;
    this.undoStack.push(JSON.parse(JSON.stringify(currentState)));
    return nextState;
  }

  public clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
}
