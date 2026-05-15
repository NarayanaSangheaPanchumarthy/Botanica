import React, { useState, useRef, useEffect } from 'react';
import { Leaf, X, ChevronRight, Calculator, Ruler, Hash, BarChart3, Image as ImageIcon, Sparkles, Loader2, Camera, RefreshCw, ScatterChart as ScatterIcon, Brain } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import MorphologyPlots from './MorphologyPlots';
import { analyzePlantDimensions } from './services/geminiService';

interface MorphologyCalculatorProps {
  onClose: () => void;
  onSendToChat: (message: string, image?: string) => void;
}

export default function MorphologyCalculator({ onClose, onSendToChat }: MorphologyCalculatorProps) {
  const [sepalLength, setSepalLength] = useState<number | ''>('');
  const [sepalWidth, setSepalWidth] = useState<number | ''>('');
  const [petalLength, setPetalLength] = useState<number | ''>('');
  const [petalWidth, setPetalWidth] = useState<number | ''>('');
  const [leafLength, setLeafLength] = useState<number | ''>('');
  const [leafWidth, setLeafWidth] = useState<number | ''>('');
  const [leafThickness, setLeafThickness] = useState<number | ''>('');

  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [showPlots, setShowPlots] = useState(false);
  const [plotTab, setPlotTab] = useState<'scatter'|'analysis'|'histogram'|undefined>(undefined);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' }, 
        audio: false 
      });
      streamRef.current = stream;
      setShowCamera(true);
      // We will set srcObject in a useEffect triggered by showCamera
    } catch (err) {
      console.error("Error accessing camera:", err);
      setCameraError("Unable to access camera. Please check permissions.");
    }
  };

  useEffect(() => {
    if (showCamera && videoRef.current && streamRef.current) {
      const video = videoRef.current;
      video.srcObject = streamRef.current;
      video.play().catch(err => {
        console.error("Video play failed:", err);
        // Autoplay might still work, but we log the error
      });
    }
  }, [showCamera]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(video, 0, 0);
      
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      setUploadedImage(dataUrl);
      stopCamera();
      handleAIAnalysis(dataUrl);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) { height = Math.round((height * MAX_WIDTH) / width); width = MAX_WIDTH; }
        } else {
          if (height > MAX_HEIGHT) { width = Math.round((width * MAX_HEIGHT) / height); height = MAX_HEIGHT; }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setUploadedImage(dataUrl);
        
        // Auto analyze
        handleAIAnalysis(dataUrl);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleAIAnalysis = async (photo: string) => {
    if (!photo) return;
    setIsAnalyzing(true);
    setAnalysisError(null);
    try {
      const dims = await analyzePlantDimensions(photo);
      if (dims.sepalLength) setSepalLength(dims.sepalLength);
      if (dims.sepalWidth) setSepalWidth(dims.sepalWidth);
      if (dims.petalLength) setPetalLength(dims.petalLength);
      if (dims.petalWidth) setPetalWidth(dims.petalWidth);
      if (dims.leafLength) setLeafLength(dims.leafLength);
      if (dims.leafWidth) setLeafWidth(dims.leafWidth);
      if (dims.leafThickness) setLeafThickness(dims.leafThickness);
    } catch (error: any) {
      console.error("AI Analysis failed:", error);
      if (error?.message?.includes("API key")) {
         setAnalysisError("Invalid Gemini API key. Please check your key in Settings > Secrets.");
      } else {
         setAnalysisError("AI analysis failed. " + (error?.message || "Please try again."));
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const calculateMeasurements = () => {
    setShowPlots(true);
  };

  const hasAnyInput = sepalLength !== '' || sepalWidth !== '' || petalLength !== '' || petalWidth !== '' || leafLength !== '' || leafWidth !== '' || leafThickness !== '' || uploadedImage !== null;

  if (showPlots) {
    const userData = hasAnyInput ? {
      sepalLength: sepalLength ? Number(sepalLength) : undefined,
      sepalWidth: sepalWidth ? Number(sepalWidth) : undefined,
      petalLength: petalLength ? Number(petalLength) : undefined,
      petalWidth: petalWidth ? Number(petalWidth) : undefined,
      leafLength: leafLength ? Number(leafLength) : undefined,
      leafWidth: leafWidth ? Number(leafWidth) : undefined,
      leafThickness: leafThickness ? Number(leafThickness) : undefined,
      image: uploadedImage
    } : undefined;

    return <MorphologyPlots onClose={onClose} onBack={() => { setShowPlots(false); setPlotTab(undefined); }} userData={userData} initialTab={plotTab} />;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl relative flex flex-col max-h-[90vh]"
      >
        <div className="p-6 border-b border-stone-100 flex justify-between items-center bg-stone-50/50">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-100 p-2 rounded-xl text-emerald-700">
              <Calculator className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-stone-800">Morphology Calculator</h2>
              <p className="text-xs text-stone-500">Analyze measurements & images</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { setPlotTab('histogram'); setShowPlots(true); }} className="p-2 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors" title="Thickness Distribution">
              <BarChart3 className="w-6 h-6" />
            </button>
            <button onClick={() => { setPlotTab('scatter'); setShowPlots(true); }} className="p-2 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors" title="Scatter Explorer">
              <ScatterIcon className="w-6 h-6" />
            </button>
            <button onClick={() => { setPlotTab('analysis'); setShowPlots(true); }} className="p-2 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors" title="AI Analysis">
              <Brain className="w-6 h-6" />
            </button>
            <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-full transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto">
          <div className="mb-6 bg-blue-50 text-blue-800 p-4 rounded-2xl text-sm border border-blue-100 flex gap-3 items-start">
            <Ruler className="w-5 h-5 shrink-0 mt-0.5 text-blue-500" />
            <p>Input measurements or upload a photo. The AI will analyze the image to estimate sepal and petal dimensions.</p>
          </div>

            {analysisError && (
              <div className="mb-6 bg-red-50 text-red-700 p-4 rounded-2xl text-sm border border-red-200">
                ⚠️ {analysisError}
              </div>
            )}

          <div className="mb-6">
            <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageSelect} />
            
            {showCamera ? (
              <div className="relative rounded-2xl overflow-hidden border border-emerald-500 shadow-lg bg-black aspect-video flex items-center justify-center">
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted
                  onLoadedMetadata={() => videoRef.current?.play()}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 p-4 flex justify-between items-center bg-gradient-to-t from-black/80 to-transparent">
                  <button 
                    onClick={stopCamera}
                    className="p-3 bg-red-500/80 hover:bg-red-600 text-white rounded-2xl transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                  <button 
                    onClick={capturePhoto}
                    className="p-5 bg-white text-emerald-600 rounded-full shadow-xl hover:scale-110 active:scale-95 transition-all outline outline-4 outline-white/20"
                  >
                    <Camera className="w-8 h-8 font-black" />
                  </button>
                  <div className="w-12 h-12" /> {/* Spacer */}
                </div>
              </div>
            ) : uploadedImage ? (
              <div className="space-y-3">
                <div className="relative rounded-2xl overflow-hidden border border-emerald-200 shadow-md">
                  <img src={uploadedImage} alt="Uploaded plant for analysis" className="w-full h-48 object-cover" />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3 flex justify-between">
                    <button 
                      onClick={() => setUploadedImage(null)}
                      className="p-1.5 bg-red-500/80 hover:bg-red-600 text-white rounded-xl transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <div className="flex gap-2">
                      <button 
                        onClick={startCamera}
                        className="p-1.5 bg-emerald-500/80 hover:bg-emerald-600 text-white rounded-xl transition-colors text-xs font-bold flex items-center gap-1.5"
                      >
                        <Camera className="w-4 h-4" /> Retake
                      </button>
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="p-1.5 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white rounded-xl transition-colors text-xs font-bold flex items-center gap-1.5"
                      >
                        <ImageIcon className="w-4 h-4" /> Change Photo
                      </button>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleAIAnalysis(uploadedImage)}
                  disabled={isAnalyzing}
                  className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold shadow-sm transition-all ${isAnalyzing ? 'bg-stone-100 text-stone-400 cursor-not-allowed border border-stone-200' : 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-600 hover:to-teal-700 shadow-emerald-100 hover:shadow-emerald-200'}`}
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      AI Extracting Values...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Auto-Extract Dimensions
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={startCamera}
                  className="py-8 border-2 border-dashed border-emerald-200 rounded-2xl hover:bg-emerald-50 hover:border-emerald-300 transition-all flex flex-col items-center gap-3 text-emerald-700 group"
                >
                  <div className="p-3 bg-emerald-100 rounded-2xl group-hover:bg-emerald-200 transition-colors">
                    <Camera className="w-7 h-7" />
                  </div>
                  <span className="font-bold text-sm">Take Photo</span>
                </button>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="py-8 border-2 border-dashed border-stone-200 rounded-2xl hover:bg-stone-50 hover:border-stone-300 transition-all flex flex-col items-center gap-3 text-stone-700 group"
                >
                  <div className="p-3 bg-stone-100 rounded-2xl group-hover:bg-stone-200 transition-colors">
                    <ImageIcon className="w-7 h-7 text-stone-500" />
                  </div>
                  <span className="font-bold text-sm">Upload Image</span>
                </button>
              </div>
            )}
            
            {cameraError && (
              <p className="mt-2 text-xs text-red-500 font-medium bg-red-50 p-2 rounded-lg border border-red-100">
                {cameraError}
              </p>
            )}
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-bold text-stone-800 mb-3 flex items-center gap-2">
                <Leaf className="w-4 h-4 text-emerald-600" /> Flower (Sepals & Petals)
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Sepal Length</label>
                  <div className="relative">
                    <input type="number" step="0.1" value={sepalLength} onChange={(e) => setSepalLength(e.target.value === '' ? '' : Number(e.target.value))} className="w-full px-4 py-3 pr-8 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-shadow bg-stone-50/50" placeholder="e.g. 5.1" />
                    <span className="absolute right-4 top-3.5 text-xs font-medium text-stone-400">cm</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Sepal Width</label>
                  <div className="relative">
                    <input type="number" step="0.1" value={sepalWidth} onChange={(e) => setSepalWidth(e.target.value === '' ? '' : Number(e.target.value))} className="w-full px-4 py-3 pr-8 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-shadow bg-stone-50/50" placeholder="e.g. 3.5" />
                    <span className="absolute right-4 top-3.5 text-xs font-medium text-stone-400">cm</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Petal Length</label>
                  <div className="relative">
                    <input type="number" step="0.1" value={petalLength} onChange={(e) => setPetalLength(e.target.value === '' ? '' : Number(e.target.value))} className="w-full px-4 py-3 pr-8 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-shadow bg-stone-50/50" placeholder="e.g. 1.4" />
                    <span className="absolute right-4 top-3.5 text-xs font-medium text-stone-400">cm</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Petal Width</label>
                  <div className="relative">
                    <input type="number" step="0.1" value={petalWidth} onChange={(e) => setPetalWidth(e.target.value === '' ? '' : Number(e.target.value))} className="w-full px-4 py-3 pr-8 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-shadow bg-stone-50/50" placeholder="e.g. 0.2" />
                    <span className="absolute right-4 top-3.5 text-xs font-medium text-stone-400">cm</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-stone-100 pt-6">
              <h3 className="text-sm font-bold text-stone-800 mb-3 flex items-center gap-2">
                <Leaf className="w-4 h-4 text-green-600" /> Foliage (Leaves)
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Leaf Length</label>
                  <div className="relative">
                    <input type="number" step="0.1" value={leafLength} onChange={(e) => setLeafLength(e.target.value === '' ? '' : Number(e.target.value))} className="w-full px-4 py-3 pr-8 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-shadow bg-stone-50/50" placeholder="e.g. 15.0" />
                    <span className="absolute right-4 top-3.5 text-xs font-medium text-stone-400">cm</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Leaf Width</label>
                  <div className="relative">
                    <input type="number" step="0.1" value={leafWidth} onChange={(e) => setLeafWidth(e.target.value === '' ? '' : Number(e.target.value))} className="w-full px-4 py-3 pr-8 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-shadow bg-stone-50/50" placeholder="e.g. 5.5" />
                    <span className="absolute right-4 top-3.5 text-xs font-medium text-stone-400">cm</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 col-span-2">
                  <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Leaf Thickness</label>
                  <div className="relative">
                    <input type="number" step="0.01" value={leafThickness} onChange={(e) => setLeafThickness(e.target.value === '' ? '' : Number(e.target.value))} className="w-full px-4 py-3 pr-8 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-shadow bg-stone-50/50" placeholder="e.g. 0.5" />
                    <span className="absolute right-4 top-3.5 text-xs font-medium text-stone-400">mm</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-stone-100 bg-stone-50 flex gap-3">
          <button 
            disabled={!hasAnyInput}
            onClick={() => { setPlotTab('scatter'); setShowPlots(true); }}
            className="flex-1 bg-white border-2 border-emerald-200 text-emerald-700 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-emerald-50 transition-colors shadow-sm"
          >
            <ScatterIcon className="w-5 h-5" />
            Scatter Explorer
          </button>
          <button 
            disabled={!hasAnyInput}
            onClick={() => { setPlotTab('analysis'); setShowPlots(true); }}
            className="flex-[1.5] bg-emerald-600 disabled:bg-stone-300 disabled:text-stone-500 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors shadow-sm"
          >
            <BarChart3 className="w-5 h-5" />
            Full Analysis
          </button>
        </div>
      </motion.div>
    </div>
  );
}
