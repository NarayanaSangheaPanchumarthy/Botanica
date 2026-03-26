import React, { useState, useEffect, useRef } from 'react';
import { 
  Sprout, 
  Leaf, 
  Calendar, 
  CheckSquare, 
  Square, 
  Plus, 
  Trash2, 
  AlertCircle, 
  Tag, 
  Bell, 
  BellRing, 
  BellOff, 
  X, 
  Map,
  ListTodo, 
  Sparkles, 
  Activity, 
  Bug, 
  ArrowLeft, 
  ArrowRight,
  Mic, 
  MicOff, 
  Image as ImageIcon, 
  Send, 
  Scan, 
  Edit,
  ThumbsUp,
  ThumbsDown,
  ChevronLeft,
  ChevronRight,
  Droplets,
  Thermometer,
  Link,
  MapPin,
  Menu,
  Globe,
  ShieldCheck,
  ShieldAlert,
  Eye,
  Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster, toast } from 'sonner';
import Markdown from 'react-markdown';
import { GoogleGenAI } from "@google/genai";
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, setDoc } from 'firebase/firestore';
import { db, auth } from './firebase';
import LandingPage from './LandingPage';
import GardenMonitor from './GardenMonitor';

// Types
interface Task {
  id: string;
  text: string;
  completed: boolean;
  dueDate?: string;
  dueTime?: string;
  plantName?: string;
  category?: string;
  frequency?: 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly';
  notificationsEnabled?: boolean;
  reminderMinutes?: number;
  createdAt: number;
}

interface NotificationSettings {
  defaultReminderMinutes: number;
  sound: string;
  enabled: boolean;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  image?: string | null;
  isScanResult?: boolean;
  feedback?: 'correct' | 'incorrect';
  groundingMetadata?: any;
}

// Constants
const CATEGORIES = ['Watering', 'Fertilizing', 'Pruning', 'Repotting', 'Harvesting', 'General'];
const NOTIFICATION_SOUNDS = {
  none: null,
  chime: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3',
  bird: 'https://assets.mixkit.co/active_storage/sfx/2436/2436-preview.mp3',
  water: 'https://assets.mixkit.co/active_storage/sfx/1113/1113-preview.mp3'
};

