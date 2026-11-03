"use client";
import { useState, useRef, useEffect } from "react";
import { MessageSquare, Send, X, Shield, RotateCcw } from "lucide-react";
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
                <div className="mb-4 w-87.5 sm:w-100 h-125 max-h-[70vh] rounded-xl shadow-xl flex flex-col overflow-hidden border border-border bg-card animate-fade-in">
                    {/* Header */}
                    <div className="p-4 border-b border-border flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <span className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
                                <Shield size={15} className="text-primary-foreground" strokeWidth={2.2} />
                            </span>
                            <span className="font-semibold text-base tracking-tight">Baitlock AI</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={clearChatHistory}
                                title="Reset / Clear Chat"
                                className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-accent cursor-pointer"
                            >
                                <RotateCcw size={15} />
                            </button>
                            <button onClick={() => setIsOpen(false)} aria-label="Close" className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-accent cursor-pointer">
                                <X size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 p-4 overflow-y-auto custom-scrollbar flex flex-col gap-3">
                        {chatMessages.map((msg) => (
                            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[92%] p-3 rounded-xl text-sm leading-relaxed ${
                                    msg.role === 'user'
                                        ? 'bg-primary text-primary-foreground rounded-br-sm'
                                        : 'bg-muted text-foreground border border-border rounded-bl-sm'
                                }`}>
                                    <MarkdownMessage content={msg.content} isUser={msg.role === 'user'} />
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div className="flex justify-start">
                                <div className="max-w-[85%] p-3 rounded-xl rounded-bl-sm bg-muted border border-border text-muted-foreground text-sm flex items-center gap-2">
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                                    </span>
                                    <span>Baitlock AI is analyzing...</span>
                                </div>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    {/* Quick Suggestions */}
                    <div className="px-3 py-2 border-t border-border flex gap-1.5 overflow-x-auto no-scrollbar">
                        <button
                            type="button"
                            onClick={() => sendChatMessage("Add phishing-test.com to my blocklist")}
                            className="text-[11px] whitespace-nowrap px-2.5 py-1 rounded-full bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/20 transition-colors cursor-pointer"
                        >
                            + Block Domain
                        </button>
                        <button
                            type="button"
                            onClick={() => sendChatMessage("Add safe-portal.org to my whitelist")}
                            className="text-[11px] whitespace-nowrap px-2.5 py-1 rounded-full bg-success/10 hover:bg-success/20 text-success border border-success/20 transition-colors cursor-pointer"
                        >
                            + Whitelist Domain
                        </button>
                        <button
                            type="button"
                            onClick={() => sendChatMessage("What is my current threat status?")}
                            className="text-[11px] whitespace-nowrap px-2.5 py-1 rounded-full bg-muted hover:bg-accent text-muted-foreground border border-border transition-colors cursor-pointer"
                        >
                            Status Check
                        </button>
                    </div>

                    {/* Input Area */}
                    <div className="p-3 border-t border-border flex gap-2">
                        <input
                            type="text"
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
                            placeholder="Ask Baitlock..."
                            className="flex-1 input-base px-3 py-2 text-sm"
                        />
                        <button
                            onClick={() => sendChatMessage()}
                            disabled={loading || !chatInput.trim()}
                            className="px-3 py-2 btn-primary rounded-lg flex items-center justify-center cursor-pointer disabled:opacity-50"
                        >
                            <Send size={16} />
                        </button>
                    </div>
                </div>
            )}

            {/* Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                aria-label="Open Baitlock AI chat"
                className="w-14 h-14 btn-primary rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95"
            >
                {isOpen ? <X size={24} /> : <MessageSquare size={24} />}
            </button>
        </div>
    );
}
