import { BaseTool } from './BaseTool';
import { ToolType } from '../model/cdf.schema';
import { CanvasEngine } from '../engine/CanvasEngine';

export class TextTool extends BaseTool {
  public readonly type: ToolType = 'text';
  private color = '#000000';

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

  public setTextColor(color: string): void {
    this.color = color;
  }

  public onPointerDown(e: any): void {
    const adapter = this.engine.getRenderAdapter();
    const canvas = adapter.getCanvas();
    if (!canvas) return;

    const pointer = canvas.getPointer(e.e);
    const x = pointer.x;
    const y = pointer.y;

    // Tạo đối tượng văn bản tại vị trí click chuột
    adapter.addText('Nhập văn bản...', x, y, this.color, 28);
    
    // Tự động chuyển qua IText editing mode
    const textObj = canvas.getActiveObject() as any;
    if (textObj && textObj.enterEditing) {
      textObj.enterEditing();
      textObj.selectAll();
    }

    // Chuyển lại công cụ chọn (select) để học sinh dễ kéo thả/xoay/sửa đổi
    this.engine.setTool('select');
  }
}