const CalendarView = ({ tasks }: { tasks: Task[] }) => {
  const [viewDate, setViewDate] = useState(new Date());
  
  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();
  
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  
  const days = [];
  const numDays = daysInMonth(year, month);
  const startDay = firstDayOfMonth(year, month);
  
  for (let i = 0; i < startDay; i++) {
    days.push(null);
  }
  
  for (let i = 1; i <= numDays; i++) {
    days.push(i);
  }
  
  const monthName = viewDate.toLocaleString('default', { month: 'long' });
  
  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-2xl font-bold text-stone-800">{monthName} {year}</h3>
        <div className="flex gap-2">
          <button onClick={prevMonth} className="p-2 hover:bg-stone-100 rounded-full transition-colors"><ChevronLeft className="w-6 h-6" /></button>
          <button onClick={nextMonth} className="p-2 hover:bg-stone-100 rounded-full transition-colors"><ChevronRight className="w-6 h-6" /></button>
        </div>
      </div>
      
      <div className="grid grid-cols-7 gap-px bg-stone-200 border border-stone-200 rounded-xl overflow-hidden">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="bg-stone-50 py-2 text-center text-xs font-bold text-stone-500 uppercase tracking-wider">{day}</div>
        ))}
        {days.map((day, i) => {
          const dateStr = day ? `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : null;
          const dayTasks = tasks.filter(t => t.dueDate === dateStr);
          const isToday = day && new Date().toISOString().split('T')[0] === dateStr;

          return (
            <div key={i} className={`bg-white min-h-[100px] sm:min-h-[120px] p-2 flex flex-col gap-1 ${!day ? 'bg-stone-50/50' : ''}`}>
              {day && (
                <>
                  <span className={`text-sm font-medium ${isToday ? 'bg-green-600 text-white w-6 h-6 flex items-center justify-center rounded-full' : 'text-stone-400'}`}>{day}</span>
                  <div className="flex flex-col gap-1 mt-1 overflow-y-auto max-h-[80px]">
                    {dayTasks.map(task => (
                      <div key={task.id} className={`text-[9px] sm:text-[10px] p-1 rounded border leading-tight ${task.completed ? 'bg-stone-50 text-stone-400 border-stone-100' : 'bg-green-50 text-green-800 border-green-100 shadow-sm'}`}>
                        <div className="font-bold flex items-center gap-1 truncate">
                          {task.category === 'Watering' && <Droplets className="w-2 h-2 text-blue-500" />}
                          {task.category === 'Fertilizing' && <Sprout className="w-2 h-2 text-amber-500" />}
                          {task.text}
                        </div>
                        {task.plantName && <div className="opacity-70 truncate italic">{task.plantName}</div>}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showTasks, setShowTasks] = useState(false);
  const [showCareSchedule, setShowCareSchedule] = useState(false);
  const [showDiseaseGuide, setShowDiseaseGuide] = useState(false);
  const [showPestGuide, setShowPestGuide] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [reportDetailLevel, setReportDetailLevel] = useState<'Brief' | 'Detailed' | 'Expert'>('Detailed');
  const [useRealTimeSearch, setUseRealTimeSearch] = useState(true);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    defaultReminderMinutes: 0,
    sound: 'bird',
    enabled: true
  });
  const [taskModalTab, setTaskModalTab] = useState<'list' | 'settings'>('list');
  const [taskSortBy, setTaskSortBy] = useState<'date' | 'plant' | 'category'>('date');
  const [taskFilterStatus, setTaskFilterStatus] = useState<'all' | 'completed' | 'incomplete'>('all');
  const [taskFilterCategory, setTaskFilterCategory] = useState('all');
  const [newTaskText, setNewTaskText] = useState('');
  const [newTaskPlant, setNewTaskPlant] = useState('');
  const [newTaskCategory, setNewTaskCategory] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskDueTime, setNewTaskDueTime] = useState('');
  const [newTaskReminderMinutes, setNewTaskReminderMinutes] = useState<number>(0);
  const [newTaskFrequency, setNewTaskFrequency] = useState<'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly'>('none');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showMaps, setShowMaps] = useState(false);
  const [showMonitor, setShowMonitor] = useState(false);
  const [aiModel, setAiModel] = useState<string>('gemini-3-flash-preview');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scanFileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastNotifiedRef = useRef<Set<string>>(new Set());
  const [mapsResults, setMapsResults] = useState<any>(null);
  const [isMapsLoading, setIsMapsLoading] = useState(false);
  const [pendingScan, setPendingScan] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (showMaps && !mapsResults && !isMapsLoading) {
      fetchNearbyGardens();
    }
  }, [showMaps]);

  useEffect(() => {
    if (isChatOpen && pendingScan && scanFileInputRef.current) {
      scanFileInputRef.current.click();
      setPendingScan(false);
    }
  }, [isChatOpen, pendingScan]);

  const fetchNearbyGardens = async () => {
    setIsMapsLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      let location = null;
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        location = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      } catch (e) {
        console.warn("Geolocation failed, using default search");
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: "Find the best plant nurseries, garden centers, and community gardens nearby. Provide a helpful summary and list them with their locations.",
        config: {
          tools: [{ googleMaps: {} }],
          toolConfig: location ? {
            retrievalConfig: {
              latLng: location
            }
          } : undefined
        }
      });

      setMapsResults({
        text: response.text,
        chunks: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
      });
    } catch (error) {
      console.error("Maps Error:", error);
      toast.error("Failed to fetch local garden info");
    } finally {
      setIsMapsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      const q = query(collection(db, 'users', user.uid, 'tasks'), orderBy('createdAt', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const t = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
        setTasks(t);
      });
      return () => unsubscribe();
    }
  }, [user]);

  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
    
    const interval = setInterval(checkTasks, 60000);
    checkTasks();
    return () => clearInterval(interval);
  }, [tasks, notificationSettings]);

  const checkTasks = () => {
    if (!notificationSettings.enabled || notificationPermission !== 'granted') return;

    const now = new Date();
    tasks.forEach(task => {
      if (task.completed || task.notificationsEnabled === false) return;

      const dueDate = task.dueDate ? new Date(task.dueDate) : null;
      if (!dueDate) return;

      const [hours, minutes] = task.dueTime ? task.dueTime.split(':').map(Number) : [9, 0];
      dueDate.setHours(hours, minutes, 0, 0);

      const reminderMins = task.reminderMinutes ?? notificationSettings.defaultReminderMinutes;
      const notifyTime = new Date(dueDate.getTime() - (reminderMins * 60000));
      
      const isTime = Math.abs(now.getTime() - notifyTime.getTime()) < 60000;
      const notificationKey = `${task.id}_${task.dueDate}_${reminderMins}`;

      if (isTime && !lastNotifiedRef.current.has(notificationKey)) {
        lastNotifiedRef.current.add(notificationKey);
        
        if (notificationSettings.sound !== 'none') {
          const soundUrl = NOTIFICATION_SOUNDS[notificationSettings.sound as keyof typeof NOTIFICATION_SOUNDS];
          if (soundUrl) new Audio(soundUrl).play().catch(() => {});
        }

        new Notification("Botanica Task Reminder", {
          body: `${task.text}${task.plantName ? ` for ${task.plantName}` : ''} is due ${reminderMins === 0 ? 'now' : `in ${reminderMins} minutes`}.`,
          icon: '/favicon.ico'
        });

        toast.info(`Task Reminder: ${task.text}`, {
          description: task.plantName ? `For ${task.plantName}` : undefined
        });
      }
    });
  };

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === 'granted') {
        toast.success("Notifications enabled!");
      }
    }
  };

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;

    const taskData: Omit<Task, 'id'> = {
      text: newTaskText.trim(),
      completed: false,
      createdAt: Date.now(),
      dueDate: newTaskDueDate || undefined,
      dueTime: newTaskDueTime || undefined,
      plantName: newTaskPlant.trim() || undefined,
      category: newTaskCategory.trim() || undefined,
      notificationsEnabled: true,
      reminderMinutes: newTaskReminderMinutes,
      frequency: newTaskFrequency
    };

    if (user) {
      await addDoc(collection(db, 'users', user.uid, 'tasks'), taskData);
    } else {
      const id = Math.random().toString(36).substr(2, 9);
      setTasks(prev => [{ id, ...taskData } as Task, ...prev]);
    }

    setNewTaskText('');
    setNewTaskPlant('');
    setNewTaskCategory('');
    setNewTaskDueDate('');
    setNewTaskDueTime('');
    setNewTaskReminderMinutes(notificationSettings.defaultReminderMinutes);
    setNewTaskFrequency('none');
  };

  const toggleTask = async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    const updatedTask = { ...task, completed: !task.completed };
    if (user) {
      await setDoc(doc(db, 'users', user.uid, 'tasks', id), updatedTask);
    } else {
      setTasks(prev => prev.map(t => t.id === id ? updatedTask : t));
    }
  };

  const deleteTask = async (id: string) => {
    if (user) {
      await deleteDoc(doc(db, 'users', user.uid, 'tasks', id));
    } else {
      setTasks(prev => prev.filter(t => t.id !== id));
    }
  };

  const updateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask || !editingTask.text.trim()) return;

    if (user) {
      await setDoc(doc(db, 'users', user.uid, 'tasks', editingTask.id), editingTask);
    } else {
      setTasks(prev => prev.map(t => t.id === editingTask.id ? editingTask : t));
    }
    setEditingTask(null);
    toast.success("Task updated!");
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error("Please upload an image file.");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setSelectedImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleScanImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        setIsChatOpen(true);
        setIsLoading(true);
        setMessages(prev => [...prev, { role: 'user', content: 'Please analyze this plant scan.', image: base64 } as Message]);

        try {
          const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
          const response = await ai.models.generateContent({
            model: aiModel,
            contents: [
              {
                parts: [
                  { text: `Identify this plant and provide a health report at a ${reportDetailLevel} level. Include common name, scientific name, and care tips.` },
                  { inlineData: { mimeType: file.type, data: base64.split(',')[1] } }
                ]
              }
            ],
            config: {
              systemInstruction: "You are Botanica, an elite, world-class AI Master Horticulturist and Botanist. Provide highly accurate, scientifically backed, and advanced gardening diagnostics. Always prioritize organic, sustainable, and evidence-based methods. When using real-time search, synthesize the latest data into a comprehensive, expert-level response.",
              temperature: 0.3,
              tools: useRealTimeSearch ? [{ googleSearch: {} }] : []
            }
          });

          setMessages(prev => [...prev, { 
            role: 'assistant', 
            content: response.text, 
            isScanResult: true,
            image: base64,
            groundingMetadata: response.candidates?.[0]?.groundingMetadata
          }]);
        } catch (error) {
          console.error("Gemini Analysis Error:", error);
          let errorMessage = "Failed to analyze plant. Please try again or upload a clearer image.";
          
          if (error instanceof Error) {
            if (error.message.includes('safety')) {
              errorMessage = "The image could not be analyzed due to safety filters. Please ensure it's a clear photo of a plant.";
            } else if (error.message.includes('quota') || error.message.includes('429')) {
              errorMessage = "The AI service is temporarily busy. Please try again in a moment.";
            } else if (error.message.includes('network') || error.message.includes('fetch')) {
              errorMessage = "Network error. Please check your connection and try again.";
            }
          }
          
          toast.error(errorMessage, { duration: 5000 });
          setMessages(prev => [...prev, { 
            role: 'assistant', 
            content: `I'm sorry, I couldn't analyze that image. ${errorMessage}` 
          } as Message]);
        } finally {
          setIsLoading(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFeedback = (index: number, feedback: 'correct' | 'incorrect') => {
    setMessages(prev => prev.map((msg, i) => i === index ? { ...msg, feedback } : msg));
    if (feedback === 'correct') {
      toast.success("Thank you for your feedback!");
    } else {
      toast.info("Sorry about that! I'll try to do better next time.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && !selectedImage) return;

    const userMessage: Message = { role: 'user', content: input, image: selectedImage };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setSelectedImage(null);
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      
      const parts: any[] = [{ text: `User is asking about gardening at a ${reportDetailLevel} level. Question: ${input}` }];
      
      if (selectedImage) {
        // Extract mime type from base64 string
        const mimeType = selectedImage.match(/data:(.*?);base64/)?.[1] || "image/jpeg";
        parts.push({
          inlineData: {
            mimeType: mimeType,
            data: selectedImage.split(',')[1]
          }
        });
      }

      const response = await ai.models.generateContent({
        model: aiModel,
        contents: [
          { role: 'user', parts }
        ],
        config: {
          systemInstruction: "You are Botanica, an elite, world-class AI Master Horticulturist and Botanist. Provide highly accurate, scientifically backed, and advanced gardening advice. Always prioritize organic, sustainable, and evidence-based methods. When using real-time search, synthesize the latest data into a comprehensive, expert-level response.",
          temperature: 0.3,
          tools: useRealTimeSearch ? [{ googleSearch: {} }] : []
        }
      });

      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: response.text,
        groundingMetadata: response.candidates?.[0]?.groundingMetadata
      }]);
      setIsLoading(false);
    } catch (error) {
      toast.error("Failed to get AI response");
      setIsLoading(false);
    }
  };

  const getGroupedTasks = () => {
    const filtered = tasks.filter(t => {
      const statusMatch = taskFilterStatus === 'all' ? true : taskFilterStatus === 'completed' ? t.completed : !t.completed;
      const categoryMatch = taskFilterCategory === 'all' ? true : t.category === taskFilterCategory;
      return statusMatch && categoryMatch;
    });

    const sorted = [...filtered].sort((a, b) => {
      if (taskSortBy === 'date') return (a.dueDate || '9999').localeCompare(b.dueDate || '9999');
      if (taskSortBy === 'plant') return (a.plantName || '').localeCompare(b.plantName || '');
      return (a.category || '').localeCompare(b.category || '');
    });

    const groups: { [key: string]: Task[] } = {
      'Overdue': [],
      'Today': [],
      'Upcoming': [],
      'No Date': []
    };

    const today = new Date().toISOString().split('T')[0];

    sorted.forEach(t => {
      if (t.completed) {
        if (!groups['Completed']) groups['Completed'] = [];
        groups['Completed'].push(t);
        return;
      }
      if (!t.dueDate) {
        groups['No Date'].push(t);
        return;
      }
      if (t.dueDate < today) groups['Overdue'].push(t);
      else if (t.dueDate === today) groups['Today'].push(t);
      else groups['Upcoming'].push(t);
    });

    return groups;
  };

  return (
    <>
      {!isChatOpen ? (
        <LandingPage 
          onStartChat={() => setIsChatOpen(true)} 
          onOpenTasks={() => setShowTasks(true)}
          onOpenCareSchedule={() => setShowCareSchedule(true)}
          onOpenDiseaseGuide={() => setShowDiseaseGuide(true)}
          onOpenPestGuide={() => setShowPestGuide(true)}
          onOpenScanReport={() => { setIsChatOpen(true); setPendingScan(true); }}
          onOpenMaps={() => setShowMaps(true)}
          onOpenMonitor={() => setShowMonitor(true)}
          aiModel={aiModel}
          onAiModelChange={setAiModel}
          detailLevel={reportDetailLevel}
          onDetailLevelChange={setReportDetailLevel}
        />
      ) : (
        <div className="flex flex-col h-screen bg-stone-50 text-stone-900 font-sans">
          <header className="bg-green-800 text-white p-4 shadow-md flex justify-between items-center z-10">
            <div className="flex items-center gap-3">
              <button onClick={() => setIsChatOpen(false)} className="p-2 hover:bg-green-700 rounded-full transition-colors mr-1">
                <ArrowLeft className="w-5 h-5 text-green-100" />
              </button>
              <div className="bg-green-700 p-2 rounded-full hidden sm:block">
                <Sprout className="w-6 h-6 text-green-100" />
              </div>
              <div>
                <h1 className="text-xl font-semibold tracking-tight">Botanica</h1>
                <p className="text-green-200 text-xs font-medium hidden sm:block">Your AI Gardening Assistant</p>
              </div>
            </div>
            <div className="flex gap-2 items-center">
              <div className="hidden lg:flex items-center gap-2 bg-green-900/30 px-3 py-1.5 rounded-full border border-green-700/50">
                <span className="text-[10px] font-bold text-green-200 uppercase tracking-wider">Model:</span>
                <select 
                  value={aiModel} 
                  onChange={(e) => setAiModel(e.target.value)}
                  className="bg-transparent text-xs font-bold text-white outline-none border-none cursor-pointer"
                >
                  <option value="gemini-3-flash-preview" className="text-stone-800">Flash (Fast)</option>
                  <option value="gemini-3.1-pro-preview" className="text-stone-800">Pro (Accurate)</option>
                  <option value="gemini-3.1-flash-lite-preview" className="text-stone-800">Lite (Efficient)</option>
                </select>
              </div>
              <input type="file" accept="image/*" className="hidden" ref={scanFileInputRef} onChange={handleScanImageSelect} />
              <button onClick={() => scanFileInputRef.current?.click()} className="flex items-center gap-2 text-sm font-medium text-green-800 bg-green-100 hover:bg-white px-3 py-2 rounded-full transition-colors shadow-sm">
                <ShieldCheck className="w-4 h-4 text-green-600" />
                <span className="hidden sm:inline">Organic Health Diagnostics</span>
              </button>
              <button onClick={() => setShowTasks(true)} className="flex items-center gap-2 text-sm font-medium text-green-800 bg-green-100 hover:bg-white px-3 py-2 rounded-full transition-colors shadow-sm">
                <ListTodo className="w-4 h-4 text-green-600" />
                <span className="hidden sm:inline">Tasks</span>
              </button>
              <button onClick={() => setShowCareSchedule(true)} className="flex items-center gap-2 text-sm font-medium text-green-800 bg-green-100 hover:bg-white px-3 py-2 rounded-full transition-colors shadow-sm">
                <Calendar className="w-4 h-4 text-green-600" />
                <span className="hidden sm:inline">Care Schedule</span>
              </button>
              <button onClick={() => setShowMenu(true)} className="p-2 text-green-100 hover:bg-green-700 rounded-full transition-colors">
                <Menu className="w-6 h-6" />
              </button>
            </div>
          </header>

          <main 
            className="flex-1 overflow-hidden flex flex-col relative"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <AnimatePresence>
              {isDragging && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-50 bg-green-600/20 backdrop-blur-[2px] border-4 border-dashed border-green-500 flex flex-col items-center justify-center pointer-events-none"
                >
                  <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4">
                    <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center text-green-600">
                      <ImageIcon className="w-8 h-8" />
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-bold text-stone-800">Drop to upload image</p>
                      <p className="text-sm text-stone-500">Release to add this photo to your message</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-stone-400 space-y-4">
                  <Sparkles className="w-12 h-12 text-stone-200" />
                  <p className="text-sm">Ask me anything about your plants!</p>
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-4 rounded-3xl ${msg.role === 'user' ? 'bg-green-600 text-white rounded-tr-none' : 'bg-white text-stone-800 rounded-tl-none shadow-sm border border-stone-100'}`}>
                    {msg.image && <img src={msg.image} alt="User upload" className="w-full h-48 object-cover rounded-xl mb-2" />}
                    <div className="markdown-body text-sm leading-relaxed">
                      <Markdown>{msg.content}</Markdown>
                    </div>
                    {msg.groundingMetadata?.groundingChunks && (
                      <div className="mt-4 pt-4 border-t border-stone-100/50">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="bg-blue-500/10 p-1 rounded-md">
                            <Search className="w-3 h-3 text-blue-600" />
                          </div>
                          <p className="text-[10px] font-bold text-stone-500 uppercase tracking-widest flex items-center gap-1">
                            Real-Time Verified Sources
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {msg.groundingMetadata.groundingChunks.map((chunk: any, idx: number) => (
                            chunk.web && (
                              <a 
                                key={idx} 
                                href={chunk.web.uri} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-[10px] bg-white hover:bg-blue-50 text-stone-600 hover:text-blue-700 px-2.5 py-1.5 rounded-lg border border-stone-200 hover:border-blue-200 transition-all shadow-sm flex items-center gap-1.5 max-w-[250px] group"
                              >
                                <Link className="w-3 h-3 opacity-50 group-hover:opacity-100" />
                                <span className="truncate font-medium">{chunk.web.title || 'Source'}</span>
                              </a>
                            )
                          ))}
                        </div>
                      </div>
                    )}
                    {msg.isScanResult && !msg.feedback && (
                      <div className="mt-4 pt-4 border-t border-stone-100 flex items-center gap-4">
                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Was this accurate?</span>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => handleFeedback(i, 'correct')}
                            className="p-1.5 hover:bg-green-50 rounded-lg text-stone-400 hover:text-green-600 transition-colors"
                            title="Correct"
                          >
                            <ThumbsUp className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleFeedback(i, 'incorrect')}
                            className="p-1.5 hover:bg-red-50 rounded-lg text-stone-400 hover:text-red-600 transition-colors"
                            title="Incorrect"
                          >
                            <ThumbsDown className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                    {msg.feedback && (
                      <div className="mt-2 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1">
                        {msg.feedback === 'correct' ? (
                          <span className="text-green-600 flex items-center gap-1"><ThumbsUp className="w-3 h-3" /> Feedback: Accurate</span>
                        ) : (
                          <span className="text-red-600 flex items-center gap-1"><ThumbsDown className="w-3 h-3" /> Feedback: Inaccurate</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white p-4 rounded-3xl rounded-tl-none shadow-sm border border-stone-100 flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-600 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-green-600 rounded-full animate-bounce [animation-delay:0.2s]" />
                    <div className="w-2 h-2 bg-green-600 rounded-full animate-bounce [animation-delay:0.4s]" />
                  </div>
                </div>
              )}
            </div>

            <footer className="bg-white border-t border-stone-200 p-4">
              <div className="max-w-3xl mx-auto">
                {selectedImage && (
                  <div className="mb-3 relative inline-block">
                    <img src={selectedImage} alt="Selected" className="h-20 w-20 object-cover rounded-lg border-2 border-green-500" />
                    <button onClick={() => setSelectedImage(null)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md"><X className="w-3 h-3" /></button>
                  </div>
                )}
                <form onSubmit={handleSubmit} className="flex gap-2 items-end">
                  <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageSelect} />
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="p-3 text-stone-500 hover:text-green-600 hover:bg-green-50 rounded-xl transition-colors shrink-0">
                    <ImageIcon className="w-6 h-6" />
                  </button>
                  <div className="flex-1 relative">
                    <textarea
                      ref={textareaRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e); } }}
                      placeholder="Ask a gardening question..."
                      className="w-full bg-stone-100 border-transparent focus:bg-white focus:border-green-500 focus:ring-2 focus:ring-green-200 rounded-xl px-4 py-3 pr-12 resize-none min-h-[52px] outline-none transition-all"
                      rows={1}
                    />
                    <button type="submit" disabled={isLoading || (!input.trim() && !selectedImage)} className="absolute right-2 bottom-2 p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors">
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              </div>
            </footer>
          </main>
        </div>
      )}

      <AnimatePresence>
        {showCareSchedule && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-5xl h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="p-4 border-b border-stone-200 flex justify-between items-center bg-green-50">
                <div className="flex items-center gap-4">
                  <div className="bg-green-100 p-2 rounded-xl">
                    <Calendar className="w-6 h-6 text-green-700" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-stone-800">Care Schedule</h2>
                    <p className="text-xs text-stone-500">View and manage your upcoming plant care tasks</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowCareSchedule(false)} 
                  className="p-2 hover:bg-stone-100 rounded-full text-stone-400 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              {/* Calendar Content */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-stone-50/30">
                <CalendarView tasks={tasks} />
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-stone-100 bg-white flex justify-between items-center">
                <div className="flex gap-4 text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    <span className="text-stone-600">Watering</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-amber-500" />
                    <span className="text-stone-600">Fertilizing</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-green-600" />
                    <span className="text-stone-600">Other</span>
                  </div>
                </div>
                <button 
                  onClick={() => setShowCareSchedule(false)}
                  className="px-6 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold rounded-xl transition-all"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showMenu && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-stone-100 flex justify-between items-center bg-green-50">
                <h2 className="text-xl font-bold text-green-800 flex items-center gap-2">
                  <Menu className="w-6 h-6" />
                  Menu & Settings
                </h2>
                <button onClick={() => setShowMenu(false)} className="p-2 hover:bg-green-100 rounded-full text-green-800 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 space-y-8 overflow-y-auto max-h-[70vh]">
                {/* Real-time Toggle */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest">AI Settings</h3>
                  <div className="flex items-center justify-between p-4 bg-stone-50 rounded-2xl border border-stone-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                        <Globe className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-stone-800">Real-time Information</p>
                        <p className="text-[10px] text-stone-500">Enable Google Search grounding</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setUseRealTimeSearch(!useRealTimeSearch)}
                      className={`w-12 h-6 rounded-full relative transition-colors ${useRealTimeSearch ? 'bg-green-500' : 'bg-stone-300'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${useRealTimeSearch ? 'left-7' : 'left-1'}`} />
                    </button>
                  </div>
                </div>

                {/* Diagnostics History */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest">Organic Health Diagnostics History</h3>
                    <button 
                      onClick={() => {
                        setShowMenu(false);
                        scanFileInputRef.current?.click();
                      }}
                      className="text-[10px] font-bold text-green-600 hover:text-green-700 flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> New Scan
                    </button>
                  </div>
                  <div className="space-y-3">
                    {messages.filter(m => m.isScanResult).length === 0 ? (
                      <div className="text-center py-8 bg-stone-50 rounded-2xl border border-dashed border-stone-200">
                        <ShieldCheck className="w-10 h-10 mx-auto mb-2 text-stone-300" />
                        <p className="text-xs text-stone-500">No diagnostic reports yet.</p>
                      </div>
                    ) : (
                      messages.filter(m => m.isScanResult).map((scan, idx) => (
                        <button 
                          key={idx}
                          onClick={() => {
                            setShowMenu(false);
                          }}
                          className="w-full flex items-center gap-3 p-3 bg-white border border-stone-100 rounded-2xl hover:border-green-200 hover:bg-green-50 transition-all text-left group"
                        >
                          <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-stone-100">
                            <img src={scan.image} alt="Scan" className="w-full h-full object-cover" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-stone-800 truncate">Diagnostic Report #{messages.filter(m => m.isScanResult).length - idx}</p>
                            <p className="text-[10px] text-stone-500 truncate">{scan.content.substring(0, 60)}...</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-stone-300 group-hover:text-green-500 transition-colors" />
                        </button>
                      ))
                    )}
                  </div>
                </div>

                {/* Other Links */}
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => { setShowMenu(false); setShowMonitor(true); }} className="p-4 bg-stone-50 rounded-2xl border border-stone-100 hover:bg-white hover:border-green-200 transition-all text-left col-span-2">
                    <Eye className="w-5 h-5 text-blue-500 mb-2" />
                    <p className="text-xs font-bold text-stone-800">AI Garden Monitor</p>
                    <p className="text-[10px] text-stone-500">Live surveillance & object counting</p>
                  </button>
                  <button onClick={() => { setShowMenu(false); setShowDiseaseGuide(true); }} className="p-4 bg-stone-50 rounded-2xl border border-stone-100 hover:bg-white hover:border-green-200 transition-all text-left">
                    <ShieldAlert className="w-5 h-5 text-red-500 mb-2" />
                    <p className="text-xs font-bold text-stone-800">Disease Guide</p>
                  </button>
                  <button onClick={() => { setShowMenu(false); setShowPestGuide(true); }} className="p-4 bg-stone-50 rounded-2xl border border-stone-100 hover:bg-white hover:border-green-200 transition-all text-left">
                    <Bug className="w-5 h-5 text-orange-500 mb-2" />
                    <p className="text-xs font-bold text-stone-800">Pest Guide</p>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showTasks && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-2xl h-[80vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-4 border-b border-stone-200 flex justify-between items-center bg-green-50">
                <div className="flex items-center gap-4">
                  <h2 className="text-lg font-semibold text-green-800 flex items-center gap-2">
                    <ListTodo className="w-5 h-5" />
                    Tasks
                  </h2>
                  <div className="flex bg-white rounded-lg p-0.5 border border-green-200">
                    <button onClick={() => setTaskModalTab('list')} className={`px-3 py-1 text-[10px] uppercase font-bold tracking-wider rounded-md transition-colors ${taskModalTab === 'list' ? 'bg-green-100 text-green-800' : 'text-stone-500 hover:text-stone-700'}`}>List</button>
                    <button onClick={() => setTaskModalTab('settings')} className={`px-3 py-1 text-[10px] uppercase font-bold tracking-wider rounded-md transition-colors ${taskModalTab === 'settings' ? 'bg-green-100 text-green-800' : 'text-stone-500 hover:text-stone-700'}`}>Settings</button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={requestNotificationPermission} className="p-1.5 hover:bg-green-200/50 rounded-full transition-colors">
                    {notificationPermission === 'granted' ? <BellRing className="w-5 h-5 text-green-600" /> : <Bell className="w-5 h-5 text-stone-500" />}
                  </button>
                  <button onClick={() => { setShowTasks(false); setEditingTask(null); }} className="p-1.5 hover:bg-green-200/50 rounded-full text-green-800 transition-colors"><X className="w-5 h-5" /></button>
                </div>
              </div>

              <div className="p-4 overflow-y-auto flex-1">
                {taskModalTab === 'settings' ? (
                  <div className="space-y-6">
                    <div className="bg-stone-50 p-4 rounded-xl border border-stone-200">
                      <h3 className="text-sm font-bold text-stone-800 flex items-center gap-2 mb-4"><BellRing className="w-4 h-4 text-green-600" />Global Notification Settings</h3>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-stone-700">Enable Notifications</span>
                          <button onClick={() => setNotificationSettings(prev => ({ ...prev, enabled: !prev.enabled }))} className={`w-10 h-5 rounded-full transition-colors relative ${notificationSettings.enabled ? 'bg-green-600' : 'bg-stone-300'}`}>
                            <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${notificationSettings.enabled ? 'left-6' : 'left-1'}`} />
                          </button>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-stone-500 uppercase">Default Reminder Time</label>
                          <select value={notificationSettings.defaultReminderMinutes} onChange={(e) => setNotificationSettings(prev => ({ ...prev, defaultReminderMinutes: Number(e.target.value) }))} className="w-full bg-white border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-green-500">
                            <option value={0}>At time of event</option>
                            <option value={15}>15 minutes before</option>
                            <option value={30}>30 minutes before</option>
                            <option value={60}>1 hour before</option>
                            <option value={1440}>1 day before</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-stone-500 uppercase">Notification Sound</label>
                          <select value={notificationSettings.sound} onChange={(e) => setNotificationSettings(prev => ({ ...prev, sound: e.target.value }))} className="w-full bg-white border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-green-500">
                            <option value="none">None (Silent)</option>
                            <option value="chime">Garden Chime</option>
                            <option value="bird">Morning Bird</option>
                            <option value="water">Soft Water</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-4 overflow-x-auto no-scrollbar pb-1">
                      <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mr-2">Sort:</span>
                      {['date', 'plant', 'category'].map(sort => (
                        <button key={sort} onClick={() => setTaskSortBy(sort as any)} className={`px-3 py-1 text-xs font-medium rounded-full transition-colors whitespace-nowrap ${taskSortBy === sort ? 'bg-green-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>{sort.charAt(0).toUpperCase() + sort.slice(1)}</button>
                      ))}
                    </div>
                    <div className="mb-6 space-y-3">
                      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                        {['all', 'incomplete', 'completed'].map(status => (
                          <button key={status} onClick={() => setTaskFilterStatus(status as any)} className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${taskFilterStatus === status ? 'bg-green-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>{status.charAt(0).toUpperCase() + status.slice(1)}</button>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mr-2">Category:</span>
                        <button 
                          onClick={() => setTaskFilterCategory('all')} 
                          className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${taskFilterCategory === 'all' ? 'bg-green-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
                        >
                          All
                        </button>
                        {CATEGORIES.map(cat => (
                          <button 
                            key={cat} 
                            onClick={() => setTaskFilterCategory(cat)} 
                            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${taskFilterCategory === cat ? 'bg-green-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>

                    {tasks.length === 0 ? (
                      <div className="text-center py-8 text-stone-500">
                        <ListTodo className="w-12 h-12 mx-auto mb-3 text-stone-300" />
                        <p>No tasks yet. Add one below!</p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {Object.entries(getGroupedTasks()).map(([groupName, groupTasks]) => (
                          <div key={groupName}>
                            <h3 className={`text-xs font-bold uppercase tracking-wider mb-3 ${groupName === 'Overdue' ? 'text-red-600 flex items-center gap-1' : 'text-stone-500'}`}>
                              {groupName === 'Overdue' && <AlertCircle className="w-4 h-4" />}
                              {groupName}
                            </h3>
                            <ul className="space-y-2">
                              {groupTasks.map(task => (
                                <li key={task.id} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${task.completed ? 'bg-stone-50 border-stone-100 opacity-75' : 'bg-white border-stone-200 shadow-sm'}`}>
                                  <button onClick={() => toggleTask(task.id)} className="flex items-center gap-3 flex-1 text-left">
                                    {task.completed ? <CheckSquare className="w-5 h-5 text-green-600 shrink-0" /> : <Square className="w-5 h-5 text-stone-400 shrink-0" />}
                                    <div className="flex flex-col">
                                      <span className={`text-sm font-medium ${task.completed ? 'line-through text-stone-400' : 'text-stone-800'}`}>{task.text}</span>
                                      <div className="flex flex-wrap gap-2 mt-1">
                                        {task.plantName && <span className="text-[10px] flex items-center gap-1 text-stone-500"><Leaf className="w-3 h-3" />{task.plantName}</span>}
                                        {task.category && <span className="text-[10px] flex items-center gap-1 text-blue-600"><Tag className="w-3 h-3" />{task.category}</span>}
                                        {task.dueDate && <span className="text-[10px] flex items-center gap-1 text-stone-500"><Calendar className="w-3 h-3" />{task.dueDate} {task.dueTime}</span>}
                                      </div>
                                    </div>
                                  </button>
                                  <div className="flex items-center gap-1">
                                    <button onClick={() => setEditingTask(task)} className="p-1.5 text-stone-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Edit task">
                                      <Edit className="w-4 h-4" />
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); toggleTask(task.id); }} className={`p-1.5 rounded-lg transition-colors ${task.notificationsEnabled !== false ? 'text-green-600 hover:bg-green-50' : 'text-stone-300 hover:bg-stone-100'}`}>
                                      {task.notificationsEnabled !== false ? <BellRing className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                                    </button>
                                    <button onClick={() => deleteTask(task.id)} className="p-1.5 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {taskModalTab === 'list' && (
                <div className="p-4 border-t border-stone-200 bg-stone-50">
                  {editingTask ? (
                  <form onSubmit={updateTask} className="space-y-3">
                    <div className="flex justify-between items-center mb-1">
                      <h3 className="text-xs font-bold text-green-800 uppercase tracking-wider">Editing Task</h3>
                      <button type="button" onClick={() => setEditingTask(null)} className="text-stone-400 hover:text-stone-600"><X className="w-4 h-4" /></button>
                    </div>
                    <div className="flex gap-2">
                      <input type="text" value={editingTask.text} onChange={(e) => setEditingTask({...editingTask, text: e.target.value})} placeholder="Task text..." className="flex-[2] px-4 py-2 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-green-500/50 text-sm" />
                      <input type="text" value={editingTask.plantName || ''} onChange={(e) => setEditingTask({...editingTask, plantName: e.target.value})} placeholder="Plant" className="flex-1 px-4 py-2 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-green-500/50 text-sm" />
                    </div>
                    <div className="flex gap-2">
                      <input type="date" value={editingTask.dueDate || ''} onChange={(e) => setEditingTask({...editingTask, dueDate: e.target.value})} className="flex-1 px-3 py-2 rounded-xl border border-stone-200 text-sm text-stone-600" />
                      <input type="time" value={editingTask.dueTime || ''} onChange={(e) => setEditingTask({...editingTask, dueTime: e.target.value})} className="flex-1 px-3 py-2 rounded-xl border border-stone-200 text-sm text-stone-600" />
                      <select value={editingTask.category || ''} onChange={(e) => setEditingTask({...editingTask, category: e.target.value})} className="flex-1 px-3 py-2 rounded-xl border border-stone-200 text-sm text-stone-600 bg-white">
                        <option value="">Category</option>
                        {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <select value={editingTask.reminderMinutes || 0} onChange={(e) => setEditingTask({...editingTask, reminderMinutes: Number(e.target.value)})} className="flex-1 px-3 py-2 rounded-xl border border-stone-200 text-sm text-stone-600 bg-white">
                        <option value={0}>At time</option>
                        <option value={15}>15m before</option>
                        <option value={30}>30m before</option>
                        <option value={60}>1h before</option>
                      </select>
                      <button type="button" onClick={() => setEditingTask({...editingTask, notificationsEnabled: !editingTask.notificationsEnabled})} className={`flex-1 px-3 py-2 rounded-xl border text-sm transition-colors flex items-center justify-center gap-2 ${editingTask.notificationsEnabled !== false ? 'bg-green-50 border-green-200 text-green-700' : 'bg-stone-50 border-stone-200 text-stone-500'}`}>
                        {editingTask.notificationsEnabled !== false ? <BellRing className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                        {editingTask.notificationsEnabled !== false ? 'Alerts On' : 'Alerts Off'}
                      </button>
                      <button type="submit" className="bg-green-600 text-white px-8 py-2 rounded-xl hover:bg-green-700 transition-colors flex items-center justify-center font-bold">
                        Save Changes
                      </button>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={addTask} className="space-y-3">
                  <div className="flex gap-2">
                    <input type="text" value={newTaskText} onChange={(e) => setNewTaskText(e.target.value)} placeholder="Add a new task..." className="flex-[2] px-4 py-2 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-green-500/50 text-sm" />
                    <input type="text" value={newTaskPlant} onChange={(e) => setNewTaskPlant(e.target.value)} placeholder="Plant" className="flex-1 px-4 py-2 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-green-500/50 text-sm" />
                  </div>
                  <div className="flex gap-2">
                    <input type="date" value={newTaskDueDate} onChange={(e) => setNewTaskDueDate(e.target.value)} className="flex-1 px-3 py-2 rounded-xl border border-stone-200 text-sm text-stone-600" />
                    <input type="time" value={newTaskDueTime} onChange={(e) => setNewTaskDueTime(e.target.value)} className="flex-1 px-3 py-2 rounded-xl border border-stone-200 text-sm text-stone-600" />
                    <select value={newTaskCategory} onChange={(e) => setNewTaskCategory(e.target.value)} className="flex-1 px-3 py-2 rounded-xl border border-stone-200 text-sm text-stone-600 bg-white">
                      <option value="">Category</option>
                      {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <select value={newTaskReminderMinutes} onChange={(e) => setNewTaskReminderMinutes(Number(e.target.value))} className="flex-1 px-3 py-2 rounded-xl border border-stone-200 text-sm text-stone-600 bg-white">
                      <option value={0}>At time</option>
                      <option value={15}>15m before</option>
                      <option value={30}>30m before</option>
                      <option value={60}>1h before</option>
                    </select>
                    <button type="submit" disabled={!newTaskText.trim()} className="bg-green-600 text-white px-8 py-2 rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center font-bold">
                      <Plus className="w-5 h-5 mr-2" /> Add Task
                    </button>
                  </div>
                  </form>
                )}
              </div>
            )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Maps Modal */}
      <AnimatePresence>
        {showMaps && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              <div className="p-6 bg-green-800 text-white flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-700 rounded-xl">
                    <Map className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Local Garden Guide</h2>
                    <p className="text-green-200 text-xs">Nearby nurseries & community spaces</p>
                  </div>
                </div>
                <button onClick={() => setShowMaps(false)} className="p-2 hover:bg-green-700 rounded-full transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {isMapsLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 space-y-4">
                    <div className="w-12 h-12 border-4 border-green-100 border-t-green-600 rounded-full animate-spin" />
                    <p className="text-stone-500 font-medium animate-pulse">Scanning your local area...</p>
                  </div>
                ) : mapsResults ? (
                  <>
                    <div className="markdown-body text-stone-700 leading-relaxed">
                      <Markdown>{mapsResults.text}</Markdown>
                    </div>
                    
                    {mapsResults.chunks.length > 0 && (
                      <div className="space-y-3">
                        <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest flex items-center gap-2">
                          <MapPin className="w-3 h-3" /> Verified Locations
                        </h3>
                        <div className="grid gap-3">
                          {mapsResults.chunks.map((chunk: any, idx: number) => (
                            chunk.maps && (
                              <a 
                                key={idx} 
                                href={chunk.maps.uri} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex items-center justify-between p-4 bg-stone-50 hover:bg-green-50 rounded-2xl border border-stone-100 transition-all group"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-green-700 shadow-sm group-hover:scale-110 transition-transform">
                                    <MapPin className="w-5 h-5" />
                                  </div>
                                  <div>
                                    <span className="font-bold text-stone-900 block">{chunk.maps.title || 'View on Maps'}</span>
                                    <span className="text-[10px] text-stone-400 uppercase tracking-wider">Open in Google Maps</span>
                                  </div>
                                </div>
                                <ArrowRight className="w-5 h-5 text-stone-300 group-hover:text-green-600 transition-colors" />
                              </a>
                            )
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-stone-500">No results found. Try again later.</p>
                  </div>
                )}
              </div>
              
              <div className="p-6 bg-stone-50 border-t border-stone-100 shrink-0">
                <button 
                  onClick={fetchNearbyGardens}
                  className="w-full py-4 bg-green-700 hover:bg-green-800 text-white rounded-2xl font-bold shadow-lg shadow-green-900/10 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-5 h-5" /> Refresh Recommendations
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDiseaseGuide && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-2xl h-[80vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-stone-100 flex justify-between items-center bg-red-50">
                <h2 className="text-xl font-bold text-red-800 flex items-center gap-2">
                  <ShieldAlert className="w-6 h-6" />
                  Organic Disease Guide
                </h2>
                <button onClick={() => setShowDiseaseGuide(false)} className="p-2 hover:bg-red-100 rounded-full text-red-800 transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="bg-red-50/50 p-4 rounded-2xl border border-red-100">
                  <p className="text-sm text-red-700 leading-relaxed">
                    Botanica prioritizes organic and safe treatments. If you suspect a disease, use the <strong>Organic Health Diagnostics</strong> tool for a specific analysis.
                  </p>
                </div>
                <div className="space-y-4">
                  {[
                    { name: 'Powdery Mildew', symptoms: 'White flour-like spots on leaves.', treatment: 'Neem oil or a mixture of milk and water (1:9 ratio).' },
                    { name: 'Root Rot', symptoms: 'Yellowing leaves, stunted growth, mushy stems.', treatment: 'Improve drainage, reduce watering, and repot in fresh soil.' },
                    { name: 'Leaf Spot', symptoms: 'Brown or black spots with yellow halos.', treatment: 'Remove affected leaves, improve air circulation, avoid overhead watering.' },
                    { name: 'Rust', symptoms: 'Orange or rusty-colored pustules on leaf undersides.', treatment: 'Remove infected parts, apply organic sulfur or copper fungicide.' }
                  ].map((disease, idx) => (
                    <div key={idx} className="p-4 bg-white border border-stone-100 rounded-2xl shadow-sm">
                      <h3 className="font-bold text-stone-900 mb-1">{disease.name}</h3>
                      <p className="text-xs text-stone-500 mb-2"><strong>Symptoms:</strong> {disease.symptoms}</p>
                      <div className="flex items-start gap-2 bg-green-50 p-2 rounded-lg">
                        <Leaf className="w-3 h-3 text-green-600 mt-0.5" />
                        <p className="text-xs text-green-800"><strong>Organic Treatment:</strong> {disease.treatment}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-6 border-t border-stone-100 bg-stone-50">
                <button 
                  onClick={() => setShowDiseaseGuide(false)}
                  className="w-full py-3 bg-white border border-stone-200 hover:bg-stone-100 text-stone-700 font-bold rounded-xl transition-all"
                >
                  Close Guide
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPestGuide && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-2xl h-[80vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-stone-100 flex justify-between items-center bg-orange-50">
                <h2 className="text-xl font-bold text-orange-800 flex items-center gap-2">
                  <Bug className="w-6 h-6" />
                  Organic Pest Guide
                </h2>
                <button onClick={() => setShowPestGuide(false)} className="p-2 hover:bg-orange-100 rounded-full text-orange-800 transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="bg-orange-50/50 p-4 rounded-2xl border border-orange-100">
                  <p className="text-sm text-orange-700 leading-relaxed">
                    Common garden pests can often be managed without harsh chemicals. Use the <strong>Organic Health Diagnostics</strong> tool for precise identification.
                  </p>
                </div>
                <div className="space-y-4">
                  {[
                    { name: 'Aphids', symptoms: 'Small green/black insects, sticky residue, curled leaves.', treatment: 'Strong water spray, insecticidal soap, or introducing ladybugs.' },
                    { name: 'Spider Mites', symptoms: 'Fine webbing on leaves, tiny yellow speckles.', treatment: 'Increase humidity, spray with water/neem oil mixture.' },
                    { name: 'Mealybugs', symptoms: 'White cottony clusters in leaf axils.', treatment: 'Dab with alcohol-soaked cotton swab or use neem oil.' },
                    { name: 'Fungus Gnats', symptoms: 'Tiny black flies around soil, larvae eating roots.', treatment: 'Allow soil to dry out, use yellow sticky traps, or BTI drench.' }
                  ].map((pest, idx) => (
                    <div key={idx} className="p-4 bg-white border border-stone-100 rounded-2xl shadow-sm">
                      <h3 className="font-bold text-stone-900 mb-1">{pest.name}</h3>
                      <p className="text-xs text-stone-500 mb-2"><strong>Symptoms:</strong> {pest.symptoms}</p>
                      <div className="flex items-start gap-2 bg-green-50 p-2 rounded-lg">
                        <Leaf className="w-3 h-3 text-green-600 mt-0.5" />
                        <p className="text-xs text-green-800"><strong>Organic Treatment:</strong> {pest.treatment}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-6 border-t border-stone-100 bg-stone-50">
                <button 
                  onClick={() => setShowPestGuide(false)}
                  className="w-full py-3 bg-white border border-stone-200 hover:bg-stone-100 text-stone-700 font-bold rounded-xl transition-all"
                >
                  Close Guide
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showMonitor && (
          <GardenMonitor 
            onClose={() => setShowMonitor(false)} 
            aiModel={aiModel}
          />
        )}
      </AnimatePresence>

      <Toaster position="top-center" richColors />
    </>
  );
}
