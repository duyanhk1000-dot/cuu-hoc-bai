import { fabric } from 'fabric';
import { CDFObject, CreativeDrawingFormat } from '../model/cdf.schema';

export class RenderAdapter {
  private canvas: fabric.Canvas | null = null;
  private onObjectModifiedCallback: (() => void) | null = null;

  public init(canvasElement: HTMLCanvasElement, onObjectModified: () => void): void {
    // Khởi tạo Fabric Canvas
    this.canvas = new fabric.Canvas(canvasElement, {
      width: canvasElement.parentElement?.clientWidth || 800,
      height: canvasElement.parentElement?.clientHeight || 600,
      backgroundColor: '#ffffff',
      isDrawingMode: false,
      selection: true,
    });

    this.onObjectModifiedCallback = onObjectModified;

    // Lắng nghe sự kiện để kích hoạt tự động lưu và lưu history
    this.canvas.on('object:added', () => this.triggerModify());
    this.canvas.on('object:modified', () => this.triggerModify());
    this.canvas.on('object:removed', () => this.triggerModify());
    this.canvas.on('path:created', (e: any) => {
      // Thiết lập metadata cho nét vẽ tự do vừa tạo
      const pathObj = e.path;
      if (pathObj) {
        pathObj.id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9);
        pathObj.customType = 'brush';
        pathObj.createdAt = Date.now();
        pathObj.updatedAt = Date.now();
      }
      this.triggerModify();
    });

