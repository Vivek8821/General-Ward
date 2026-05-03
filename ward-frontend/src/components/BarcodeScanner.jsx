import { useState, useEffect, useRef } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { Camera, Keyboard, X, Search, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '../utils/api';
import toast from 'react-hot-toast';

/**
 * BarcodeScanner component supporting USB keyboard wedge and camera-based scanning.
 */
export default function BarcodeScanner({ 
  onResolved, 
  onUnregistered, 
  placeholder = "Scan or type barcode...",
  autoFocus = true 
}) {
  const [mode, setMode] = useState('keyboard'); // 'keyboard' | 'camera'
  const [inputValue, setInputValue] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [lastKeystrokeTime, setLastKeystrokeTime] = useState(0);
  const [keystrokeCount, setKeystrokeCount] = useState(0);
  
  const videoRef = useRef(null);
  const inputRef = useRef(null);
  const readerRef = useRef(null);

  // Focus management
  useEffect(() => {
    if (autoFocus && mode === 'keyboard' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus, mode]);

  // Wedge detection logic
  const handleKeyDown = (e) => {
    const now = Date.now();
    const diff = now - lastKeystrokeTime;
    
    if (e.key === 'Enter') {
      // If it looks like a scanner (fast sequence), or user pressed enter
      if (inputValue.length > 0) {
        handleScan(inputValue);
      }
      setInputValue('');
      setKeystrokeCount(0);
    } else {
      // Basic wedge detection: if diff is very small, it's likely a scanner
      if (diff < 50) {
        setKeystrokeCount(prev => prev + 1);
      } else {
        setKeystrokeCount(1);
      }
      setLastKeystrokeTime(now);
    }
  };

  const handleScan = async (code) => {
    if (!code) return;
    setIsScanning(true);
    try {
      const response = await api.get(`/pharmacy/scan/${encodeURIComponent(code)}`);
      if (response.status === 'RESOLVED') {
        onResolved?.(response);
      } else {
        onUnregistered?.(response.parsedFields);
      }
    } catch (err) {
      toast.error('Scan resolution failed');
      console.error(err);
    } finally {
      setIsScanning(false);
    }
  };

  // Camera logic
  useEffect(() => {
    if (mode === 'camera') {
      const codeReader = new BrowserMultiFormatReader();
      readerRef.current = codeReader;

      codeReader.decodeFromVideoDevice(undefined, videoRef.current, (result, error) => {
        if (result) {
          handleScan(result.getText());
          setMode('keyboard'); // Switch back after success
        }
      });

      return () => {
        codeReader.reset();
      };
    }
  }, [mode]);

  return (
    <div className="card border-dashed border-2 border-border/60 p-4 bg-bg-secondary/30 relative overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-lg ${mode === 'keyboard' ? 'bg-primary/10 text-primary' : 'bg-bg-tertiary text-text-secondary'}`}>
            <Keyboard className="h-5 w-5" />
          </div>
          <h3 className="font-semibold text-sm">Pharmacy Scanner</h3>
        </div>
        <div className="flex bg-bg-tertiary rounded-lg p-1">
          <button 
            onClick={() => setMode('keyboard')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${mode === 'keyboard' ? 'bg-white dark:bg-zinc-800 shadow-sm text-primary' : 'text-text-secondary hover:text-text-primary'}`}
          >
            USB / Manual
          </button>
          <button 
            onClick={() => setMode('camera')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${mode === 'camera' ? 'bg-white dark:bg-zinc-800 shadow-sm text-primary' : 'text-text-secondary hover:text-text-primary'}`}
          >
            Camera
          </button>
        </div>
      </div>

      <div className="relative">
        {mode === 'keyboard' ? (
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                className="input-field pl-10 h-12 w-full text-lg tracking-wider font-mono"
                placeholder={placeholder}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isScanning}
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              {isScanning && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                   <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="relative aspect-video rounded-xl bg-black overflow-hidden border border-border">
            <video ref={videoRef} className="w-full h-full object-cover" />
            <div className="absolute inset-0 border-2 border-primary/40 m-12 rounded-lg pointer-events-none animate-pulse flex items-center justify-center">
              <div className="w-48 h-1 bg-primary/40 blur-sm absolute top-1/2 -translate-y-1/2"></div>
            </div>
            <button 
              onClick={() => setMode('keyboard')}
              className="absolute top-2 right-2 p-2 bg-black/60 text-white rounded-full hover:bg-black/80 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-black/60 backdrop-blur-md rounded-full text-[10px] font-bold text-white uppercase tracking-widest">
              Align barcode within frame
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2 text-[11px] text-text-secondary font-medium italic">
        <AlertCircle className="h-3 w-3" />
        <span>Supports manufacturer barcodes (GS1-128, EAN) and internal QR labels</span>
      </div>
    </div>
  );
}
