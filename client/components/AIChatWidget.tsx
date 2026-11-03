"use client";
import { useState, useRef, useEffect } from "react";
import { MessageSquare, Send, X, ShieldAlert, RotateCcw } from "lucide-react";
import MarkdownMessage from "./MarkdownMessage";
import { API_V1_URL } from "@/lib/api";

export default function AIChatWidget() {
    const [isOpen, setIsOpen] = useState(false);
    const [chatInput, setChatInput] = useState("");
    const [chatMessages, setChatMessages] = useState<any[]>([
        { id: 1, role: 'assistant', content: "Hello! I am Baitlock AI. I'm actively monitoring your traffic. Any questions about recent threats?" }
    ]);
    const [loading, setLoading] = useState(false);
    const [historyLoaded, setHistoryLoaded] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    const sanitizeContent = (text: string) => {
        if (!text) return text;
        if (
            text.includes("Groq API error") || 
            text.includes("Ollama local API error") || 
            text.includes("429 Client Error") ||
            text.includes("Too Many Requests") ||
            text.includes("LLM_PROVIDER")
        ) {
            return "⏳ *Baitlock AI was momentarily busy. Ready for your next inquiry.*";
        }
        return text;
    };

    useEffect(() => {
        if (isOpen && !historyLoaded) {
            setLoading(true);
            const token = localStorage.getItem('access_token');
            fetch(`${API_V1_URL}/chat/history`, {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            })
                .then(res => res.json())
                .then(data => {
                    if (data.messages && data.messages.length > 0) {
                        const formatted = data.messages.map((m: any) => ({
                            id: m.id,
                            role: m.role,
                            content: sanitizeContent(m.content)
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

    const clearChatHistory = async () => {
        try {
            const token = localStorage.getItem('access_token');
            await fetch(`${API_V1_URL}/chat/history`, {
                method: 'DELETE',
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });
            setChatMessages([
                { id: Date.now(), role: 'assistant', content: "Chat history cleared. How can I help protect you today?" }
            ]);
        } catch (err) {
            console.error("Failed to clear chat", err);
        }
    };

    const sendChatMessage = async (customText?: string) => {
        const text = (customText !== undefined ? customText : chatInput).trim();
        if (!text) return;

        const newUserMessage = { id: Date.now(), role: 'user', content: text };
        setChatMessages(prev => [...prev, newUserMessage]);
        if (customText === undefined) setChatInput("");
        setLoading(true);

        try {
            const token = localStorage.getItem('access_token');
            const res = await fetch(`${API_V1_URL}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
                body: JSON.stringify({
                    role: "user",
                    content: text
                })
            });
            const data = await res.json().catch(() => ({}));
            
            if (data.content) {
                setChatMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', content: sanitizeContent(data.content) }]);
            } else {
                setChatMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', content: "⏳ AI response took longer than expected. Please retry in a few moments." }]);
            }
        } catch (error: any) {
            console.warn("Chat connection issue:", error?.message || error);
            setChatMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', content: "⚠️ Could not connect to Baitlock AI service. Please verify the backend is running." }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
            {/* Chat Box */}
            {isOpen && (
                <div
                    className="mb-4 w-87.5 sm:w-100 h-125 max-h-[70vh] rounded-2xl shadow-[0_30px_70px_-20px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden border border-white/12 backdrop-blur-md transition-all duration-300 animate-fade-in opacity-100"
                    style={{ background: "linear-gradient(180.03deg, #050d1d 5.53%, #0a2047 122.03%)" }}
                >
                    {/* Header */}
                    <div className="p-4 bg-gradient-to-r from-blue-600/25 to-indigo-600/15 border-b border-white/10 flex justify-between items-center">
                        <div className="flex items-center gap-2 text-white">
                            <ShieldAlert size={18} className="text-blue-300" />
                            <span className="font-cormorant font-bold text-xl tracking-wide">Baitlock AI</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={clearChatHistory} 
                                title="Reset / Clear Chat"
                                className="text-white/40 hover:text-white/90 transition-colors p-1 rounded hover:bg-white/10 cursor-pointer"
                            >
                                <RotateCcw size={15} />
                            </button>
                            <button onClick={() => setIsOpen(false)} className="text-white/50 hover:text-white transition-colors cursor-pointer">
                                <X size={20} />
                            </button>
                        </div>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 p-4 overflow-y-auto custom-scrollbar flex flex-col gap-4">
                        {chatMessages.map((msg) => (
                            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[92%] p-3.5 rounded-2xl text-sm font-inter leading-relaxed shadow-lg ${
                                    msg.role === 'user'
                                        ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-br-md shadow-[0_8px_20px_-10px_rgba(37,99,235,0.7)]'
                                        : 'bg-white/8 text-white/95 border border-white/10 rounded-bl-md'
                                }`}>
                                    <MarkdownMessage content={msg.content} isUser={msg.role === 'user'} />
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div className="flex justify-start">
                                <div className="max-w-[85%] p-3 rounded-[9px] rounded-bl-none bg-white/10 border border-white/5 text-blue-200 text-sm flex items-center gap-2">
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                                    </span>
                                    <span>Baitlock AI is analyzing...</span>
                                </div>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    {/* Quick Suggestions */}
                    <div className="px-3 py-1.5 bg-[#000D1F]/70 border-t border-white/5 flex gap-1.5 overflow-x-auto no-scrollbar">
                        <button
                            type="button"
                            onClick={() => sendChatMessage("Add phishing-test.com to my blocklist")}
                            className="text-[11px] whitespace-nowrap px-2.5 py-1 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/20 transition-colors cursor-pointer"
                        >
                            + Block Domain
                        </button>
                        <button
                            type="button"
                            onClick={() => sendChatMessage("Add safe-portal.org to my whitelist")}
                            className="text-[11px] whitespace-nowrap px-2.5 py-1 rounded-full bg-green-500/10 hover:bg-green-500/20 text-green-300 border border-green-500/20 transition-colors cursor-pointer"
                        >
                            + Whitelist Domain
                        </button>
                        <button
                            type="button"
                            onClick={() => sendChatMessage("What is my current threat status?")}
                            className="text-[11px] whitespace-nowrap px-2.5 py-1 rounded-full bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/20 transition-colors cursor-pointer"
                        >
                            Status Check
                        </button>
                    </div>

                    {/* Input Area */}
                    <div className="p-3 bg-[#000D1F]/50 border-t border-white/10 flex gap-2">
                        <input 
                            type="text" 
                            value={chatInput} 
                            onChange={(e) => setChatInput(e.target.value)} 
                            onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
                            placeholder="Ask Baitlock..."
                            className="flex-1 bg-black/40 border border-white/10 text-white placeholder-white/30 rounded-lg px-3 py-2 text-sm focus:outline-none input-ring"
                        />
                        <button
                            onClick={() => sendChatMessage()}
                            disabled={loading || !chatInput.trim()}
                            className="px-3 py-2 btn-primary disabled:opacity-50 text-white rounded-lg flex items-center justify-center cursor-pointer"
                        >
                            <Send size={16} />
                        </button>
                    </div>
                </div>
            )}

            {/* Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 hover:brightness-110 text-white rounded-full flex items-center justify-center shadow-[0_10px_30px_-6px_rgba(37,99,235,0.6)] border border-white/20 transition-transform hover:scale-105 active:scale-95"
            >
                {isOpen ? <X size={24} /> : <MessageSquare size={24} />}
            </button>
        </div>
    );
}
