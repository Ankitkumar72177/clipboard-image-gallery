export interface ImageItem {
  id: string;
  dataUrl: string;
  timestamp: string;
  label: string;
  tags: string[];
}

export interface TextItem {
  id: string;
  content: string;
  timestamp: string;
  label: string;
  tags: string[];
}

export type ItemType = 'image' | 'text';