import { CreativeDrawingFormat, CDFObject } from './cdf.schema';

export function validateCDF(data: any): CreativeDrawingFormat {
  if (!data || typeof data !== 'object') {
    return createEmptyCDF();
  }

  const version = typeof data.version === 'number' ? data.version : 1;
  const backgroundColor = typeof data.backgroundColor === 'string' ? data.backgroundColor : '#ffffff';
  const rawObjects = Array.isArray(data.objects) ? data.objects : [];

  const objects: CDFObject[] = [];

  for (const obj of rawObjects) {
    if (!obj || typeof obj !== 'object' || !obj.id || !obj.type) {
      continue; // Skip invalid objects
    }

    const type = obj.type;
    if (!['brush', 'shape', 'sticker', 'text', 'image'].includes(type)) {
      continue; // Skip unknown object types
    }

    const id = String(obj.id);
    const x = typeof obj.x === 'number' ? obj.x : 0;
    const y = typeof obj.y === 'number' ? obj.y : 0;
    const createdAt = typeof obj.createdAt === 'number' ? obj.createdAt : Date.now();
    const updatedAt = typeof obj.updatedAt === 'number' ? obj.updatedAt : Date.now();

    const validatedObj: CDFObject = {
      id,
      type: type as any,
      x,
      y,
      createdAt,
      updatedAt,
      width: typeof obj.width === 'number' ? obj.width : undefined,
      height: typeof obj.height === 'number' ? obj.height : undefined,
      scaleX: typeof obj.scaleX === 'number' ? obj.scaleX : 1,
      scaleY: typeof obj.scaleY === 'number' ? obj.scaleY : 1,
      angle: typeof obj.angle === 'number' ? obj.angle : 0,
      color: typeof obj.color === 'string' ? obj.color : undefined,
      strokeWidth: typeof obj.strokeWidth === 'number' ? obj.strokeWidth : undefined,
      points: Array.isArray(obj.points) ? obj.points.map(Number) : undefined,
      name: typeof obj.name === 'string' ? obj.name : undefined,
      text: typeof obj.text === 'string' ? obj.text : undefined,
      imageUrl: typeof obj.imageUrl === 'string' ? obj.imageUrl : undefined,
    };

    objects.push(validatedObj);
  }

  return {
    version,
    backgroundColor,
    objects,
  };
}

export function createEmptyCDF(): CreativeDrawingFormat {
  return {
    version: 1,
    backgroundColor: '#ffffff',
    objects: [],
  };
}
