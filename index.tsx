import React, { useState, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type, GenerateContentResponse } from '@google/genai';
import { 
  Send, 
  FileUp, 
  Bot, 
  User, 
  Trash2, 
  FileText, 
  CheckCircle2, 
  Loader2,
  ExternalLink,
  MessageSquare,
  BookOpen,
  History,
  Table,
  Presentation,
  PlusCircle,
  MessageCircle,
  X,
  MapPin,
  Phone,
  Mail
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import * as mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';

// Configuração do PDF.js
// @ts-ignore
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

const OPCO_LOGO_URL = 'https://raw.githubusercontent.com/SurionPt/OCPCO/refs/heads/main/esfera%2050x47.png';

interface Document {
  id: string;
  name: string;
  content: string;
  size: string;
  type: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string; // ISO string for storage
}

interface Chat {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
}

const STORAGE_KEY = 'opco_buddy_chats';

const App = () => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load chats from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setChats(parsed);
        if (parsed.length > 0) {
          setActiveChatId(parsed[0].id);
        } else {
          createNewChat();
        }
      } catch (e) {
        console.error("Erro ao carregar histórico:", e);
        createNewChat();
      }
    } else {
      createNewChat();
    }
  }, []);

  // Save chats to localStorage whenever they change
  useEffect(() => {
    if (chats.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
    }
  }, [chats]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chats, activeChatId, isTyping]);

  const activeChat = chats.find(c => c.id === activeChatId) || null;
  const messages = activeChat ? activeChat.messages : [];

  const createNewChat = () => {
    const newChat: Chat = {
      id: Date.now().toString(),
      title: 'Nova Conversa',
      messages: [
        {
          id: '1',
          role: 'assistant',
          content: 'Bem-vindo à **OPCO**. Sou o **OPCO Buddy**, o seu Assistente de Conhecimento Inteligente. \n\nA minha função é analisar de forma **abrangente e detalhada** qualquer documento que carregue, fornecendo respostas baseadas inteiramente na sua base de dados pessoal ou empresarial. \n\nCarregue os seus ficheiros e pergunte-me o que desejar em qualquer idioma.',
          timestamp: new Date().toISOString(),
        }
      ],
      createdAt: new Date().toISOString()
    };
    setChats(prev => [newChat, ...prev]);
    setActiveChatId(newChat.id);
  };

  const deleteChat = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const filtered = chats.filter(c => c.id !== id);
    setChats(filtered);
    if (activeChatId === id) {
      if (filtered.length > 0) {
        setActiveChatId(filtered[0].id);
      } else {
        createNewChat();
      }
    }
  };

  const extractTextFromPDF = async (data: ArrayBuffer): Promise<string> => {
    // @ts-ignore
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      fullText += textContent.items.map((item: any) => item.str).join(' ') + '\n';
    }
    return fullText;
  };

  const extractTextFromDOCX = async (data: ArrayBuffer): Promise<string> => {
    const result = await mammoth.extractRawText({ arrayBuffer: data });
    return result.value;
  };

  const extractTextFromXLSX = async (data: ArrayBuffer): Promise<string> => {
    const workbook = XLSX.read(data, { type: 'array' });
    let fullText = '';
    workbook.SheetNames.forEach(sheetName => {
      const worksheet = workbook.Sheets[sheetName];
      fullText += `--- Folha: ${sheetName} ---\n`;
      fullText += XLSX.utils.sheet_to_txt(worksheet) + '\n';
    });
    return fullText;
  };

  const extractTextFromPPTX = async (data: ArrayBuffer): Promise<string> => {
    const zip = await JSZip.loadAsync(data);
    let fullText = '';
    const slideEntries = Object.keys(zip.files).filter(name => name.startsWith('ppt/slides/slide') && name.endsWith('.xml'));
    
    slideEntries.sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)?.[0] || '0');
      const numB = parseInt(b.match(/\d+/)?.[0] || '0');
      return numA - numB;
    });

    for (const slidePath of slideEntries) {
      const content = await zip.file(slidePath)?.async('text');
      if (content) {
        const slideNum = slidePath.match(/\d+/)?.[0];
        fullText += `--- Slide ${slideNum} ---\n`;
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(content, "text/xml");
        const textNodes = xmlDoc.getElementsByTagName("a:t");
        for (let i = 0; i < textNodes.length; i++) {
          fullText += (textNodes[i].textContent || '') + ' ';
        }
        fullText += '\n';
      }
    }
    return fullText;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    setIsUploading(true);
    for (const file of Array.from(files)) {
      try {
        let content = '';
        const extension = file.name.split('.').pop()?.toLowerCase();
        const buffer = await file.arrayBuffer();

        if (extension === 'pdf') {
          content = await extractTextFromPDF(buffer);
        } else if (extension === 'docx') {
          content = await extractTextFromDOCX(buffer);
        } else if (extension === 'xlsx' || extension === 'xls') {
          content = await extractTextFromXLSX(buffer);
        } else if (extension === 'pptx') {
          content = await extractTextFromPPTX(buffer);
        } else if (['txt', 'md', 'csv', 'json', 'xml'].includes(extension || '')) {
          content = await file.text();
        } else {
          try {
            content = await file.text();
          } catch {
            content = "[Ficheiro binário não suportado]";
          }
        }

        if (content.trim()) {
          const newDoc: Document = {
            id: Math.random().toString(36).substr(2, 9),
            name: file.name,
            content: content,
            size: (file.size / 1024).toFixed(1) + ' KB',
            type: extension || 'file'
          };
          setDocuments(prev => [...prev, newDoc]);
        }
      } catch (error) {
        console.error(`Erro ao processar ficheiro ${file.name}:`, error);
      }
    }
    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeDocument = (id: string) => {
    setDocuments(prev => prev.filter(doc => doc.id !== id));
  };

  const getDocIcon = (type: string) => {
    switch (type) {
      case 'xlsx': case 'xls': case 'csv': return <Table size={16} />;
      case 'pptx': case 'ppt': return <Presentation size={16} />;
      default: return <FileText size={16} />;
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isTyping || !activeChatId) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date().toISOString(),
    };

    const currentInput = input;
    const assistantMsgId = (Date.now() + 1).toString();
    setInput('');
    setIsTyping(true);

    // Adiciona a mensagem do utilizador e um placeholder para a resposta do assistente
    setChats(prev => prev.map(chat => {
      if (chat.id === activeChatId) {
        const isFirstUserMessage = chat.messages.filter(m => m.role === 'user').length === 0;
        return {
          ...chat,
          title: isFirstUserMessage ? currentInput.substring(0, 30) + (currentInput.length > 30 ? '...' : '') : chat.title,
          messages: [...chat.messages, userMessage, {
            id: assistantMsgId,
            role: 'assistant',
            content: '',
            timestamp: new Date().toISOString()
          }]
        };
      }
      return chat;
    }));

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const context = documents.length > 0 
        ? `Você tem acesso à seguinte base de conhecimento extraída dos documentos carregados pelo utilizador:\n${documents.map(d => `--- INÍCIO DO DOCUMENTO: ${d.name} ---\n${d.content}\n--- FIM DO DOCUMENTO: ${d.name} ---`).join('\n\n')}\n\nInstrução Importante: Utilize as informações acima de forma abrangente para responder à questão. Não se limite a uma área técnica se o conteúdo dos documentos for de outro domínio.`
        : "O utilizador não carregou documentos de contexto. Responda como um assistente inteligente e prestativo da OPCO.";

      const responseStream = await ai.models.generateContentStream({
        model: 'gemini-3-flash-preview', 
        contents: [
          {
            parts: [{
              text: `${context}\n\nPergunta do utilizador: ${currentInput}`
            }]
          }
        ],
        config: {
          systemInstruction: "Você é o OPCO Buddy, o Assistente Digital da OPCO (https://opco.pt/). A sua função principal é processar e explicar de forma abrangente e imparcial qualquer informação presente nos documentos fornecidos pelo utilizador. Não force respostas direcionadas a Lean Management ou Consultoria se o tema do documento for diferente. Adapte-se totalmente ao contexto dos ficheiros. O seu tom deve ser profissional, claro e rigoroso. Use o Português de Portugal como língua preferencial, mas responda noutros idiomas se solicitado.",
          temperature: 0.7,
        }
      });

      let fullContent = '';
      for await (const chunk of responseStream) {
        const chunkText = chunk.text || "";
        fullContent += chunkText;
        
        // Atualiza a interface com cada pedaço de texto recebido (streaming)
        setChats(prev => prev.map(chat => {
          if (chat.id === activeChatId) {
            return {
              ...chat,
              messages: chat.messages.map(m => 
                m.id === assistantMsgId ? { ...m, content: fullContent } : m
              )
            };
          }
          return chat;
        }));
      }

    } catch (error) {
      console.error('Erro na API:', error);
      const errorMessage = 'Ocorreu um erro técnico na comunicação com os sistemas OPCO. Por favor, tente novamente.';
      setChats(prev => prev.map(chat => {
        if (chat.id === activeChatId) {
          return {
            ...chat,
            messages: chat.messages.map(m => 
              m.id === assistantMsgId ? { ...m, content: errorMessage } : m
            )
          };
        }
        return chat;
      }));
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-screen bg-[#f8f9fa] overflow-hidden">
      {/* Sidebar - Knowledge Base & History */}
      <aside className="w-full md:w-80 bg-black border-r border-slate-800 flex flex-col shrink-0 relative overflow-hidden">
        {/* Subtil Neural Background Pattern */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.08]" style={{ 
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='120' height='120' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cg stroke='%23ca0607' stroke-width='0.4' fill='none'%3E%3Cpath d='M10 10 L30 40 L60 20 L90 50'/%3E%3Cpath d='M30 40 L10 80'/%3E%3Cpath d='M60 20 L80 80'/%3E%3Cpath d='M90 50 L40 90 L10 10'/%3E%3Ccircle cx='10' cy='10' r='1' fill='%23ca0607'/%3E%3Ccircle cx='30' cy='40' r='1' fill='%23ca0607'/%3E%3Ccircle cx='60' cy='20' r='1' fill='%23ca0607'/%3E%3Ccircle cx='90' cy='50' r='1' fill='%23ca0607'/%3E%3Ccircle cx='10' cy='80' r='1' fill='%23ca0607'/%3E%3Ccircle cx='80' cy='80' r='1' fill='%23ca0607'/%3E%3Ccircle cx='40' cy='90' r='1' fill='%23ca0607'/%3E%3C/g%3E%3C/svg%3E")`,
          backgroundSize: '180px 180px'
        }}></div>

        <div className="relative z-10 flex flex-col h-full">
          <div className="p-6 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2 text-white font-bold text-xl tracking-tighter">
              <div className="w-10 h-10 flex items-center justify-center">
                <img src={OPCO_LOGO_URL} alt="OPCO Logo" className="w-full h-full object-contain" />
              </div>
              <div className="flex flex-col">
                <span className="text-white text-lg"><span className="text-[#ca0607]">OPCO</span> Buddy</span>
              </div>
            </div>
            <a href="https://opco.pt" target="_blank" rel="noopener noreferrer" className="text-white/40 hover:text-[#ca0607] transition-colors">
              <ExternalLink size={20} />
            </a>
          </div>

          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar flex flex-col gap-8">
            {/* New Chat Button */}
            <button 
              onClick={createNewChat}
              className="flex items-center gap-3 w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white hover:bg-white/10 transition-all text-sm font-semibold shadow-sm"
            >
              <PlusCircle size={18} className="text-[#ca0607]" />
              <span>Nova Conversa</span>
            </button>

            {/* Conversations History */}
            <section>
              <div className="flex items-center gap-2 mb-4 text-slate-500 font-bold text-[10px] uppercase tracking-[0.2em]">
                <MessageCircle size={14} className="text-[#ca0607]" />
                <span>Conversas Recentes</span>
              </div>
              <div className="space-y-2">
                {chats.map(chat => (
                  <div 
                    key={chat.id} 
                    onClick={() => setActiveChatId(chat.id)}
                    className={`group relative p-3 rounded-xl cursor-pointer transition-all border ${
                      activeChatId === chat.id 
                        ? 'bg-[#ca0607]/10 border-[#ca0607]/30 text-white' 
                        : 'bg-transparent border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-200'
                    }`}
                  >
                    <p className="text-xs font-medium truncate pr-6">{chat.title}</p>
                    <button 
                      onClick={(e) => deleteChat(chat.id, e)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {/* Knowledge Base */}
            <section>
              <div className="flex items-center gap-2 mb-4 text-slate-500 font-bold text-[10px] uppercase tracking-[0.2em]">
                <BookOpen size={14} className="text-[#ca0607]" />
                <span>Conhecimento ({documents.length})</span>
              </div>

              {documents.length === 0 ? (
                <div className="text-center py-8 px-4 bg-slate-900/40 rounded-2xl border border-slate-800 border-dashed">
                  <FileUp className="mx-auto mb-2 text-slate-700" size={24} />
                  <p className="text-[10px] text-slate-500 leading-relaxed uppercase tracking-wider">Arraste documentos para análise</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {documents.map(doc => (
                    <div key={doc.id} className="group p-2 bg-slate-900/60 border border-slate-800 rounded-lg hover:border-[#ca0607]/50 transition-all animate-fade-in relative">
                      <div className="flex items-start gap-2">
                        <div className="p-1.5 bg-[#ca0607]/10 text-[#ca0607] rounded">
                          {getDocIcon(doc.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-medium text-slate-300 truncate pr-4">{doc.name}</p>
                          <p className="text-[9px] text-slate-600 font-mono uppercase">{doc.size}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => removeDocument(doc.id)}
                        className="absolute top-2 right-2 text-slate-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <div className="p-4 bg-black border-t border-slate-800">
            <label className={`
              flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl font-bold text-sm transition-all cursor-pointer
              ${isUploading ? 'bg-slate-800 text-slate-500' : 'bg-[#ca0607] text-white hover:bg-[#b00506] shadow-lg shadow-red-900/10'}
            `}>
              {isUploading ? <Loader2 size={18} className="animate-spin" /> : <FileUp size={18} />}
              <span>{isUploading ? 'ANALISANDO...' : 'CARREGAR FICHEIROS'}</span>
              <input 
                type="file" 
                className="hidden" 
                accept=".pdf,.docx,.doc,.xlsx,.xls,.pptx,.ppt,.txt,.md,.csv,.json,.xml" 
                multiple 
                onChange={handleFileUpload}
                disabled={isUploading}
                ref={fileInputRef}
              />
            </label>
          </div>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col bg-white relative">
        <header className="h-20 border-b border-slate-100 flex items-center justify-between px-8 bg-white/80 backdrop-blur-md z-10 sticky top-0">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 flex items-center justify-center p-1">
                <img src={OPCO_LOGO_URL} alt="OPCO Buddy" className="w-full h-full object-contain" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></div>
            </div>
            <div>
              <h2 className="text-base font-bold text-black tracking-tight uppercase italic">OPCO Buddy</h2>
              <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                OPCO DIGITAL SYSTEMS
              </div>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-full border border-slate-100">
             <History size={14} className="text-slate-400" />
             <span className="text-[10px] font-bold text-slate-500 uppercase">Flash Engine Ativa</span>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
              <div className={`flex gap-4 max-w-[90%] md:max-w-[75%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center shadow-sm border overflow-hidden ${
                  msg.role === 'user' 
                    ? 'bg-black text-[#ca0607] border-slate-800' 
                    : 'bg-white border-slate-100'
                }`}>
                  {msg.role === 'user' ? <User size={20} /> : <img src={OPCO_LOGO_URL} alt="Buddy" className="w-full h-full p-1.5 object-contain" />}
                </div>
                <div className={`p-5 rounded-2xl shadow-sm border ${
                  msg.role === 'user' 
                    ? 'bg-black text-white border-slate-800' 
                    : 'bg-white border-slate-100 text-slate-800 min-h-[50px]'
                }`}>
                  <div className={`prose prose-sm max-w-none ${msg.role === 'user' ? 'prose-invert' : 'prose-slate'}`}>
                    <ReactMarkdown 
                      components={{
                        p: ({node, ...props}) => <p className="m-0 leading-relaxed font-normal" {...props} />,
                        strong: ({node, ...props}) => <strong className="text-[#ca0607] font-bold" {...props} />,
                        a: ({node, ...props}) => <a className="text-[#ca0607] underline font-medium" {...props} />
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                  <div className={`text-[9px] mt-3 font-bold uppercase tracking-widest ${msg.role === 'user' ? 'text-slate-500' : 'text-slate-400'}`}>
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {isTyping && !messages.find(m => m.id === (messages.length > 0 ? messages[messages.length-1].id : '') && m.content !== '') && (
            <div className="flex justify-start animate-fade-in">
              <div className="flex gap-4 max-w-[75%]">
                <div className="shrink-0 w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center overflow-hidden">
                  <img src={OPCO_LOGO_URL} alt="Buddy" className="w-full h-full p-1.5 object-contain" />
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 flex gap-1.5 items-center">
                  <div className="w-2 h-2 bg-[#ca0607] rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-[#ca0607] rounded-full animate-bounce [animation-delay:0.2s]"></div>
                  <div className="w-2 h-2 bg-[#ca0607] rounded-full animate-bounce [animation-delay:0.4s]"></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-8 pt-2 bg-white border-t border-slate-100">
          <form onSubmit={handleSendMessage} className="relative max-w-5xl mx-auto group">
            <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-focus-within:text-[#ca0607] transition-colors">
              <MessageSquare size={20} />
            </div>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pergunte sobre qualquer documento ou tema..."
              className="w-full bg-slate-50 border border-slate-200 rounded-3xl py-5 pl-14 pr-16 focus:outline-none focus:ring-4 focus:ring-[#ca0607]/5 focus:border-[#ca0607] transition-all text-slate-800 placeholder:text-slate-400 font-medium"
              disabled={isTyping}
            />
            <button
              type="submit"
              disabled={!input.trim() || isTyping}
              className={`absolute right-3 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center rounded-2xl transition-all shadow-xl ${
                !input.trim() || isTyping 
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                : 'bg-[#ca0607] text-white hover:bg-black hover:scale-105 active:scale-95'
              }`}
            >
              <Send size={22} />
            </button>
          </form>
          
          <div className="mt-6 flex flex-col items-center gap-4">
            <div className="flex flex-wrap items-center justify-center gap-6 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
              <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-[#ca0607]" />
                  <span>Base de Dados Abrangente</span>
              </div>
              <div className="w-1.5 h-1.5 bg-slate-200 rounded-full"></div>
              <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-black rounded-full"></div>
                  <span>Confidencialidade OPCO</span>
              </div>
              <div className="w-1.5 h-1.5 bg-slate-200 rounded-full"></div>
              <div className="hover:text-[#ca0607] cursor-pointer transition-colors">OPCO DIGITAL</div>
            </div>

            {/* Dados da Empresa */}
            <div className="flex flex-col items-center gap-2 text-center border-t border-slate-50 pt-4 w-full max-w-2xl">
              <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium italic">
                <MapPin size={10} className="text-[#ca0607]" />
                Rua José Augusto Coelho, Nº 158, 2925-539 Vila Nogueira de Azeitão
              </div>
              <div className="flex flex-wrap items-center justify-center gap-4 text-[10px] font-bold text-slate-600">
                <div className="flex items-center gap-1.5">
                  <Phone size={10} className="text-[#ca0607]" />
                  <span>+351 210 152 492</span>
                </div>
                <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
                <div className="flex items-center gap-1.5">
                  <Mail size={10} className="text-[#ca0607]" />
                  <a href="mailto:opco@opco.pt" className="hover:text-[#ca0607] transition-colors uppercase tracking-tighter">opco@opco.pt</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

createRoot(document.getElementById('root')!).render(<App />);