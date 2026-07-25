import { BaseTool } from '../tools/BaseTool';
import { ToolType } from '../model/cdf.schema';
import { CanvasEngine } from './CanvasEngine';

export class ToolManager {
  private activeTool: BaseTool | null = null;
  private tools: Map<ToolType, BaseTool> = new Map();
  private engine: CanvasEngine;

  constructor(engine: CanvasEngine) {
    this.engine = engine;
  }

  public registerTool(tool: BaseTool): void {
    this.tools.set(tool.type, tool);
  }

  public setTool(type: ToolType): void {
    if (this.activeTool) {
      this.activeTool.deactivate();
    }
    const tool = this.tools.get(type);
    if (tool) {
      this.activeTool = tool;
      this.activeTool.activate();
    } else {
      this.activeTool = null;
    }
  }

  public getActiveTool(): BaseTool | null {
    return this.activeTool;
  }

  public onPointerDown(e: any): void {
    if (this.activeTool) this.activeTool.onPointerDown(e);
  }

  public onPointerMove(e: any): void {
    if (this.activeTool) this.activeTool.onPointerMove(e);
  }

  public onPointerUp(e: any): void {
    if (this.activeTool) this.activeTool.onPointerUp(e);
  }

  public onKeyDown(e: KeyboardEvent): void {
    if (this.activeTool) this.activeTool.onKeyDown(e);
  }

  public onKeyUp(e: KeyboardEvent): void {
    if (this.activeTool) this.activeTool.onKeyUp(e);
  }

  public cancel(): void {
    if (this.activeTool) this.activeTool.cancel();
  }
}
