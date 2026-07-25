import { BaseTool } from './BaseTool';
import { ToolType } from '../model/cdf.schema';
import { CanvasEngine } from '../engine/CanvasEngine';

export class StickerTool extends BaseTool {
  public readonly type: ToolType = 'sticker';

  constructor(engine: CanvasEngine) {
    super(engine);
  }

  public activate(): void {
    const adapter = this.engine.getRenderAdapter();
    const canvas = adapter.getCanvas();
    if (canvas) {
      canvas.isDrawingMode = false;
      canvas.selection = true;
    }
  }
}
