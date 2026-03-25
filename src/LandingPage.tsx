import React, { useState } from 'react';
import { Leaf, Sprout, MapPin, Scan, Brain, ShieldCheck, ChevronDown, ArrowRight, HelpCircle, Map, Star, Droplets, Sun, Thermometer, Twitter, Facebook, Linkedin, Link, ListTodo, Activity, Bug } from 'lucide-react';

interface LandingPageProps {
  onStartChat: () => void;
  onOpenTasks: () => void;
  onOpenDiseaseGuide: () => void;
  onOpenPestGuide: () => void;
}

const FAQS = [
  {
    question: "How accurate is the plant identification?",
    answer: "Botanica uses advanced AI vision models (Gemini 3.1 Pro) with high-thinking capabilities. It can accurately identify thousands of plant species, and even scan and count multiple distinct plants in a single photo."
  },
  {
    question: "Can it help me find where to buy plants?",
    answer: "Yes! Botanica integrates with real-time Google Maps data. If you ask for local nurseries, garden centers, or community gardens, it will provide accurate, up-to-date local recommendations with direct links."
  },
  {
    question: "Is the pest treatment advice safe?",
    answer: "Absolutely. Botanica is specifically instructed to prioritize organic, safe, and environmentally friendly treatment methods for all pest and disease diagnoses."
  },
  {
    question: "Do I need to create an account?",
    answer: "No account is required! You can start chatting, scanning plants, and getting expert gardening advice right away."
  }
];

const SHOWCASE_PLANTS = [
  {
    name: "Monstera Deliciosa",
    image: "https://images.unsplash.com/photo-1614594975525-e45190c55d0b?auto=format&fit=crop&q=80&w=800",
    description: "A tropical favorite known for its natural leaf holes. Thrives in warm, humid environments.",
    stats: { water: "Every 1-2 weeks", light: "Bright Indirect", temp: "65-85°F" }
  },
  {
    name: "Japanese Maple",
    image: "https://images.unsplash.com/photo-1599148401005-fe6d7497cb5e?auto=format&fit=crop&q=80&w=800",
    description: "An elegant ornamental tree with stunning seasonal color changes. Requires protection from harsh afternoon sun.",
    stats: { water: "Consistently moist", light: "Dappled Shade", temp: "Hardy to -10°F" }
  },
  {
    name: "English Lavender",
    image: "https://images.unsplash.com/photo-1565011523534-747a8601f10a?auto=format&fit=crop&q=80&w=800",
    description: "A fragrant, drought-tolerant herb perfect for pollinator gardens. Demands excellent drainage.",
    stats: { water: "Low (when established)", light: "Full Sun", temp: "Hardy to -20°F" }
  }
];

