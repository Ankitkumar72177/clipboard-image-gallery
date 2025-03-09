import React, { useState, useEffect, useRef } from 'react';
import { Search, Trash2, Download, Tag, X, Plus, Image as ImageIcon, Copy, CheckCircle, ClipboardPaste, AlertCircle, FileText, Layers, Edit } from 'lucide-react';
import ImageGallery from './components/ImageGallery';
import PasteZone from './components/PasteZone';
import TextGallery from './components/TextGallery';
import TextPasteZone from './components/TextPasteZone';
import { ImageItem, TextItem, ItemType } from './types';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

function App() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [texts, setTexts] = useState<TextItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedImage, setSelectedImage] = useState<ImageItem | null>(null);
  const [selectedText, setSelectedText] = useState<TextItem | null>(null);
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [currentItemId, setCurrentItemId] = useState<string | null>(null);
  const [currentItemType, setCurrentItemType] = useState<ItemType>('image');
  const [copiedImageId, setCopiedImageId] = useState<string | null>(null);
  const [copiedTextId, setCopiedTextId] = useState<string | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [activeTab, setActiveTab] = useState<ItemType>('image');
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [storageType, setStorageType] = useState<'local' | 'supabase'>('local');
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null);
  const [clipboardPermissionError, setClipboardPermissionError] = useState(false);
  const [monitoringAttempts, setMonitoringAttempts] = useState(0);
  const labelInputRef = useRef<HTMLInputElement>(null);
  const clipboardMonitorRef = useRef<number | null>(null);
  const documentHasFocus = useRef<boolean>(document.hasFocus());
  const lastClipboardCheck = useRef<number>(0);
  const processedImages = useRef<Set<string>>(new Set());
  const processedTexts = useRef<Set<string>>(new Set());
  const initialMonitoringSetup = useRef<boolean>(false);
  const lastProcessedDataUrl = useRef<string | null>(null);
  const lastProcessedText = useRef<string | null>(null);
  const lastProcessedHash = useRef<string | null>(null);
  const imageCounter = useRef<number>(0);
  const textCounter = useRef<number>(0);
  const isProcessingPaste = useRef<boolean>(false);
  const lastTextPasteTime = useRef<number>(0);
  const lastMonitoredText = useRef<string | null>(null);
  const isMonitoringText = useRef<boolean>(false);
  const isMonitoringImages = useRef<boolean>(false);
  const textMonitorRef = useRef<number | null>(null);
  const imageMonitorRef = useRef<number | null>(null);
  const [textMonitoringActive, setTextMonitoringActive] = useState(false);
  const [imageMonitoringActive, setImageMonitoringActive] = useState(false);
  const [isEditingText, setIsEditingText] = useState(false);
  const [editedTextContent, setEditedTextContent] = useState('');
  const [isMonitoringTextEnabled, setIsMonitoringTextEnabled] = useState(false);
  const [isMonitoringImagesEnabled, setIsMonitoringImagesEnabled] = useState(false);

  // Add performance optimization settings
  const MONITOR_SETTINGS = {
    TEXT_INTERVAL: 400, // Reduce interval for faster checking (was 800)
    IMAGE_INTERVAL: 500, // Reduce interval for faster checking (was 1000)
    DEBOUNCE_TIME: 150, // Short debounce for rapid captures
    MAX_CONCURRENT: 2 // Limit concurrent clipboard operations
  };
  
  // Track concurrent operations
  const concurrentOperations = useRef<number>(0);

  useEffect(() => {
    loadImages();
  }, [storageType]);

  useEffect(() => {
    if (images.length > 0) {
      saveImages();
    }
  }, [images]);

  useEffect(() => {
    if (isLabelModalOpen && labelInputRef.current) {
      labelInputRef.current.focus();
    }
  }, [isLabelModalOpen]);

  useEffect(() => {
    if (copiedImageId) {
      const timer = setTimeout(() => {
        setCopiedImageId(null);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [copiedImageId]);

  useEffect(() => {
    if (notificationMessage) {
      const timer = setTimeout(() => {
        setNotificationMessage(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [notificationMessage]);

  useEffect(() => {
    const handleFocus = () => {
      documentHasFocus.current = true;
      if (isMonitoring) {
        setClipboardPermissionError(false);
        startMonitoring();
      }
    };
    
    const handleBlur = () => {
      documentHasFocus.current = false;
    };
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        documentHasFocus.current = true;
        if (isMonitoring) {
          startMonitoring();
        }
      } else {
        documentHasFocus.current = false;
      }
    };
    
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isMonitoring]);

  useEffect(() => {
    if (isMonitoring && !initialMonitoringSetup.current) {
      initialMonitoringSetup.current = true;
      // Add a small delay before starting monitoring to prevent immediate clipboard processing
      const timer = setTimeout(() => {
      startMonitoring();
      }, 500);
      return () => clearTimeout(timer);
    } else if (!isMonitoring) {
      stopMonitoring();
      processedImages.current.clear();
      lastProcessedDataUrl.current = null;
      initialMonitoringSetup.current = false;
    }

    return () => {
      stopMonitoring();
    };
  }, [isMonitoring]);

  useEffect(() => {
    loadTexts();
  }, [storageType]);

  useEffect(() => {
    if (texts.length > 0) {
      saveTexts();
    }
  }, [texts]);

  // Performance-optimized text monitoring
  const startTextMonitoring = async () => {
    stopTextMonitoring();
    
    if (!isMonitoringTextEnabled) return;
    
    console.log("Starting optimized TEXT monitoring");
    
    // Set states
    isMonitoringText.current = true;
    setTextMonitoringActive(true);
    
    // Perform an immediate check with small delay to let UI update
    setTimeout(async () => {
      try {
        const initialText = await navigator.clipboard.readText();
        if (initialText && initialText.trim() && initialText !== lastProcessedText.current) {
          processTextFromClipboard(initialText);
        }
      } catch (e) {
        console.error("Initial text check failed:", e);
      }
    }, 50);
    
    // Set up faster interval for more responsive checking
    textMonitorRef.current = window.setInterval(async () => {
      if (!isMonitoringTextEnabled) {
        stopTextMonitoring();
        return;
      }
      
      // Skip if too many concurrent operations
      if (concurrentOperations.current >= MONITOR_SETTINGS.MAX_CONCURRENT) {
        console.log("Too many concurrent operations, skipping text check");
        return;
      }
      
      // Only check when document has focus
      if (document.hasFocus()) {
        try {
          concurrentOperations.current++;
          const text = await navigator.clipboard.readText();
          
          if (text && text.trim() && text !== lastProcessedText.current) {
            // Use a small timeout to debounce rapid changes
            const processingText = text; // Capture current value
            setTimeout(() => {
              // Only process if it's still the latest text
              if (processingText === text) {
                processTextFromClipboard(processingText);
              }
            }, MONITOR_SETTINGS.DEBOUNCE_TIME);
          }
        } catch (err) {
          console.error("Text clipboard error:", err);
        } finally {
          concurrentOperations.current--;
        }
      }
    }, MONITOR_SETTINGS.TEXT_INTERVAL);
  };

  const startImageMonitoring = async () => {
    // Stop any existing image monitoring
    stopImageMonitoring();
    
    // Double-check state to ensure we should be monitoring
    if (!isMonitoringImagesEnabled) {
      console.log("Image monitoring is disabled, not starting");
      return;
    }
    
    // Set monitoring state
    isMonitoringImages.current = true;
    setImageMonitoringActive(true);
    console.log("Starting IMAGE clipboard monitoring with enhanced detection");
    
    try {
      // More aggressive image monitoring with more frequent checks
      imageMonitorRef.current = window.setInterval(() => {
        // Check if monitoring is still enabled
        if (!isMonitoringImagesEnabled || !isMonitoringImages.current) {
          console.log("Image monitoring was disabled, stopping interval");
          stopImageMonitoring();
          return;
        }
        
        // Proceed with check if conditions are met
        if (document.hasFocus()) {
          console.log("Checking clipboard for images...");
          
          // Simpler and more direct approach
          navigator.clipboard.read().then(async items => {
            try {
              for (const item of items) {
                // Look for image types in the clipboard
        if (item.types.some(type => type.startsWith('image/'))) {
                  console.log("Found image type in clipboard");
          const imageType = item.types.find(type => type.startsWith('image/'));
          
          if (imageType) {
                    console.log("Getting image data:", imageType);
                    // Get the image blob
                    try {
            const blob = await item.getType(imageType);
                      console.log("Got image blob of size:", blob.size);
                      
                      // Skip duplicate check for now to ensure images are captured
                      // Read the image data
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        if (event.target?.result) {
                          console.log("Successfully read image data");
                          const dataUrl = event.target.result as string;
                          
                          // Process the image
                          handleImagePaste(dataUrl);
                          console.log("Image processed and added to gallery");
                          setNotificationMessage("Image captured from clipboard!");
                        }
                      };
                      reader.readAsDataURL(blob);
                      break;
                    } catch (blobError) {
                      console.error("Error getting image blob:", blobError);
                    }
                  }
                }
              }
            } catch (itemError) {
              console.error("Error processing clipboard items:", itemError);
            }
          }).catch(e => {
            console.error("Error reading clipboard for images:", e);
          });
        }
      }, 500); // Check frequently (increased from 600ms)
    } catch (error) {
      console.error("Image monitoring setup error:", error);
    }
  };

  const stopTextMonitoring = () => {
    console.log("Stopping TEXT monitoring");
    if (textMonitorRef.current) {
      window.clearInterval(textMonitorRef.current);
      textMonitorRef.current = null;
    }
    isMonitoringText.current = false;
    setTextMonitoringActive(false);
  };

  const stopImageMonitoring = () => {
    console.log("Stopping IMAGE monitoring");
    if (imageMonitorRef.current) {
      window.clearInterval(imageMonitorRef.current);
      imageMonitorRef.current = null;
    }
    isMonitoringImages.current = false;
    setImageMonitoringActive(false);
  };

  const startMonitoring = async () => {
    // Stop all existing monitoring
    stopMonitoring();
    
    if (!isMonitoring) return;

    console.log("Starting all clipboard monitoring");
    
    // Start both monitoring types separately
    startTextMonitoring();
    startImageMonitoring();
    
    setNotificationMessage("Clipboard monitoring activated");
  };

  const stopMonitoring = () => {
    console.log("Stopping all clipboard monitoring");
    stopTextMonitoring();
    stopImageMonitoring();
  };

  // Update the global monitoring state based on individual states
  const updateGlobalMonitoringState = () => {
    // Global state should only be true if BOTH are enabled
    const shouldBeGloballyEnabled = isMonitoringTextEnabled && isMonitoringImagesEnabled;
    if (isMonitoring !== shouldBeGloballyEnabled) {
      setIsMonitoring(shouldBeGloballyEnabled);
    }
  };

  // Update toggle functions to use the new helper
  const toggleTextMonitoring = () => {
    // Toggle the state
    const newState = !isMonitoringTextEnabled;
    console.log("Text monitoring toggled:", newState ? "ON" : "OFF");
    
    // Update state immediately
    setIsMonitoringTextEnabled(newState);
    
    if (newState) {
      // Turn ON text monitoring
      console.log("Turning ON text monitoring");
      
      // Don't update global monitoring state here
      // Instead, let the useEffect handle it
      
      // Reset text tracking variables
      processedTexts.current = new Set();
      lastProcessedText.current = null;
      
      // Force update the monitoring state immediately
      isMonitoringText.current = true;
      setTextMonitoringActive(true);
      
      // Request text permission and do immediate check
      navigator.clipboard.readText()
        .then(text => {
          // Do immediate check
          if (text && text.trim()) {
            console.log("Found text in initial check");
            processTextFromClipboard(text);
          }
          
          // Start regular text monitoring
          startTextMonitoring();
          setNotificationMessage("Text monitoring activated");
        })
        .catch(e => {
          console.error("Text permission error:", e);
          setClipboardPermissionError(true);
          
          // Still try to start monitoring
          startTextMonitoring();
          setNotificationMessage("Text monitoring activated (permission needed)");
        });
    } else {
      // Stopping text monitoring
      stopTextMonitoring();
      setNotificationMessage("Text monitoring stopped");
    }
  };
  
  const toggleImageMonitoring = () => {
    // Toggle the state
    const newState = !isMonitoringImagesEnabled;
    console.log("Image monitoring toggled:", newState ? "ON" : "OFF");
    
    // Update state immediately
    setIsMonitoringImagesEnabled(newState);
    
    if (newState) {
      // Turn ON image monitoring
      console.log("Turning ON image monitoring");
      
      // Don't update global monitoring state here
      // Instead, let the useEffect handle it
      
      // Reset image tracking variables
      processedImages.current = new Set();
      lastProcessedDataUrl.current = null;
      
      // Clear any existing monitor
      if (imageMonitorRef.current !== null) {
        window.clearInterval(imageMonitorRef.current);
        imageMonitorRef.current = null;
      }
      
      // Force monitoring state active
      isMonitoringImages.current = true;
      setImageMonitoringActive(true);
      
      // Start a new, simple monitoring interval that doesn't depend on complex conditions
      const interval = window.setInterval(() => {
        if (document.hasFocus()) {
          console.log("IMAGE MONITOR: Checking clipboard...");
          checkImageClipboard();
        }
      }, 800); // Use a slightly longer interval to reduce performance impact
      
      // Save the interval ID
      imageMonitorRef.current = interval;
      
      // Also do an immediate check
      setTimeout(checkImageClipboard, 100);
      
      // Show notification
      setNotificationMessage("Image monitoring activated");
    } else {
      // Turn OFF image monitoring
      console.log("Turning OFF image monitoring");
      
      // Clean up the interval
      if (imageMonitorRef.current !== null) {
        window.clearInterval(imageMonitorRef.current);
        imageMonitorRef.current = null;
      }
      
      // Update monitoring states
      isMonitoringImages.current = false;
      setImageMonitoringActive(false);
      
      // Show notification
      setNotificationMessage("Image monitoring stopped");
    }
  };
  
  // Add useEffect to update global state when individual states change
  useEffect(() => {
    // Update global monitoring state based on individual states
    const shouldBeGloballyEnabled = isMonitoringTextEnabled && isMonitoringImagesEnabled;
    setIsMonitoring(shouldBeGloballyEnabled);
  }, [isMonitoringTextEnabled, isMonitoringImagesEnabled]);
  
  // Update the toggleClipboardMonitoring for faster response
  const toggleClipboardMonitoring = () => {
    const newState = !isMonitoring;
    
    // Update all states immediately
    setIsMonitoring(newState);
    setIsMonitoringTextEnabled(newState);
    setIsMonitoringImagesEnabled(newState);
    
    if (newState) {
      // Clean up existing monitoring
      stopTextMonitoring();
      stopImageMonitoring();
      
      // Reset tracking variables
      processedTexts.current = new Set();
      processedImages.current = new Set();
      lastProcessedText.current = null;
      lastProcessedDataUrl.current = null;
      concurrentOperations.current = 0;
      
      // Set states
      isMonitoringText.current = true;
      isMonitoringImages.current = true;
      setTextMonitoringActive(true);
      setImageMonitoringActive(true);
      
      // Start optimized text monitoring
      textMonitorRef.current = window.setInterval(async () => {
        if (document.hasFocus() && concurrentOperations.current < MONITOR_SETTINGS.MAX_CONCURRENT) {
          try {
            concurrentOperations.current++;
            const text = await navigator.clipboard.readText();
            if (text && text.trim() && text !== lastProcessedText.current) {
              processTextFromClipboard(text);
            }
          } catch (err) {
            console.error("Text monitoring error:", err);
          } finally {
            concurrentOperations.current--;
          }
        }
      }, MONITOR_SETTINGS.TEXT_INTERVAL);
      
      // Start optimized image monitoring
      imageMonitorRef.current = window.setInterval(() => {
        if (document.hasFocus()) {
          checkImageClipboard();
        }
      }, MONITOR_SETTINGS.IMAGE_INTERVAL);
      
      // Do quick initial checks
      setTimeout(() => {
        // Check for text
        navigator.clipboard.readText()
          .then(text => {
            if (text && text.trim() && text !== lastProcessedText.current) {
              processTextFromClipboard(text);
            }
          })
          .catch(e => console.error("Initial text check error:", e));
        
        // Check for images
        checkImageClipboard();
      }, 50);
      
      setNotificationMessage("Fast clipboard monitoring activated");
    } else {
      // Turn everything off
      stopTextMonitoring();
      stopImageMonitoring();
      
      // Clear states
      isMonitoringText.current = false;
      isMonitoringImages.current = false;
      setTextMonitoringActive(false);
      setImageMonitoringActive(false);
      
      setNotificationMessage("Clipboard monitoring stopped");
    }
  };

  // Improve processing performance for text
  const processTextFromClipboard = (text: string) => {
    if (!text || !text.trim() || text === lastProcessedText.current) return;
    
    try {
      // Immediately update last processed to prevent duplicates
      lastProcessedText.current = text;
      
      // Create text item (more efficient)
      const uniqueId = Date.now() + '-' + Math.random().toString(36).substring(2, 10);
      const newText: TextItem = {
        id: uniqueId,
        content: text,
        timestamp: new Date().toISOString(),
        label: generateUniqueTextName(),
        tags: []
      };
      
      // Batch state update
      setTexts(prevTexts => [newText, ...prevTexts]);
      setNotificationMessage("New text captured!");
    } catch (error) {
      console.error("Text processing error:", error);
    }
  };

  const generateImageHash = async (blob: Blob): Promise<string> => {
    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const sampleSize = Math.min(50, bytes.length);
    const step = Math.max(1, Math.floor(bytes.length / sampleSize));
    
    let samples = [];
    for (let i = 0; i < bytes.length; i += step) {
      samples.push(bytes[i]);
    }
    
    return `${blob.size}-${blob.type}-${samples.join('')}`;
  };

  const generateTextHash = async (text: string): Promise<string> => {
    // More robust hash for text that captures content better
    const length = text.length;
    // Take more content for the hash to improve accuracy
    const firstPart = text.substring(0, Math.min(100, length));
    const lastPart = length > 200 ? text.substring(length - 100) : '';
    // Include word count as an additional signal
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    return `${length}-${wordCount}-${firstPart}${lastPart}`;
  };

  const loadImages = async () => {
    try {
      if (storageType === 'local') {
        const savedImages = localStorage.getItem('clipboardImages');
        if (savedImages) {
          const parsedImages = JSON.parse(savedImages);
          setImages(parsedImages);
          
          // Initialize the counter based on existing images with more robust parsing
          const existingNumbers = parsedImages
            .map(img => {
              // Extract the number from the label, handling both old and new formats
              const match = img.label.match(/Image (\d+)/);
              return match ? parseInt(match[1]) : 0;
            })
            .filter(num => !isNaN(num));
          
          if (existingNumbers.length > 0) {
            // Set the counter to at least 10 higher than the max to avoid conflicts
            imageCounter.current = Math.max(0, ...existingNumbers) + 10;
          } else {
            imageCounter.current = 10; // Start from a reasonable number
          }
        }
      } else if (storageType === 'supabase') {
        const { data, error } = await supabase
          .from('images')
          .select('*')
          .order('timestamp', { ascending: false });
          
        if (error) throw error;
        
        if (data) {
          setImages(data);
          
          // Initialize the counter based on existing images with more robust parsing
          const existingNumbers = data
            .map(img => {
              // Extract the number from the label, handling both old and new formats
              const match = img.label.match(/Image (\d+)/);
              return match ? parseInt(match[1]) : 0;
            })
            .filter(num => !isNaN(num));
          
          if (existingNumbers.length > 0) {
            // Set the counter to at least 10 higher than the max to avoid conflicts
            imageCounter.current = Math.max(0, ...existingNumbers) + 10;
          } else {
            imageCounter.current = 10; // Start from a reasonable number
          }
        }
      }
    } catch (error) {
      console.error('Error loading images:', error);
      setNotificationMessage("Failed to load images");
    }
  };

  const saveImages = async () => {
    try {
      if (storageType === 'local') {
        try {
          const maxImagesToStore = 50;
          const imagesToStore = images.slice(0, maxImagesToStore);
          
          localStorage.setItem('clipboardImages', JSON.stringify(imagesToStore));
        } catch (error) {
          if (error instanceof DOMException && error.name === 'QuotaExceededError') {
            setNotificationMessage("Storage limit reached. Keeping only recent images.");
            
            const recentImages = images.slice(0, Math.max(10, images.length / 2));
            localStorage.setItem('clipboardImages', JSON.stringify(recentImages));
            
            setImages(recentImages);
          } else {
            throw error;
          }
        }
      } else if (storageType === 'supabase') {
        // Supabase implementation would go here
      }
    } catch (error) {
      console.error('Error saving images:', error);
      setNotificationMessage("Failed to save images");
    }
  };

  const generateUniqueName = () => {
    // Increment the counter
    imageCounter.current += 1;
    
    // Get current date/time components for uniqueness
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    
    // Include counter and time in name to guarantee uniqueness
    return `Image ${imageCounter.current} (${hours}:${minutes})`;
  };

  // Fast image paste handling
  const handleImagePaste = async (imageDataUrl: string) => {
    if (imageDataUrl === lastProcessedDataUrl.current) return;
    
    try {
      // Immediately update to prevent duplicates
      lastProcessedDataUrl.current = imageDataUrl;
      
      // Create image efficiently
      const uniqueId = Date.now() + '-' + Math.random().toString(36).substring(2, 10);
      const newImage: ImageItem = {
        id: uniqueId,
        dataUrl: imageDataUrl,
        timestamp: new Date().toISOString(),
        label: generateUniqueName(),
        tags: []
      };
      
      // Batch state update
      setImages(prevImages => [newImage, ...prevImages]);
      setNotificationMessage("New image added!");
    } catch (error) {
      console.error('Image processing error:', error);
    }
  };

  const handleImageDelete = (id: string) => {
    setImages(images.filter(image => image.id !== id));
    if (selectedImage?.id === id) {
      setSelectedImage(null);
    }
  };

  const handleImageSelect = (image: ImageItem) => {
    setSelectedImage(image);
  };

  const handleImageDownload = (image: ImageItem) => {
    const link = document.createElement('a');
    link.href = image.dataUrl;
    link.download = `${image.label || 'image'}-${new Date().toISOString().slice(0, 10)}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyToClipboard = async (image: ImageItem) => {
    try {
      const response = await fetch(image.dataUrl);
      const blob = await response.blob();
      
      const item = new ClipboardItem({
        [blob.type]: blob
      });
      
      await navigator.clipboard.write([item]);
      
      setCopiedImageId(image.id);
    } catch (error) {
      console.error('Failed to copy image to clipboard:', error);
      setNotificationMessage("Failed to copy image to clipboard");
    }
  };

  const openLabelModal = (id: string, type: ItemType = 'image') => {
    setCurrentItemId(id);
    setCurrentItemType(type);
    
    if (type === 'image') {
    const image = images.find(img => img.id === id);
    if (image) {
      setNewLabel(image.label);
      }
    } else {
      const text = texts.find(txt => txt.id === id);
      if (text) {
        setNewLabel(text.label);
      }
    }
    
    setIsLabelModalOpen(true);
  };

  const handleLabelSave = () => {
    if (!currentItemId || !newLabel.trim()) {
      setIsLabelModalOpen(false);
      return;
    }
    
    if (currentItemType === 'image') {
      setImages(images.map(image => 
        image.id === currentItemId
          ? { ...image, label: newLabel.trim() } 
          : image
      ));
      
      if (selectedImage?.id === currentItemId) {
        setSelectedImage({
          ...selectedImage,
          label: newLabel.trim()
        });
      }
    } else {
      setTexts(texts.map(text => 
        text.id === currentItemId
          ? { ...text, label: newLabel.trim() } 
          : text
      ));
      
      if (selectedText?.id === currentItemId) {
        setSelectedText({
          ...selectedText,
          label: newLabel.trim()
        });
      }
    }
    
    setIsLabelModalOpen(false);
    setNewLabel('');
    setCurrentItemId(null);
  };

  const handleAddTag = (id: string, tag: string, type: ItemType = 'image') => {
    if (!tag.trim()) return;
    
    const formattedTag = tag.trim().toLowerCase();
    
    if (type === 'image') {
    setImages(images.map(image => 
        image.id === id && !image.tags.includes(formattedTag)
          ? { ...image, tags: [...image.tags, formattedTag] } 
        : image
    ));
    
      if (selectedImage?.id === id && !selectedImage.tags.includes(formattedTag)) {
      setSelectedImage({
        ...selectedImage,
          tags: [...selectedImage.tags, formattedTag]
        });
      }
    } else {
      setTexts(texts.map(text => 
        text.id === id && !text.tags.includes(formattedTag)
          ? { ...text, tags: [...text.tags, formattedTag] } 
          : text
      ));
      
      if (selectedText?.id === id && !selectedText.tags.includes(formattedTag)) {
        setSelectedText({
          ...selectedText,
          tags: [...selectedText.tags, formattedTag]
        });
      }
    }
  };

  const handleRemoveTag = (id: string, tagToRemove: string, type: ItemType = 'image') => {
    if (type === 'image') {
    setImages(images.map(image => 
      image.id === id
        ? { ...image, tags: image.tags.filter(tag => tag !== tagToRemove) } 
        : image
    ));
    
    if (selectedImage?.id === id) {
      setSelectedImage({
        ...selectedImage,
        tags: selectedImage.tags.filter(tag => tag !== tagToRemove)
      });
      }
    } else {
      setTexts(texts.map(text => 
        text.id === id
          ? { ...text, tags: text.tags.filter(tag => tag !== tagToRemove) } 
          : text
      ));
      
      if (selectedText?.id === id) {
        setSelectedText({
          ...selectedText,
          tags: selectedText.tags.filter(tag => tag !== tagToRemove)
        });
      }
    }
  };

  const loadTexts = async () => {
    try {
      if (storageType === 'local') {
        const savedTexts = localStorage.getItem('clipboardTexts');
        if (savedTexts) {
          const parsedTexts = JSON.parse(savedTexts);
          setTexts(parsedTexts);
          
          // Initialize the counter based on existing texts with more robust parsing
          const existingNumbers = parsedTexts
            .map(txt => {
              // Extract the number from the label, handling both old and new formats
              const match = txt.label.match(/Text (\d+)/);
              return match ? parseInt(match[1]) : 0;
            })
            .filter(num => !isNaN(num));
          
          if (existingNumbers.length > 0) {
            // Set the counter to at least 10 higher than the max to avoid conflicts
            textCounter.current = Math.max(0, ...existingNumbers) + 10;
    } else {
            textCounter.current = 10; // Start from a reasonable number
          }
        }
      } else if (storageType === 'supabase') {
        const { data, error } = await supabase
          .from('texts')
          .select('*')
          .order('timestamp', { ascending: false });
          
        if (error) throw error;
        
        if (data) {
          setTexts(data);
          
          // Initialize the counter based on existing texts with more robust parsing
          const existingNumbers = data
            .map(txt => {
              // Extract the number from the label, handling both old and new formats
              const match = txt.label.match(/Text (\d+)/);
              return match ? parseInt(match[1]) : 0;
            })
            .filter(num => !isNaN(num));
          
          if (existingNumbers.length > 0) {
            // Set the counter to at least 10 higher than the max to avoid conflicts
            textCounter.current = Math.max(0, ...existingNumbers) + 10;
          } else {
            textCounter.current = 10; // Start from a reasonable number
          }
        }
      }
    } catch (error) {
      console.error('Error loading texts:', error);
      setNotificationMessage("Failed to load texts");
    }
  };

  const saveTexts = async () => {
    try {
      if (storageType === 'local') {
        try {
          const maxTextsToStore = 100;
          const textsToStore = texts.slice(0, maxTextsToStore);
          
          localStorage.setItem('clipboardTexts', JSON.stringify(textsToStore));
        } catch (error) {
          if (error instanceof DOMException && error.name === 'QuotaExceededError') {
            setNotificationMessage("Storage limit reached. Keeping only recent texts.");
            
            const recentTexts = texts.slice(0, Math.max(20, texts.length / 2));
            localStorage.setItem('clipboardTexts', JSON.stringify(recentTexts));
            
            setTexts(recentTexts);
          } else {
            throw error;
          }
        }
      } else if (storageType === 'supabase') {
        // Supabase implementation would go here
      }
    } catch (error) {
      console.error('Error saving texts:', error);
    }
  };

  const generateUniqueTextName = () => {
    // Increment the counter
    textCounter.current += 1;
    
    // Get current date/time components for uniqueness
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    
    // Include counter and time in name to guarantee uniqueness
    return `Text ${textCounter.current} (${hours}:${minutes})`;
  };

  const handleTextPaste = (textContent: string) => {
    try {
      // Prevent overlapping paste operations but allow intentional duplicates
      if (isProcessingPaste.current) {
        console.log('Already processing a paste operation, skipping...');
        return;
      }
      
      // Set processing flag
      isProcessingPaste.current = true;
      
      // For manual pastes, we'll be less strict about duplicates
      // Only check if this exact same content was just processed in the last few seconds
      const isDuplicateOfLastPaste = 
        lastProcessedText.current === textContent && 
        // Only consider it a duplicate if it was processed in the last 2 seconds (unintentional duplicate)
        Date.now() - lastTextPasteTime.current < 2000;
      
      // If it's a very recent duplicate (likely unintentional), notify and exit
      if (isDuplicateOfLastPaste) {
        setNotificationMessage("Duplicate text detected - not added");
        setTimeout(() => { isProcessingPaste.current = false; }, 100);
        return;
      }
      
      const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
      
      const newText: TextItem = {
        id: uniqueId,
        content: textContent,
        timestamp: new Date().toISOString(),
        label: generateUniqueTextName(),
        tags: []
      };
      
      lastProcessedText.current = textContent;
      lastTextPasteTime.current = Date.now();  // Track when this paste happened
      setTexts(prevTexts => [newText, ...prevTexts]);
      setNotificationMessage("New text captured");
      
      // Clear processing flag after small delay
      setTimeout(() => {
        isProcessingPaste.current = false;
      }, 100);
    } catch (error) {
      console.error('Error processing text:', error);
      isProcessingPaste.current = false;
    }
  };

  const handleTextDelete = (id: string) => {
    setTexts(texts.filter(text => text.id !== id));
    if (selectedText?.id === id) {
      setSelectedText(null);
    }
  };

  const handleTextSelect = (text: TextItem) => {
    setSelectedText(text);
    setEditedTextContent(text.content);
    setIsEditingText(false);
    setSelectedImage(null);
  };

  const handleCopyTextToClipboard = async (text: TextItem) => {
    try {
      await navigator.clipboard.writeText(text.content);
      setCopiedTextId(text.id);
      setNotificationMessage("Text copied to clipboard");
      
      setTimeout(() => {
        setCopiedTextId(null);
      }, 2000);
    } catch (error) {
      console.error('Failed to copy text:', error);
      setNotificationMessage("Failed to copy text to clipboard");
    }
  };

  const handleTextContentSave = () => {
    if (!selectedText) return;
    
    // Update the text content in the collection
    setTexts(prevTexts => 
      prevTexts.map(text => 
        text.id === selectedText.id 
          ? { ...text, content: editedTextContent } 
          : text
      )
    );
    
    // Update the selected text with the new content
    setSelectedText({
      ...selectedText,
      content: editedTextContent
    });
    
    // Exit editing mode
    setIsEditingText(false);
    setNotificationMessage("Text content updated!");
  };

  // Performance-optimized image monitoring
  const checkImageClipboard = async () => {
    // Skip if disabled or too many concurrent operations
    if (!isMonitoringImagesEnabled || 
        concurrentOperations.current >= MONITOR_SETTINGS.MAX_CONCURRENT) {
      return;
    }
    
    try {
      concurrentOperations.current++;
      const items = await navigator.clipboard.read();
      
      for (const item of items) {
        if (item.types.some(type => type.startsWith('image/'))) {
          const imageType = item.types.find(type => type.startsWith('image/'));
          if (!imageType) continue;
          
          try {
            // Process image with optimized pipeline
            const blob = await item.getType(imageType);
            
            // Use more efficient Promise-based approach
            const reader = new FileReader();
            const dataUrl = await new Promise<string>((resolve, reject) => {
              reader.onload = () => reader.result ? resolve(reader.result as string) : reject();
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
            
            // Skip duplicate
            if (dataUrl === lastProcessedDataUrl.current) return;
            
            // Debounce rapid changes
            setTimeout(() => {
              handleImagePaste(dataUrl);
              setNotificationMessage("New image captured!");
            }, MONITOR_SETTINGS.DEBOUNCE_TIME);
            
            // Only process one image at a time
            break;
          } catch (error) {
            console.error("Image processing error:", error);
          }
        }
      }
    } catch (error) {
      console.error("Image clipboard error:", error);
    } finally {
      concurrentOperations.current--;
    }
  };
  
  // Fix filteredImages and filteredTexts
  const filteredImages = images.filter(image => {
    const searchLower = searchTerm.toLowerCase();
    return (
      image.label.toLowerCase().includes(searchLower) ||
      image.tags.some(tag => tag.toLowerCase().includes(searchLower))
    );
  });

  const filteredTexts = texts.filter(text => {
    const searchLower = searchTerm.toLowerCase();
    return (
      text.label.toLowerCase().includes(searchLower) ||
      text.content.toLowerCase().includes(searchLower) ||
      text.tags.some(tag => tag.toLowerCase().includes(searchLower))
    );
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <Layers className="mr-2" size={24} />
            Clipboard Manager
          </h1>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <button
                onClick={toggleTextMonitoring}
                className={`inline-flex items-center px-3 py-1.5 border rounded-md text-sm font-medium ${
                  isMonitoringTextEnabled 
                    ? 'bg-blue-100 text-blue-700 border-blue-300' 
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
                title={isMonitoringTextEnabled ? "Text monitoring active - click to stop" : "Click to start monitoring clipboard for text"}
              >
                <FileText size={16} className={`mr-1.5 ${isMonitoringTextEnabled ? 'text-blue-500' : ''}`} />
                {isMonitoringTextEnabled ? 'Text: On' : 'Monitor Text'}
              </button>
              
              <button
                onClick={toggleImageMonitoring}
                className={`inline-flex items-center px-3 py-1.5 border rounded-md text-sm font-medium ${
                  isMonitoringImagesEnabled 
                    ? 'bg-purple-100 text-purple-700 border-purple-300' 
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
                title={isMonitoringImagesEnabled ? "Image monitoring active - click to stop" : "Click to start monitoring clipboard for images"}
              >
                <ImageIcon size={16} className={`mr-1.5 ${isMonitoringImagesEnabled ? 'text-purple-500' : ''}`} />
                {isMonitoringImagesEnabled ? 'Images: On' : 'Monitor Images'}
              </button>
              
            <button
              onClick={toggleClipboardMonitoring}
              className={`inline-flex items-center px-3 py-1.5 border rounded-md text-sm font-medium ${
                isMonitoring 
                  ? 'bg-indigo-100 text-indigo-700 border-indigo-300' 
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
                title="Toggle all monitoring"
            >
              <ClipboardPaste size={16} className={`mr-1.5 ${isMonitoring ? 'text-indigo-500' : ''}`} />
                {isMonitoring ? 'All: On' : 'Monitor All'}
            </button>
            </div>
            <div className="relative w-64">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {notificationMessage && (
          <div className="fixed top-4 right-4 z-50 bg-indigo-600 text-white px-4 py-2 rounded-md shadow-lg flex items-center">
            <span>{notificationMessage}</span>
          </div>
        )}
        
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('image')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'image'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center">
                <ImageIcon size={16} className="mr-2" />
                Images ({images.length})
              </div>
            </button>
            <button
              onClick={() => setActiveTab('text')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'text'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center">
                <FileText size={16} className="mr-2" />
                Texts ({texts.length})
              </div>
            </button>
          </nav>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            {clipboardPermissionError && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md flex items-start">
                <AlertCircle className="h-5 w-5 text-amber-500 mr-2 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-medium text-amber-800">Clipboard permission required</h3>
                  <p className="mt-1 text-sm text-amber-700">
                    To monitor clipboard, this page needs to be in focus and have clipboard permission.
                    Click anywhere on the page and allow clipboard access when prompted.
                  </p>
                  <button 
                    onClick={startMonitoring}
                    className="mt-2 text-sm font-medium text-indigo-600 hover:text-indigo-800"
                  >
                    Try again
                  </button>
                </div>
              </div>
            )}
            
            {activeTab === 'image' ? (
              <>
                <PasteZone 
                  onImagePaste={handleImagePaste} 
                  isMonitoring={isMonitoringImagesEnabled} 
                />
            
            <div className="mt-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Your Images ({filteredImages.length})</h2>
              {filteredImages.length > 0 ? (
                <ImageGallery 
                  images={filteredImages} 
                  onImageSelect={handleImageSelect}
                  onImageDelete={handleImageDelete}
                      onLabelEdit={(id) => openLabelModal(id, 'image')}
                  onCopyImage={handleCopyToClipboard}
                  copiedImageId={copiedImageId}
                />
              ) : (
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 text-center">
                  <ImageIcon className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No images</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {searchTerm ? 'No images match your search.' : 'Paste an image to get started.'}
                  </p>
                </div>
              )}
            </div>
              </>
            ) : (
              <>
                <TextPasteZone 
                  onTextPaste={handleTextPaste} 
                  isMonitoring={isMonitoringTextEnabled} 
                />
                
                <div className="mt-6">
                  <h2 className="text-lg font-medium text-gray-900 mb-4">Your Texts ({filteredTexts.length})</h2>
                  {filteredTexts.length > 0 ? (
                    <TextGallery 
                      texts={filteredTexts} 
                      onTextSelect={handleTextSelect}
                      onTextDelete={handleTextDelete}
                      onLabelEdit={(id) => openLabelModal(id, 'text')}
                      onCopyText={handleCopyTextToClipboard}
                      copiedTextId={copiedTextId}
                    />
                  ) : (
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 text-center">
                      <FileText className="mx-auto h-12 w-12 text-gray-400" />
                      <h3 className="mt-2 text-sm font-medium text-gray-900">No texts</h3>
                      <p className="mt-1 text-sm text-gray-500">
                        {searchTerm ? 'No texts match your search.' : 'Paste or type text to get started.'}
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="lg:col-span-1">
            {selectedImage && activeTab === 'image' ? (
              <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 sticky top-6">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-lg font-medium text-gray-900">Image Details</h3>
                  <button 
                    onClick={() => setSelectedImage(null)}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <X size={20} />
                  </button>
                </div>
                
                <div className="mb-4 relative group">
                  <img 
                    src={selectedImage.dataUrl} 
                    alt={selectedImage.label} 
                    className="w-full rounded-md"
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200">
                    <button
                      onClick={() => handleCopyToClipboard(selectedImage)}
                      className="p-2 bg-white rounded-full shadow-md text-gray-700 hover:text-indigo-600 transform transition-transform duration-200 hover:scale-110"
                      title="Copy to clipboard"
                    >
                      {copiedImageId === selectedImage.id ? (
                        <CheckCircle size={24} className="text-green-500" />
                      ) : (
                        <Copy size={24} />
                      )}
                    </button>
                  </div>
                </div>
                
                <div className="mb-4">
                  <div className="flex justify-between items-center">
                    <h4 className="text-sm font-medium text-gray-700">Label</h4>
                    <button 
                      onClick={() => openLabelModal(selectedImage.id, 'image')}
                      className="text-xs text-indigo-600 hover:text-indigo-800"
                    >
                      Edit
                    </button>
                  </div>
                  <p className="mt-1 text-sm text-gray-900">{selectedImage.label}</p>
                </div>
                
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-1">Date Added</h4>
                  <p className="text-sm text-gray-900">
                    {new Date(selectedImage.timestamp).toLocaleString()}
                  </p>
                </div>
                
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="text-sm font-medium text-gray-700">Tags</h4>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 mb-2">
                    {selectedImage.tags.map((tag, index) => (
                      <span 
                        key={`${selectedImage.id}-tag-${index}`}
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800"
                      >
                        {tag}
                        <button 
                          onClick={() => handleRemoveTag(selectedImage.id, tag, 'image')}
                          className="ml-1.5 text-indigo-600 hover:text-indigo-800"
                        >
                          <X size={14} />
                        </button>
                      </span>
                    ))}
                  </div>
                  
                  <form 
                    onSubmit={(e) => {
                      e.preventDefault();
                      const input = e.currentTarget.elements.namedItem('tag') as HTMLInputElement;
                      handleAddTag(selectedImage.id, input.value, 'image');
                      input.value = '';
                    }}
                    className="flex"
                  >
                    <input
                      type="text"
                      name="tag"
                      className="flex-1 min-w-0 block w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="Add a tag..."
                    />
                    <button
                      type="submit"
                      className="ml-2 inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      <Plus size={16} />
                    </button>
                  </form>
                </div>
              </div>
            ) : selectedText && activeTab === 'text' ? (
              <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 sticky top-6">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-lg font-medium text-gray-900">Text Details</h3>
                  <button 
                    onClick={() => setSelectedText(null)}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <X size={20} />
                  </button>
                </div>
                
                <div className="mb-4 relative group">
                  {isEditingText ? (
                    <div className="w-full">
                      <textarea
                        value={editedTextContent}
                        onChange={(e) => setEditedTextContent(e.target.value)}
                        className="w-full p-3 border border-indigo-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 min-h-[150px] text-sm"
                      />
                      <div className="mt-2 flex justify-end space-x-2">
                  <button
                          onClick={() => setIsEditingText(false)}
                          className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleTextContentSave}
                          className="px-3 py-1 text-sm bg-indigo-600 text-white border border-transparent rounded-md hover:bg-indigo-700"
                        >
                          Save Changes
                        </button>
                      </div>
                    </div>
                    ) : (
                      <>
                      <div className="max-h-64 overflow-y-auto p-3 bg-gray-50 rounded-md">
                        <p className="text-sm whitespace-pre-wrap break-words text-gray-800">
                          {selectedText.content}
                        </p>
                      </div>
                      <div className="absolute top-2 right-2 flex space-x-1">
                        <button
                          onClick={() => handleCopyTextToClipboard(selectedText)}
                          className="p-1.5 bg-white rounded-full shadow-sm text-gray-700 hover:text-indigo-600"
                          title="Copy to clipboard"
                        >
                          {copiedTextId === selectedText.id ? (
                            <CheckCircle size={16} className="text-green-500" />
                          ) : (
                            <Copy size={16} />
                          )}
                        </button>
                        <button
                          onClick={() => setIsEditingText(true)}
                          className="p-1.5 bg-white rounded-full shadow-sm text-gray-700 hover:text-indigo-600"
                          title="Edit text"
                        >
                          <Edit size={16} />
                        </button>
                      </div>
                      </>
                    )}
                </div>
                
                <div className="mb-4">
                  <div className="flex justify-between items-center">
                    <h4 className="text-sm font-medium text-gray-700">Label</h4>
                    <button 
                      onClick={() => openLabelModal(selectedText.id, 'text')}
                      className="text-xs text-indigo-600 hover:text-indigo-800"
                    >
                      Edit
                  </button>
                  </div>
                  <p className="mt-1 text-sm text-gray-900">{selectedText.label}</p>
                </div>
                
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-1">Date Added</h4>
                  <p className="text-sm text-gray-900">
                    {new Date(selectedText.timestamp).toLocaleString()}
                  </p>
                </div>
                
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="text-sm font-medium text-gray-700">Tags</h4>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 mb-2">
                    {selectedText.tags.map((tag, index) => (
                      <span 
                        key={`${selectedText.id}-tag-${index}`}
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800"
                      >
                        {tag}
                  <button
                          onClick={() => handleRemoveTag(selectedText.id, tag, 'text')}
                          className="ml-1.5 text-indigo-600 hover:text-indigo-800"
                  >
                          <X size={14} />
                  </button>
                      </span>
                    ))}
                  </div>
                  
                  <form 
                    onSubmit={(e) => {
                      e.preventDefault();
                      const input = e.currentTarget.elements.namedItem('tag') as HTMLInputElement;
                      handleAddTag(selectedText.id, input.value, 'text');
                      input.value = '';
                    }}
                    className="flex"
                  >
                    <input
                      type="text"
                      name="tag"
                      className="flex-1 min-w-0 block w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="Add a tag..."
                    />
                  <button
                      type="submit"
                      className="ml-2 inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                      <Plus size={16} />
                  </button>
                  </form>
                </div>
              </div>
            ) : (
              <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 text-center">
                <div className="p-6">
                  <Layers className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No item selected</h3>
                <p className="mt-1 text-sm text-gray-500">
                    Select an item to view its details
                </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {isLabelModalOpen && (
        <div className="fixed z-10 inset-0 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true"></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                      Edit Label
                    </h3>
                    <div className="mt-2">
                      <input
                        type="text"
                        ref={labelInputRef}
                        className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                        placeholder="Enter a label"
                        value={newLabel}
                        onChange={(e) => setNewLabel(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button 
                  type="button" 
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={handleLabelSave}
                >
                  Save
                </button>
                <button 
                  type="button" 
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={() => {
                    setIsLabelModalOpen(false);
                    setNewLabel('');
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;