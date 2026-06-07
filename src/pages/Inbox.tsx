import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Copy, Bot, Send, User, Reply, Search, FileText, MessageSquare, BotOff, Loader2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'agent' | 'ai';
  timestamp: Date;
}

interface Chat {
  id: string;
  clientName: string;
  phone: string;
  lastMessage: string;
  lastMessageAt: Date;
  messages: Message[];
  aiPaused?: boolean;
  unreadCount?: number;
}

export function Inbox() {
  const { user } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [templates, setTemplates] = useState<any[]>([]);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeChat, chats]);

  // Cargar conversaciones desde el backend y templates
  useEffect(() => {
    async function loadData() {
      if (!user) return;
      setLoading(true);

      try {
        // Load templates for quick replies
        const q = query(collection(db, "whatsappTemplates"), where("agentId", "==", user.uid));
        const snap = await getDocs(q);
        const tdata: any[] = [];
        snap.forEach(d => tdata.push({ id: d.id, ...d.data() }));
        setTemplates(tdata);

        // Check if AI is enabled
        const settingsDoc = await getDoc(doc(db, "settings", user.uid));
        if (settingsDoc.exists() && settingsDoc.data().aiEnabled) {
          setAiEnabled(true);
        }

        // Fetch real conversations
        const res = await fetch(`/api/whatsapp/conversations/${user.uid}`);
        if (res.ok) {
          const convs = await res.json();
          if (convs.length > 0) {
            setChats(convs.map((c: any) => ({
              id: c.id,
              clientName: c.clientName || c.clientPhone,
              phone: c.clientPhone,
              lastMessage: c.lastMessage || '',
              lastMessageAt: new Date(c.lastMessageAt || Date.now()),
              messages: [],
              aiPaused: c.aiPaused ?? false,
              unreadCount: c.unreadCount ?? 0,
            })));
          }
        }
      } catch (e) {
        console.error("Error loading inbox data:", e);
      } finally {
        setLoading(false);
      }
    }

    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [user]);

  // Cargar mensajes del chat activo
  useEffect(() => {
    if (!activeChat || !user) return;
    const chat = chats.find(c => c.id === activeChat);
    if (!chat) return;

    const fetchMessages = async () => {
      try {
        const res = await fetch(`/api/whatsapp/messages/${user.uid}/${encodeURIComponent(chat.phone)}`);
        if (res.ok) {
          const msgs = await res.json();
          setChats(prev => prev.map(c =>
            c.id === activeChat
              ? {
                  ...c,
                  messages: msgs.map((m: any) => ({
                    id: m.id || `msg-${m.timestamp}`,
                    text: m.text,
                    sender: m.direction === 'incoming' ? 'user' : 'agent',
                    timestamp: new Date(m.timestamp),
                  })),
                }
              : c
          ));
        }
      } catch (e) { /* polling silently */ }
    };

    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [activeChat, user]);

  const handleSendMessage = async () => {
    if (!messageText.trim() || !activeChat || !user) return;
    const chat = chats.find(c => c.id === activeChat);
    if (!chat) return;

    const textToSend = messageText;
    setMessageText("");

    // Optimistic update
    const optimisticMsg: Message = {
      id: `temp-${Date.now()}`,
      text: textToSend,
      sender: 'agent',
      timestamp: new Date(),
    };
    setChats(prev => prev.map(c =>
      c.id === activeChat ? { ...c, messages: [...c.messages, optimisticMsg], lastMessage: textToSend } : c
    ));

    try {
      await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: user.uid, clientPhone: chat.phone, text: textToSend }),
      });
    } catch (e) {
      console.error('Failed to send message', e);
    }
  };

  const handleToggleAi = async () => {
    if (!activeChat) return;
    const chat = chats.find(c => c.id === activeChat);
    if (!chat) return;

    const newAiPaused = !chat.aiPaused;
    setChats(prev => prev.map(c =>
      c.id === activeChat ? { ...c, aiPaused: newAiPaused } : c
    ));

    try {
      await fetch('/api/whatsapp/ai-toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: activeChat, aiPaused: newAiPaused }),
      });
    } catch (e) { console.error(e); }
  };

  const handleSendTemplate = async (templateContent: string) => {
    if (!activeChat || !user) return;
    const chat = chats.find(c => c.id === activeChat);
    if (!chat) return;

    // Optimistic
    const optimisticMsg: Message = {
      id: `temp-${Date.now()}`,
      text: templateContent,
      sender: 'agent',
      timestamp: new Date(),
    };
    setChats(prev => prev.map(c =>
      c.id === activeChat ? { ...c, messages: [...c.messages, optimisticMsg], lastMessage: templateContent } : c
    ));

    try {
      await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: user.uid, clientPhone: chat.phone, text: templateContent }),
      });
    } catch (e) { console.error(e); }
  };

  const activeChatData = chats.find(c => c.id === activeChat);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">Inbox</h2>
        <p className="text-slate-500">WhatsApp conectado. Chats en tiempo real.</p>
      </div>

      <div className="grid md:grid-cols-12 gap-4 h-[calc(100vh-180px)] min-h-[600px]">
        {/* Chat List */}
        <div className="md:col-span-4 bg-white rounded-xl border flex flex-col">
          <div className="p-4 border-b">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input placeholder="Buscar conversación..." className="pl-9 bg-slate-50" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-slate-500">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Cargando conversaciones...
              </div>
            ) : chats.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                <MessageSquare className="w-10 h-10 mb-3 text-slate-300" />
                <p className="text-sm">No hay conversaciones aún</p>
                <p className="text-xs text-slate-400 mt-1">Los mensajes de WhatsApp aparecerán aquí</p>
              </div>
            ) : (
              chats.map(chat => (
                <div
                  key={chat.id}
                  onClick={() => setActiveChat(chat.id)}
                  className={`p-4 border-b cursor-pointer hover:bg-slate-50 transition-colors ${
                    activeChat === chat.id ? 'bg-blue-50 border-l-2 border-l-blue-600' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-sm text-slate-900">{chat.clientName}</span>
                    <span className="text-xs text-slate-400">
                      {chat.lastMessageAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 truncate">{chat.lastMessage}</p>
                  {chat.unreadCount ? (
                    <span className="inline-block mt-1 bg-blue-600 text-white text-xs rounded-full px-2 py-0.5">
                      {chat.unreadCount}
                    </span>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Chat Area */}
        {activeChatData ? (
          <div className="md:col-span-8 bg-white rounded-xl border flex flex-col">
            {/* Chat Header */}
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900">{activeChatData.clientName}</h3>
                <p className="text-xs text-slate-500">{activeChatData.phone}</p>
              </div>
              <div className="flex items-center gap-2">
                {aiEnabled && (
                  <Button
                    variant={activeChatData.aiPaused ? "outline" : "default"}
                    size="sm"
                    onClick={handleToggleAi}
                    className={
                      activeChatData.aiPaused
                        ? "border-amber-200 text-amber-700 hover:bg-amber-50"
                        : "bg-blue-600 hover:bg-blue-700"
                    }
                  >
                    {activeChatData.aiPaused ? (
                      <><BotOff className="w-4 h-4 mr-2" /> IA Pausada</>
                    ) : (
                      <><Bot className="w-4 h-4 mr-2" /> IA Respondiendo</>
                    )}
                  </Button>
                )}
                <Button variant="outline" size="sm" className="hidden sm:flex">
                  <FileText className="w-4 h-4 mr-2" />
                  Ver Lead Info
                </Button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30">
              {activeChatData.messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                  Sin mensajes aún
                </div>
              ) : (
                activeChatData.messages.map(msg => {
                  const isClient = msg.sender === 'user';
                  return (
                    <div key={msg.id} className={`flex ${isClient ? 'justify-start' : 'justify-end'}`}>
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                          isClient
                            ? 'bg-white border text-slate-800 rounded-bl-none shadow-sm'
                            : 'bg-blue-600 text-white rounded-br-none shadow-sm'
                        }`}
                      >
                        {!isClient && msg.sender === 'ai' && (
                          <div className="flex items-center gap-1 mb-1 text-blue-100 text-xs font-medium">
                            <Bot className="w-3 h-3" /> Respondido por IA
                          </div>
                        )}
                        <p className="text-sm leading-relaxed">{msg.text}</p>
                        <div
                          className={`text-[10px] mt-1 text-right ${
                            isClient ? 'text-slate-400' : 'text-blue-200'
                          }`}
                        >
                          {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="p-4 bg-white border-t">
              {templates.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-3 mb-2 scrollbar-none">
                  {templates.map(t => (
                    <button
                      key={t.id}
                      onClick={() => handleSendTemplate(t.content)}
                      className="whitespace-nowrap px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-full transition-colors flex items-center gap-1"
                    >
                      <Reply className="w-3 h-3" />
                      {t.name}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex items-end gap-2">
                <Textarea
                  value={messageText}
                  onChange={e => setMessageText(e.target.value)}
                  placeholder="Escribe un mensaje para responder manualmente..."
                  className="min-h-[60px] resize-none pb-2 text-sm max-h-[120px]"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!messageText.trim()}
                  className="bg-blue-600 hover:bg-blue-700 h-[60px] w-[60px] rounded-xl shrink-0"
                >
                  <Send className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="md:col-span-8 bg-white rounded-xl border flex items-center justify-center text-slate-500">
            <div className="text-center">
              <MessageSquare className="w-12 h-12 mb-4 text-slate-300 mx-auto" />
              <p>Selecciona una conversación para comenzar</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}