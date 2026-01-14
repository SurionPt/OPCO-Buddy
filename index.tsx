
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type, GenerateContentResponse, FunctionDeclaration, Modality } from '@google/genai';
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
  Mail,
  Download,
  ChevronDown,
  Globe,
  AlertCircle,
  FileCode,
  Search,
  Menu,
  UploadCloud,
  ImageIcon,
  FileDown,
  Sparkles,
  Film,
  Settings,
  Image as ImageIconAlt,
  Wand2,
  FileBadge
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import * as mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import * as docx from 'docx';
import PptxGenJS from 'pptxgenjs';

// --- Utility Functions ---
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// --- Models & Config ---
const OPCO_LOGO_URL = 'https://raw.githubusercontent.com/SurionPt/OCPCO/refs/heads/main/esfera%2050x47.png';
const NEURAL_BG_URL = 'https://raw.githubusercontent.com/SurionPt/OCPCO/refs/heads/main/neural.jpg';
const STORAGE_KEY = 'opco_buddy_chats_v3';

interface MediaAsset {
  id: string;
  url: string;
  type: 'image' | 'video';
  mimeType: string;
  base64?: string;
}

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
  timestamp: string;
  generatedFiles?: any[];
  imageUrls?: string[];
  videoUrl?: string;
  attachedMedia?: MediaAsset[];
}

interface Chat {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
}

// --- Function Declarations ---
const createTrainingDocTool: FunctionDeclaration = {
  name: 'create_training_document',
  parameters: {
    type: Type.OBJECT,
    description: 'Cria um documento profissional estruturado para formação ou apresentação corporativa.',
    properties: {
      title: { type: Type.STRING, description: 'Título da formação' },
      modules: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: 'Nome do módulo' },
            objectives: { type: Type.ARRAY, items: { type: Type.STRING } },
            content: { type: Type.STRING, description: 'Conteúdo detalhado do módulo' }
          }
        }
      }
    },
    required: ['title', 'modules']
  }
};