    // Cấu hình điều khiển (controls) thân thiện cho trẻ em
    fabric.Object.prototype.transparentCorners = false;
    fabric.Object.prototype.cornerColor = '#8B5CF6'; // Màu tím xinh xắn
    fabric.Object.prototype.cornerStrokeColor = '#ffffff';
    fabric.Object.prototype.cornerSize = 12; // To hơn chuẩn (chạm cảm ứng dễ hơn)
    fabric.Object.prototype.cornerStyle = 'circle';
    fabric.Object.prototype.borderScaleFactor = 2;
  }

  private triggerModify(): void {
    if (this.onObjectModifiedCallback) {
      this.onObjectModifiedCallback();
    }
  }

  public getCanvas(): fabric.Canvas | null {
    return this.canvas;
  }

  public setDimensions(width: number, height: number): void {
    if (this.canvas) {
      this.canvas.setDimensions({ width, height });
    }
  }

  public setBackgroundColor(color: string): void {
    if (this.canvas) {
      this.canvas.setBackgroundColor(color, () => {
        this.canvas?.renderAll();
        this.triggerModify();
      });
    }
  }

  public getBackgroundColor(): string {
    return (this.canvas?.backgroundColor as string) || '#ffffff';
  }

  public setDrawingMode(enabled: boolean, color = '#000000', width = 5): void {
    if (!this.canvas) return;
    this.canvas.isDrawingMode = enabled;
    if (enabled && this.canvas.freeDrawingBrush) {
      this.canvas.freeDrawingBrush.color = color;
      this.canvas.freeDrawingBrush.width = width;
    }
  }

  public addRectangle(x: number, y: number, width: number, height: number, color: string, strokeWidth = 2, id?: string): void {
    if (!this.canvas) return;
    const rect = new fabric.Rect({
      left: x,
      top: y,
      width,
      height,
      fill: color,
      strokeWidth: 0, // Dùng fill đặc cho trẻ em dễ tô vẽ
      selectable: true,
      hasControls: true,
    });
    
    // Gán custom metadata
    const objId = id || (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9));
    (rect as any).id = objId;
    (rect as any).customType = 'shape';
    (rect as any).shapeName = 'rectangle';
    (rect as any).createdAt = Date.now();
    (rect as any).updatedAt = Date.now();

    this.canvas.add(rect);
    this.canvas.setActiveObject(rect);
    this.canvas.renderAll();
  }

  public addEllipse(x: number, y: number, rx: number, ry: number, color: string, strokeWidth = 2, id?: string): void {
    if (!this.canvas) return;
    const ellipse = new fabric.Ellipse({
      left: x,
      top: y,
      rx,
      ry,
      fill: color,
      strokeWidth: 0,
      selectable: true,
      hasControls: true,
    });

    const objId = id || (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9));
    (ellipse as any).id = objId;
    (ellipse as any).customType = 'shape';
    (ellipse as any).shapeName = 'ellipse';
    (ellipse as any).createdAt = Date.now();
    (ellipse as any).updatedAt = Date.now();

    this.canvas.add(ellipse);
    this.canvas.setActiveObject(ellipse);
    this.canvas.renderAll();
  }

  public addLine(x: number, y: number, x2: number, y2: number, color: string, strokeWidth = 5, id?: string): void {
    if (!this.canvas) return;
    const line = new fabric.Line([x, y, x2, y2], {
      stroke: color,
      strokeWidth,
      selectable: true,
      hasControls: true,
    });

    const objId = id || (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9));
    (line as any).id = objId;
    (line as any).customType = 'shape';
    (line as any).shapeName = 'line';
    (line as any).createdAt = Date.now();
    (line as any).updatedAt = Date.now();

    this.canvas.add(line);
    this.canvas.setActiveObject(line);
    this.canvas.renderAll();
  }

  public addStar(x: number, y: number, color: string, id?: string): void {
    if (!this.canvas) return;
    // Vẽ đa giác hình ngôi sao 5 cánh đơn giản
    const points = this.calculateStarPoints(x, y, 5, 40, 20);
    const star = new fabric.Polygon(points, {
      left: x,
      top: y,
      fill: color,
      strokeWidth: 0,
      selectable: true,
      hasControls: true,
    });

    const objId = id || (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9));
    (star as any).id = objId;
    (star as any).customType = 'shape';
    (star as any).shapeName = 'star';
    (star as any).createdAt = Date.now();
    (star as any).updatedAt = Date.now();

    this.canvas.add(star);
    this.canvas.setActiveObject(star);
    this.canvas.renderAll();
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

  public addText(text: string, x: number, y: number, color: string, fontSize = 28, id?: string): void {
    if (!this.canvas) return;
    const textObj = new fabric.IText(text, {
      left: x,
      top: y,
      fontFamily: 'Plus Jakarta Sans',
      fontSize,
      fill: color,
      selectable: true,
      hasControls: true,
    });

    const objId = id || (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9));
    (textObj as any).id = objId;
    (textObj as any).customType = 'text';
    (textObj as any).createdAt = Date.now();
    (textObj as any).updatedAt = Date.now();

    this.canvas.add(textObj);
    this.canvas.setActiveObject(textObj);
    this.canvas.renderAll();
  }

  public addSticker(name: string, url: string, x: number, y: number, id?: string): void {
    if (!this.canvas) return;
    fabric.Image.fromURL(url, (img) => {
      img.set({
        left: x,
        top: y,
        selectable: true,
        hasControls: true,
      });
      img.scaleToWidth(120);
      img.scaleToHeight(120);

      const objId = id || (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9));
      (img as any).id = objId;
      (img as any).customType = 'sticker';
      (img as any).stickerName = name;
      (img as any).imageUrl = url;
      (img as any).createdAt = Date.now();
      (img as any).updatedAt = Date.now();

      this.canvas?.add(img);
      this.canvas?.setActiveObject(img);
      this.canvas?.renderAll();
    }, { crossOrigin: 'anonymous' });
  }

  public clear(): void {
    if (this.canvas) {
      this.canvas.clear();
      this.canvas.setBackgroundColor('#ffffff', () => {
        this.canvas?.renderAll();
      });
    }
  }

  public undo(): void {
    // Undo sẽ được Engine và HistoryManager điều phối bằng cách importCDF
  }

  public exportWebP(quality = 0.8): string {
    if (!this.canvas) return '';
    // Bỏ khung viền chọn vật thể trước khi xuất ảnh
    const activeObject = this.canvas.getActiveObject();
    if (activeObject) {
      this.canvas.discardActiveObject();
      this.canvas.renderAll();
    }

    const dataUrl = this.canvas.toDataURL({
      format: 'webp',
      quality,
    });

    // Phục hồi lại đối tượng active cũ
    if (activeObject) {
      this.canvas.setActiveObject(activeObject);
      this.canvas.renderAll();
    }

    return dataUrl;
  }

  public exportCDFObjects(): CDFObject[] {
    if (!this.canvas) return [];
    const objects = this.canvas.getObjects();
    const cdfObjects: CDFObject[] = [];

    for (const obj of objects) {
      const id = (obj as any).id || (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9));
      const customType = (obj as any).customType || 'brush';
      const createdAt = (obj as any).createdAt || Date.now();
      const updatedAt = (obj as any).updatedAt || Date.now();

      const cdfObj: CDFObject = {
        id,
        type: customType,
        x: obj.left || 0,
        y: obj.top || 0,
        width: obj.width,
        height: obj.height,
        scaleX: obj.scaleX || 1,
        scaleY: obj.scaleY || 1,
        angle: obj.angle || 0,
        createdAt,
        updatedAt,
      };

      if (customType === 'brush' && (obj as any).path) {
        // Lưu trữ nét vẽ brush dưới dạng chuỗi SVG Path (Engine-independent)
        cdfObj.name = JSON.stringify((obj as any).path);
        cdfObj.color = obj.stroke;
        cdfObj.strokeWidth = obj.strokeWidth;
      } else if (customType === 'shape') {
        cdfObj.name = (obj as any).shapeName || 'rectangle';
        cdfObj.color = obj.fill as string;
        cdfObj.strokeWidth = obj.strokeWidth;
      } else if (customType === 'sticker') {
        cdfObj.name = (obj as any).stickerName || '';
        cdfObj.imageUrl = (obj as any).imageUrl || '';
      } else if (customType === 'text') {
        cdfObj.text = (obj as any).text || '';
        cdfObj.color = obj.fill as string;
        cdfObj.strokeWidth = (obj as any).fontSize; // dùng strokeWidth lưu trữ fontSize
      }

      cdfObjects.push(cdfObj);
    }

    return cdfObjects;
  }

  public importCDFObjects(cdfObjects: CDFObject[]): void {
    if (!this.canvas) return;
    this.canvas.clear();
    this.canvas.setBackgroundColor('#ffffff', () => {
      this.canvas?.renderAll();
    });

    for (const obj of cdfObjects) {
      if (obj.type === 'brush' && obj.name) {
        try {
          const pathData = JSON.parse(obj.name);
          const pathObj = new fabric.Path(pathData as any, {
            left: obj.x,
            top: obj.y,
            stroke: obj.color || '#000000',
            strokeWidth: obj.strokeWidth || 5,
            fill: undefined,
            scaleX: obj.scaleX,
            scaleY: obj.scaleY,
            angle: obj.angle,
            selectable: true,
            hasControls: true,
          });
          (pathObj as any).id = obj.id;
          (pathObj as any).customType = 'brush';
          (pathObj as any).createdAt = obj.createdAt;
          (pathObj as any).updatedAt = obj.updatedAt;
          this.canvas.add(pathObj);
        } catch (e) {
          console.error('Lỗi khi import nét vẽ brush CDF:', e);
        }
      } else if (obj.type === 'shape') {
        if (obj.name === 'rectangle') {
          const rect = new fabric.Rect({
            left: obj.x,
            top: obj.y,
            width: obj.width,
            height: obj.height,
            fill: obj.color || '#000000',
            scaleX: obj.scaleX,
            scaleY: obj.scaleY,
            angle: obj.angle,
            selectable: true,
            hasControls: true,
          });
          (rect as any).id = obj.id;
          (rect as any).customType = 'shape';
          (rect as any).shapeName = 'rectangle';
          (rect as any).createdAt = obj.createdAt;
          (rect as any).updatedAt = obj.updatedAt;
          this.canvas.add(rect);
        } else if (obj.name === 'ellipse') {
          const rx = (obj.width || 50) / 2;
          const ry = (obj.height || 50) / 2;
          const ellipse = new fabric.Ellipse({
            left: obj.x,
            top: obj.y,
            rx,
            ry,
            fill: obj.color || '#000000',
            scaleX: obj.scaleX,
            scaleY: obj.scaleY,
            angle: obj.angle,
            selectable: true,
            hasControls: true,
          });
          (ellipse as any).id = obj.id;
          (ellipse as any).customType = 'shape';
          (ellipse as any).shapeName = 'ellipse';
          (ellipse as any).createdAt = obj.createdAt;
          (ellipse as any).updatedAt = obj.updatedAt;
          this.canvas.add(ellipse);
        } else if (obj.name === 'line') {
          const line = new fabric.Line([0, 0, obj.width || 100, obj.height || 0], {
            left: obj.x,
            top: obj.y,
            stroke: obj.color || '#000000',
            strokeWidth: obj.strokeWidth || 5,
            scaleX: obj.scaleX,
            scaleY: obj.scaleY,
            angle: obj.angle,
            selectable: true,
            hasControls: true,
          });
          (line as any).id = obj.id;
          (line as any).customType = 'shape';
          (line as any).shapeName = 'line';
          (line as any).createdAt = obj.createdAt;
          (line as any).updatedAt = obj.updatedAt;
          this.canvas.add(line);
        } else if (obj.name === 'star') {
          const points = this.calculateStarPoints(0, 0, 5, 40, 20);
          const star = new fabric.Polygon(points, {
            left: obj.x,
            top: obj.y,
            fill: obj.color || '#000000',
            scaleX: obj.scaleX,
            scaleY: obj.scaleY,
            angle: obj.angle,
            selectable: true,
            hasControls: true,
          });
          (star as any).id = obj.id;
          (star as any).customType = 'shape';
          (star as any).shapeName = 'star';
          (star as any).createdAt = obj.createdAt;
          (star as any).updatedAt = obj.updatedAt;
          this.canvas.add(star);
        }
      } else if (obj.type === 'text') {
        const textObj = new fabric.IText(obj.text || '', {
          left: obj.x,
          top: obj.y,
          fontFamily: 'Plus Jakarta Sans',
          fontSize: obj.strokeWidth || 28, // Dùng strokeWidth khôi phục fontSize
          fill: obj.color || '#000000',
          scaleX: obj.scaleX,
          scaleY: obj.scaleY,
          angle: obj.angle,
          selectable: true,
          hasControls: true,
        });
        (textObj as any).id = obj.id;
        (textObj as any).customType = 'text';
        (textObj as any).createdAt = obj.createdAt;
        (textObj as any).updatedAt = obj.updatedAt;
        this.canvas.add(textObj);
      } else if (obj.type === 'sticker' && obj.imageUrl) {
        fabric.Image.fromURL(obj.imageUrl, (img) => {
          img.set({
            left: obj.x,
            top: obj.y,
            scaleX: obj.scaleX,
            scaleY: obj.scaleY,
            angle: obj.angle,
            selectable: true,
            hasControls: true,
          });
          if (obj.width) img.scaleToWidth(obj.width * (obj.scaleX || 1));
          if (obj.height) img.scaleToHeight(obj.height * (obj.scaleY || 1));

          (img as any).id = obj.id;
          (img as any).customType = 'sticker';
          (img as any).stickerName = obj.name || '';
          (img as any).imageUrl = obj.imageUrl;
          (img as any).createdAt = obj.createdAt;
          (img as any).updatedAt = obj.updatedAt;

          this.canvas?.add(img);
          this.canvas?.renderAll();
        }, { crossOrigin: 'anonymous' });
      }
    }

    this.canvas.renderAll();
  }

  public destroy(): void {
    if (this.canvas) {
      this.canvas.dispose();
      this.canvas = null;
    }
  }
}