export default function LandingPage({ onStartChat, onOpenTasks, onOpenDiseaseGuide, onOpenPestGuide }: LandingPageProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const handleShare = async (platform: string) => {
    const url = window.location.href;
    const text = "Check out Botanica, the AI-powered master gardener! 🌱";
    
    switch (platform) {
      case 'twitter':
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
        break;
      case 'facebook':
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
        break;
      case 'linkedin':
        window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, '_blank');
        break;
      case 'native':
        if (navigator.share) {
          navigator.share({
            title: 'Botanica AI',
            text: text,
            url: url,
          }).catch(console.error);
        } else {
          try {
            await navigator.clipboard.writeText(url);
            alert('Link copied to clipboard!');
          } catch (err) {
            console.error('Failed to copy link', err);
          }
        }
        break;
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans overflow-x-hidden">
      {/* Navigation */}
      <nav className="bg-green-900/90 backdrop-blur-md text-white p-4 shadow-md flex justify-between items-center fixed top-0 w-full z-50">
        <div className="flex items-center justify-between max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="bg-green-700 p-2 rounded-full">
              <Sprout className="w-6 h-6 text-green-100" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">Botanica</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenTasks}
              className="flex items-center gap-2 text-sm font-medium text-green-800 bg-green-100 hover:bg-white px-3 py-2 rounded-full transition-colors shadow-sm"
            >
              <ListTodo className="w-4 h-4" />
              <span className="hidden sm:inline">Tasks</span>
            </button>
            <button
              onClick={onOpenDiseaseGuide}
              className="flex items-center gap-2 text-sm font-medium text-green-800 bg-green-100 hover:bg-white px-3 py-2 rounded-full transition-colors shadow-sm"
            >
              <Activity className="w-4 h-4" />
              <span className="hidden sm:inline">Disease Guide</span>
            </button>
            <button
              onClick={onOpenPestGuide}
              className="flex items-center gap-2 text-sm font-medium text-green-800 bg-green-100 hover:bg-white px-3 py-2 rounded-full transition-colors shadow-sm"
            >
              <Bug className="w-4 h-4" />
              <span className="hidden sm:inline">Pest Guide</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-40 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1585320806297-9794b3e4ce88?auto=format&fit=crop&q=80&w=2000" 
            alt="Beautiful landscape garden" 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-green-950/70 via-green-900/50 to-stone-50"></div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center mt-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 backdrop-blur-md text-white border border-white/30 text-sm font-medium mb-8">
            <Brain className="w-4 h-4 text-green-300" />
            Powered by Advanced AI Vision
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white mb-6 drop-shadow-lg">
            Your AI-Powered <br className="hidden md:block" />
            <span className="text-green-400">Master Gardener</span>
          </h1>
          <p className="mt-4 text-xl text-stone-200 max-w-2xl mx-auto mb-10 drop-shadow-md">
            Instantly identify plants, diagnose diseases, and get real-time local care recommendations. Upload a photo and let Botanica do the rest.
          </p>
          <button 
            onClick={onStartChat}
            className="inline-flex items-center gap-2 bg-green-600 text-white px-8 py-4 rounded-full text-lg font-semibold hover:bg-green-500 transition-all shadow-[0_0_20px_rgba(22,163,74,0.4)] hover:shadow-[0_0_30px_rgba(22,163,74,0.6)] hover:-translate-y-1"
          >
            Try Botanica Now
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </section>

      {/* What, Where, Why Section */}
      <section className="py-24 bg-stone-50 relative z-20 -mt-10 rounded-t-[3rem]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-stone-900">The Botanica Advantage</h2>
            <p className="mt-4 text-lg text-stone-600">Everything you need to know about your new gardening companion.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-stone-100 hover:shadow-md transition-shadow">
              <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center text-green-700 mb-6">
                <HelpCircle className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-stone-900 mb-3">What is Botanica?</h3>
              <p className="text-stone-600 leading-relaxed">Botanica is an advanced AI-powered master gardener. It uses cutting-edge vision models to instantly identify plants, diagnose diseases, and provide highly accurate, real-time care instructions tailored to your specific plant.</p>
            </div>
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-stone-100 hover:shadow-md transition-shadow">
              <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center text-green-700 mb-6">
                <Map className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-stone-900 mb-3">Where to use it?</h3>
              <p className="text-stone-600 leading-relaxed">Use it anywhere plants grow! Whether you're tending to indoor houseplants, managing a backyard vegetable garden, exploring a local nursery, or hiking through a nature reserve, Botanica is your on-the-go botanical expert.</p>
            </div>
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-stone-100 hover:shadow-md transition-shadow">
              <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center text-green-700 mb-6">
                <Star className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-stone-900 mb-3">Why is it useful?</h3>
              <p className="text-stone-600 leading-relaxed">It takes the guesswork out of gardening. By providing instant, accurate diagnoses and organic treatment plans, Botanica saves dying plants, optimizes growth, and helps you become a more confident, successful gardener.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Plant Showcase Section */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-stone-900">Real-Time Accurate Plant Profiles</h2>
            <p className="mt-4 text-lg text-stone-600">Experience the level of detail Botanica provides for thousands of species.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {SHOWCASE_PLANTS.map((plant, idx) => (
              <div key={idx} className="bg-stone-50 rounded-3xl overflow-hidden border border-stone-100 shadow-sm hover:shadow-xl transition-all duration-300 group">
                <div className="h-56 overflow-hidden relative">
                  <img src={plant.image} alt={plant.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" referrerPolicy="no-referrer" />
                  <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-bold text-green-800 flex items-center gap-1.5 shadow-sm">
                    <Scan className="w-3.5 h-3.5" /> Identified
                  </div>
                </div>
                <div className="p-8">
                  <h3 className="text-2xl font-bold text-stone-900 mb-3">{plant.name}</h3>
                  <p className="text-stone-600 text-sm mb-8 line-clamp-2 leading-relaxed">{plant.description}</p>
                  <div className="space-y-4 bg-white p-4 rounded-2xl border border-stone-100">
                    <div className="flex items-center gap-3 text-sm text-stone-700">
                      <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                        <Droplets className="w-4 h-4 text-blue-500" />
                      </div>
                      <div>
                        <span className="block text-xs text-stone-400 font-medium uppercase tracking-wider">Water</span>
                        <span className="font-semibold">{plant.stats.water}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-stone-700">
                      <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
                        <Sun className="w-4 h-4 text-amber-500" />
                      </div>
                      <div>
                        <span className="block text-xs text-stone-400 font-medium uppercase tracking-wider">Light</span>
                        <span className="font-semibold">{plant.stats.light}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-stone-700">
                      <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                        <Thermometer className="w-4 h-4 text-red-400" />
                      </div>
                      <div>
                        <span className="block text-xs text-stone-400 font-medium uppercase tracking-wider">Temperature</span>
                        <span className="font-semibold">{plant.stats.temp}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-stone-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-stone-900">AI-Driven Real-Time Intelligence</h2>
            <p className="mt-4 text-lg text-stone-600">More than just a plant dictionary. Botanica sees, thinks, and connects you locally.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-white rounded-3xl p-8 border border-stone-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center mb-6 text-green-700">
                <Scan className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-stone-900 mb-3">Advanced Vision & Counting</h3>
              <p className="text-stone-600 leading-relaxed">
                Upload a photo and Botanica's high-thinking AI will scan the image, explicitly count the number of distinct plants, and identify each one individually with detailed care instructions.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white rounded-3xl p-8 border border-stone-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center mb-6 text-green-700">
                <MapPin className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-stone-900 mb-3">Real-Time Local Maps</h3>
              <p className="text-stone-600 leading-relaxed">
                Need to buy a specific plant or find a community garden? Botanica uses Google Maps grounding to provide up-to-date, real-time local recommendations right in your area.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white rounded-3xl p-8 border border-stone-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center mb-6 text-green-700">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-stone-900 mb-3">Organic Health Diagnostics</h3>
              <p className="text-stone-600 leading-relaxed">
                Detect pests, diseases, and distress early. Botanica analyzes the visual health of your plants and provides actionable, organic treatment plans to keep your garden thriving safely.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-24 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-stone-900">Frequently Asked Questions</h2>
          </div>
          
          <div className="space-y-4">
            {FAQS.map((faq, index) => (
              <div 
                key={index} 
                className="bg-stone-50 border border-stone-200 rounded-2xl overflow-hidden transition-all duration-200"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="w-full px-6 py-5 text-left flex justify-between items-center focus:outline-none"
                >
                  <span className="font-semibold text-stone-900">{faq.question}</span>
                  <ChevronDown 
                    className={`w-5 h-5 text-stone-500 transition-transform duration-200 ${openFaq === index ? 'rotate-180' : ''}`} 
                  />
                </button>
                <div 
                  className={`px-6 overflow-hidden transition-all duration-300 ease-in-out ${
                    openFaq === index ? 'max-h-48 pb-5 opacity-100' : 'max-h-0 opacity-0'
                  }`}
                >
                  <p className="text-stone-600 leading-relaxed">{faq.answer}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-stone-900 text-stone-400 py-12 text-center">
        <div className="flex items-center justify-center gap-2 mb-6">
          <Leaf className="w-5 h-5 text-green-500" />
          <span className="text-xl font-semibold text-white tracking-tight">Botanica</span>
        </div>
        <div className="flex justify-center items-center gap-6 mb-8">
          <button onClick={() => handleShare('twitter')} className="hover:text-white transition-colors" title="Share on Twitter">
            <Twitter className="w-5 h-5" />
          </button>
          <button onClick={() => handleShare('facebook')} className="hover:text-white transition-colors" title="Share on Facebook">
            <Facebook className="w-5 h-5" />
          </button>
          <button onClick={() => handleShare('linkedin')} className="hover:text-white transition-colors" title="Share on LinkedIn">
            <Linkedin className="w-5 h-5" />
          </button>
          <button onClick={() => handleShare('native')} className="hover:text-white transition-colors" title="Copy Link / Share">
            <Link className="w-5 h-5" />
          </button>
        </div>
        <p>© {new Date().getFullYear()} Botanica AI. All rights reserved.</p>
      </footer>
    </div>
  );
}
