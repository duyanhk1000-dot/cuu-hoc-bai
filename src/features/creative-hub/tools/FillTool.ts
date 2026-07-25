import { BaseTool } from './BaseTool';
import { ToolType } from '../model/cdf.schema';
import { CanvasEngine } from '../engine/CanvasEngine';

export class FillTool extends BaseTool {
  public readonly type: ToolType = 'fill';
  private color = '#ffffff';

  constructor(engine: CanvasEngine) {
    super(engine);
  }

  public activate(): void {
    const adapter = this.engine.getRenderAdapter();
    const canvas = adapter.getCanvas();
    if (canvas) {
      canvas.isDrawingMode = false;
      canvas.selection = false;
    }
  }

  public setFillColor(color: string): void {
    this.color = color;
  }

  public onPointerDown(e: any): void {
    const adapter = this.engine.getRenderAdapter();
    adapter.setBackgroundColor(this.color);
    this.engine.saveHistory();
  }
}
