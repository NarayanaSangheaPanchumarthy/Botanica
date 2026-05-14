import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, updateDoc, deleteField } from 'firebase/firestore';
import { db, auth } from './firebase';
import { X, Plus, Image as ImageIcon, Calendar, Trash2, ChevronLeft, Camera, Leaf, Edit, GitCompare, CheckCircle2, Search, Sparkles, Loader2, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { analyzePlantDimensions } from './services/geminiService';

interface Plant {
  id: string;
  name: string;
  species?: string;
  createdAt: number;
}

interface JournalEntry {
  id: string;
  plantId: string;
  note: string;
  photoBase64?: string;
  date: string;
  createdAt: number;
  sepalLength?: number;
  sepalWidth?: number;
  petalLength?: number;
  petalWidth?: number;
  leafLength?: number;
  leafWidth?: number;
  leafThickness?: number;
}

interface PlantJournalProps {
  onClose: () => void;
}

export default function PlantJournal({ onClose }: PlantJournalProps) {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlant, setSelectedPlant] = useState<Plant | null>(null);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [compareViewType, setCompareViewType] = useState<'timeline' | 'metrics' | 'trend'>('timeline');
  const [trendMeasurement, setTrendMeasurement] = useState<keyof JournalEntry>('sepalLength');
  const [selectedComparePlants, setSelectedComparePlants] = useState<Plant[]>([]);
  const [showCompareView, setShowCompareView] = useState(false);
  const [compareEntries, setCompareEntries] = useState<Record<string, JournalEntry[]>>({});

  const trendData = React.useMemo(() => {
    if (!showCompareView || compareViewType !== 'trend') return [];
    
    // 1. Get all unique dates from all selected plants, sorted chronologicaly
    const dates = Array.from(new Set(
      selectedComparePlants.flatMap(plant => (compareEntries[plant.id] || []).map(e => e.date))
    )).sort();
    
    // 2. Create data objects for LineChart: { date: '...', [plantId1]: value, [plantId2]: value, ... }
    return dates.map(date => {
       const row: any = { date: new Date(date).toLocaleDateString() };
       selectedComparePlants.forEach(plant => {
         // Find the entry for this date for this plant. If one date has multiple entries, take the first one found.
         const entry = compareEntries[plant.id]?.find(e => e.date === date);
         row[plant.id] = entry ? entry[trendMeasurement] : null; 
       });
       return row;
    });
  }, [showCompareView, compareViewType, compareEntries, trendMeasurement, selectedComparePlants]);

  const [showAddPlant, setShowAddPlant] = useState(false);
  const [newPlantName, setNewPlantName] = useState('');
  const [newPlantSpecies, setNewPlantSpecies] = useState('');

  const [showAddEntry, setShowAddEntry] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [newEntryNote, setNewEntryNote] = useState('');
  const [newEntryDate, setNewEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [newEntryPhoto, setNewEntryPhoto] = useState<string | null>(null);
  
  const [sepalLength, setSepalLength] = useState<number | ''>('');
  const [sepalWidth, setSepalWidth] = useState<number | ''>('');
  const [petalLength, setPetalLength] = useState<number | ''>('');
  const [petalWidth, setPetalWidth] = useState<number | ''>('');
  const [leafLength, setLeafLength] = useState<number | ''>('');
  const [leafWidth, setLeafWidth] = useState<number | ''>('');
  const [leafThickness, setLeafThickness] = useState<number | ''>('');

  const [showMeasurements, setShowMeasurements] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(collection(db, 'users', auth.currentUser.uid, 'plants'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPlants(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Plant)));
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!auth.currentUser || !selectedPlant) return;
    const q = query(collection(db, 'users', auth.currentUser.uid, 'plants', selectedPlant.id, 'entries'), orderBy('date', 'desc'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setEntries(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as JournalEntry)));
    });
    return () => unsubscribe();
  }, [selectedPlant]);

  useEffect(() => {
    if (!showCompareView || selectedComparePlants.length === 0 || !auth.currentUser) return;
    
    // We fetch entries for all selected compare plants
    const unsubscribes = selectedComparePlants.map(plant => {
      const q = query(
        collection(db, 'users', auth.currentUser!.uid, 'plants', plant.id, 'entries'),
        orderBy('date', 'desc'),
        orderBy('createdAt', 'desc')
      );
      return onSnapshot(q, (snapshot) => {
        setCompareEntries(prev => ({
          ...prev,
          [plant.id]: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as JournalEntry))
        }));
      });
    });

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [showCompareView, selectedComparePlants]);

  const handleAddPlant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !newPlantName.trim()) return;
    
    await addDoc(collection(db, 'users', auth.currentUser.uid, 'plants'), {
      name: newPlantName.trim(),
      species: newPlantSpecies.trim() || null,
      createdAt: Date.now()
    });
    
    setNewPlantName('');
    setNewPlantSpecies('');
    setShowAddPlant(false);
  };

  const handleDeletePlant = async (plantId: string) => {
    if (!auth.currentUser) return;
    if (confirm('Are you sure you want to delete this plant and all its journal entries?')) {
      await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'plants', plantId));
      if (selectedPlant?.id === plantId) setSelectedPlant(null);
    }
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
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
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        // Compress to JPEG with 0.7 quality
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        setNewEntryPhoto(dataUrl);
        
        // Automatically suggest analysis
        handleAIAnalysis(dataUrl);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleAIAnalysis = async (photo: string) => {
    if (!photo) return;
    setIsAnalyzing(true);
    try {
      const dims = await analyzePlantDimensions(photo);
      if (dims.sepalLength) setSepalLength(dims.sepalLength);
      if (dims.sepalWidth) setSepalWidth(dims.sepalWidth);
      if (dims.petalLength) setPetalLength(dims.petalLength);
      if (dims.petalWidth) setPetalWidth(dims.petalWidth);
      if (dims.leafLength) setLeafLength(dims.leafLength);
      if (dims.leafWidth) setLeafWidth(dims.leafWidth);
      if (dims.leafThickness) setLeafThickness(dims.leafThickness);
      
      // Open measurements if any were found
      if (Object.values(dims).some(v => v !== undefined)) {
        setShowMeasurements(true);
      }
    } catch (error) {
      console.error("AI Analysis failed:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !selectedPlant || !newEntryNote.trim() || !newEntryDate) return;

    if (editingEntry) {
      const entryRef = doc(db, 'users', auth.currentUser.uid, 'plants', selectedPlant.id, 'entries', editingEntry.id);
      
      const updateData: any = {
        note: newEntryNote.trim(),
        date: newEntryDate,
        photoBase64: newEntryPhoto ? newEntryPhoto : deleteField()
      };
      
      if (sepalLength !== '') updateData.sepalLength = sepalLength; else updateData.sepalLength = deleteField();
      if (sepalWidth !== '') updateData.sepalWidth = sepalWidth; else updateData.sepalWidth = deleteField();
      if (petalLength !== '') updateData.petalLength = petalLength; else updateData.petalLength = deleteField();
      if (petalWidth !== '') updateData.petalWidth = petalWidth; else updateData.petalWidth = deleteField();
      if (leafLength !== '') updateData.leafLength = leafLength; else updateData.leafLength = deleteField();
      if (leafWidth !== '') updateData.leafWidth = leafWidth; else updateData.leafWidth = deleteField();
      if (leafThickness !== '') updateData.leafThickness = leafThickness; else updateData.leafThickness = deleteField();

      await updateDoc(entryRef, updateData);
    } else {
      const entryData: any = {
        plantId: selectedPlant.id,
        note: newEntryNote.trim(),
        date: newEntryDate,
        createdAt: Date.now()
      };

      if (newEntryPhoto) entryData.photoBase64 = newEntryPhoto;
      if (sepalLength !== '') entryData.sepalLength = sepalLength;
      if (sepalWidth !== '') entryData.sepalWidth = sepalWidth;
      if (petalLength !== '') entryData.petalLength = petalLength;
      if (petalWidth !== '') entryData.petalWidth = petalWidth;
      if (leafLength !== '') entryData.leafLength = leafLength;
      if (leafWidth !== '') entryData.leafWidth = leafWidth;
      if (leafThickness !== '') entryData.leafThickness = leafThickness;

      await addDoc(collection(db, 'users', auth.currentUser.uid, 'plants', selectedPlant.id, 'entries'), entryData);
    }
    
    handleCancelForm();
  };

  const handleEditClick = (entry: JournalEntry) => {
    setEditingEntry(entry);
    setNewEntryNote(entry.note);
    setNewEntryDate(entry.date);
    setNewEntryPhoto(entry.photoBase64 || null);
    
    setSepalLength(entry.sepalLength ?? '');
    setSepalWidth(entry.sepalWidth ?? '');
    setPetalLength(entry.petalLength ?? '');
    setPetalWidth(entry.petalWidth ?? '');
    setLeafLength(entry.leafLength ?? '');
    setLeafWidth(entry.leafWidth ?? '');
    setLeafThickness(entry.leafThickness ?? '');
    setShowMeasurements(!!(entry.sepalLength || entry.sepalWidth || entry.petalLength || entry.petalWidth || entry.leafLength || entry.leafWidth || entry.leafThickness));

    setShowAddEntry(false);
  };

  const handleCancelForm = () => {
    setShowAddEntry(false);
    setEditingEntry(null);
    setNewEntryNote('');
    setNewEntryDate(new Date().toISOString().split('T')[0]);
    setNewEntryPhoto(null);
    setSepalLength('');
    setSepalWidth('');
    setPetalLength('');
    setPetalWidth('');
    setLeafLength('');
    setLeafWidth('');
    setLeafThickness('');
    setShowMeasurements(false);
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (!auth.currentUser || !selectedPlant) return;
    if (confirm('Delete this journal entry?')) {
      await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'plants', selectedPlant.id, 'entries', entryId));
    }
  };

  const filteredPlants = plants.filter(plant => 
    plant.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (plant.species && plant.species.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredEntries = entries.filter(entry => 
    entry.note.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-3xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden shadow-2xl relative"
      >
        {/* Header */}
        <div className="p-6 border-b border-stone-100 flex justify-between items-center bg-stone-50/50">
          <div className="flex items-center gap-3">
            {(selectedPlant || showCompareView) && (
              <button 
                onClick={() => {
                  setSelectedPlant(null);
                  setShowCompareView(false);
                }} 
                className="p-2 hover:bg-stone-200 rounded-full transition-colors mr-2"
              >
                <ChevronLeft className="w-5 h-5 text-stone-600" />
              </button>
            )}
            <div className="bg-green-100 p-2 rounded-xl">
              {showCompareView ? <GitCompare className="w-6 h-6 text-green-700" /> : <Calendar className="w-6 h-6 text-green-700" />}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-stone-800">{showCompareView ? 'Compare Plants' : 'Plant Journal'}</h2>
              <p className="text-xs text-stone-500">
                {showCompareView ? `Comparing ${selectedComparePlants.length} plants` : selectedPlant ? `Tracking ${selectedPlant.name}` : 'Track your plants progress over time'}
              </p>
            </div>
          </div>
          
          {/* Search Bar */}
          <div className="mx-4 flex-1 max-w-sm hidden md:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input 
                type="text" 
                placeholder="Search plants or entries..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-stone-100 border-none rounded-full text-sm focus:ring-2 focus:ring-green-500/30 text-stone-700"
              />
            </div>
          </div>

          <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-full transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden flex bg-stone-50">
          {!selectedPlant && !showCompareView ? (
            // Plant List View
            <div className="flex-1 p-6 overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-stone-800">My Plants</h3>
                <div className="flex items-center gap-2">
                  {isCompareMode ? (
                    <>
                      <button 
                        onClick={() => {
                           setIsCompareMode(false);
                           setSelectedComparePlants([]);
                        }}
                        className="px-4 py-2 rounded-full text-sm font-bold text-stone-500 hover:bg-stone-100 transition-colors flex items-center gap-2"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={() => setShowCompareView(true)}
                        disabled={selectedComparePlants.length < 2}
                        className="bg-green-600 disabled:bg-stone-300 disabled:text-stone-500 text-white px-4 py-2 rounded-full text-sm font-bold hover:bg-green-700 transition-colors flex items-center gap-2 shadow-sm"
                      >
                        <GitCompare className="w-4 h-4" /> Compare Selected ({selectedComparePlants.length})
                      </button>
                    </>
                  ) : (
                    <>
                      <button 
                        onClick={() => setIsCompareMode(true)}
                        className="px-4 py-2 rounded-full text-sm font-bold text-stone-600 hover:bg-stone-100 transition-colors flex items-center gap-2"
                      >
                        <GitCompare className="w-4 h-4" /> Compare
                      </button>
                      <button 
                        onClick={() => setShowAddPlant(true)}
                        className="bg-green-600 text-white px-4 py-2 rounded-full text-sm font-bold hover:bg-green-700 transition-colors flex items-center gap-2 shadow-sm"
                      >
                        <Plus className="w-4 h-4" /> Add Plant
                      </button>
                    </>
                  )}
                </div>
              </div>

              {showAddPlant && (
                <form onSubmit={handleAddPlant} className="bg-white p-4 rounded-2xl border border-stone-200 mb-6 shadow-sm">
                  <div className="flex gap-4 mb-4">
                    <input 
                      type="text" 
                      placeholder="Plant Name (e.g., Monstera)" 
                      value={newPlantName}
                      onChange={(e) => setNewPlantName(e.target.value)}
                      className="flex-1 px-4 py-2 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-green-500/50"
                      required
                    />
                    <input 
                      type="text" 
                      placeholder="Species (Optional)" 
                      value={newPlantSpecies}
                      onChange={(e) => setNewPlantSpecies(e.target.value)}
                      className="flex-1 px-4 py-2 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-green-500/50"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setShowAddPlant(false)} className="px-4 py-2 text-stone-500 hover:bg-stone-100 rounded-xl text-sm font-medium transition-colors">Cancel</button>
                    <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 transition-colors">Save Plant</button>
                  </div>
                </form>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredPlants.map(plant => (
                  <div 
                    key={plant.id} 
                    onClick={() => {
                      if (isCompareMode) {
                        if (selectedComparePlants.find(p => p.id === plant.id)) {
                          setSelectedComparePlants(prev => prev.filter(p => p.id !== plant.id));
                        } else {
                          setSelectedComparePlants(prev => [...prev, plant]);
                        }
                      } else {
                        setSelectedPlant(plant);
                      }
                    }}
                    className={`bg-white p-5 rounded-2xl border shadow-sm hover:shadow-md transition-all cursor-pointer group relative ${isCompareMode && selectedComparePlants.find(p => p.id === plant.id) ? 'border-green-500 ring-2 ring-green-200' : 'border-stone-200 hover:border-green-300'}`}
                  >
                    {isCompareMode && selectedComparePlants.find(p => p.id === plant.id) && (
                      <div className="absolute top-4 right-4 text-green-500">
                        <CheckCircle2 className="w-5 h-5 fill-green-50" />
                      </div>
                    )}
                    <h4 className="font-bold text-stone-800 text-lg mb-1 pr-8">{plant.name}</h4>
                    {plant.species && <p className="text-sm text-stone-500 italic mb-3">{plant.species}</p>}
                    <p className="text-xs text-stone-400">Added {new Date(plant.createdAt).toLocaleDateString()}</p>
                    
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDeletePlant(plant.id); }}
                      className="absolute top-4 right-4 p-2 text-stone-300 hover:text-red-500 hover:bg-red-50 rounded-full opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {plants.length === 0 && !showAddPlant && (
                  <div className="col-span-full text-center py-12 text-stone-500">
                    <p>No plants added yet. Start tracking your garden!</p>
                  </div>
                )}
              </div>
            </div>
          ) : showCompareView ? (
            <div className="flex-1 flex flex-col overflow-hidden bg-stone-100">
              {/* Compare Mode Header */}
              <div className="p-4 bg-white border-b border-stone-200 flex justify-center gap-4">
                <button 
                  onClick={() => setCompareViewType('timeline')}
                  className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${compareViewType === 'timeline' ? 'bg-green-600 text-white shadow-md' : 'text-stone-500 hover:bg-stone-100'}`}
                >
                  <Calendar className="w-4 h-4 inline-block mr-2" /> Timeline
                </button>
                <button 
                  onClick={() => setCompareViewType('metrics')}
                  className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${compareViewType === 'metrics' ? 'bg-green-600 text-white shadow-md' : 'text-stone-500 hover:bg-stone-100'}`}
                >
                  <GitCompare className="w-4 h-4 inline-block mr-2" /> Metrics Matrix
                </button>
                <button 
                  onClick={() => setCompareViewType('trend')}
                  className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${compareViewType === 'trend' ? 'bg-green-600 text-white shadow-md' : 'text-stone-500 hover:bg-stone-100'}`}
                >
                  <TrendingUp className="w-4 h-4 inline-block mr-2" /> Trends
                </button>
              </div>

              <div className="flex-1 overflow-x-auto p-6 scrollbar-thin scrollbar-thumb-stone-300">
                {compareViewType === 'metrics' ? (
                  <div className="bg-white rounded-3xl shadow-sm border border-stone-200 overflow-hidden min-w-max">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-stone-50/80 border-b border-stone-200">
                          <th className="p-6 text-xs font-bold text-stone-400 uppercase tracking-widest border-r border-stone-200">Measurement (Latest)</th>
                          {selectedComparePlants.map(plant => (
                            <th key={plant.id} className="p-6 min-w-[200px]">
                              <div className="text-lg font-black text-stone-800">{plant.name}</div>
                              {plant.species && <div className="text-xs text-stone-500 italic font-medium">{plant.species}</div>}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {[
                          { label: 'Sepal Length', key: 'sepalLength', unit: 'cm', icon: '📏' },
                          { label: 'Sepal Width', key: 'sepalWidth', unit: 'cm', icon: '📏' },
                          { label: 'Petal Length', key: 'petalLength', unit: 'cm', icon: '🌸' },
                          { label: 'Petal Width', key: 'petalWidth', unit: 'cm', icon: '🌸' },
                          { label: 'Leaf Length', key: 'leafLength', unit: 'cm', icon: '🍃' },
                          { label: 'Leaf Width', key: 'leafWidth', unit: 'cm', icon: '🍃' },
                          { label: 'Leaf Thickness', key: 'leafThickness', unit: 'mm', icon: '🍃' },
                        ].map((metric) => (
                          <tr key={metric.key} className="hover:bg-stone-50/50 transition-colors">
                            <td className="p-5 border-r border-stone-200">
                              <div className="flex items-center gap-3">
                                <span className="text-xl">{metric.icon}</span>
                                <div>
                                  <div className="font-bold text-stone-700 text-sm">{metric.label}</div>
                                  <div className="text-[10px] text-stone-400 uppercase tracking-tighter">Unit: {metric.unit}</div>
                                </div>
                              </div>
                            </td>
                            {selectedComparePlants.map(plant => {
                              const latestEntryWithMetric = [...(compareEntries[plant.id] || [])]
                                .find(e => e[metric.key as keyof JournalEntry] !== undefined);
                              const value = latestEntryWithMetric ? latestEntryWithMetric[metric.key as keyof JournalEntry] : null;
                              
                              return (
                                <td key={plant.id} className="p-5">
                                  {value !== null ? (
                                    <div className="flex items-baseline gap-1">
                                      <span className="text-2xl font-black text-green-600 tracking-tighter">{value}</span>
                                      <span className="text-xs font-bold text-stone-400">{metric.unit}</span>
                                    </div>
                                  ) : (
                                    <span className="text-stone-300 font-medium italic text-sm">-- N/A --</span>
                                  )}
                                  {latestEntryWithMetric && (
                                    <div className="text-[10px] text-stone-400 mt-1">
                                      Recorded {new Date(latestEntryWithMetric.date).toLocaleDateString()}
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    
                    <div className="p-8 bg-stone-50 border-t border-stone-100 italic text-stone-400 text-xs text-center">
                      * This visual comparison matrix uses the most recent recorded measurement for each plant.
                    </div>
                  </div>
                ) : compareViewType === 'trend' ? (
                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-stone-200">
                    <div className="mb-6 flex gap-4 items-center">
                       <span className="text-sm font-bold text-stone-500 uppercase tracking-widest">Select Measurement:</span>
                       <select 
                         value={trendMeasurement} 
                         onChange={(e) => setTrendMeasurement(e.target.value as keyof JournalEntry)}
                         className="px-4 py-2 rounded-xl border border-stone-200 text-sm font-medium focus:ring-2 focus:ring-green-500"
                       >
                         {['sepalLength', 'sepalWidth', 'petalLength', 'petalWidth', 'leafLength', 'leafWidth', 'leafThickness'].map(m => (
                           <option key={m} value={m}>{m.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</option>
                         ))}
                       </select>
                    </div>
                    <div className="h-[400px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={trendData}>                
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          {selectedComparePlants.map((plant, idx) => (
                             <Line key={plant.id} type="monotone" dataKey={plant.id} name={plant.name} stroke={`hsl(${idx * 137}, 70%, 50%)`} strokeWidth={2} />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-6 h-full min-w-max">
                    {selectedComparePlants.map(plant => (
                      <div key={plant.id} className="w-[360px] flex flex-col bg-white border border-stone-200 shadow-sm rounded-3xl overflow-hidden">
                        <div className="p-5 border-b border-stone-200 bg-stone-50/80">
                          <h3 className="font-bold text-stone-800 text-xl">{plant.name}</h3>
                          {plant.species && <p className="text-sm text-stone-500 italic">{plant.species}</p>}
                        </div>
                        <div className="flex-1 overflow-y-auto p-5 space-y-5">
                          {(compareEntries[plant.id] || [])
                            .filter(entry => entry.note.toLowerCase().includes(searchQuery.toLowerCase()))
                            .map((entry: JournalEntry) => (
                            <div key={entry.id} className="bg-stone-50 p-4 rounded-2xl border border-stone-200 relative">
                              <div className="absolute -left-[1px] top-4 w-1 h-8 bg-green-400 rounded-r-md" />
                              <div className="font-bold text-sm text-stone-800 mb-2 pl-2">{new Date(entry.date).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</div>
                              <p className="text-sm text-stone-600 whitespace-pre-wrap pl-2">{entry.note}</p>
                              {entry.photoBase64 && <img src={entry.photoBase64} alt="Journal entry" className="mt-3 mx-2 w-[calc(100%-16px)] rounded-xl object-cover max-h-48 border border-stone-100 shadow-sm" />}
                              <div className="mx-2 mt-3 flex flex-wrap gap-2">
                                {entry.sepalLength && <span className="bg-stone-200 text-stone-700 px-2 py-1 rounded text-xs">Sepal L: {entry.sepalLength}cm</span>}
                                {entry.sepalWidth && <span className="bg-stone-200 text-stone-700 px-2 py-1 rounded text-xs">Sepal W: {entry.sepalWidth}cm</span>}
                                {entry.petalLength && <span className="bg-stone-200 text-stone-700 px-2 py-1 rounded text-xs">Petal L: {entry.petalLength}cm</span>}
                                {entry.petalWidth && <span className="bg-stone-200 text-stone-700 px-2 py-1 rounded text-xs">Petal W: {entry.petalWidth}cm</span>}
                                {entry.leafLength && <span className="bg-stone-200 text-stone-700 px-2 py-1 rounded text-xs">Leaf L: {entry.leafLength}cm</span>}
                                {entry.leafWidth && <span className="bg-stone-200 text-stone-700 px-2 py-1 rounded text-xs">Leaf W: {entry.leafWidth}cm</span>}
                                {entry.leafThickness && <span className="bg-stone-200 text-stone-700 px-2 py-1 rounded text-xs">Leaf T: {entry.leafThickness}mm</span>}
                              </div>
                            </div>
                          ))}
                          {(compareEntries[plant.id] || []).length === 0 && (
                            <p className="text-sm text-stone-400 text-center py-8">No entries for this plant yet.</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            // Journal Entries View
            <div className="flex-1 flex flex-col h-full">
              <div className="p-6 border-b border-stone-200 bg-white flex justify-between items-center">
                <div>
                  <h3 className="text-2xl font-bold text-stone-800">{selectedPlant.name}</h3>
                  {selectedPlant.species && <p className="text-stone-500 italic">{selectedPlant.species}</p>}
                </div>
                <button 
                  onClick={() => setShowAddEntry(true)}
                  className="bg-green-600 text-white px-5 py-2.5 rounded-full text-sm font-bold hover:bg-green-700 transition-colors flex items-center gap-2 shadow-sm"
                >
                  <Plus className="w-4 h-4" /> New Entry
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {(showAddEntry || editingEntry) && (
                  <form onSubmit={handleAddEntry} className="bg-white p-5 rounded-2xl border border-stone-200 mb-8 shadow-sm">
                    <h4 className="font-bold text-stone-800 mb-4">{editingEntry ? 'Edit Journal Entry' : 'Add Journal Entry'}</h4>
                    <div className="space-y-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-stone-500 uppercase tracking-wider">Entry Date</label>
                        <input 
                          type="date" 
                          value={newEntryDate}
                          onChange={(e) => setNewEntryDate(e.target.value)}
                          className="w-full px-4 py-2 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-green-500/50 text-stone-700"
                          required
                        />
                      </div>
                      
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-stone-500 uppercase tracking-wider">Note</label>
                        <textarea 
                          placeholder="How is the plant doing? Any new growth, issues, or care taken?"
                          value={newEntryNote}
                          onChange={(e) => setNewEntryNote(e.target.value)}
                          onInput={(e) => {
                            const target = e.target as HTMLTextAreaElement;
                            target.style.height = 'auto';
                            target.style.height = `${target.scrollHeight}px`;
                          }}
                          className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-green-500/50 min-h-[100px] resize-none overflow-hidden text-stone-700"
                          required
                        />
                      </div>
                      
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-stone-500 uppercase tracking-wider">Photo (Optional)</label>
                        <input 
                          type="file" 
                          accept="image/*" 
                          ref={fileInputRef}
                          onChange={handlePhotoSelect}
                          className="hidden"
                        />
                        {newEntryPhoto ? (
                          <div className="flex flex-col gap-3">
                            <div className="relative inline-block group w-fit">
                              <img src={newEntryPhoto} alt="Preview" className="h-48 rounded-2xl object-cover border-2 border-stone-200 shadow-lg" />
                              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3 rounded-b-2xl opacity-0 group-hover:opacity-100 transition-opacity flex justify-between items-center">
                                <button 
                                  type="button" 
                                  onClick={() => setNewEntryPhoto(null)}
                                  className="bg-red-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-red-600 transition-colors shadow-sm"
                                >
                                  <Trash2 className="w-3.5 h-3.5" /> Remove
                                </button>
                                <button 
                                  type="button" 
                                  onClick={() => fileInputRef.current?.click()}
                                  className="bg-white/20 backdrop-blur-md text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-white/30 transition-colors"
                                >
                                  <Camera className="w-3.5 h-3.5" /> Retake
                                </button>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleAIAnalysis(newEntryPhoto)}
                              disabled={isAnalyzing}
                              className={`flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold shadow-sm transition-all ${isAnalyzing ? 'bg-stone-100 text-stone-400 cursor-not-allowed' : 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-600 hover:to-teal-700 shadow-emerald-200'}`}
                            >
                              {isAnalyzing ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  Analyzing Plant Dimensions...
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-4 h-4" />
                                  Scan Morphology with AI
                                </>
                              )}
                            </button>
                          </div>
                        ) : (
                          <button 
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 border-2 border-dashed border-stone-200 rounded-xl text-stone-500 hover:bg-stone-50 hover:border-stone-300 hover:text-stone-700 transition-all text-sm font-medium"
                          >
                            <Camera className="w-5 h-5" /> Add Photo
                          </button>
                        )}
                      </div>

                      <div className="border-t border-stone-100 pt-4">
                        <button 
                          type="button" 
                          onClick={() => setShowMeasurements(!showMeasurements)}
                          className="flex items-center gap-2 text-sm font-bold text-stone-600 hover:text-green-600 transition-colors"
                        >
                          <Leaf className="w-4 h-4" /> 
                          {showMeasurements ? 'Hide Plant Measurements' : 'Add Plant Measurements (Optional)'}
                        </button>
                        
                        {showMeasurements && (
                          <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3">
                            <div className="flex flex-col gap-1.5">
                              <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Sepal Length</label>
                              <div className="relative">
                                <input type="number" step="0.1" value={sepalLength} onChange={(e) => setSepalLength(e.target.value === '' ? '' : Number(e.target.value))} className="w-full px-3 py-2 pr-8 rounded-lg border border-stone-200 text-sm focus:outline-none focus:border-green-500" placeholder="e.g. 5.1" />
                                <span className="absolute right-3 top-2.5 text-xs font-medium text-stone-400">cm</span>
                              </div>
                            </div>
                            <div className="flex flex-col gap-1.5">
                              <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Sepal Width</label>
                              <div className="relative">
                                <input type="number" step="0.1" value={sepalWidth} onChange={(e) => setSepalWidth(e.target.value === '' ? '' : Number(e.target.value))} className="w-full px-3 py-2 pr-8 rounded-lg border border-stone-200 text-sm focus:outline-none focus:border-green-500" placeholder="e.g. 3.5" />
                                <span className="absolute right-3 top-2.5 text-xs font-medium text-stone-400">cm</span>
                              </div>
                            </div>
                            <div className="flex flex-col gap-1.5">
                              <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Petal Length</label>
                              <div className="relative">
                                <input type="number" step="0.1" value={petalLength} onChange={(e) => setPetalLength(e.target.value === '' ? '' : Number(e.target.value))} className="w-full px-3 py-2 pr-8 rounded-lg border border-stone-200 text-sm focus:outline-none focus:border-green-500" placeholder="e.g. 1.4" />
                                <span className="absolute right-3 top-2.5 text-xs font-medium text-stone-400">cm</span>
                              </div>
                            </div>
                            <div className="flex flex-col gap-1.5">
                              <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Petal Width</label>
                              <div className="relative">
                                <input type="number" step="0.1" value={petalWidth} onChange={(e) => setPetalWidth(e.target.value === '' ? '' : Number(e.target.value))} className="w-full px-3 py-2 pr-8 rounded-lg border border-stone-200 text-sm focus:outline-none focus:border-green-500" placeholder="e.g. 0.2" />
                                <span className="absolute right-3 top-2.5 text-xs font-medium text-stone-400">cm</span>
                              </div>
                            </div>
                            <div className="flex flex-col gap-1.5">
                              <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Leaf Length</label>
                              <div className="relative">
                                <input type="number" step="0.1" value={leafLength} onChange={(e) => setLeafLength(e.target.value === '' ? '' : Number(e.target.value))} className="w-full px-3 py-2 pr-8 rounded-lg border border-stone-200 text-sm focus:outline-none focus:border-green-500" placeholder="e.g. 15.0" />
                                <span className="absolute right-3 top-2.5 text-xs font-medium text-stone-400">cm</span>
                              </div>
                            </div>
                            <div className="flex flex-col gap-1.5">
                              <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Leaf Width</label>
                              <div className="relative">
                                <input type="number" step="0.1" value={leafWidth} onChange={(e) => setLeafWidth(e.target.value === '' ? '' : Number(e.target.value))} className="w-full px-3 py-2 pr-8 rounded-lg border border-stone-200 text-sm focus:outline-none focus:border-green-500" placeholder="e.g. 5.5" />
                                <span className="absolute right-3 top-2.5 text-xs font-medium text-stone-400">cm</span>
                              </div>
                            </div>
                            <div className="flex flex-col gap-1.5">
                              <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Leaf Thickness</label>
                              <div className="relative">
                                <input type="number" step="0.1" value={leafThickness} onChange={(e) => setLeafThickness(e.target.value === '' ? '' : Number(e.target.value))} className="w-full px-3 py-2 pr-8 rounded-lg border border-stone-200 text-sm focus:outline-none focus:border-green-500" placeholder="e.g. 0.5" />
                                <span className="absolute right-3 top-2.5 text-xs font-medium text-stone-400">mm</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex justify-end gap-2 pt-4 border-t border-stone-100 mt-6">
                        <button type="button" onClick={handleCancelForm} className="px-4 py-2 text-stone-500 hover:bg-stone-100 rounded-xl text-sm font-medium transition-colors">Cancel</button>
                        <button type="submit" className="px-6 py-2 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 transition-colors">{editingEntry ? 'Update Entry' : 'Save Entry'}</button>
                      </div>
                    </div>
                  </form>
                )}

                <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-stone-200 before:to-transparent">
                  {filteredEntries.map((entry, idx) => (
                    <div key={entry.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-green-100 text-green-600 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 relative z-10">
                        <Leaf className="w-4 h-4" />
                      </div>
                      <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-5 rounded-2xl border border-stone-200 shadow-sm relative">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-bold text-stone-800">{new Date(entry.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => handleEditClick(entry)}
                              className="text-stone-300 hover:text-green-600 transition-colors"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDeleteEntry(entry.id)}
                              className="text-stone-300 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <p className="text-stone-600 whitespace-pre-wrap mb-3">{entry.note}</p>
                        {entry.photoBase64 && (
                          <img src={entry.photoBase64} alt="Journal entry" className="w-full rounded-xl object-cover max-h-64 border border-stone-100 mb-3" />
                        )}
                        <div className="flex flex-wrap gap-2 mt-2">
                          {entry.sepalLength && <span className="bg-stone-100 text-stone-600 px-2 py-1 rounded text-xs font-mono">Sepal L: {entry.sepalLength}cm</span>}
                          {entry.sepalWidth && <span className="bg-stone-100 text-stone-600 px-2 py-1 rounded text-xs font-mono">Sepal W: {entry.sepalWidth}cm</span>}
                          {entry.petalLength && <span className="bg-stone-100 text-stone-600 px-2 py-1 rounded text-xs font-mono">Petal L: {entry.petalLength}cm</span>}
                          {entry.petalWidth && <span className="bg-stone-100 text-stone-600 px-2 py-1 rounded text-xs font-mono">Petal W: {entry.petalWidth}cm</span>}
                          {entry.leafLength && <span className="bg-stone-100 text-stone-600 px-2 py-1 rounded text-xs font-mono">Leaf L: {entry.leafLength}cm</span>}
                          {entry.leafWidth && <span className="bg-stone-100 text-stone-600 px-2 py-1 rounded text-xs font-mono">Leaf W: {entry.leafWidth}cm</span>}
                          {entry.leafThickness && <span className="bg-stone-100 text-stone-600 px-2 py-1 rounded text-xs font-mono">Leaf T: {entry.leafThickness}mm</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                  {entries.length === 0 && !showAddEntry && !editingEntry && (
                    <div className="text-center py-12 text-stone-500 relative z-10 bg-stone-50/80 backdrop-blur-sm rounded-2xl">
                      <p>No journal entries yet. Document your plant's journey!</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
