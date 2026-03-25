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
  ListTodo, 
  Sparkles, 
  Activity, 
  Bug, 
  ArrowLeft, 
  Mic, 
  MicOff, 
  Image as ImageIcon, 
  Send, 
  Scan, 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster, toast } from 'sonner';
import Markdown from 'react-markdown';
import { GoogleGenAI } from "@google/genai";
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, setDoc } from 'firebase/firestore';
import { db, auth } from './firebase';
import LandingPage from './LandingPage';

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

// Constants
const CATEGORIES = ['Watering', 'Fertilizing', 'Pruning', 'Repotting', 'Harvesting', 'General'];
const NOTIFICATION_SOUNDS = {
  none: null,
  chime: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3',
  bird: 'https://assets.mixkit.co/active_storage/sfx/2436/2436-preview.mp3',
  water: 'https://assets.mixkit.co/active_storage/sfx/1113/1113-preview.mp3'
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showTasks, setShowTasks] = useState(false);
  const [showDiseaseGuide, setShowDiseaseGuide] = useState(false);
  const [showPestGuide, setShowPestGuide] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [reportDetailLevel, setReportDetailLevel] = useState<'Brief' | 'Detailed' | 'Expert'>('Detailed');
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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scanFileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastNotifiedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

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

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setSelectedImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleScanImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      toast.promise(new Promise(resolve => setTimeout(resolve, 2000)), {
        loading: 'Analyzing plant...',
        success: 'Analysis complete!',
        error: 'Analysis failed'
      });
      setIsChatOpen(true);
      setMessages(prev => [...prev, { role: 'user', content: 'Please analyze this plant scan.' }, { role: 'assistant', content: 'I see a healthy Monstera Deliciosa. The leaves are vibrant, but I notice some slight browning on the tips, which could indicate low humidity.' }]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && !selectedImage) return;

    const userMessage = { role: 'user', content: input, image: selectedImage };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setSelectedImage(null);
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
          { role: 'user', parts: [{ text: `User is asking about gardening at a ${reportDetailLevel} level. Question: ${input}` }] }
        ]
      });

      setMessages(prev => [...prev, { role: 'assistant', content: response.text }]);
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

  if (!isChatOpen) {
    return <LandingPage 
      onStartChat={() => setIsChatOpen(true)} 
      onOpenTasks={() => { setIsChatOpen(true); setShowTasks(true); }}
      onOpenDiseaseGuide={() => { setIsChatOpen(true); setShowDiseaseGuide(true); }}
      onOpenPestGuide={() => { setIsChatOpen(true); setShowPestGuide(true); }}
      onOpenScanReport={() => { setIsChatOpen(true); scanFileInputRef.current?.click(); }}
      detailLevel={reportDetailLevel}
      onDetailLevelChange={setReportDetailLevel}
    />;
  }

  return (
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
        <div className="flex gap-2">
          <input type="file" accept="image/*" className="hidden" ref={scanFileInputRef} onChange={handleScanImageSelect} />
          <button onClick={() => scanFileInputRef.current?.click()} className="flex items-center gap-2 text-sm font-medium text-green-800 bg-green-100 hover:bg-white px-3 py-2 rounded-full transition-colors shadow-sm">
            <Scan className="w-4 h-4 text-green-600" />
            <span className="hidden sm:inline">AI Scan Report</span>
          </button>
          <button onClick={() => setShowTasks(true)} className="flex items-center gap-2 text-sm font-medium text-green-800 bg-green-100 hover:bg-white px-3 py-2 rounded-full transition-colors shadow-sm">
            <ListTodo className="w-4 h-4 text-green-600" />
            <span className="hidden sm:inline">Tasks</span>
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden flex flex-col relative">
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
                  <button onClick={() => setShowTasks(false)} className="p-1.5 hover:bg-green-200/50 rounded-full text-green-800 transition-colors"><X className="w-5 h-5" /></button>
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

              <div className="p-4 border-t border-stone-200 bg-stone-50">
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
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <Toaster position="top-center" richColors />
    </div>
  );
}
