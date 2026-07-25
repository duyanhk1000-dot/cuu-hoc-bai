import { CanvasEngine } from '../engine/CanvasEngine';
import { ToolType } from '../model/cdf.schema';

export abstract class BaseTool {
  protected engine: CanvasEngine;
  public abstract readonly type: ToolType;

  constructor(engine: CanvasEngine) {
    this.engine = engine;
  }

  public activate(): void {}
  public deactivate(): void {}

  public onPointerDown(e: any): void {}
  public onPointerMove(e: any): void {}
  public onPointerUp(e: any): void {}
  
  public onKeyDown(e: KeyboardEvent): void {}
  public onKeyUp(e: KeyboardEvent): void {}
  
  public cancel(): void {}
}
