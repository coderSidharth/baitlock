"use client";
import { useState, useRef, useEffect } from "react";
import { MessageSquare, Send, X, ShieldAlert } from "lucide-react";

export default function AIChatWidget() {
    const [isOpen, setIsOpen] = useState(false);
    const [chatInput, setChatInput] = useState("");
    const [chatMessages, setChatMessages] = useState<any[]>([
        { id: 1, role: 'assistant', content: "Hello! I am Baitlock AI. I'm actively monitoring your traffic. Any questions about recent threats?" }
    ]);
    const [loading, setLoading] = useState(false);
    const [historyLoaded, setHistoryLoaded] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen && !historyLoaded) {
            setLoading(true);
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
            const token = localStorage.getItem('access_token');
            fetch(`${apiUrl}/api/v1/chat/history`, {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            })
                .then(res => res.json())
                .then(data => {
                    if (data.messages && data.messages.length > 0) {
                        const formatted = data.messages.map((m: any) => ({
                            id: m.id,
                            role: m.role,
                            content: m.content
                        }));
                        setChatMessages(formatted);
                    }
                    setHistoryLoaded(true);
                    setLoading(false);
                })
                .catch(err => {
                    console.error("Failed to load chat history", err);
                    setHistoryLoaded(true);
                    setLoading(false);
                });
        }
    }, [isOpen, historyLoaded]);

    useEffect(() => {
        if (isOpen && chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [chatMessages, isOpen]);

    const sendChatMessage = async () => {
        if (!chatInput.trim()) return;

        const newUserMessage = { id: Date.now(), role: 'user', content: chatInput };
        setChatMessages(prev => [...prev, newUserMessage]);
        setChatInput("");
        setLoading(true);

        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
            const token = localStorage.getItem('access_token');
            const res = await fetch(`${apiUrl}/api/v1/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
                body: JSON.stringify({
                    role: "user",
                    content: chatInput
                })
            });
            const data = await res.json();
            
            if (data.content) {
                setChatMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', content: data.content }]);
            } else {
                setChatMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', content: "Sorry, I couldn't process that." }]);
            }
            setLoading(false);
        } catch (error) {
            console.error(error);
            setLoading(false);
            setChatMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', content: "An error occurred while connecting to Baitlock." }]);
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
            {/* Chat Box */}
            {isOpen && (
                <div 
                    className="mb-4 w-87.5 sm:w-100 h-125 max-h-[70vh] rounded-[15px] shadow-2xl flex flex-col overflow-hidden border border-white/20 backdrop-blur-md transition-all duration-300 animate-in slide-in-from-bottom-5 opacity-100"
                    style={{ background: "linear-gradient(180.03deg, #000D1F 5.53%, #00214D 122.03%)" }}
                >
                    {/* Header */}
                    <div className="p-4 bg-[#0048A6]/30 border-b border-white/10 flex justify-between items-center">
                        <div className="flex items-center gap-2 text-white">
                            <ShieldAlert size={18} className="text-blue-300" />
                            <span className="font-cormorant font-bold text-xl tracking-wide">Baitlock AI</span>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="text-white/50 hover:text-white transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 p-4 overflow-y-auto custom-scrollbar flex flex-col gap-4">
                        {chatMessages.map((msg) => (
                            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] p-3 rounded-[9px] text-[15px] font-inter leading-relaxed ${
                                    msg.role === 'user' 
                                        ? 'bg-[#0048A6] text-white rounded-br-none' 
                                        : 'bg-white/10 text-white/90 border border-white/5 rounded-bl-none'
                                }`}>
                                    {msg.content}
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div className="flex justify-start">
                                <div className="max-w-[85%] p-3 rounded-[9px] rounded-bl-none bg-white/10 border border-white/5 text-white/50 text-sm animate-pulse">
                                    Analyzing...
                                </div>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="p-3 bg-[#000D1F]/50 border-t border-white/10 flex gap-2">
                        <input 
                            type="text" 
                            value={chatInput} 
                            onChange={(e) => setChatInput(e.target.value)} 
                            onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
                            placeholder="Ask Baitlock..." 
                            className="flex-1 bg-[#12141A] border border-white/10 text-white placeholder-white/30 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-white/30 transition-colors"
                        />
                        <button 
                            onClick={sendChatMessage} 
                            disabled={loading || !chatInput.trim()}
                            className="px-3 py-2 bg-[#0048A6] hover:bg-[#003882] disabled:opacity-50 text-white rounded-md transition-colors flex items-center justify-center"
                        >
                            <Send size={16} />
                        </button>
                    </div>
                </div>
            )}

            {/* Toggle Button */}
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="w-14 h-14 bg-linear-to-r from-[#003882] to-[#0048A6] hover:brightness-110 text-white rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(0,113,255,0.4)] border border-white/20 transition-transform hover:scale-105 active:scale-95"
            >
                {isOpen ? <X size={24} /> : <MessageSquare size={24} />}
            </button>
        </div>
    );
}
