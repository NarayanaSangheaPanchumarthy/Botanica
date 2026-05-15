import React, { useState, useEffect } from 'react';
import { X, ArrowLeft, BarChart3, ScatterChart as ScatterIcon, LineChart as LineIcon, PieChart as PieIcon, Activity, Brain } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from '@google/genai';
import Markdown from 'react-markdown';
import { 
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, LineChart, Line, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  PieChart, Pie, Cell, ZAxis
} from 'recharts';
import { irisData, processSpeciesMeans } from './IrisDataset';

interface MorphologyPlotsProps {
  onClose: () => void;
  onBack: () => void;
  initialTab?: 'scatter'|'bar'|'line'|'radar'|'doughnut'|'bubble'|'histogram'|'analysis';
  userData?: {
    sepalLength?: number;
    sepalWidth?: number;
    petalLength?: number;
    petalWidth?: number;
    leafLength?: number;
    leafWidth?: number;
    leafThickness?: number;
    image?: string | null;
  }
}

const COLORS = {
  setosa: '#10b981', // emerald-500
  versicolor: '#3b82f6', // blue-500
  virginica: '#8b5cf6', // violet-500
  user: '#f97316', // orange-500
};

export default function MorphologyPlots({ onClose, onBack, userData, initialTab }: MorphologyPlotsProps) {
  const [activeTab, setActiveTab] = useState<'scatter'|'bar'|'line'|'radar'|'doughnut'|'bubble'|'histogram'|'analysis'>(initialTab || (userData ? 'analysis' : 'scatter'));
  const [xAxisFeature, setXAxisFeature] = useState<string>('sepalLength');
  const [yAxisFeature, setYAxisFeature] = useState<string>(initialTab === 'histogram' ? 'leafThickness' : 'petalLength');
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const PRESETS = [
    { label: 'Sepal L vs Petal L', x: 'sepalLength', y: 'petalLength' },
    { label: 'Petal L vs Petal W', x: 'petalLength', y: 'petalWidth' },
    { label: 'Leaf L vs Leaf W', x: 'leafLength', y: 'leafWidth' },
    { label: 'Leaf Thickness vs Leaf W', x: 'leafThickness', y: 'leafWidth' },
  ];

  const FEATURES = [
    { id: 'sepalLength', label: 'Sepal Length', unit: 'cm' },
    { id: 'sepalWidth', label: 'Sepal Width', unit: 'cm' },
    { id: 'petalLength', label: 'Petal Length', unit: 'cm' },
    { id: 'petalWidth', label: 'Petal Width', unit: 'cm' },
    { id: 'leafLength', label: 'Leaf Length', unit: 'cm' },
    { id: 'leafWidth', label: 'Leaf Width', unit: 'cm' },
    { id: 'leafThickness', label: 'Leaf Thickness', unit: 'mm' },
  ];

  const getFeatureLabel = (id: string) => FEATURES.find(f => f.id === id)?.label || id;
  const getFeatureUnit = (id: string) => FEATURES.find(f => f.id === id)?.unit || 'cm';

  useEffect(() => {
    if (activeTab === 'analysis' && !analysisResult && !isAnalyzing && userData) {
      const runAnalysis = async () => {
        setIsAnalyzing(true);
        try {
          const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
          let prompt = "Please analyze these plant morphological measurements";
          if (userData.image) {
            prompt = "Please analyze this plant image and estimate its sepal/petal/leaf lengths and widths in cm. Then tell me what species it might be based on its morphology.";
          } else {
            prompt += ":\n";
            if (userData.sepalLength) prompt += `- Sepal Length: ${userData.sepalLength} cm\n`;
            if (userData.sepalWidth) prompt += `- Sepal Width: ${userData.sepalWidth} cm\n`;
            if (userData.petalLength) prompt += `- Petal Length: ${userData.petalLength} cm\n`;
            if (userData.petalWidth) prompt += `- Petal Width: ${userData.petalWidth} cm\n`;
            if (userData.leafLength) prompt += `- Leaf Length: ${userData.leafLength} cm\n`;
            if (userData.leafWidth) prompt += `- Leaf Width: ${userData.leafWidth} cm\n`;
            if (userData.leafThickness) prompt += `- Leaf Thickness: ${userData.leafThickness} mm\n`;
            prompt += "\n\nBased on these measurements, what species could this be, and what can you tell me about its health or growth stage?";
          }
          
          let response;
          if (userData.image) {
            const base64Data = userData.image.includes(",") ? userData.image.split(",")[1] : userData.image;
            response = await ai.models.generateContent({
              model: 'gemini-3-flash-preview',
              contents: {
                parts: [
                  { text: prompt },
                  { inlineData: { data: base64Data.trim(), mimeType: 'image/jpeg' } }
                ]
              }
            });
          } else {
            response = await ai.models.generateContent({
              model: 'gemini-3-flash-preview',
              contents: prompt
            });
          }
          
          setAnalysisResult(response.text || "No analysis could be determined.");
        } catch (error) {
          console.error("Analysis failed:", error);
          setAnalysisResult("Failed to perform analysis. Please try again.");
        } finally {
          setIsAnalyzing(false);
        }
      };
      runAnalysis();
    }
  }, [activeTab, analysisResult, isAnalyzing, userData]);
  
  const meansData = processSpeciesMeans();

  const getHistogramData = (feature: string) => {
    const values = irisData.map(d => d[feature as keyof typeof d] as number);
    const min = Math.floor(Math.min(...values) * 10) / 10;
    const max = Math.ceil(Math.max(...values) * 10) / 10;
    const binCount = 8;
    const binSize = (max - min) / binCount;
    
    const bins = Array.from({ length: binCount }, (_, i) => ({
      binStart: min + i * binSize,
      binEnd: min + (i + 1) * binSize,
      setosa: 0,
      versicolor: 0,
      virginica: 0,
      label: `${(min + i * binSize).toFixed(1)}`
    }));

    irisData.forEach(d => {
      const val = d[feature as keyof typeof d] as number;
      const species = d.species as 'setosa' | 'versicolor' | 'virginica';
      const binIndex = Math.min(Math.floor((val - min) / binSize), binCount - 1);
      if (bins[binIndex]) {
        bins[binIndex][species]++;
      }
    });

    return bins;
  };

  const histogramData = getHistogramData(yAxisFeature);

  // For radar chart, we normalize the means to look good on radar
  const radarData = [
    { 
      subject: 'Sepal L', 
      fullLabel: 'Sepal Length',
      setosa: meansData[0].sepalLength, 
      versicolor: meansData[1].sepalLength, 
      virginica: meansData[2].sepalLength,
      user: userData?.sepalLength || 0
    },
    { 
      subject: 'Sepal W', 
      fullLabel: 'Sepal Width',
      setosa: meansData[0].sepalWidth, 
      versicolor: meansData[1].sepalWidth, 
      virginica: meansData[2].sepalWidth,
      user: userData?.sepalWidth || 0
    },
    { 
      subject: 'Petal L', 
      fullLabel: 'Petal Length',
      setosa: meansData[0].petalLength, 
      versicolor: meansData[1].petalLength, 
      virginica: meansData[2].petalLength,
      user: userData?.petalLength || 0
    },
    { 
      subject: 'Petal W', 
      fullLabel: 'Petal Width',
      setosa: meansData[0].petalWidth, 
      versicolor: meansData[1].petalWidth, 
      virginica: meansData[2].petalWidth,
      user: userData?.petalWidth || 0
    },
    { 
      subject: 'Leaf L', 
      fullLabel: 'Leaf Length',
      setosa: (meansData[0] as any).leafLength || 0, 
      versicolor: (meansData[1] as any).leafLength || 0, 
      virginica: (meansData[2] as any).leafLength || 0,
      user: userData?.leafLength || 0
    },
    { 
      subject: 'Leaf W', 
      fullLabel: 'Leaf Width',
      setosa: (meansData[0] as any).leafWidth || 0, 
      versicolor: (meansData[1] as any).leafWidth || 0, 
      virginica: (meansData[2] as any).leafWidth || 0,
      user: userData?.leafWidth || 0
    },
    { 
      subject: 'Thickness', 
      fullLabel: 'Leaf Thickness',
      setosa: (meansData[0] as any).leafThickness || 0, 
      versicolor: (meansData[1] as any).leafThickness || 0, 
      virginica: (meansData[2] as any).leafThickness || 0,
      user: userData?.leafThickness || 0
    }
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'analysis':
        return (
          <div className="w-full h-full p-4 overflow-y-auto">
            <h3 className="text-sm font-bold text-stone-700 mb-4 flex items-center gap-2">
              <Brain className="w-4 h-4 text-emerald-600" />
              AI Morphological Analysis
            </h3>
            {isAnalyzing ? (
              <div className="flex flex-col items-center justify-center py-12 gap-4">
                <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
                <p className="text-sm text-stone-500 font-medium animate-pulse">Analyzing morphological data...</p>
              </div>
            ) : analysisResult ? (
              <div className="markdown-body prose prose-stone prose-sm max-w-none">
                <Markdown>{analysisResult}</Markdown>
              </div>
            ) : (
              <div className="text-center py-12 text-stone-500 text-sm">
                No user data provided for analysis.
              </div>
            )}
          </div>
        );
      case 'scatter':
        return (
          <div className="h-full w-full flex flex-col">
            <h3 className="text-sm font-bold text-center text-stone-700 mb-4">
              {getFeatureLabel(xAxisFeature)} vs {getFeatureLabel(yAxisFeature)}
            </h3>
            <div className="flex-1 w-full min-h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" dataKey={xAxisFeature} name={getFeatureLabel(xAxisFeature)} unit={getFeatureUnit(xAxisFeature)} />
                  <YAxis type="number" dataKey={yAxisFeature} name={getFeatureLabel(yAxisFeature)} unit={getFeatureUnit(yAxisFeature)} />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                  <Legend />
                  <Scatter name="Setosa" data={irisData.filter(d => d.species === 'setosa')} fill={COLORS.setosa} opacity={0.5} />
                  <Scatter name="Versicolor" data={irisData.filter(d => d.species === 'versicolor')} fill={COLORS.versicolor} opacity={0.5} />
                  <Scatter name="Virginica" data={irisData.filter(d => d.species === 'virginica')} fill={COLORS.virginica} opacity={0.5} />
                  {userData && userData[xAxisFeature as keyof typeof userData] !== undefined && userData[yAxisFeature as keyof typeof userData] !== undefined && (
                    <Scatter name="Your Data" data={[userData]} fill={COLORS.user} shape="star" opacity={1} />
                  )}
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      case 'bar':
        return (
          <div className="h-full w-full flex flex-col">
            <h3 className="text-sm font-bold text-center text-stone-700 mb-4">
              {getFeatureLabel(yAxisFeature)} Distribution by Species
            </h3>
            <div className="flex-1 w-full min-h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={meansData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="species" />
                  <YAxis unit={getFeatureUnit(yAxisFeature)} label={{ value: getFeatureLabel(yAxisFeature), angle: -90, position: 'insideLeft' }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey={yAxisFeature} name={getFeatureLabel(yAxisFeature)} fill="#34d399">
                    {meansData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[entry.species as keyof typeof COLORS] || '#8884d8'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      case 'line':
        return (
          <div className="h-full w-full flex flex-col">
            <h3 className="text-sm font-bold text-center text-stone-700 mb-4">
              Sequential Variation: {getFeatureLabel(yAxisFeature)}
            </h3>
            <div className="flex-1 w-full min-h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart margin={{ top: 5, right: 30, left: 20, bottom: 5 }} data={irisData.map((d, i) => ({ ...d, index: i }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="index" label={{ value: 'Sample Index', position: 'insideBottom', offset: -10 }} />
                  <YAxis unit={getFeatureUnit(yAxisFeature)} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey={yAxisFeature} data={irisData.filter(d => d.species === 'setosa')} name="Setosa" stroke={COLORS.setosa} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey={yAxisFeature} data={irisData.filter(d => d.species === 'versicolor')} name="Versicolor" stroke={COLORS.versicolor} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey={yAxisFeature} data={irisData.filter(d => d.species === 'virginica')} name="Virginica" stroke={COLORS.virginica} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      case 'radar':
        return (
          <div className="h-full w-full flex flex-col">
            <h3 className="text-sm font-bold text-center text-stone-700 mb-4">Species Morphology Profiles (Mean Values)</h3>
            <div className="flex-1 w-full min-h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                  <PolarGrid stroke="#e5e7eb" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#6b7280', fontSize: 10, fontWeight: 600 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 'auto']} axisLine={false} tick={false} />
                  <Radar name="Setosa" dataKey="setosa" stroke={COLORS.setosa} fill={COLORS.setosa} fillOpacity={0.4} />
                  <Radar name="Versicolor" dataKey="versicolor" stroke={COLORS.versicolor} fill={COLORS.versicolor} fillOpacity={0.4} />
                  <Radar name="Virginica" dataKey="virginica" stroke={COLORS.virginica} fill={COLORS.virginica} fillOpacity={0.4} />
                  {userData && (userData.sepalLength || userData.petalLength) && (
                    <Radar name="Your Plant" dataKey="user" stroke={COLORS.user} fill={COLORS.user} fillOpacity={0.2} strokeDasharray="4 4" />
                  )}
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend verticalAlign="bottom" wrapperStyle={{ paddingTop: '20px' }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            {userData && (
              <div className="mt-4 px-4 py-2 bg-orange-50/50 border border-orange-100 rounded-xl text-[10px] text-orange-700 font-medium text-center italic">
                * Dashed line represents your plant's profile compared to typical species averages.
              </div>
            )}
          </div>
        );
      case 'doughnut':
        return (
          <div className="h-64 w-full">
            <h3 className="text-sm font-bold text-center text-stone-700 mb-2">Species Ratio (Iris Dataset Demo)</h3>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Setosa', value: 50 },
                    { name: 'Versicolor', value: 50 },
                    { name: 'Virginica', value: 50 },
                  ]}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  <Cell fill={COLORS.setosa} />
                  <Cell fill={COLORS.versicolor} />
                  <Cell fill={COLORS.virginica} />
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        );
      case 'bubble':
        return (
          <div className="h-64 w-full">
            <h3 className="text-sm font-bold text-center text-stone-700 mb-2">Sepal Dimension vs Petal Size</h3>
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 20 }}>
                <CartesianGrid />
                <XAxis type="number" dataKey="sepalLength" name="Sepal L" unit="cm" />
                <YAxis type="number" dataKey="sepalWidth" name="Sepal W" unit="cm" />
                <ZAxis type="number" dataKey="petalWidth" range={[20, 200]} name="Petal W" />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                <Legend />
                <Scatter name="Setosa" data={irisData.filter(d => d.species === 'setosa')} fill={COLORS.setosa} opacity={0.6} />
                <Scatter name="Versicolor" data={irisData.filter(d => d.species === 'versicolor')} fill={COLORS.versicolor} opacity={0.6} />
                <Scatter name="Virginica" data={irisData.filter(d => d.species === 'virginica')} fill={COLORS.virginica} opacity={0.6} />
                {userData && userData.sepalLength && userData.sepalWidth && userData.petalWidth && (
                  <Scatter name="Your Data" data={[userData]} fill={COLORS.user} shape="star" opacity={1} />
                )}
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        );
      case 'histogram':
        return (
          <div className="h-full w-full flex flex-col">
            <h3 className="text-sm font-bold text-center text-stone-700 mb-4">
              Frequency Distribution: {getFeatureLabel(yAxisFeature)}
            </h3>
            <div className="flex-1 w-full min-h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={histogramData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis 
                    dataKey="label" 
                    label={{ value: `${getFeatureLabel(yAxisFeature)} (${getFeatureUnit(yAxisFeature)})`, position: 'insideBottom', offset: -10 }} 
                  />
                  <YAxis label={{ value: 'Frequency', angle: -90, position: 'insideLeft' }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number, name: string) => [value, name.charAt(0).toUpperCase() + name.slice(1)]}
                  />
                  <Legend />
                  <Bar dataKey="setosa" name="Setosa" stackId="a" fill={COLORS.setosa} />
                  <Bar dataKey="versicolor" name="Versicolor" stackId="a" fill={COLORS.versicolor} />
                  <Bar dataKey="virginica" name="Virginica" stackId="a" fill={COLORS.virginica} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {userData && userData[yAxisFeature as keyof typeof userData] !== undefined && (
              <div className="mt-2 text-center">
                <span className="inline-flex items-center gap-2 px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-[10px] font-bold">
                  <Activity className="w-3 h-3" />
                  Your plant: {userData[yAxisFeature as keyof typeof userData]} {getFeatureUnit(yAxisFeature)}
                </span>
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl relative flex flex-col max-h-[90vh]"
      >
        <div className="p-4 border-b border-stone-100 flex justify-between items-center bg-stone-50/50">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-full transition-colors mr-2">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="bg-emerald-100 p-2 rounded-xl text-emerald-700">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-stone-800">Morphodynamics Data</h2>
              <p className="text-[10px] text-stone-500">Visualizing reference dataset</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-full transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 p-4 bg-white border-b border-stone-100">
          <button onClick={() => setActiveTab('analysis')} className={`p-2 text-xs font-bold rounded-lg flex flex-col items-center gap-1 ${activeTab === 'analysis' ? 'bg-emerald-100 text-emerald-700' : 'text-stone-500 hover:bg-stone-50'}`}>
            <Brain className="w-4 h-4" /> AI Analysis
          </button>
          <button onClick={() => setActiveTab('scatter')} className={`p-2 text-xs font-bold rounded-lg flex flex-col items-center gap-1 ${activeTab === 'scatter' ? 'bg-emerald-100 text-emerald-700' : 'text-stone-500 hover:bg-stone-50'}`}>
            <ScatterIcon className="w-4 h-4" /> Scatter
          </button>
          <button onClick={() => setActiveTab('bar')} className={`p-2 text-xs font-bold rounded-lg flex flex-col items-center gap-1 ${activeTab === 'bar' ? 'bg-emerald-100 text-emerald-700' : 'text-stone-500 hover:bg-stone-50'}`}>
            <BarChart3 className="w-4 h-4" /> Bar
          </button>
          <button onClick={() => setActiveTab('line')} className={`p-2 text-xs font-bold rounded-lg flex flex-col items-center gap-1 ${activeTab === 'line' ? 'bg-emerald-100 text-emerald-700' : 'text-stone-500 hover:bg-stone-50'}`}>
            <LineIcon className="w-4 h-4" /> Line
          </button>
          <button onClick={() => setActiveTab('radar')} className={`p-2 text-xs font-bold rounded-lg flex flex-col items-center gap-1 ${activeTab === 'radar' ? 'bg-emerald-100 text-emerald-700' : 'text-stone-500 hover:bg-stone-50'}`}>
            <Activity className="w-4 h-4" /> Radar
          </button>
          <button onClick={() => setActiveTab('doughnut')} className={`p-2 text-xs font-bold rounded-lg flex flex-col items-center gap-1 ${activeTab === 'doughnut' ? 'bg-emerald-100 text-emerald-700' : 'text-stone-500 hover:bg-stone-50'}`}>
            <PieIcon className="w-4 h-4" /> Pie
          </button>
          <button onClick={() => setActiveTab('histogram')} className={`p-2 text-xs font-bold rounded-lg flex flex-col items-center gap-1 ${activeTab === 'histogram' ? 'bg-emerald-100 text-emerald-700' : 'text-stone-500 hover:bg-stone-50'}`}>
            <BarChart3 className="w-4 h-4" /> Histogram
          </button>
          <button onClick={() => setActiveTab('bubble')} className={`p-2 text-xs font-bold rounded-lg flex flex-col items-center gap-1 ${activeTab === 'bubble' ? 'bg-emerald-100 text-emerald-700' : 'text-stone-500 hover:bg-stone-50'}`}>
            <ScatterIcon className="w-4 h-4" /> Bubble
          </button>
        </div>

        {['scatter', 'bar', 'line', 'histogram'].includes(activeTab) && (
          <div className="px-6 py-4 bg-white border-b border-stone-100 flex flex-wrap gap-6 items-center justify-center">
            {activeTab === 'scatter' && (
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Preset View</span>
                  <select 
                    onChange={(e) => {
                      const preset = PRESETS[parseInt(e.target.value)];
                      if (preset) {
                        setXAxisFeature(preset.x);
                        setYAxisFeature(preset.y);
                      }
                    }}
                    className="text-xs font-bold bg-stone-50 border border-stone-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all cursor-pointer hover:border-emerald-200"
                  >
                    <option value="">Custom Selection</option>
                    {PRESETS.map((p, i) => <option key={i} value={i}>{p.label}</option>)}
                  </select>
                </div>
                <div className="h-8 w-px bg-stone-100 hidden sm:block" />
              </div>
            )}
            
            {activeTab === 'scatter' && (
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Horizontal (X)</span>
                  <select 
                    value={xAxisFeature} 
                    onChange={(e) => setXAxisFeature(e.target.value)}
                    className="text-xs font-bold bg-white border border-stone-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all cursor-pointer hover:border-emerald-200"
                  >
                    {FEATURES.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                  </select>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">
                  {['bar', 'line', 'histogram'].includes(activeTab) ? 'Visualization Metric' : 'Vertical (Y)'}
                </span>
                <select 
                  value={yAxisFeature} 
                  onChange={(e) => setYAxisFeature(e.target.value)}
                  className="text-xs font-bold bg-white border border-stone-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all cursor-pointer hover:border-emerald-200"
                >
                  {FEATURES.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}

        <div className="p-6 bg-stone-50/30 flex-1 min-h-[400px] flex items-center justify-center">
          {renderContent()}
        </div>
      </motion.div>
    </div>
  );
}
