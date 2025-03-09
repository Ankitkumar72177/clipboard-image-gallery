import React from 'react';
import { Trash2, Tag, Copy, CheckCircle } from 'lucide-react';
import { ImageItem } from '../types';

interface ImageGalleryProps {
  images: ImageItem[];
  onImageSelect: (image: ImageItem) => void;
  onImageDelete: (id: string) => void;
  onLabelEdit: (id: string) => void;
  onCopyImage: (image: ImageItem) => void;
  copiedImageId: string | null;
}

const ImageGallery: React.FC<ImageGalleryProps> = ({ 
  images, 
  onImageSelect, 
  onImageDelete,
  onLabelEdit,
  onCopyImage,
  copiedImageId
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {images.map((image) => (
        <div 
          key={image.id} 
          className="group relative bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200 hover:shadow-md transition-shadow duration-200"
        >
          <div 
            className="aspect-w-1 aspect-h-1 w-full overflow-hidden bg-gray-200 relative"
            onClick={() => onImageSelect(image)}
          >
            <img
              src={image.dataUrl}
              alt={image.label}
              className="w-full h-full object-cover cursor-pointer"
            />
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCopyImage(image);
                }}
                className="p-2 bg-white rounded-full shadow-md text-gray-700 hover:text-indigo-600 transform transition-transform duration-200 hover:scale-110"
                title="Copy to clipboard"
              >
                {copiedImageId === image.id ? (
                  <CheckCircle size={20} className="text-green-500" />
                ) : (
                  <Copy size={20} />
                )}
              </button>
            </div>
          </div>
          
          <div className="p-3">
            <div className="flex justify-between items-start">
              <div 
                className="text-sm font-medium text-gray-900 truncate cursor-pointer"
                onClick={() => onLabelEdit(image.id)}
                title={image.label}
              >
                {image.label}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onImageDelete(image.id);
                }}
                className="text-gray-400 hover:text-red-500 transition-colors duration-200"
                title="Delete image"
              >
                <Trash2 size={16} />
              </button>
            </div>
            
            <div className="mt-1 flex items-center text-xs text-gray-500">
              <span>{new Date(image.timestamp).toLocaleDateString()}</span>
            </div>
            
            {image.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {image.tags.slice(0, 2).map(tag => (
                  <span 
                    key={`${image.id}-tag-${tag}`} 
                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800"
                  >
                    {tag}
                  </span>
                ))}
                {image.tags.length > 2 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                    +{image.tags.length - 2}
                  </span>
                )}
              </div>
            )}
          </div>
          
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onLabelEdit(image.id);
              }}
              className="p-1 bg-white rounded-full shadow-md text-gray-500 hover:text-indigo-600"
              title="Edit label"
            >
              <Tag size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ImageGallery;