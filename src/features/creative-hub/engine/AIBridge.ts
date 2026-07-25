import { CreativeDrawingFormat } from '../model/cdf.schema';

export class AIBridge {
  public static prepareCDFPayload(cdf: CreativeDrawingFormat): string {
    const objects = cdf.objects;
    if (objects.length === 0) {
      return 'Bức tranh trống, chưa vẽ gì.';
    }

    const summary: string[] = [];

    // Phân loại các đối tượng trong CDF
    const brushObjects = objects.filter(o => o.type === 'brush');
    const shapeObjects = objects.filter(o => o.type === 'shape');
    const stickerObjects = objects.filter(o => o.type === 'sticker');
    const textObjects = objects.filter(o => o.type === 'text');

    if (brushObjects.length > 0) {
      summary.push(`- Vẽ tự do (Brush): ${brushObjects.length} nét vẽ.`);
    }

    if (shapeObjects.length > 0) {
      const shapeCounts: { [key: string]: number } = {};
      shapeObjects.forEach(s => {
        const name = s.name || 'hình dạng';
        shapeCounts[name] = (shapeCounts[name] || 0) + 1;
      });
      const shapeDetails = Object.entries(shapeCounts)
        .map(([name, count]) => `${count} hình ${this.translateShapeName(name)}`)
        .join(', ');
      summary.push(`- Hình hình học (Shapes): ${shapeDetails}.`);
    }

    if (stickerObjects.length > 0) {
      const stickerNames = stickerObjects.map(s => s.name || 'nhãn dán').join(', ');
      summary.push(`- Nhãn dán trang trí (Stickers): các nhãn dán [${stickerNames}].`);
    }

    if (textObjects.length > 0) {
      const textContents = textObjects.map(t => `"${t.text || ''}"`).join(', ');
      summary.push(`- Chữ viết (Text): các cụm văn bản [${textContents}].`);
    }

    return summary.join('\n');
  }

  private static translateShapeName(name: string): string {
    switch (name) {
      case 'rectangle': return 'chữ nhật';
      case 'ellipse': return 'tròn/bầu dục';
      case 'line': return 'đường thẳng';
      case 'star': return 'ngôi sao';
      default: return name;
    }
  }
}
