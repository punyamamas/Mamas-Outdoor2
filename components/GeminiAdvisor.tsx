import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, Loader2, Bot } from 'lucide-react';
import { getAdventureRecommendation } from '../services/geminiService';
import { Product } from '../types';

interface GeminiAdvisorProps {
  products: Product[];
  onAddRecommended: (productId: string) => void;
}

interface Message {
  role: 'user' | 'ai';
  content: string;
  recommendedIds?: string[];
}

const GeminiAdvisor: React.FC<GeminiAdvisorProps> = ({ products, onAddRecommended }) => {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { 
      role: 'ai', 
      content: 'Halo Mas/Mba! Mau naik gunung mana nih? Saya bisa bantu rekomendasikan alat yang cocok buat trip kamu. Ceritain aja rencananya!' 
    }
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!query.trim()) return;

    const userMsg = query;
    setQuery('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsLoading(true);

    try {
      // Pass the current products list to the AI service
      const result = await getAdventureRecommendation(userMsg, products);
      setMessages(prev => [...prev, { 
        role: 'ai', 
        content: result.text, 
        recommendedIds: result.recommendedIds 
      }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'ai', content: "Maaf, sepertinya koneksi saya ke basecamp terputus. Coba lagi ya!" }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div id="ai-guide" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 scroll-mt-20">
      <div className="bg-gradient-to-br from-nature-800 to-nature-900 rounded-2xl shadow-xl overflow-hidden flex flex-col md:flex-row min-h-[500px]">
        
        {/* Left Side: Info */}
        <div className="md:w-1/3 p-8 text-white flex flex-col justify-center">
          <div className="bg-white/10 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-sm">
            <Sparkles className="text-adventure-500" size={32} />
          </div>
          <h2 className="text-3xl font-bold mb-4">Mamas AI Guide</h2>
          <p className="text-nature-100 mb-6 leading-relaxed">
            Bingung mau bawa apa ke Gunung Slamet? Atau mau camping ceria di Baturraden tapi takut salah kostum?
            <br/><br/>
            Tanya asisten pintar kami! Didukung oleh Gemini AI, kami siap bantu list perlengkapanmu.
          </p>
          <div className="bg-white/10 rounded-xl p-4 text-sm text-nature-100 border border-white/10">
            <p className="font-semibold text-white mb-2">Contoh pertanyaan:</p>
            <ul className="list-disc pl-4 space-y-1 opacity-90">
              <li>"Saya pemula mau ke Prau 2 hari, butuh apa aja?"</li>
              <li>"Rekomendasi alat buat camping 4 orang."</li>
              <li>"Cuaca lagi hujan terus, perlu bawa apa?"</li>
            </ul>
          </div>
        </div>

        {/* Right Side: Chat Interface */}
        <div className="md:w-2/3 bg-gray-50 flex flex-col h-[500px] md:h-auto">
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  
                  {/* Avatar */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'ai' ? 'bg-nature-600 text-white' : 'bg-gray-300 text-gray-600'}`}>
                    {msg.role === 'ai' ? <Bot size={16} /> : <div className="text-xs font-bold">U</div>}
                  </div>

                  {/* Bubble */}
                  <div className={`p-4 rounded-2xl text-sm leading-relaxed shadow-sm ${
                    msg.role === 'user' 
                      ? 'bg-nature-600 text-white rounded-tr-none' 
                      : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'
                  }`}>
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    
                    {/* Recommended Products Quick Add */}
                    {msg.recommendedIds && msg.recommendedIds.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-gray-100">
                        <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Produk Terkait:</p>
                        <div className="flex flex-wrap gap-2">
                          {msg.recommendedIds.map(recId => {
                            // Mencari produk berdasarkan ID atau Nama (case insensitive)
                            const product = products.find(p => 
                              p.id === recId || 
                              p.name.toLowerCase().includes(recId.toLowerCase())
                            );
                            
                            if (!product) return null;
                            return (
                              <button 
                                key={recId}
                                onClick={() => onAddRecommended(product.id)}
                                className="flex items-center gap-2 bg-nature-50 hover:bg-nature-100 text-nature-700 px-3 py-1.5 rounded-lg text-xs font-medium transition border border-nature-200"
                              >
                                {product.name}
                                <span className="text-adventure-600 font-bold">+</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                 <div className="flex gap-3 max-w-[85%]">
                   <div className="w-8 h-8 rounded-full bg-nature-600 text-white flex items-center justify-center">
                     <Bot size={16} />
                   </div>
                   <div className="bg-white p-4 rounded-2xl rounded-tl-none border border-gray-100 shadow-sm flex items-center gap-2 text-gray-500 text-sm">
                     <Loader2 className="animate-spin" size={16} />
                     <span>Sedang mengetik...</span>
                   </div>
                 </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 bg-white border-t border-gray-200">
            <div className="relative flex items-center">
              <input 
                type="text" 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Tulis pertanyaanmu disini..." 
                className="w-full pl-4 pr-12 py-3 bg-gray-100 rounded-xl border-transparent focus:bg-white focus:border-nature-500 focus:ring-2 focus:ring-nature-200 outline-none transition text-sm text-gray-800"
                disabled={isLoading}
              />
              <button 
                onClick={handleSend}
                disabled={!query.trim() || isLoading}
                className="absolute right-2 p-2 bg-nature-600 text-white rounded-lg hover:bg-nature-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GeminiAdvisor;