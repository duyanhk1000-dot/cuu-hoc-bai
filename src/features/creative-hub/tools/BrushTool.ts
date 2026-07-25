import { BaseTool } from './BaseTool';
import { ToolType } from '../model/cdf.schema';
import { CanvasEngine } from '../engine/CanvasEngine';

export class BrushTool extends BaseTool {
  public readonly type: ToolType;
  private color = '#000000';
  private width = 5;

  constructor(engine: CanvasEngine, type: 'pencil' | 'brush' | 'marker') {
    super(engine);
    this.type = type;
    
    // Cỡ nét vẽ mặc định theo từng loại bút
    if (type === 'pencil') this.width = 4;
    else if (type === 'marker') this.width = 12;
    else this.width = 24;
  }

  public activate(): void {
    this.updateBrush();
  }

  public setBrushColor(color: string): void {
    this.color = color;
    this.updateBrush();
  }

  public setBrushWidth(width: number): void {
    this.width = width;
    this.updateBrush();
  }

  private updateBrush(): void {
    const adapter = this.engine.getRenderAdapter();
    const canvas = adapter.getCanvas();
    if (canvas) {
      canvas.isDrawingMode = true;
      if (canvas.freeDrawingBrush) {
        canvas.freeDrawingBrush.color = this.color;
        canvas.freeDrawingBrush.width = this.width;
        
        // Marker có độ trong suốt nhẹ giống bút marker thật
        if (this.type === 'marker') {
          // Thêm opacity 0.7 vào mã màu hex
          const hex = this.color.replace('#', '');
          const r = parseInt(hex.substring(0, 2), 16);
          const g = parseInt(hex.substring(2, 4), 16);
          const b = parseInt(hex.substring(4, 6), 16);
          canvas.freeDrawingBrush.color = `rgba(${r}, ${g}, ${b}, 0.7)`;
        }
      }
    }
  }
}
