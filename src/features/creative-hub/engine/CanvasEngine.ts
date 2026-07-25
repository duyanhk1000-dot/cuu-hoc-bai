import { CreativeDrawingFormat, ToolType } from '../model/cdf.schema';

export interface CanvasEngine {
  init(canvasElement: HTMLCanvasElement): void;
  setTool(tool: ToolType): void;
  setBrushColor(color: string): void;
  setBrushWidth(width: number): void;
  addSticker(name: string, url: string): void;
  addShape(type: 'rectangle' | 'ellipse' | 'line' | 'star', color: string): void;
  addText(text: string, color: string): void;
  undo(): void;
  redo(): void;
  clear(): void;
  exportWebP(quality?: number): string;
  exportCDF(): CreativeDrawingFormat;
  importCDF(data: CreativeDrawingFormat): void;
  destroy(): void;
  
  // APIs bổ sung để các công cụ tương tác
  getRenderAdapter(): any;
  saveHistory(): void;
}
