import React, { useRef, useEffect, useState } from 'react';
import { Camera, X, Shield, Activity, RefreshCw, AlertTriangle, Eye, EyeOff, Loader2, ZoomIn, ZoomOut, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from "@google/genai";
import { toast } from 'sonner';

interface GardenMonitorProps {
  onClose: () => void;
  aiModel: string;
}

interface ScanResult {
  plants: number;
  crops: number;
  fruits: number;
  trees: number;
  animals: number;
  timestamp: number;
}

export default function GardenMonitor({ onClose, aiModel }: GardenMonitorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isCameraLoading, setIsCameraLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [lastResult, setLastResult] = useState<ScanResult | null>(null);
  const [isAutoMode, setIsAutoMode] = useState(false);
  const [motionDetected, setMotionDetected] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [zoomCapabilities, setZoomCapabilities] = useState<{ min: number; max: number; step: number } | null>(null);
  
  const lastFrameRef = useRef<ImageData | null>(null);
  const motionThreshold = 50; // Sensitivity
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    };
  }, []);

  const startCamera = async () => {
    setIsCameraLoading(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Check for zoom capabilities
        const track = stream.getVideoTracks()[0];
        const capabilities = track.getCapabilities() as any;
        
        if (capabilities.zoom) {
          setZoomCapabilities({
            min: capabilities.zoom.min,
            max: capabilities.zoom.max,
            step: capabilities.zoom.step || 0.1
          });
          setZoom(capabilities.zoom.min);
        }

        // Wait for video to be ready
        videoRef.current.onloadedmetadata = () => {
          setIsStreaming(true);
          setIsCameraLoading(false);
        };
      }
    } catch (err) {
      console.error("Camera access error:", err);
      toast.error("Could not access camera. Please check permissions.");
      setIsCameraLoading(false);
    }
  };

  // Apply zoom when it changes
  useEffect(() => {
    const applyZoom = async () => {
      if (videoRef.current && videoRef.current.srcObject && zoomCapabilities) {
        const track = (videoRef.current.srcObject as MediaStream).getVideoTracks()[0];
        try {
          await track.applyConstraints({ advanced: [{ zoom }] as any });
        } catch (e) {
          console.warn("Failed to apply zoom constraint:", e);
        }
      }
    };
    applyZoom();
  }, [zoom, zoomCapabilities]);

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    setIsStreaming(false);
  };

  // Simple motion detection
  useEffect(() => {
    if (!isStreaming || !isAutoMode) return;

    const detectMotion = () => {
      if (!videoRef.current || !canvasRef.current || !isAutoMode) return;
      
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      
      if (!ctx) return;

      canvas.width = video.videoWidth / 4; // Downscale for performance
      canvas.height = video.videoHeight / 4;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const currentFrame = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      if (lastFrameRef.current) {
        let diff = 0;
        const data1 = lastFrameRef.current.data;
        const data2 = currentFrame.data;
        
        for (let i = 0; i < data1.length; i += 4) {
          const rDiff = Math.abs(data1[i] - data2[i]);
          const gDiff = Math.abs(data1[i+1] - data2[i+1]);
          const bDiff = Math.abs(data1[i+2] - data2[i+2]);
          if (rDiff + gDiff + bDiff > 100) diff++;
        }
        
        const motionPercent = (diff / (canvas.width * canvas.height)) * 100;
        if (motionPercent > 2 && !isScanning) {
          setMotionDetected(true);
          handleScan(); // Trigger AI scan on motion
        } else {
          setMotionDetected(false);
        }
      }
      
      lastFrameRef.current = currentFrame;
      requestAnimationFrame(detectMotion);
    };

    const animationId = requestAnimationFrame(detectMotion);
    return () => cancelAnimationFrame(animationId);
  }, [isStreaming, isAutoMode, isScanning]);

  const handleScan = async () => {
    if (isScanning || !videoRef.current) return;
    
    setIsScanning(true);
    try {
      const canvas = document.createElement('canvas');
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      // If we're using CSS zoom fallback, we need to capture the zoomed area
      if (!zoomCapabilities && zoom > 1) {
        const sWidth = video.videoWidth / zoom;
        const sHeight = video.videoHeight / zoom;
        const sx = (video.videoWidth - sWidth) / 2;
        const sy = (video.videoHeight - sHeight) / 2;
        ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, canvas.width, canvas.height);
      } else {
        ctx.drawImage(video, 0, 0);
      }
      
      const base64Image = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
      
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image
            }
          },
          {
            text: "You are a specialized garden monitoring AI. Scan this garden view and count the following objects: plants, crops, fruits, trees, and animals. Return ONLY a JSON object with these keys: plants, crops, fruits, trees, animals. If none are found, use 0."
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              plants: { type: Type.INTEGER },
              crops: { type: Type.INTEGER },
              fruits: { type: Type.INTEGER },
              trees: { type: Type.INTEGER },
              animals: { type: Type.INTEGER }
            },
            required: ["plants", "crops", "fruits", "trees", "animals"]
          }
        }
      });

      const result = JSON.parse(response.text);
      setLastResult({ ...result, timestamp: Date.now() });
      
      if (result.animals > 0) {
        toast.warning(`Motion Alert: ${result.animals} animal(s) detected in the garden!`);
      }
    } catch (err) {
      console.error("Scan error:", err);
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col">
      {/* Header */}
      <div className="p-4 bg-stone-900/80 backdrop-blur-md flex justify-between items-center border-b border-stone-800">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${isAutoMode ? 'bg-red-500/20 text-red-500 animate-pulse' : 'bg-green-500/20 text-green-500'}`}>
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-white font-bold">AI Garden Monitor</h2>
            <p className="text-[10px] text-stone-400 uppercase tracking-widest">
              {isAutoMode ? 'Active Surveillance Mode' : 'Manual Scanning Mode'}
            </p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 text-stone-400 hover:text-white transition-colors">
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Main Viewport */}
      <div className="flex-1 relative overflow-hidden bg-stone-950 flex items-center justify-center">
        {isCameraLoading && (
          <div className="absolute inset-0 z-50 bg-stone-950 flex flex-col items-center justify-center gap-4">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            >
              <Loader2 className="w-12 h-12 text-green-500" />
            </motion.div>
            <p className="text-stone-400 font-medium animate-pulse">Initializing Secure Feed...</p>
          </div>
        )}

        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted 
          className={`w-full h-full object-cover transition-opacity duration-700 ${isStreaming ? 'opacity-80' : 'opacity-0'}`}
          style={!zoomCapabilities ? { transform: `scale(${zoom})` } : {}}
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Zoom Controls Overlay */}
        {isStreaming && (
          <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col gap-4 z-20">
            <button 
              onClick={() => setZoom(prev => Math.min(zoomCapabilities?.max || 3, prev + (zoomCapabilities?.step || 0.2)))}
              className="p-3 bg-black/60 backdrop-blur-md border border-white/10 rounded-full text-white hover:bg-black/80 transition-all active:scale-90"
            >
              <ZoomIn className="w-5 h-5" />
            </button>
            <div className="h-32 w-10 bg-black/40 backdrop-blur-sm rounded-full border border-white/5 flex flex-col items-center py-2 relative">
              <div className="absolute inset-y-4 w-0.5 bg-stone-700 rounded-full" />
              <motion.div 
                className="absolute w-3 h-3 bg-green-500 rounded-full shadow-[0_0_10px_rgba(34,197,94,0.5)]"
                animate={{ 
                  bottom: `${((zoom - (zoomCapabilities?.min || 1)) / ((zoomCapabilities?.max || 3) - (zoomCapabilities?.min || 1))) * 80 + 10}%` 
                }}
              />
            </div>
            <button 
              onClick={() => setZoom(prev => Math.max(zoomCapabilities?.min || 1, prev - (zoomCapabilities?.step || 0.2)))}
              className="p-3 bg-black/60 backdrop-blur-md border border-white/10 rounded-full text-white hover:bg-black/80 transition-all active:scale-90"
            >
              <ZoomOut className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* HUD Overlays */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Corner Brackets */}
          <div className="absolute top-8 left-8 w-12 h-12 border-t-2 border-l-2 border-green-500/50 rounded-tl-2xl" />
          <div className="absolute top-8 right-8 w-12 h-12 border-t-2 border-r-2 border-green-500/50 rounded-tr-2xl" />
          <div className="absolute bottom-8 left-8 w-12 h-12 border-b-2 border-l-2 border-green-500/50 rounded-bl-2xl" />
          <div className="absolute bottom-8 right-8 w-12 h-12 border-b-2 border-r-2 border-green-500/50 rounded-br-2xl" />

          {/* Scanning Line */}
          {isScanning && (
            <motion.div 
              initial={{ top: '0%' }}
              animate={{ top: '100%' }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="absolute left-0 right-0 h-0.5 bg-green-400 shadow-[0_0_15px_rgba(74,222,128,0.5)] z-10"
            />
          )}

          {/* Motion Indicator */}
          {motionDetected && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2">
              <div className="px-4 py-2 bg-red-500/80 text-white text-xs font-bold rounded-full animate-bounce flex items-center gap-2">
                <Activity className="w-4 h-4" /> MOTION DETECTED
              </div>
            </div>
          )}
        </div>

        {/* Stats Overlay */}
        <div className="absolute bottom-24 left-4 right-4 grid grid-cols-5 gap-2">
          {[
            { label: 'Plants', value: lastResult?.plants ?? 0, color: 'text-green-400' },
            { label: 'Crops', value: lastResult?.crops ?? 0, color: 'text-emerald-400' },
            { label: 'Fruits', value: lastResult?.fruits ?? 0, color: 'text-orange-400' },
            { label: 'Trees', value: lastResult?.trees ?? 0, color: 'text-lime-400' },
            { label: 'Animals', value: lastResult?.animals ?? 0, color: 'text-red-400' },
          ].map((stat, i) => (
            <div key={i} className="bg-black/60 backdrop-blur-md border border-white/10 p-3 rounded-2xl flex flex-col items-center">
              <span className={`text-xl font-black ${stat.color}`}>{stat.value}</span>
              <span className="text-[8px] uppercase font-bold text-stone-400 tracking-tighter">{stat.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="p-6 bg-stone-900/90 backdrop-blur-xl border-t border-stone-800 flex items-center justify-between">
        <button 
          onClick={() => setIsAutoMode(!isAutoMode)}
          className={`flex items-center gap-3 px-6 py-3 rounded-2xl font-bold transition-all ${
            isAutoMode 
              ? 'bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.3)]' 
              : 'bg-stone-800 text-stone-400 hover:bg-stone-700'
          }`}
        >
          {isAutoMode ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
          {isAutoMode ? 'SURVEILLANCE ON' : 'AUTO SCAN OFF'}
        </button>

        <button 
          onClick={handleScan}
          disabled={isScanning}
          className="w-20 h-20 bg-green-600 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(22,163,74,0.4)] active:scale-90 transition-all disabled:opacity-50"
        >
          {isScanning ? (
            <RefreshCw className="w-8 h-8 text-white animate-spin" />
          ) : (
            <Camera className="w-8 h-8 text-white" />
          )}
        </button>

        <div className="flex flex-col items-end">
          <p className="text-stone-500 text-[10px] font-bold uppercase tracking-widest">Last Update</p>
          <p className="text-white font-mono text-sm">
            {lastResult ? new Date(lastResult.timestamp).toLocaleTimeString() : '--:--:--'}
          </p>
        </div>
      </div>
    </div>
  );
}
