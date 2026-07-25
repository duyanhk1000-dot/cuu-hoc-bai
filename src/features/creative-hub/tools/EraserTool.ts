import { BaseTool } from './BaseTool';
import { ToolType } from '../model/cdf.schema';
import { CanvasEngine } from '../engine/CanvasEngine';

export class EraserTool extends BaseTool {
  public readonly type: ToolType = 'eraser';
  private width = 30; // Nét tẩy mặc định to

  constructor(engine: CanvasEngine) {
    super(engine);
  }

  public activate(): void {
    this.updateEraser();
  }

  public setEraserWidth(width: number): void {
    this.width = width;
    this.updateEraser();
  }

  private updateEraser(): void {
    const adapter = this.engine.getRenderAdapter();
    const canvas = adapter.getCanvas();
    if (canvas) {
      canvas.isDrawingMode = true;
      if (canvas.freeDrawingBrush) {
        // Tẩy cơ chế vẽ màu trắng trùng màu nền
        canvas.freeDrawingBrush.color = '#ffffff';
        canvas.freeDrawingBrush.width = this.width;
      }
    }
  }
}
