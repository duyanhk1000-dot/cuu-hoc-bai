import { CDFObject } from './cdf.schema';

export function createCDFBrush(params: {
  points: number[];
  color: string;
  strokeWidth: number;
}): CDFObject {
  const now = Date.now();
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
    type: 'brush',
    x: 0,
    y: 0,
    points: params.points,
    color: params.color,
    strokeWidth: params.strokeWidth,
    createdAt: now,
    updatedAt: now,
  };
}

export function createCDFShape(params: {
  name: 'rectangle' | 'ellipse' | 'line' | 'star';
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  strokeWidth?: number;
}): CDFObject {
  const now = Date.now();
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
    type: 'shape',
    name: params.name,
    x: params.x,
    y: params.y,
    width: params.width,
    height: params.height,
    color: params.color,
    strokeWidth: params.strokeWidth || 2,
    scaleX: 1,
    scaleY: 1,
    angle: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export function createCDFSticker(params: {
  name: string;
  imageUrl: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
}): CDFObject {
  const now = Date.now();
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
    type: 'sticker',
    name: params.name,
    imageUrl: params.imageUrl,
    x: params.x,
    y: params.y,
    width: params.width || 100,
    height: params.height || 100,
    scaleX: 1,
    scaleY: 1,
    angle: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export function createCDFText(params: {
  text: string;
  x: number;
  y: number;
  color: string;
  fontSize?: number;
}): CDFObject {
  const now = Date.now();
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
    type: 'text',
    text: params.text,
    x: params.x,
    y: params.y,
    color: params.color,
    strokeWidth: params.fontSize || 24, // Dùng strokeWidth lưu fontSize
    scaleX: 1,
    scaleY: 1,
    angle: 0,
    createdAt: now,
    updatedAt: now,
  };
}
