import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Copy, Bot, Send, User, Reply, Search, FileText, MessageSquare } from "lucide-react";
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
}

export function Inbox() {
  const { user } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [templates, setTemplates] = useState<any[]>([]);
  const [aiEnabled, setAiEnabled] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeChat, chats]);

  useEffect(() => {
    async function loadData() {
      if (!user) return;
      
      // Load templates for quick replies
      const q = query(collection(db, "whatsappTemplates"), where("agentId", "==", user.uid));
      const snap = await getDocs(q);
      const tdata: any[] = [];
      snap.forEach(d => tdata.push({ id: d.id, ...d.data() }));
      setTemplates(tdata);

      // check if AI is enabled
      const settingsDoc = await getDoc(doc(db, "settings", user.uid));
      if (settingsDoc.exists() && settingsDoc.data().aiEnabled) {
        setAiEnabled(true);
      }

      // Mock some chats for visualization
      setChats([
        {
          id: "1",
          clientName: "María López",
          phone: "+54 9 11 1234-5678",
          lastMessage: "¡Excelente! Me gustaría agendar una visita.",
          lastMessageAt: new Date(Date.now() - 1000 * 60 * 5),
          messages: [
            { id: "m1", text: "Hola, vi la casa en Palermo, ¿sigue disponible?", sender: "user", timestamp: new Date(Date.now() - 1000 * 60 * 60) },
            { id: "m2", text: "¡Hola María! Sí, sigue disponible. Tiene 3 habitaciones y un patio amplio. ¿Te gustaría saber el precio o más detalles?", sender: "ai", timestamp: new Date(Date.now() - 1000 * 60 * 55) },
            { id: "m3", text: "Me interesa verla. ¿Cuándo se puede?", sender: "user", timestamp: new Date(Date.now() - 1000 * 60 * 15) },
            { id: "m4", text: "Podemos agendar para mañana por la tarde o el sábado a la mañana. ¿Qué día prefieres?", sender: "ai", timestamp: new Date(Date.now() - 1000 * 60 * 10) },
            { id: "m5", text: "¡Excelente! Me gustaría agendar una visita para el sábado.", sender: "user", timestamp: new Date(Date.now() - 1000 * 60 * 5) }
          ]
        },
        {
          id: "2",
          clientName: "Carlos Gómez",
          phone: "+54 9 11 9876-5432",
          lastMessage: "¿Aceptan mascotas?",
          lastMessageAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
          messages: [
            { id: "m1", text: "Me interesa el departamento de Belgrano.", sender: "user", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3) },
            { id: "m2", text: "¡Hola Carlos! Es una excelente opción. ¿Qué información te gustaría saber?", sender: "ai", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2.5) },
            { id: "m3", text: "¿Aceptan mascotas?", sender: "user", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2) }
          ]
        }
      ]);
      setActiveChat("1");
    }
    loadData();
  }, [user]);

  const handleSendMessage = () => {
    if (!messageText.trim() || !activeChat) return;
    
    setChats(chats.map(chat => {
      if (chat.id === activeChat) {
        return {
          ...chat,
          messages: [
            ...chat.messages,
            { id: Date.now().toString(), text: messageText, sender: "agent", timestamp: new Date() }
          ],
          lastMessage: messageText,
          lastMessageAt: new Date()
        };
      }
      return chat;
    }));
    setMessageText("");
  };

  const handleSendTemplate = (content: string) => {
    setMessageText(content);
  };

  const currentChat = chats.find(c => c.id === activeChat);

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col">
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Mensajes y Chat</h2>
          <p className="text-slate-500">
            Gestiona conversaciones y supervisa las respuestas de la IA.
          </p>
        </div>
        {aiEnabled && (
          <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-full text-sm font-medium border border-blue-100">
            <Bot className="w-4 h-4" />
            Asistente IA Activo
          </div>
        )}
      </div>

      <div className="flex-1 border rounded-xl overflow-hidden bg-white flex shadow-sm">
        {/* Chat List */}
        <div className="w-1/3 border-r flex flex-col bg-slate-50/50 hidden md:flex">
          <div className="p-4 border-b bg-white">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input placeholder="Buscar chats..." className="pl-9 bg-slate-50 border-slate-200" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {chats.map(chat => (
              <div 
                key={chat.id} 
                onClick={() => setActiveChat(chat.id)}
                className={`p-4 border-b cursor-pointer transition-colors ${activeChat === chat.id ? 'bg-blue-50/50 border-l-4 border-l-blue-600' : 'hover:bg-slate-100'}`}
              >
                <div className="flex justify-between items-start mb-1">
                  <h4 className="font-semibold text-slate-900">{chat.clientName}</h4>
                  <span className="text-xs text-slate-500">
                    {chat.lastMessageAt.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </span>
                </div>
                <p className="text-xs text-slate-500 truncate mb-1">{chat.phone}</p>
                <p className="text-sm text-slate-600 truncate">{chat.lastMessage}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Chat Area */}
        {currentChat ? (
          <div className="flex-1 flex flex-col bg-white">
            {/* Header */}
            <div className="p-4 border-b flex items-center justify-between bg-white">
              <div>
                <h3 className="font-bold text-lg text-slate-900">{currentChat.clientName}</h3>
                <p className="text-sm text-slate-500">{currentChat.phone}</p>
              </div>
              <Button variant="outline" size="sm" className="hidden sm:flex">
                <FileText className="w-4 h-4 mr-2" />
                Ver Lead Info
              </Button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30">
              {currentChat.messages.map(msg => {
                const isClient = msg.sender === 'user';
                return (
                  <div key={msg.id} className={`flex ${isClient ? 'justify-start' : 'justify-end'}`}>
                    <div className={`max-w-[75%] rounded-2xl px-4 py-2 ${isClient ? 'bg-white border text-slate-800 rounded-bl-none shadow-sm' : 'bg-blue-600 text-white rounded-br-none shadow-sm'}`}>
                      {!isClient && msg.sender === 'ai' && (
                         <div className="flex items-center gap-1 mb-1 text-blue-100 text-xs font-medium">
                           <Bot className="w-3 h-3" /> Respondido por IA
                         </div>
                      )}
                       <p className="text-sm leading-relaxed">{msg.text}</p>
                       <div className={`text-[10px] mt-1 text-right ${isClient ? 'text-slate-400' : 'text-blue-200'}`}>
                         {msg.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                       </div>
                    </div>
                  </div>
                );
              })}
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
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Escribe un mensaje para responder manualmente o intervenir..."
                  className="min-h-[60px] resize-none pb-2 text-sm max-h-[120px]"
                  onKeyDown={(e) => {
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
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 bg-slate-50/50">
            <MessageSquare className="w-12 h-12 mb-4 text-slate-300" />
            <p>Selecciona una conversación para comenzar</p>
          </div>
        )}
      </div>
    </div>
  );
}
