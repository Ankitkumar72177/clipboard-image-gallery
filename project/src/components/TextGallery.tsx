import React from 'react';
import { Trash2, Tag, Copy, CheckCircle } from 'lucide-react';
import { TextItem } from '../types';

interface TextGalleryProps {
  texts: TextItem[];
  onTextSelect: (text: TextItem) => void;
  onTextDelete: (id: string) => void;
  onLabelEdit: (id: string) => void;
  onCopyText: (text: TextItem) => void;
  copiedTextId: string | null;
}

const TextGallery: React.FC<TextGalleryProps> = ({ 
  texts, 
  onTextSelect, 
  onTextDelete,
  onLabelEdit,
  onCopyText,
  copiedTextId
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {texts.map((text) => (
        <div 
          key={text.id} 
          className="group relative bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200 hover:shadow-md transition-shadow duration-200"
        >
          <div 
            className="aspect-w-1 aspect-h-1 w-full overflow-hidden bg-gray-50 relative p-4"
            onClick={() => onTextSelect(text)}
          >
            <div className="w-full h-full cursor-pointer overflow-hidden text-ellipsis">
              <p className="text-gray-800 line-clamp-6">
                {text.content}
              </p>
            </div>
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCopyText(text);
                }}
                className="p-2 bg-white rounded-full shadow-md text-gray-700 hover:text-indigo-600 transform transition-transform duration-200 hover:scale-110"
                title="Copy to clipboard"
              >
                {copiedTextId === text.id ? (
                  <CheckCircle size={20} className="text-green-500" />
                ) : (
                  <Copy size={20} />
                )}
              </button>
            </div>
          </div>
          <div className="px-4 py-3 flex justify-between items-center">
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-medium text-gray-900 truncate">
                {text.label}
              </h3>
              <div className="flex flex-wrap gap-1 mt-1">
                {text.tags.slice(0, 3).map((tag, index) => (
                  <span 
                    key={`${text.id}-tag-${index}`}
                    className="inline-block px-2 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-800 rounded-full"
                  >
                    {tag}
                  </span>
                ))}
                {text.tags.length > 3 && (
                  <span className="inline-block px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
                    +{text.tags.length - 3}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-2 ml-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onLabelEdit(text.id);
                }}
                className="p-1.5 text-gray-400 hover:text-indigo-600"
                title="Edit label"
              >
                <Tag size={16} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onTextDelete(text.id);
                }}
                className="p-1.5 text-gray-400 hover:text-red-600"
                title="Delete"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default TextGallery; 