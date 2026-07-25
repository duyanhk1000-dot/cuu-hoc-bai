import { BaseTool } from './BaseTool';
import { ToolType } from '../model/cdf.schema';
import { CanvasEngine } from '../engine/CanvasEngine';

export class SelectTool extends BaseTool {
  public readonly type: ToolType = 'select';

  constructor(engine: CanvasEngine) {
    super(engine);
  }

  public activate(): void {
    const adapter = this.engine.getRenderAdapter();
    const canvas = adapter.getCanvas();
    if (canvas) {
      canvas.isDrawingMode = false;
      canvas.selection = true;
      canvas.forEachObject((obj: any) => {
        obj.selectable = true;
        obj.evented = true;
      });
      canvas.renderAll();
    }
  }

  public deactivate(): void {
    const adapter = this.engine.getRenderAdapter();
    const canvas = adapter.getCanvas();
    if (canvas) {
      // Bỏ chọn khi thoát khỏi công cụ select
      canvas.discardActiveObject();
      canvas.renderAll();
    }
  }
}
