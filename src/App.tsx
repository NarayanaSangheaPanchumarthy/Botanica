/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Content, Part, GenerateContentResponse, ThinkingLevel } from '@google/genai';
import { Send, Image as ImageIcon, X, Leaf, Sprout, Loader2, Mic, MicOff, Bug, MapPin, Scan, ArrowLeft, Activity, ArrowRight, ListTodo, CheckSquare, Square, Trash2, Plus, Calendar, Repeat, AlertCircle, Sun, Cloud, CloudRain, CloudSnow, CloudLightning, CloudFog, Droplets, Thermometer, Bell, BellOff, BellRing, LogIn, LogOut, Lock } from 'lucide-react';
import LandingPage from './LandingPage';
import { auth, db, googleProvider } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { collection, doc, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore';
import { Toaster, toast } from 'sonner';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const PEST_GUIDE = [
  {
    name: "Aphids",
    image: "https://picsum.photos/seed/aphids/300/200",
    identification: "Tiny, pear-shaped insects often found in clusters on new growth or the undersides of leaves. They can be green, black, brown, or pink. They leave behind sticky honeydew.",
    treatment: "Spray with a strong stream of water to dislodge them. Apply insecticidal soap or neem oil. Introduce beneficial insects like ladybugs or lacewings."
  },
  {
    name: "Spider Mites",
    image: "https://picsum.photos/seed/spidermite/300/200",
    identification: "Microscopic arachnids that look like tiny moving dots. Signs include fine webbing on the plant, and stippling (tiny yellow or white dots) on leaves.",
    treatment: "Wipe leaves with a damp cloth. Increase humidity around the plant. Spray thoroughly with neem oil or horticultural oil, ensuring you hit the undersides of leaves."
  },
  {
    name: "Mealybugs",
    image: "https://picsum.photos/seed/mealybug/300/200",
    identification: "Small, soft-bodied insects covered in a white, cottony or waxy substance. Often found in the joints of stems or along leaf veins.",
    treatment: "Dab individual bugs with a cotton swab dipped in rubbing alcohol. For larger infestations, use insecticidal soap or neem oil sprays."
  },
  {
    name: "Fungus Gnats",
    image: "https://picsum.photos/seed/fungusgnat/300/200",
    identification: "Small, dark, fruit-fly-like insects flying around the soil surface. Larvae live in the soil and can damage roots.",
    treatment: "Allow the top 1-2 inches of soil to dry out completely between waterings. Use yellow sticky traps for adults. Apply Mosquito Dunks (BTI) to watering can to kill larvae."
  },
  {
    name: "Whiteflies",
    image: "https://picsum.photos/seed/whitefly/300/200",
    identification: "Tiny, moth-like white insects that fly up in a cloud when the plant is disturbed. They congregate on the undersides of leaves.",
    treatment: "Use yellow sticky traps. Vacuum them carefully from the plant. Apply insecticidal soap or neem oil every few days to break their life cycle."
  }
];

const DISEASE_GUIDE = [
  {
    name: "Powdery Mildew",
    image: "https://picsum.photos/seed/powderymildew/300/200",
    progression: [
      { stage: "Early", description: "Small white powdery spots appear on leaves." },
      { stage: "Mid", description: "Spots merge, covering entire leaves; leaves turn yellow." },
      { stage: "Late", description: "Leaves drop prematurely, plant growth is severely stunted." }
    ],
    prevention: "Ensure good air circulation, avoid overhead watering, and plant resistant varieties.",
    treatment: "Apply neem oil or a baking soda and water solution. Remove heavily infected leaves."
  },
  {
    name: "Root Rot",
    image: "https://picsum.photos/seed/rootrot/300/200",
    progression: [
      { stage: "Early", description: "Slow growth, slight yellowing of lower leaves." },
      { stage: "Mid", description: "Wilting even when soil is wet; roots become mushy and brown." },
      { stage: "Late", description: "Complete plant collapse and death." }
    ],
    prevention: "Use well-draining soil, allow topsoil to dry between waterings, ensure pots have drainage holes.",
    treatment: "Remove plant from soil, trim away mushy roots, repot in fresh, sterile, well-draining soil."
  },
  {
    name: "Early Blight",
    image: "https://picsum.photos/seed/earlyblight/300/200",
    progression: [
      { stage: "Early", description: "Small brown spots with concentric rings on lower leaves." },
      { stage: "Mid", description: "Spots enlarge, surrounding tissue turns yellow, leaves drop." },
      { stage: "Late", description: "Spreads to stems and fruit; severe defoliation." }
    ],
    prevention: "Practice crop rotation, use mulch to prevent soil splashing, water at the base of the plant.",
    treatment: "Remove infected leaves immediately. Apply organic copper fungicide if necessary."
  }
];

import ReactMarkdown from 'react-markdown';

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

type Message = {
  id: string;
  role: 'user' | 'model';
  text: string;
  image?: string; // Data URL for display
  isStreaming?: boolean;
  groundingUrls?: { uri: string; title: string }[];
};

type Task = {
  id: string;
  text: string;
  completed: boolean;
  dueDate?: string;
  frequency?: 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly';
  plantName?: string;
  lastNotified?: string;
};

type WeatherData = {
  temperature: number;
  humidity: number;
  precipitation: number;
  code: number;
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'model',
      text: 'Hello! I am Botanica, your AI gardening assistant. You can ask me questions about plant care, or upload a photo of a plant for identification and detailed care instructions.',
    }
  ]);
  const [input, setInput] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [hasSpeechSupport, setHasSpeechSupport] = useState(false);
  const [showPestGuide, setShowPestGuide] = useState(false);
  const [showDiseaseGuide, setShowDiseaseGuide] = useState(false);
  const [showTasks, setShowTasks] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskText, setNewTaskText] = useState('');
  const [newTaskPlant, setNewTaskPlant] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskFrequency, setNewTaskFrequency] = useState<'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly'>('none');
  const [taskSortBy, setTaskSortBy] = useState<'date' | 'plant'>('date');
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    'Notification' in window ? Notification.permission : 'default'
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isAuthReady) return;
    
    if (!user) {
      // Load from local storage if not logged in
      const localTasks = localStorage.getItem('botanica_tasks');
      if (localTasks) {
        try {
          setTasks(JSON.parse(localTasks));
        } catch (e) {
          console.error('Error parsing local tasks:', e);
          setTasks([]);
        }
      } else {
        setTasks([]);
      }
      return;
    }

    const path = `users/${user.uid}/tasks`;
    const unsubscribe = onSnapshot(collection(db, path), (snapshot) => {
      const loadedTasks: Task[] = [];
      snapshot.forEach((doc) => {
        loadedTasks.push({ id: doc.id, ...doc.data() } as Task);
      });
      setTasks(loadedTasks);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });

    return () => unsubscribe();
  }, [user, isAuthReady]);

  // Sync tasks to local storage if not logged in
  useEffect(() => {
    if (!user && isAuthReady) {
      localStorage.setItem('botanica_tasks', JSON.stringify(tasks));
    }
  }, [tasks, user, isAuthReady]);

  const tasksRef = useRef(tasks);
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  useEffect(() => {
    const checkTasks = () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];
      
      let updated = false;
      const currentTasks = tasksRef.current;
      
      const newTasks = currentTasks.map(task => {
        if (!task.completed && task.dueDate) {
          const taskDateStr = task.dueDate; // Already YYYY-MM-DD
          if (taskDateStr <= todayStr && task.lastNotified !== todayStr) {
            const message = `Time to: ${task.text} ${task.plantName ? `for your ${task.plantName}` : ''}`;
            
            // Native Notification
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('Botanica Reminder 🌱', { body: message });
            }
            
            // In-app Toast (Fallback/Addition)
            toast.success('Botanica Reminder 🌱', {
              description: message,
              duration: 10000,
            });

            updated = true;
            return { ...task, lastNotified: todayStr };
          }
        }
        return task;
      });
      
      if (updated) {
        setTasks(newTasks);
      }
    };

    checkTasks();
    const interval = setInterval(checkTasks, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => {
          console.error('Error getting location:', error);
        }
      );
    }
  }, []);

  useEffect(() => {
    if (location) {
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code`)
        .then(res => res.json())
        .then(data => {
          if (data && data.current) {
            setWeather({
              temperature: data.current.temperature_2m,
              humidity: data.current.relative_humidity_2m,
              precipitation: data.current.precipitation,
              code: data.current.weather_code
            });
          }
        })
        .catch(err => console.error("Weather fetch error:", err));
    }
  }, [location]);

  const getWeatherDisplay = (code: number) => {
    if (code === 0) return { text: 'Clear', icon: <Sun className="w-4 h-4 text-yellow-400" /> };
    if (code <= 3) return { text: 'Cloudy', icon: <Cloud className="w-4 h-4 text-stone-300" /> };
    if (code <= 48) return { text: 'Foggy', icon: <CloudFog className="w-4 h-4 text-stone-300" /> };
    if (code <= 67) return { text: 'Rainy', icon: <CloudRain className="w-4 h-4 text-blue-400" /> };
    if (code <= 77) return { text: 'Snowy', icon: <CloudSnow className="w-4 h-4 text-blue-200" /> };
    if (code <= 82) return { text: 'Showers', icon: <CloudRain className="w-4 h-4 text-blue-400" /> };
    if (code <= 86) return { text: 'Snow Showers', icon: <CloudSnow className="w-4 h-4 text-blue-200" /> };
    if (code >= 95) return { text: 'Stormy', icon: <CloudLightning className="w-4 h-4 text-yellow-500" /> };
    return { text: 'Unknown', icon: <Cloud className="w-4 h-4 text-stone-300" /> };
  };
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const inputRef = useRef(input);

  useEffect(() => {
    inputRef.current = input;
  }, [input]);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setHasSpeechSupport(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;

      let originalInput = '';

      recognition.onstart = () => {
        originalInput = inputRef.current;
        setIsRecording(true);
      };

      recognition.onresult = (event: any) => {
        let sessionTranscript = '';
        for (let i = 0; i < event.results.length; ++i) {
          sessionTranscript += event.results[i][0].transcript;
        }
        const separator = originalInput && !originalInput.endsWith(' ') ? ' ' : '';
        setInput(originalInput + separator + sessionTranscript);

        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
          textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 128)}px`;
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
    } else {
      try {
        recognitionRef.current?.start();
      } catch (e) {
        console.error('Error starting speech recognition:', e);
      }
    }
  };

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      toast.error('Notifications not supported', {
        description: 'This browser does not support desktop notifications.'
      });
      return;
    }
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission === 'granted') {
      toast.success('Notifications enabled!', {
        description: 'You will now receive alerts for your gardening tasks.'
      });
    } else if (permission === 'denied') {
      toast.error('Notifications blocked', {
        description: 'Please enable notifications in your browser settings to receive alerts.'
      });
    }
  };

  const testNotification = () => {
    const message = "Testing Botanica notifications! Alerts are working correctly.";
    
    // Test Native
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Botanica Test 🌱', { body: message });
    }
    
    // Test Toast
    toast.success('Botanica Test 🌱', {
      description: message,
      duration: 5000,
    });
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
    // Reset file input so the same file can be selected again if removed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;
    
    const newTask: Task = { 
      id: Date.now().toString(), 
      text: newTaskText.trim(), 
      completed: false,
      dueDate: newTaskDueDate || undefined,
      frequency: newTaskFrequency,
      plantName: newTaskPlant.trim() || undefined
    };

    if (user) {
      const path = `users/${user.uid}/tasks/${newTask.id}`;
      try {
        await setDoc(doc(db, 'users', user.uid, 'tasks', newTask.id), newTask);
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, path);
      }
    } else {
      setTasks(prev => [...prev, newTask]);
    }

    setNewTaskText('');
    setNewTaskPlant('');
    setNewTaskDueDate('');
    setNewTaskFrequency('none');
  };

  const toggleTask = async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    let updatedTask = { ...task, completed: !task.completed };

    // Handle recurring tasks
    if (updatedTask.completed && task.frequency && task.frequency !== 'none' && task.dueDate) {
      const currentDue = new Date(task.dueDate);
      const nextDue = new Date(currentDue);
      
      switch (task.frequency) {
        case 'daily': nextDue.setDate(currentDue.getDate() + 1); break;
        case 'weekly': nextDue.setDate(currentDue.getDate() + 7); break;
        case 'biweekly': nextDue.setDate(currentDue.getDate() + 14); break;
        case 'monthly': nextDue.setMonth(currentDue.getMonth() + 1); break;
      }
      
      const nextTask: Task = {
        ...task,
        id: Date.now().toString(),
        completed: false,
        dueDate: nextDue.toISOString().split('T')[0],
        lastNotified: undefined
      };
      
      if (user) {
        try {
          await setDoc(doc(db, 'users', user.uid, 'tasks', nextTask.id), nextTask);
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}/tasks/${nextTask.id}`);
        }
      } else {
        setTasks(prev => [...prev, nextTask]);
      }
    }

    if (user) {
      const path = `users/${user.uid}/tasks/${id}`;
      try {
        await setDoc(doc(db, 'users', user.uid, 'tasks', id), updatedTask);
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    } else {
      setTasks(prev => prev.map(t => t.id === id ? updatedTask : t));
    }
  };

  const deleteTask = async (id: string) => {
    if (user) {
      const path = `users/${user.uid}/tasks/${id}`;
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'tasks', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      }
    } else {
      setTasks(prev => prev.filter(t => t.id !== id));
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
  };

  const getGroupedTasks = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    if (taskSortBy === 'date') {
      const groups: Record<string, Task[]> = {
        'Overdue': [],
        'Today': [],
        'Upcoming': [],
        'No Date': [],
        'Completed': []
      };

      tasks.forEach(task => {
        if (task.completed) {
          groups['Completed'].push(task);
        } else if (!task.dueDate) {
          groups['No Date'].push(task);
        } else {
          const taskDateStr = task.dueDate; // YYYY-MM-DD
          if (taskDateStr < todayStr) {
            groups['Overdue'].push(task);
          } else if (taskDateStr === todayStr) {
            groups['Today'].push(task);
          } else {
            groups['Upcoming'].push(task);
          }
        }
      });

      // Sort chronologically within groups
      groups['Overdue'].sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
      groups['Upcoming'].sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
      
      return groups;
    } else {
      const groups: Record<string, Task[]> = {};
      tasks.forEach(task => {
        // Case-insensitive grouping by plant name
        const rawPlant = task.plantName?.trim() || 'General';
        const plantKey = rawPlant.charAt(0).toUpperCase() + rawPlant.slice(1).toLowerCase();
        
        if (!groups[plantKey]) groups[plantKey] = [];
        groups[plantKey].push(task);
      });

      // Sort within plant groups: Incomplete first, then by date
      Object.keys(groups).forEach(key => {
        groups[key].sort((a, b) => {
          if (a.completed !== b.completed) return a.completed ? 1 : -1;
          const dateA = a.dueDate || '9999-12-31';
          const dateB = b.dueDate || '9999-12-31';
          return dateA.localeCompare(dateB);
        });
      });

      // Sort the groups themselves alphabetically, but keep 'General' at the top or bottom
      const sortedKeys = Object.keys(groups).sort((a, b) => {
        if (a === 'General') return -1;
        if (b === 'General') return 1;
        return a.localeCompare(b);
      });

      const sortedGroups: Record<string, Task[]> = {};
      sortedKeys.forEach(key => {
        sortedGroups[key] = groups[key];
      });

      return sortedGroups;
    }
  };

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && !selectedImage) return;

    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
    }

    const userMessageId = Date.now().toString();
    const newUserMessage: Message = {
      id: userMessageId,
      role: 'user',
      text: input.trim(),
      image: selectedImage || undefined,
    };

    setMessages((prev) => [...prev, newUserMessage]);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setSelectedImage(null);
    setIsLoading(true);

    const modelMessageId = (Date.now() + 1).toString();
    setMessages((prev) => [
      ...prev,
      { id: modelMessageId, role: 'model', text: '', isStreaming: true },
    ]);

    try {
      // Construct API history
      // We skip the welcome message as it's just UI flair
      const apiHistory: Content[] = messages
        .filter(m => m.id !== 'welcome')
        .concat(newUserMessage)
        .map((m) => {
          const parts: Part[] = [];
          if (m.image) {
            const base64Data = m.image.split(',')[1];
            const mimeType = m.image.split(';')[0].split(':')[1];
            parts.push({
              inlineData: {
                data: base64Data,
                mimeType: mimeType,
              },
            });
          }
          if (m.text) {
            parts.push({ text: m.text });
          }
          return {
            role: m.role,
            parts,
          };
        });

      const config: any = {
        systemInstruction: `You are Botanica, an expert gardening assistant equipped with advanced vision detection capabilities (acting as a sophisticated plant detector). When a user uploads a photo, you MUST: 1. **Detection & Counting**: Carefully scan the image and explicitly state EXACTLY HOW MANY distinct plants you detect in the picture at the very beginning of your response. 2. **Plant Details**: For EACH detected plant, identify it and provide its specific details. 3. **Health Assessment**: Analyze the plants for any visible signs of disease, pests, or distress. If a disease is detected, you MUST include a 'Disease Progression & Timeline' section describing the stages of the disease, and a 'Preventative Measures' section to avoid future occurrences. Focus on ORGANIC treatment options. 4. **Care Guide**: Provide a structured 'Care Guide' (Watering, Sunlight, Soil, Tips). 5. **Similar Species Showcase**: Visually showcase 2-3 similar plants directly within the results to help the user confirm the identification or explore related species. For EACH similar plant, you MUST provide a visual example using markdown image syntax: \`![Plant Name](https://picsum.photos/seed/{plant_name_no_spaces}/400/300)\` followed by the plant's name in bold and a brief comparison of their visual differences and care requirements. Use Google Maps for local nursery queries. Structure your responses clearly using markdown.${weather ? `\n\nCRITICAL WEATHER CONTEXT: The user's current local weather is ${weather.temperature}°C, ${weather.humidity}% humidity, and ${weather.precipitation}mm precipitation. You MUST dynamically adjust your care instructions and advice based on these real-time conditions (e.g., advising less watering if it recently rained or humidity is high, or suggesting protection if temperatures are extreme).` : ''}`,
        tools: [{ googleMaps: {} }],
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
      };

      if (location) {
        config.toolConfig = {
          retrievalConfig: {
            latLng: {
              latitude: location.latitude,
              longitude: location.longitude,
            }
          }
        };
      }

      const responseStream = await ai.models.generateContentStream({
        model: 'gemini-3.1-pro-preview',
        contents: apiHistory,
        config,
      });

      let fullText = '';
      let groundingUrls: { uri: string; title: string }[] = [];
      for await (const chunk of responseStream) {
        const c = chunk as GenerateContentResponse;
        if (c.text) {
          fullText += c.text;
        }
        
        const chunks = c.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (chunks) {
          chunks.forEach((chunk: any) => {
            if (chunk.maps?.uri && !groundingUrls.some(u => u.uri === chunk.maps.uri)) {
              groundingUrls.push({ 
                uri: chunk.maps.uri, 
                title: chunk.maps.title || 'View on Maps' 
              });
            }
          });
        }

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === modelMessageId
              ? { ...msg, text: fullText, groundingUrls }
              : msg
          )
        );
      }

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === modelMessageId
            ? { ...msg, isStreaming: false }
            : msg
        )
      );
    } catch (error) {
      console.error('Error generating response:', error);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === modelMessageId
            ? { ...msg, text: 'Sorry, I encountered an error while processing your request. Please try again.', isStreaming: false }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (!isChatOpen) {
    return <LandingPage 
      onStartChat={() => setIsChatOpen(true)} 
      onOpenTasks={() => { setIsChatOpen(true); setShowTasks(true); }}
      onOpenDiseaseGuide={() => { setIsChatOpen(true); setShowDiseaseGuide(true); }}
      onOpenPestGuide={() => { setIsChatOpen(true); setShowPestGuide(true); }}
    />;
  }

  return (
    <div className="flex flex-col h-screen bg-stone-50 text-stone-900 font-sans">
      {/* Header */}
      <header className="bg-green-800 text-white p-4 shadow-md flex justify-between items-center z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsChatOpen(false)}
            className="p-2 hover:bg-green-700 rounded-full transition-colors mr-1"
            title="Back to Home"
          >
            <ArrowLeft className="w-5 h-5 text-green-100" />
          </button>
          <div className="bg-green-700 p-2 rounded-full hidden sm:block">
            <Sprout className="w-6 h-6 text-green-100" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight flex items-center gap-3">
              Botanica
              {weather && (
                <div className="hidden md:flex items-center gap-2 text-xs font-normal bg-green-900/50 px-2 py-1 rounded-full border border-green-700/50">
                  {getWeatherDisplay(weather.code).icon}
                  <span>{weather.temperature}°C</span>
                  <span className="text-green-300/50">|</span>
                  <span className="flex items-center gap-0.5"><Droplets className="w-3 h-3 text-blue-300" /> {weather.humidity}%</span>
                </div>
              )}
            </h1>
            <p className="text-green-200 text-xs font-medium hidden sm:block">Your AI Gardening Assistant</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowTasks(true)}
            className="flex items-center gap-2 text-sm font-medium text-green-800 bg-green-100 hover:bg-white px-3 py-2 rounded-full transition-colors shadow-sm"
          >
            <ListTodo className="w-4 h-4" />
            <span className="hidden sm:inline">Tasks</span>
          </button>
          <button
            onClick={() => setShowDiseaseGuide(true)}
            className="flex items-center gap-2 text-sm font-medium text-green-800 bg-green-100 hover:bg-white px-3 py-2 rounded-full transition-colors shadow-sm"
          >
            <Activity className="w-4 h-4" />
            <span className="hidden sm:inline">Disease Guide</span>
          </button>
          <button
            onClick={() => setShowPestGuide(true)}
            className="flex items-center gap-2 text-sm font-medium text-green-800 bg-green-100 hover:bg-white px-3 py-2 rounded-full transition-colors shadow-sm"
          >
            <Bug className="w-4 h-4" />
            <span className="hidden sm:inline">Pest Guide</span>
          </button>
        </div>
      </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 shadow-sm ${
                  msg.role === 'user'
                    ? 'bg-green-600 text-white rounded-tr-sm'
                    : 'bg-white border border-stone-200 rounded-tl-sm'
                }`}
              >
                {msg.role === 'model' && (
                  <div className="flex items-center gap-2 mb-2 text-green-800 font-semibold text-sm">
                    <Leaf className="w-4 h-4" />
                    Botanica
                  </div>
                )}
                
                {msg.image && (
                  <div className="relative inline-block mb-3 rounded-lg overflow-hidden group">
                    <img
                      src={msg.image}
                      alt="Uploaded plant"
                      className="max-w-full h-auto object-cover max-h-64 block transition-transform duration-300 group-hover:scale-105"
                      referrerPolicy="no-referrer"
                    />
                    {msg.isStreaming && (
                      <>
                        <div className="absolute inset-0 bg-green-500/10 pointer-events-none">
                          <div className="absolute left-0 w-full h-0.5 bg-green-400 shadow-[0_0_10px_2px_rgba(74,222,128,0.8)] animate-scan" />
                        </div>
                        <div className="absolute bottom-2 right-2 bg-black/70 text-green-400 text-xs px-2 py-1 rounded font-mono flex items-center gap-1 backdrop-blur-sm">
                          <Scan className="w-3 h-3 animate-pulse" />
                          ANALYZING...
                        </div>
                      </>
                    )}
                  </div>
                )}
                
                <div className={`prose prose-sm sm:prose-base max-w-none ${msg.role === 'user' ? 'prose-invert' : 'prose-stone'}`}>
                  {msg.text ? (
                    <ReactMarkdown
                      components={{
                        img: ({node, ...props}) => (
                          <div className="rounded-2xl overflow-hidden my-5 shadow-md hover:shadow-xl transition-shadow max-w-full sm:w-3/4 border border-stone-200 inline-block group">
                            <img 
                              {...props} 
                              className="w-full h-auto object-cover max-h-72 block transition-transform duration-300 group-hover:scale-105" 
                              referrerPolicy="no-referrer" 
                            />
                          </div>
                        )
                      }}
                    >
                      {msg.text}
                    </ReactMarkdown>
                  ) : msg.isStreaming ? (
                    <div className="flex items-center gap-2 text-stone-400">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Thinking...</span>
                    </div>
                  ) : null}
                </div>
                
                {msg.groundingUrls && msg.groundingUrls.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-stone-200/50">
                    <p className="text-sm font-semibold text-green-800 mb-2 flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      Local Places Found
                    </p>
                    <ul className="space-y-2">
                      {msg.groundingUrls.map((url, idx) => (
                        <li key={idx}>
                          <a 
                            href={url.uri} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-sm text-green-700 hover:text-green-900 hover:underline flex items-start gap-1"
                          >
                            <span className="truncate">{url.title}</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input Area */}
      <footer className="bg-white border-t border-stone-200 p-4">
        <div className="max-w-3xl mx-auto">
          {selectedImage && (
            <div className="mb-3 relative inline-block">
              <img
                src={selectedImage}
                alt="Selected"
                className="h-20 w-20 object-cover rounded-lg border-2 border-green-500"
                referrerPolicy="no-referrer"
              />
              <button
                onClick={removeImage}
                className="absolute -top-2 -right-2 bg-stone-800 text-white rounded-full p-1 hover:bg-stone-700 transition-colors"
                type="button"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="flex gap-2 items-end">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              ref={fileInputRef}
              onChange={handleImageSelect}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-3 text-stone-500 hover:text-green-600 hover:bg-green-50 rounded-xl transition-colors shrink-0"
              title="Upload a photo"
            >
              <ImageIcon className="w-6 h-6" />
            </button>

            {hasSpeechSupport && (
              <button
                type="button"
                onClick={toggleRecording}
                className={`p-3 rounded-xl transition-colors shrink-0 ${
                  isRecording
                    ? 'text-red-500 bg-red-50 hover:bg-red-100 animate-pulse'
                    : 'text-stone-500 hover:text-green-600 hover:bg-green-50'
                }`}
                title={isRecording ? "Stop recording" : "Start voice input"}
              >
                {isRecording ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
              </button>
            )}
            
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                placeholder={selectedImage ? "Ask about this plant..." : "Ask a gardening question or upload a photo..."}
                className="w-full bg-stone-100 border-transparent focus:bg-white focus:border-green-500 focus:ring-2 focus:ring-green-200 rounded-xl px-4 py-3 pr-12 resize-none min-h-[52px] outline-none transition-all"
                rows={1}
                style={{ height: 'auto' }}
              />
              <button
                type="submit"
                disabled={isLoading || (!input.trim() && !selectedImage)}
                className="absolute right-2 bottom-2 p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:hover:bg-green-600 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
          <div className="text-center mt-2 text-xs text-stone-400">
            Botanica can make mistakes. Consider verifying important information.
          </div>
        </div>
      </footer>
      {/* Pest Guide Modal */}
      {showPestGuide && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-stone-200 flex justify-between items-center bg-green-50">
              <h2 className="text-lg font-semibold text-green-800 flex items-center gap-2">
                <Bug className="w-5 h-5" />
                Common Garden Pests Guide
              </h2>
              <button 
                onClick={() => setShowPestGuide(false)} 
                className="p-1.5 hover:bg-green-200/50 rounded-full text-green-800 transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              {PEST_GUIDE.map((pest, index) => (
                <div key={index} className="flex flex-col sm:flex-row gap-4 bg-stone-50 p-4 rounded-xl border border-stone-100">
                  <img 
                    src={pest.image} 
                    alt={pest.name} 
                    className="w-full sm:w-40 h-32 object-cover rounded-lg shrink-0 shadow-sm" 
                    referrerPolicy="no-referrer" 
                  />
                  <div>
                    <h3 className="font-semibold text-lg text-stone-800">{pest.name}</h3>
                    <p className="text-sm text-stone-600 mt-1">
                      <strong className="text-stone-700">Identification:</strong> {pest.identification}
                    </p>
                    <p className="text-sm text-stone-600 mt-2">
                      <strong className="text-green-700">Organic Treatment:</strong> {pest.treatment}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Disease Guide Modal */}
      {showDiseaseGuide && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-stone-200 flex justify-between items-center bg-green-50">
              <h2 className="text-lg font-semibold text-green-800 flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Plant Disease Progression Guide
              </h2>
              <button 
                onClick={() => setShowDiseaseGuide(false)} 
                className="p-1.5 hover:bg-green-200/50 rounded-full text-green-800 transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-6">
              {DISEASE_GUIDE.map((disease, index) => (
                <div key={index} className="flex flex-col gap-4 bg-stone-50 p-5 rounded-xl border border-stone-100">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <img 
                      src={disease.image} 
                      alt={disease.name} 
                      className="w-full sm:w-48 h-36 object-cover rounded-lg shrink-0 shadow-sm" 
                      referrerPolicy="no-referrer" 
                    />
                    <div>
                      <h3 className="font-bold text-xl text-stone-800">{disease.name}</h3>
                      <div className="mt-3 space-y-2">
                        <p className="text-sm text-stone-600">
                          <strong className="text-green-700">Prevention:</strong> {disease.prevention}
                        </p>
                        <p className="text-sm text-stone-600">
                          <strong className="text-green-700">Organic Treatment:</strong> {disease.treatment}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Timeline */}
                  <div className="mt-2 pt-4 border-t border-stone-200">
                    <h4 className="text-sm font-bold text-stone-800 mb-3">Progression Timeline</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {disease.progression.map((stage, sIdx) => (
                        <div key={sIdx} className="bg-white p-3 rounded-lg border border-stone-200 shadow-sm relative">
                          <div className="text-xs font-bold text-green-700 uppercase tracking-wider mb-1">{stage.stage} Stage</div>
                          <p className="text-xs text-stone-600">{stage.description}</p>
                          {sIdx < disease.progression.length - 1 && (
                            <div className="hidden sm:block absolute top-1/2 -right-3 transform -translate-y-1/2 text-stone-300 z-10">
                              <ArrowRight className="w-4 h-4" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tasks Modal */}
      {showTasks && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[85vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-stone-200 flex justify-between items-center bg-green-50">
              <div className="flex items-center gap-4">
                <h2 className="text-lg font-semibold text-green-800 flex items-center gap-2">
                  <ListTodo className="w-5 h-5" />
                  Tasks
                </h2>
                <div className="flex bg-white rounded-lg p-0.5 border border-green-200">
                  <button 
                    onClick={() => setTaskSortBy('date')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${taskSortBy === 'date' ? 'bg-green-100 text-green-800' : 'text-stone-500 hover:text-stone-700'}`}
                  >
                    By Date
                  </button>
                  <button 
                    onClick={() => setTaskSortBy('plant')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${taskSortBy === 'plant' ? 'bg-green-100 text-green-800' : 'text-stone-500 hover:text-stone-700'}`}
                  >
                    By Plant
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={testNotification}
                  className="p-1.5 hover:bg-green-200/50 rounded-full transition-colors text-stone-500"
                  title="Test notification"
                >
                  <Activity className="w-5 h-5" />
                </button>
                <button
                  onClick={requestNotificationPermission}
                  className="p-1.5 hover:bg-green-200/50 rounded-full transition-colors"
                  title={notificationPermission === 'granted' ? 'Notifications enabled' : 'Enable notifications'}
                >
                  {notificationPermission === 'granted' ? (
                    <BellRing className="w-5 h-5 text-green-600" />
                  ) : notificationPermission === 'denied' ? (
                    <BellOff className="w-5 h-5 text-red-400" />
                  ) : (
                    <Bell className="w-5 h-5 text-stone-500" />
                  )}
                </button>
                <button 
                  onClick={() => setShowTasks(false)} 
                  className="p-1.5 hover:bg-green-200/50 rounded-full text-green-800 transition-colors"
                  title="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              {tasks.length === 0 ? (
                <div className="text-center py-8 text-stone-500">
                  <ListTodo className="w-12 h-12 mx-auto mb-3 text-stone-300" />
                  <p>No tasks yet. Add one below!</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(getGroupedTasks()).map(([groupName, groupTasks]) => {
                    if (groupTasks.length === 0) return null;
                    return (
                      <div key={groupName}>
                        <h3 className={`text-xs font-bold uppercase tracking-wider mb-3 ${groupName === 'Overdue' ? 'text-red-600 flex items-center gap-1' : 'text-stone-500'}`}>
                          {groupName === 'Overdue' && <AlertCircle className="w-4 h-4" />}
                          {groupName}
                        </h3>
                        <ul className="space-y-2">
                          {groupTasks.map(task => {
                            const isOverdue = task.dueDate && new Date(task.dueDate) < new Date(new Date().setHours(0,0,0,0)) && !task.completed;
                            return (
                              <li 
                                key={task.id} 
                                className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                                  task.completed ? 'bg-stone-50 border-stone-100 opacity-75' : 
                                  isOverdue ? 'bg-red-50 border-red-200 shadow-sm' : 
                                  'bg-white border-stone-200 shadow-sm'
                                }`}
                              >
                                <button 
                                  onClick={() => toggleTask(task.id)}
                                  className="flex items-center gap-3 flex-1 text-left"
                                >
                                  {task.completed ? (
                                    <CheckSquare className="w-5 h-5 text-green-600 shrink-0" />
                                  ) : (
                                    <Square className={`w-5 h-5 shrink-0 ${isOverdue ? 'text-red-400' : 'text-stone-400'}`} />
                                  )}
                                  <div className="flex flex-col text-left">
                                    <span className={`text-sm font-medium ${task.completed ? 'line-through text-stone-400' : isOverdue ? 'text-red-900' : 'text-stone-800'}`}>
                                      {task.text}
                                    </span>
                                    <div className="flex flex-wrap gap-3 mt-1">
                                      {task.plantName && (
                                        <span className={`text-xs flex items-center gap-1 ${task.completed ? 'text-stone-400' : 'text-stone-500'}`}>
                                          <Leaf className="w-3 h-3" />
                                          {task.plantName}
                                        </span>
                                      )}
                                      {task.dueDate && (
                                        <span className={`text-xs flex items-center gap-1 ${task.completed ? 'text-stone-400' : isOverdue ? 'text-red-600 font-bold' : 'text-stone-500'}`}>
                                          <Calendar className="w-3 h-3" />
                                          {new Date(task.dueDate).toLocaleDateString()}
                                        </span>
                                      )}
                                      {task.frequency && task.frequency !== 'none' && (
                                        <span className={`text-xs flex items-center gap-1 ${task.completed ? 'text-stone-400' : 'text-green-600'}`}>
                                          <Repeat className="w-3 h-3" />
                                          <span className="capitalize">{task.frequency}</span>
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </button>
                                <button 
                                  onClick={() => deleteTask(task.id)}
                                  className={`p-1.5 rounded-lg transition-colors ml-2 ${isOverdue ? 'text-red-400 hover:text-red-600 hover:bg-red-100' : 'text-stone-400 hover:text-red-500 hover:bg-red-50'}`}
                                  title="Delete task"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-stone-200 bg-stone-50">
              <form onSubmit={addTask} className="flex flex-col gap-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTaskText}
                    onChange={(e) => setNewTaskText(e.target.value)}
                    placeholder="Add a new task (e.g., Water)..."
                    className="flex-[2] px-4 py-2 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 text-sm"
                  />
                  <input
                    type="text"
                    value={newTaskPlant}
                    onChange={(e) => setNewTaskPlant(e.target.value)}
                    placeholder="Plant (optional)"
                    className="flex-1 px-4 py-2 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={newTaskDueDate}
                    onChange={(e) => setNewTaskDueDate(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 text-sm text-stone-600"
                  />
                  <select
                    value={newTaskFrequency}
                    onChange={(e) => setNewTaskFrequency(e.target.value as any)}
                    className="flex-1 px-3 py-2 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 text-sm text-stone-600 bg-white"
                  >
                    <option value="none">No repeat</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Bi-weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                  <button
                    type="submit"
                    disabled={!newTaskText.trim()}
                    className="bg-green-600 text-white px-4 py-2 rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:hover:bg-green-600 transition-colors flex items-center justify-center"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      <Toaster position="top-center" richColors />
    </div>
  );
}
