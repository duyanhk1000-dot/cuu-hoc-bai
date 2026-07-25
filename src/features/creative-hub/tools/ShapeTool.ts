import { fabric } from 'fabric';
import { BaseTool } from './BaseTool';
import { ToolType } from '../model/cdf.schema';
import { CanvasEngine } from '../engine/CanvasEngine';

export class ShapeTool extends BaseTool {
  public readonly type: ToolType;
  private startX = 0;
  private startY = 0;
  private isDrawing = false;
  private activeShape: any = null;
  private color = '#E11D48'; // Màu mặc định đẹp

  constructor(engine: CanvasEngine, type: 'rectangle' | 'ellipse' | 'line' | 'star') {
    super(engine);
    this.type = type;
  }

  public activate(): void {
    const adapter = this.engine.getRenderAdapter();
    const canvas = adapter.getCanvas();
    if (canvas) {
      canvas.isDrawingMode = false;
      canvas.selection = false;
      canvas.forEachObject((obj: any) => {
        obj.selectable = false;
        obj.evented = false;
      });
    }
  }

  public setShapeColor(color: string): void {
    this.color = color;
  }

  public onPointerDown(e: any): void {
    const adapter = this.engine.getRenderAdapter();
    const canvas = adapter.getCanvas();
    if (!canvas) return;

    const pointer = canvas.getPointer(e.e);
    this.startX = pointer.x;
    this.startY = pointer.y;
    this.isDrawing = true;

    if (this.type === 'rectangle') {
      this.activeShape = new fabric.Rect({
        left: this.startX,
        top: this.startY,
        width: 0,
        height: 0,
        fill: this.color,
        strokeWidth: 0,
        selectable: false,
        evented: false,
      });
    } else if (this.type === 'ellipse') {
      this.activeShape = new fabric.Ellipse({
        left: this.startX,
        top: this.startY,
        rx: 0,
        ry: 0,
        fill: this.color,
        strokeWidth: 0,
        selectable: false,
        evented: false,
      });
    } else if (this.type === 'line') {
      this.activeShape = new fabric.Line([this.startX, this.startY, this.startX, this.startY], {
        stroke: this.color,
        strokeWidth: 6,
        selectable: false,
        evented: false,
      });
    } else if (this.type === 'star') {
      this.activeShape = new fabric.Polygon(this.calculateStarPoints(this.startX, this.startY, 5, 0, 0), {
        left: this.startX,
        top: this.startY,
        fill: this.color,
        strokeWidth: 0,
        selectable: false,
        evented: false,
      });
    }

    if (this.activeShape) {
      canvas.add(this.activeShape);
      canvas.renderAll();
    }
  }

  public onPointerMove(e: any): void {
    if (!this.isDrawing || !this.activeShape) return;

    const adapter = this.engine.getRenderAdapter();
    const canvas = adapter.getCanvas();
    if (!canvas) return;

    const pointer = canvas.getPointer(e.e);
    const currentX = pointer.x;
    const currentY = pointer.y;

    const width = Math.abs(currentX - this.startX);
    const height = Math.abs(currentY - this.startY);
    const left = Math.min(this.startX, currentX);
    const top = Math.min(this.startY, currentY);

    if (this.type === 'rectangle') {
      this.activeShape.set({ left, top, width, height });
    } else if (this.type === 'ellipse') {
      this.activeShape.set({
        left,
        top,
        rx: width / 2,
        ry: height / 2,
        width,
        height,
      });
    } else if (this.type === 'line') {
      this.activeShape.set({ x2: currentX, y2: currentY });
    } else if (this.type === 'star') {
      // Star được vẽ bằng đa giác, ta cập nhật lại mảng điểm của Polygon
      const radius = Math.max(width, height);
      const points = this.calculateStarPoints(left + radius/2, top + radius/2, 5, radius/2, radius/4);
      
      this.activeShape.set({
        points,
        left,
        top,
        width,
        height
      });
    }

    canvas.renderAll();
  }

  public onPointerUp(e: any): void {
    if (!this.isDrawing) return;
    this.isDrawing = false;

    const adapter = this.engine.getRenderAdapter();
    const canvas = adapter.getCanvas();
    if (!canvas) return;

    if (this.activeShape) {
      // Gán metadata chuẩn hóa cho đối tượng vẽ hình học
      this.activeShape.set({
        selectable: true,
        evented: true,
      });
      this.activeShape.id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9);
      this.activeShape.customType = 'shape';
      this.activeShape.shapeName = this.type;
      this.activeShape.createdAt = Date.now();
      this.activeShape.updatedAt = Date.now();

      this.activeShape = null;
      this.engine.saveHistory();
    }
  }

  private calculateStarPoints(cx: number, cy: number, spikes: number, outerRadius: number, innerRadius: number) {
    let rot = (Math.PI / 2) * 3;
    let x = cx;
    let y = cy;
    const step = Math.PI / spikes;
    const results = [];

    for (let i = 0; i < spikes; i++) {
      x = cx + Math.cos(rot) * outerRadius;
      y = cy + Math.sin(rot) * outerRadius;
      results.push({ x, y });
      rot += step;

      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      results.push({ x, y });
      rot += step;
    }
    return results;
  }
}
