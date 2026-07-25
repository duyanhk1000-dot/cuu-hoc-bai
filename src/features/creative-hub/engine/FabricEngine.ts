import { CanvasEngine } from './CanvasEngine';
import { RenderAdapter } from './RenderAdapter';
import { ToolManager } from './ToolManager';
import { HistoryManager } from './HistoryManager';
import { ExportManager } from './ExportManager';
import { CreativeDrawingFormat, ToolType } from '../model/cdf.schema';
import { validateCDF } from '../model/cdf.validator';

// Import các Tool Plugins
import { SelectTool } from '../tools/SelectTool';
import { BrushTool } from '../tools/BrushTool';
import { EraserTool } from '../tools/EraserTool';
import { ShapeTool } from '../tools/ShapeTool';
import { TextTool } from '../tools/TextTool';
import { StickerTool } from '../tools/StickerTool';
import { FillTool } from '../tools/FillTool';

export class FabricEngine implements CanvasEngine {
  private adapter: RenderAdapter;
  private toolManager: ToolManager;
  private historyManager: HistoryManager;
  private exportManager: ExportManager;
  
  private brushColor = '#E11D48'; // Tím hồng sáng đẹp mặc định
  private brushWidth = 6;
  private activeToolType: ToolType = 'select';
  
  // Callback để báo cho React Component biết canvas có cập nhật mới
  private onChangeCallback: (() => void) | null = null;

  constructor(onChange?: () => void) {
    this.adapter = new RenderAdapter();
    this.toolManager = new ToolManager(this);
    this.historyManager = new HistoryManager();
    this.exportManager = new ExportManager(this.adapter);
    this.onChangeCallback = onChange || null;
  }

  public init(canvasElement: HTMLCanvasElement): void {
    // 1. Khởi tạo RenderAdapter để cấu hình Fabric
    this.adapter.init(canvasElement, () => this.handleObjectModified());

    // 2. Đăng ký các công cụ vẽ
    this.toolManager.registerTool(new SelectTool(this));
    this.toolManager.registerTool(new BrushTool(this, 'pencil'));
    this.toolManager.registerTool(new BrushTool(this, 'brush'));
    this.toolManager.registerTool(new BrushTool(this, 'marker'));
    this.toolManager.registerTool(new EraserTool(this));
    this.toolManager.registerTool(new ShapeTool(this, 'rectangle'));
    this.toolManager.registerTool(new ShapeTool(this, 'ellipse'));
    this.toolManager.registerTool(new ShapeTool(this, 'line'));
    this.toolManager.registerTool(new ShapeTool(this, 'star'));
    this.toolManager.registerTool(new TextTool(this));
    this.toolManager.registerTool(new StickerTool(this));
    this.toolManager.registerTool(new FillTool(this));

    // 3. Đăng ký lắng nghe sự kiện chuột/cảm ứng để phân phối cho ToolManager
    const canvas = this.adapter.getCanvas();
    if (canvas) {
      canvas.on('mouse:down', (e) => this.toolManager.onPointerDown(e));
      canvas.on('mouse:move', (e) => this.toolManager.onPointerMove(e));
      canvas.on('mouse:up', (e) => this.toolManager.onPointerUp(e));
    }

    // 4. Kích hoạt SelectTool làm mặc định lúc đầu
    this.setTool('select');

    // 5. Lưu trạng thái trống ban đầu vào History
    this.saveHistory();
  }

  private handleObjectModified(): void {
    this.saveHistory();
    if (this.onChangeCallback) {
      this.onChangeCallback();
    }
  }

  public getRenderAdapter(): RenderAdapter {
    return this.adapter;
  }

  public saveHistory(): void {
    const state = this.exportCDF();
    this.historyManager.save(state);
  }

  public setTool(tool: ToolType): void {
    this.activeToolType = tool;
    
    // Đồng bộ các thuộc tính màu vẽ hiện tại vào tool trước khi kích hoạt
    const activeTool = this.toolManager.getActiveTool();
    if (activeTool) {
      this.deactivateCurrentToolConfig();
    }

    // Kích hoạt tool mới
    this.toolManager.setTool(tool);
    this.syncActiveToolConfig();
  }

  private deactivateCurrentToolConfig(): void {
    // Thu dọn hoặc reset các cấu hình đặc thù của công cụ cũ nếu cần
  }

