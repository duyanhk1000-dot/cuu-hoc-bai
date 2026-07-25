export interface CDFObject {
  id: string;
  type: 'brush' | 'shape' | 'sticker' | 'text' | 'image';
  createdAt: number;
  updatedAt: number;
  x: number;
  y: number;
  width?: number;
  height?: number;
  scaleX?: number;
  scaleY?: number;
  angle?: number;
  color?: string;
  strokeWidth?: number;
  points?: number[]; // Coords array: [x1, y1, x2, y2, ...] for brush
  name?: string;     // Sticker name (e.g. 'cat', 'dino') or shape type ('rectangle', 'ellipse', 'line', 'star')
  text?: string;     // Text contents
  imageUrl?: string; // Image path / URL
}

export interface CreativeDrawingFormat {
  version: number;
  backgroundColor: string;
  objects: CDFObject[];
}

export type ToolType = 
  | 'pencil' | 'brush' | 'marker' | 'eraser' 
  | 'rectangle' | 'ellipse' | 'line' | 'star' 
  | 'text' | 'image' | 'sticker' | 'select' | 'fill';
