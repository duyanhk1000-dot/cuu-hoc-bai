import { RenderAdapter } from './RenderAdapter';
import { CreativeDrawingFormat } from '../model/cdf.schema';

export class ExportManager {
  private renderAdapter: RenderAdapter;

  constructor(renderAdapter: RenderAdapter) {
    this.renderAdapter = renderAdapter;
  }

  public exportWebP(quality = 0.8): string {
    return this.renderAdapter.exportWebP(quality);
  }

  public exportPNG(): string {
    const canvas = this.renderAdapter.getCanvas();
    if (!canvas) return '';
    
    // Bỏ chọn vật thể trước khi chụp ảnh
    const activeObject = canvas.getActiveObject();
    if (activeObject) {
      canvas.discardActiveObject();
      canvas.renderAll();
    }

    const dataUrl = canvas.toDataURL({
      format: 'png',
    });

    if (activeObject) {
      canvas.setActiveObject(activeObject);
      canvas.renderAll();
    }

    return dataUrl;
  }

  public exportJPEG(quality = 0.9): string {
    const canvas = this.renderAdapter.getCanvas();
    if (!canvas) return '';
    
    const activeObject = canvas.getActiveObject();
    if (activeObject) {
      canvas.discardActiveObject();
      canvas.renderAll();
    }

    const dataUrl = canvas.toDataURL({
      format: 'jpeg',
      quality,
    });

    if (activeObject) {
      canvas.setActiveObject(activeObject);
      canvas.renderAll();
    }

    return dataUrl;
  }

  public downloadCDF(filename: string, cdfData: CreativeDrawingFormat): void {
    const jsonStr = JSON.stringify(cdfData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
