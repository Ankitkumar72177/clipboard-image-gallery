import React, { useState, useEffect, useRef } from 'react';
import { FileText, AlertCircle, ClipboardPaste, CheckCircle2, Keyboard } from 'lucide-react';

interface TextPasteZoneProps {
  onTextPaste: (text: string) => void;
  isMonitoring?: boolean;
}

const TextPasteZone: React.FC<TextPasteZoneProps> = ({ onTextPaste, isMonitoring = false }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const pasteZoneRef = useRef<HTMLDivElement>(null);
  const processingPaste = useRef<boolean>(false);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      // Always handle paste events from keyboard (Ctrl+V / Cmd+V)
      if (processingPaste.current) return;
      
      processingPaste.current = true;
      
      const text = e.clipboardData?.getData('text/plain');
      if (text && text.trim()) {
        onTextPaste(text);
        setSuccess("Text captured successfully!");
        setTimeout(() => setSuccess(null), 2000);
      } else {
        setError('No text found in clipboard.');
        setTimeout(() => setError(null), 3000);
      }
      
      setTimeout(() => {
        processingPaste.current = false;
      }, 100);
    };

    // Always add paste event listener regardless of monitoring state
    document.addEventListener('paste', handlePaste);

    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, [onTextPaste, isMonitoring]);

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

    if (processingPaste.current) return;
    processingPaste.current = true;

    const items = e.dataTransfer.items;
    
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].kind === 'string' && items[i].type.match(/^text\//)) {
          items[i].getAsString((text) => {
            if (text && text.trim()) {
              onTextPaste(text);
              setSuccess("Text captured successfully!");
              setTimeout(() => setSuccess(null), 2000);
            }
            setTimeout(() => {
              processingPaste.current = false;
            }, 100);
          });
          return;
        }
      }
    }
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type === 'text/plain') {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) {
            const text = event.target.result.toString();
            if (text && text.trim()) {
              onTextPaste(text);
              setSuccess("Text captured successfully!");
              setTimeout(() => setSuccess(null), 2000);
            }
          }
          setTimeout(() => {
            processingPaste.current = false;
          }, 100);
        };
        reader.readAsText(file);
      } else {
        setError('The dropped file is not a text file.');
        setTimeout(() => setError(null), 3000);
        setTimeout(() => {
          processingPaste.current = false;
        }, 100);
      }
    } else {
      setTimeout(() => {
        processingPaste.current = false;
      }, 100);
    }
  };

  return (
    <div 
      ref={pasteZoneRef}
      className={`border-2 border-dashed rounded-lg p-6 text-center ${
        isDragging 
          ? 'border-indigo-500 bg-indigo-50' 
          : isMonitoring
            ? 'border-green-400 bg-green-50 hover:border-green-500'
            : 'border-gray-300 hover:border-gray-300 bg-white'
      } transition-colors duration-200`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      tabIndex={0}
    >
      {isMonitoring ? (
        <>
          <ClipboardPaste className="mx-auto h-12 w-12 text-green-500" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Clipboard Monitoring Active</h3>
          <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 mt-2">
            <span className="animate-pulse bg-green-400 rounded-full h-2 w-2 mr-2"></span>
            <span>Watching for copied text</span>
          </div>
          <p className="mt-3 text-sm text-green-600">
            Any text copied to your clipboard will be automatically added
          </p>
        </>
      ) : (
        <>
          <FileText className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Paste Text Here</h3>
          <div className="flex items-center justify-center mt-2 mb-2">
            <Keyboard className="mr-1 h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">
              Press Ctrl+V or ⌘+V to paste
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Copy text from any webpage and paste it here using keyboard shortcuts
          </p>
        </>
      )}
      <p className="mt-1 text-xs text-gray-400">
        You can also drag and drop text files here
      </p>
      
      {error && (
        <div className="mt-4 p-2 bg-red-50 rounded-md flex items-center">
          <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
          <span className="text-sm text-red-700">{error}</span>
        </div>
      )}
      
      {success && (
        <div className="mt-4 p-2 bg-green-50 rounded-md flex items-center">
          <CheckCircle2 className="h-5 w-5 text-green-500 mr-2" />
          <span className="text-sm text-green-700">{success}</span>
        </div>
      )}
    </div>
  );
};

export default TextPasteZone; 