  private syncActiveToolConfig(): void {
    const activeTool = this.toolManager.getActiveTool();
    if (!activeTool) return;

    // Cập nhật cấu hình BrushColor/BrushWidth cho BrushTool
    if (activeTool instanceof BrushTool) {
      activeTool.setBrushColor(this.brushColor);
      activeTool.setBrushWidth(this.brushWidth);
    } 
    // Cập nhật tẩy
    else if (activeTool instanceof EraserTool) {
      activeTool.setEraserWidth(this.brushWidth * 4); // Eraser luôn to gấp 4 lần cỡ bút thông thường
    }
    // Cập nhật màu vẽ hình dạng
    else if (activeTool instanceof ShapeTool) {
      activeTool.setShapeColor(this.brushColor);
    }
    // Cập nhật màu văn bản
    else if (activeTool instanceof TextTool) {
      activeTool.setTextColor(this.brushColor);
    }
    // Cập nhật màu đổ nền
    else if (activeTool instanceof FillTool) {
      activeTool.setFillColor(this.brushColor);
    }
  }

  public setBrushColor(color: string): void {
    this.brushColor = color;
    this.syncActiveToolConfig();
  }

  public setBrushWidth(width: number): void {
    this.brushWidth = width;
    this.syncActiveToolConfig();
  }

  public addSticker(name: string, url: string): void {
    const canvas = this.adapter.getCanvas();
    if (!canvas) return;

    // Tính toán tọa độ chính giữa màn hình vẽ để chèn
    const width = canvas.getWidth();
    const height = canvas.getHeight();
    const x = width / 2 - 60;
    const y = height / 2 - 60;

    // Gọi chèn qua Adapter
    this.adapter.addSticker(name, url, x, y);
    
    // Tự động chuyển về select tool để trẻ em xoay/di chuyển sticker ngay lập tức
    this.setTool('select');
  }

  public addShape(type: 'rectangle' | 'ellipse' | 'line' | 'star', color: string): void {
    const canvas = this.adapter.getCanvas();
    if (!canvas) return;

    const width = canvas.getWidth();
    const height = canvas.getHeight();
    const x = width / 2 - 50;
    const y = height / 2 - 50;

    if (type === 'rectangle') {
      this.adapter.addRectangle(x, y, 100, 100, color);
    } else if (type === 'ellipse') {
      this.adapter.addEllipse(x, y, 50, 50, color);
    } else if (type === 'line') {
      this.adapter.addLine(x - 50, y, x + 50, y, color);
    } else if (type === 'star') {
      this.adapter.addStar(x, y, color);
    }

    this.setTool('select');
  }

  public addText(text: string, color: string): void {
    const canvas = this.adapter.getCanvas();
    if (!canvas) return;

    const width = canvas.getWidth();
    const height = canvas.getHeight();
    const x = width / 2 - 80;
    const y = height / 2 - 20;

    this.adapter.addText(text, x, y, color, 28);
    this.setTool('select');
  }

  public undo(): void {
    const currentState = this.exportCDF();
    const previousState = this.historyManager.undo(currentState);
    if (previousState) {
      this.importCDF(previousState);
      if (this.onChangeCallback) {
        this.onChangeCallback();
      }
    }
  }

  public redo(): void {
    const currentState = this.exportCDF();
    const nextState = this.historyManager.redo(currentState);
    if (nextState) {
      this.importCDF(nextState);
      if (this.onChangeCallback) {
        this.onChangeCallback();
      }
    }
  }

  public clear(): void {
    this.adapter.clear();
    this.saveHistory();
    if (this.onChangeCallback) {
      this.onChangeCallback();
    }
  }

  public exportWebP(quality = 0.8): string {
    return this.exportManager.exportWebP(quality);
  }

  public exportPNG(): string {
    return this.exportManager.exportPNG();
  }

  public exportJPEG(quality = 0.9): string {
    return this.exportManager.exportJPEG(quality);
  }

  public downloadCDFFile(filename = 'my-drawing.cdf'): void {
    const data = this.exportCDF();
    this.exportManager.downloadCDF(filename, data);
  }

  public exportCDF(): CreativeDrawingFormat {
    return {
      version: 1,
      backgroundColor: this.adapter.getBackgroundColor(),
      objects: this.adapter.exportCDFObjects(),
    };
  }

  public importCDF(data: CreativeDrawingFormat): void {
    const validatedData = validateCDF(data);
    this.adapter.setBackgroundColor(validatedData.backgroundColor);
    this.adapter.importCDFObjects(validatedData.objects);
  }

  public destroy(): void {
    this.adapter.destroy();
    this.historyManager.clear();
  }
}