const App = () => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [attachedMedia, setAttachedMedia] = useState<MediaAsset[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  // --- Derived State ---
  const activeChat = useMemo(() => chats.find(c => c.id === activeChatId), [chats, activeChatId]);

  // --- Initial Setup ---
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setChats(parsed);
        if (parsed.length > 0) setActiveChatId(parsed[0].id);
      } catch (e) { createNewChat(); }
    } else createNewChat();
  }, []);

  useEffect(() => {
    if (chats.length > 0) localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
  }, [chats]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chats, isTyping]);

  const createNewChat = () => {
    const id = Date.now().toString();
    const newChat: Chat = {
      id,
      title: "Nova Consulta OPCO",
      messages: [{ id: '1', role: 'assistant', content: "Bem-vindo ao OPCO Buddy. Sou o seu assistente inteligente. Carregue documentos para análise ou peça-me para criar manuais e imagens corporativas.", timestamp: new Date().toISOString() }],
      createdAt: new Date().toISOString()
    };
    setChats(prev => [newChat, ...prev]);
    setActiveChatId(id);
  };

  // --- File Processing ---
  // @ts-ignore
  const pdfjsLib = window['pdfjs-dist/build/pdf'] || window.pdfjsLib;

  const processFile = async (file: File): Promise<string> => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    const buffer = await file.arrayBuffer();
    switch (ext) {
      case 'pdf':
        try {
          const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
          let fullText = '';
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            fullText += textContent.items.map((item: any) => item.str).join(' ') + '\n';
          }
          return fullText;
        } catch (e) { return "Erro ao ler PDF."; }
      case 'docx':
        try {
          const result = await mammoth.extractRawText({ arrayBuffer: buffer });
          return result.value;
        } catch (e) { return "Erro ao ler DOCX."; }
      case 'xlsx':
      case 'xls':
        try {
          const wb = XLSX.read(buffer, { type: 'array' });
          return wb.SheetNames.map(n => `Sheet: ${n}\n${XLSX.utils.sheet_to_txt(wb.Sheets[n])}`).join('\n');
        } catch (e) { return "Erro ao ler Excel."; }
      default:
        return await file.text();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setIsUploading(true);
    const filesArray = Array.from(files) as File[];
    for (const f of filesArray) {
      const content = await processFile(f);
      setDocuments(prev => [...prev, {
        id: Math.random().toString(36).substr(2, 9),
        name: f.name,
        content,
        size: `${(f.size / 1024).toFixed(1)} KB`,
        type: f.name.split('.').pop() || 'file'
      }]);
    }
    setIsUploading(false);
  };

  // --- Media Handlers ---
  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const filesArray = Array.from(files) as File[];
    for (const file of filesArray) {
      const base64 = await blobToBase64(file);
      const url = URL.createObjectURL(file);
      setAttachedMedia(prev => [...prev, {
        id: Math.random().toString(36).substr(2, 9),
        url,
        type: file.type.startsWith('video') ? 'video' : 'image',
        mimeType: file.type,
        base64
      }]);
    }
  };

  // --- AI Logic ---
  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!input.trim() && attachedMedia.length === 0) || isTyping || !activeChatId) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      attachedMedia: [...attachedMedia],
      timestamp: new Date().toISOString()
    };

    setChats(prev => prev.map(chat => chat.id === activeChatId ? { ...chat, messages: [...chat.messages, userMessage] } : chat));
    setInput('');
    setAttachedMedia([]);
    setIsTyping(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const currentInput = userMessage.content;
      const media = userMessage.attachedMedia || [];
      const hasImage = media.some(m => m.type === 'image');

      // Note: Video Generation (Veo) removed as it requires Paid API per instructions.
      if (/(video|anima|filme|movimento)/gi.test(currentInput) && hasImage) {
         addAssistantMessage("As funcionalidades de geração de vídeo requerem uma subscrição profissional. Posso ajudá-lo com análise de documentos ou geração de imagens.");
         setIsTyping(false);
         return;
      }

      // 1. Edição de Imagem ou Geração com Flash (Grátis)
      if (/(edita|altera|muda|filtro|remove|adiciona|gera|cria|imagem|foto|logo)/gi.test(currentInput)) {
        setStatusMsg("A processar imagem...");
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: {
            parts: [
              ...(hasImage ? [{ inlineData: { data: media.find(m => m.type === 'image')!.base64!, mimeType: media.find(m => m.type === 'image')!.mimeType } }] : []),
              { text: `${currentInput}. Estilo corporativo para a empresa OPCO.` }
            ]
          }
        });

        let imageUrls: string[] = [];
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) imageUrls.push(`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`);
        }
        
        if (imageUrls.length > 0) {
          addAssistantMessage("Aqui está o resultado processado:", { imageUrls });
        } else {
          addAssistantMessage(response.text || "Processamento concluído.");
        }
        setStatusMsg('');
        return;
      }

      // 2. Chat Normal / RAG / Docs de Formação com Flash
      const context = documents.length > 0 ? "Documentos Base OPCO:\n" + documents.map(d => d.content).join('\n') : "";
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `${context}\n\nUtilizador: ${currentInput}`,
        config: {
          systemInstruction: "És o OPCO Buddy. Especialista em consultoria digital e formação. Responde com base nos documentos carregados.",
          tools: [{ functionDeclarations: [createTrainingDocTool] }]
        }
      });

      let content = response.text || "";
      let files: any[] = [];

      if (response.functionCalls) {
        for (const fc of response.functionCalls) {
          if (fc.name === 'create_training_document') {
            const file = await generateTrainingPDF(fc.args);
            files.push(file);
            content += "\n\n**Manual de Formação OPCO gerado com sucesso.**";
          }
        }
      }

      addAssistantMessage(content, { generatedFiles: files });

    } catch (error: any) {
      addAssistantMessage("Ocorreu um erro técnico. Por favor, tente novamente.");
    } finally {
      setIsTyping(false);
      setStatusMsg('');
    }
  };

  const addAssistantMessage = (content: string, extra = {}) => {
    const msg: Message = {
      id: Date.now().toString(),
      role: 'assistant',
      content,
      timestamp: new Date().toISOString(),
      ...extra
    };
    setChats(prev => prev.map(chat => chat.id === activeChatId ? { ...chat, messages: [...chat.messages, msg] } : chat));
  };

  const generateTrainingPDF = async (args: any) => {
    const doc = new jsPDF();
    doc.setFillColor(202, 6, 7);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255);
    doc.setFontSize(22);
    doc.text("MANUAL DE FORMAÇÃO OPCO", 15, 25);
    
    doc.setTextColor(0);
    doc.setFontSize(16);
    doc.text(args.title, 15, 55);
    
    let y = 70;
    args.modules.forEach((mod: any) => {
      if (y > 250) { doc.addPage(); y = 20; }
      doc.setFontSize(14);
      doc.setTextColor(202, 6, 7);
      doc.text(mod.name, 15, y);
      y += 10;
      doc.setFontSize(10);
      doc.setTextColor(50);
      const lines = doc.splitTextToSize(mod.content, 180);
      doc.text(lines, 15, y);
      y += (lines.length * 6) + 10;
    });

    const blob = doc.output('blob');
    return { name: `Formacao-${args.title}.pdf`, url: URL.createObjectURL(blob), type: 'pdf' };
  };

  return (
    <div className="flex h-[100dvh] bg-slate-50 overflow-hidden font-inter">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#111218] border-r border-slate-800/50 flex flex-col transition-transform duration-300 md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: `url("${NEURAL_BG_URL}")`, backgroundSize: 'cover' }}></div>
        <div className="relative z-10 flex flex-col h-full">
          <div className="p-6 flex items-center justify-between border-b border-white/5">
            <div className="flex items-center gap-2 text-white font-bold text-lg hover:opacity-80 transition-opacity cursor-pointer" onClick={() => window.location.reload()}>
              <img src={OPCO_LOGO_URL} className="w-7 h-7" /> <span>OPCO Buddy</span>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-white/40"><X size={20}/></button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5 custom-scrollbar">
            <button onClick={createNewChat} className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-xl text-white text-xs font-semibold hover:bg-white/10 transition-all">
              <PlusCircle size={16} className="text-[#ca0607]" /> Nova Consulta
            </button>

            <div className="space-y-3">
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest px-1">Conhecimento Carregado</div>
              <div className="space-y-1">
                {documents.length === 0 ? (
                  <div className="p-3 text-[10px] text-slate-600 italic">Nenhum documento carregado</div>
                ) : (
                  documents.map(doc => (
                    <div key={doc.id} className="p-2.5 bg-white/5 rounded-lg text-[10px] text-slate-300 flex justify-between items-center group">
                      <span className="truncate flex-1 pr-2">{doc.name}</span>
                      <button onClick={() => setDocuments(prev => prev.filter(d => d.id !== doc.id))} className="text-slate-600 hover:text-red-500 transition-colors"><X size={12}/></button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest px-1">Histórico</div>
              <div className="space-y-1">
                {chats.map(c => (
                  <div key={c.id} onClick={() => setActiveChatId(c.id)} className={`p-2.5 rounded-lg text-[11px] truncate cursor-pointer transition-all ${activeChatId === c.id ? 'bg-[#ca0607]/20 text-white font-medium' : 'text-slate-400 hover:bg-white/5'}`}>
                    {c.title}
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <div className="p-4 border-t border-white/5 bg-black/20">
             <button onClick={() => fileInputRef.current?.click()} className="w-full py-2.5 bg-[#ca0607] text-white rounded-lg text-[11px] font-bold flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all">
               {isUploading ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
               {isUploading ? "A carregar..." : "Carregar Documento"}
             </button>
             <input type="file" ref={fileInputRef} className="hidden" multiple accept=".pdf,.docx,.xlsx,.xls,.txt" onChange={handleFileUpload} />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative bg-white overflow-hidden">
        <header className="h-16 md:h-18 border-b bg-white/95 backdrop-blur-md flex items-center justify-between px-6 shrink-0 z-30 shadow-sm">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 text-slate-500"><Menu size={22}/></button>
            <div className="flex items-center gap-2.5">
              <img src={OPCO_LOGO_URL} className="w-8 h-8" />
              <div>
                <h1 className="text-xs font-black uppercase tracking-wider text-slate-800">OPCO Buddy</h1>
                <div className="text-[9px] text-green-500 font-bold flex items-center gap-1.5"><div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div> ONLINE</div>
              </div>
            </div>
          </div>
          <div className="hidden lg:flex items-center gap-5">
            <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest"><Sparkles size={12} className="text-[#ca0607]"/> Flash Image</div>
            <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest"><Bot size={12} className="text-[#ca0607]"/> Flash Chat</div>
            <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest"><FileBadge size={12} className="text-[#ca0607]"/> RAG Engine</div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-10 space-y-6 custom-scrollbar bg-[#f8fafc]">
          {activeChat?.messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
              <div className={`max-w-[92%] md:max-w-[80%] p-5 rounded-2xl shadow-sm border ${msg.role === 'user' ? 'bg-[#1e293b] text-white border-slate-700' : 'bg-white text-slate-800 border-slate-100'}`}>
                {msg.attachedMedia && msg.attachedMedia.length > 0 && (
                  <div className="mb-4 flex flex-wrap gap-2">
                    {msg.attachedMedia.map(m => (
                      <div key={m.id} className="w-16 h-16 rounded-lg overflow-hidden border border-slate-200 shadow-sm">
                        <img src={m.url} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                )}
                <div className={`prose prose-xs max-w-none ${msg.role === 'user' ? 'prose-invert opacity-95' : 'prose-slate'}`}>
                  <ReactMarkdown components={{ strong: ({node, ...props}) => <strong className="text-[#ca0607]" {...props}/> }}>{msg.content}</ReactMarkdown>
                </div>
                
                {msg.imageUrls && (
                  <div className="mt-4 grid grid-cols-1 gap-4">
                    {msg.imageUrls.map((url, i) => (
                      <div key={i} className="group relative rounded-xl overflow-hidden border shadow-lg border-slate-100">
                        <img src={url} className="w-full" />
                        <a href={url} download={`opco-img-${i}.png`} className="absolute top-3 right-3 bg-black/40 hover:bg-[#ca0607] p-2 rounded-lg text-white transition-all"><Download size={16}/></a>
                      </div>
                    ))}
                  </div>
                )}

                {msg.generatedFiles && (
                  <div className="mt-5 space-y-2">
                    {msg.generatedFiles.map((f, i) => (
                      <a key={i} href={f.url} download={f.name} className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-100 rounded-xl hover:border-[#ca0607] transition-all group shadow-sm">
                        <div className="p-2 bg-red-50 text-[#ca0607] rounded-lg"><FileText size={20}/></div>
                        <div className="flex-1 truncate">
                          <div className="text-[10px] font-bold text-slate-400 uppercase leading-none mb-1">Documento Gerado</div>
                          <div className="text-xs font-bold truncate text-slate-700">{f.name}</div>
                        </div>
                        <Download className="text-slate-300 group-hover:text-[#ca0607]" size={16}/>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex flex-col gap-3">
              <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm inline-flex items-center gap-3 w-fit">
                <div className="flex gap-1.5">
                  <div className="w-1.5 h-1.5 bg-[#ca0607] rounded-full animate-bounce"></div>
                  <div className="w-1.5 h-1.5 bg-[#ca0607] rounded-full animate-bounce [animation-delay:0.2s]"></div>
                  <div className="w-1.5 h-1.5 bg-[#ca0607] rounded-full animate-bounce [animation-delay:0.4s]"></div>
                </div>
                {statusMsg && <span className="text-[10px] font-bold text-[#ca0607] animate-pulse uppercase tracking-wider">{statusMsg}</span>}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} className="h-4" />
        </div>

        {/* Input Area */}
        <div className="p-4 md:p-6 border-t bg-white relative z-40 shadow-[0_-10px_20px_-15px_rgba(0,0,0,0.05)]">
          {attachedMedia.length > 0 && (
            <div className="max-w-4xl mx-auto mb-3 flex flex-wrap gap-2 animate-fade-in">
              {attachedMedia.map(m => (
                <div key={m.id} className="relative">
                  <img src={m.url} className="w-10 h-10 object-cover rounded-lg border border-slate-100 shadow-sm" />
                  <button onClick={() => setAttachedMedia(prev => prev.filter(x => x.id !== m.id))} className="absolute -top-1.5 -right-1.5 bg-red-500 text-white p-1 rounded-full shadow-lg"><X size={8}/></button>
                </div>
              ))}
            </div>
          )}
          <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex items-center gap-2 relative">
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-2xl flex-1 px-2">
               <button type="button" onClick={() => mediaInputRef.current?.click()} className="p-2 text-slate-400 hover:text-[#ca0607] transition-colors"><ImageIcon size={18} /></button>
               <button type="button" onClick={() => docInputRef.current?.click()} className="p-2 text-slate-400 hover:text-[#ca0607] transition-colors"><FileUp size={18} /></button>
               <input 
                type="text" 
                value={input} 
                onChange={e => setInput(e.target.value)} 
                placeholder="Analise documentos, crie manuais ou gere imagens..." 
                className="flex-1 bg-transparent py-3.5 px-2 focus:outline-none text-sm font-medium text-slate-700 placeholder:text-slate-400"
              />
            </div>
            <button type="submit" disabled={isTyping || (!input.trim() && attachedMedia.length === 0)} className="bg-[#ca0607] text-white w-12 h-12 rounded-2xl flex items-center justify-center hover:bg-black disabled:bg-slate-50 disabled:text-slate-200 shadow-md active:scale-95 transition-all shrink-0">
              <Send size={18} />
            </button>
            
            <input type="file" ref={mediaInputRef} className="hidden" multiple accept="image/*" onChange={handleMediaUpload} />
            <input type="file" ref={docInputRef} className="hidden" multiple accept=".pdf,.docx,.xlsx,.xls,.txt" onChange={handleFileUpload} />
          </form>

          {/* Minimalist Contact Section */}
          <div className="mt-5 pt-4 border-t border-slate-50 max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-center md:text-left">
            <div className="flex flex-wrap justify-center md:justify-start gap-x-4 gap-y-1 text-[8px] text-slate-400 font-bold uppercase tracking-widest">
              <div className="flex items-center gap-1"><MapPin size={9} className="text-[#ca0607]"/> Azeitão Office Center</div>
              <div className="flex items-center gap-1"><Phone size={9} className="text-[#ca0607]"/> +351 210 152 492</div>
              <div className="flex items-center gap-1"><Mail size={9} className="text-[#ca0607]"/> opco@opco.pt</div>
            </div>
            <div className="text-[8px] text-slate-300 font-bold uppercase tracking-[0.1em]">
              OPCO Buddy &copy; {new Date().getFullYear()}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

createRoot(document.getElementById('root')!).render(<App />);
