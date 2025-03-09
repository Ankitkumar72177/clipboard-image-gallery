import React, { useState, useEffect, useRef } from 'react';
import { Clipboard, AlertCircle, ClipboardPaste } from 'lucide-react';

interface PasteZoneProps {
  onImagePaste: (imageDataUrl: string) => void;
  isMonitoring?: boolean;
}

const PasteZone: React.FC<PasteZoneProps> = ({ onImagePaste, isMonitoring = false }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pasteZoneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      let imageFound = false;
      
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          imageFound = true;
          const blob = items[i].getAsFile();
          if (blob) {
            const reader = new FileReader();
            reader.onload = (event) => {
              if (event.target?.result) {
                onImagePaste(event.target.result as string);
                setError(null);
              }
            };
            reader.readAsDataURL(blob);
          }
          break;
        }
      }

      if (!imageFound) {
        setError('No image found in clipboard. Try copying an image first.');
        setTimeout(() => setError(null), 3000);
      }
    };

    // Only add paste event listeners if monitoring is disabled
    if (!isMonitoring) {
      // Add paste event listener to the document
      document.addEventListener('paste', handlePaste);

      // Add paste event listener to the paste zone
      const pasteZoneElement = pasteZoneRef.current;
      if (pasteZoneElement) {
        pasteZoneElement.addEventListener('paste', handlePaste);
      }

      return () => {
        document.removeEventListener('paste', handlePaste);
        if (pasteZoneElement) {
          pasteZoneElement.removeEventListener('paste', handlePaste);
        }
      };
    }
  }, [onImagePaste, isMonitoring]);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type.match('image.*')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) {
            onImagePaste(event.target.result as string);
            setError(null);
          }
        };
        reader.readAsDataURL(file);
      } else {
        setError('The dropped file is not an image. Please drop an image file.');
        setTimeout(() => setError(null), 3000);
      }
    }
  };

  // Function to request clipboard permission
  const requestClipboardPermission = async () => {
    try {
      await navigator.clipboard.read();
      // Permission granted
      return true;
    } catch (error) {
      // Permission denied or other error
      console.error("Clipboard permission error:", error);
      return false;
    }
  };

  return (
    <div 
      ref={pasteZoneRef}
      className={`border-2 border-dashed rounded-lg p-8 text-center ${
        isDragging 
          ? 'border-indigo-500 bg-indigo-50' 
          : isMonitoring
            ? 'border-green-400 bg-green-50 hover:border-green-500'
            : 'border-gray-300 hover:border-indigo-400 bg-white'
      } transition-colors duration-200 cursor-pointer`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => {
        pasteZoneRef.current?.focus();
        // Request clipboard permission when clicked
        if (isMonitoring) {
          requestClipboardPermission();
        }
      }}
      tabIndex={0}
    >
      {isMonitoring ? (
        <>
          <ClipboardPaste className="mx-auto h-12 w-12 text-green-500" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Clipboard Monitoring Active</h3>
          <p className="mt-1 text-sm text-green-600">
            Any image copied to your clipboard will be automatically added to the gallery
          </p>
        </>
      ) : (
        <>
          <Clipboard className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Paste Image Here</h3>
          <p className="mt-1 text-sm text-gray-500">
            Copy an image to your clipboard and paste it here (Ctrl+V or ⌘+V)
          </p>
        </>
      )}
      <p className="mt-1 text-xs text-gray-400">
        You can also drag and drop an image file here
      </p>
      
      {error && (
        <div className="mt-4 p-2 bg-red-50 rounded-md flex items-center">
          <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
          <span className="text-sm text-red-700">{error}</span>
        </div>
      )}
    </div>
  );
};

export default PasteZone;