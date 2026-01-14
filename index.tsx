import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type, FunctionDeclaration } from '@google/genai';
import { 
  Send, 
  FileUp, 
  FileText, 
  Loader2,
  PlusCircle,
  X,
  MapPin,
  Phone,
  Mail,
  Download,
  Menu,
  UploadCloud,
  ImageIcon,
  Sparkles,
  FileBadge,
  Table as TableIcon,
  Bot,
  Presentation,
  Table,
  FileSpreadsheet,
  CheckCircle2,
  Layers,
  MessageSquare
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import * as mammoth from 'mammoth';
import * as XLSX from 'xlsx';
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
const DEFAULT_TITLE = "Nova Consulta OPCO";

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

interface GeneratedFile {
  name: string;
  url: string;
  type: 'pdf' | 'docx' | 'pptx' | 'xlsx';
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  generatedFiles?: GeneratedFile[];
  imageUrls?: string[];
  attachedMedia?: MediaAsset[];
  contextFile?: string;
}

interface Chat {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
}

const generateCorporateFileTool: FunctionDeclaration = {
  name: 'generate_corporate_file',
  parameters: {
    type: Type.OBJECT,
    description: 'Gera ficheiros profissionais (Word, PDF, PowerPoint, Excel) com base no conteúdo solicitado.',
    properties: {
      fileType: { type: Type.STRING, description: 'Tipo de ficheiro: pdf, docx, pptx ou xlsx', enum: ['pdf', 'docx', 'pptx', 'xlsx'] },
      fileName: { type: Type.STRING, description: 'Nome sugerido para o ficheiro (sem extensão)' },
      title: { type: Type.STRING, description: 'Título principal do documento' },
      sections: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            heading: { type: Type.STRING, description: 'Título da secção ou slide' },
            body: { type: Type.STRING, description: 'Texto detalhado da secção' }
          }
        },
        description: 'Conteúdo estruturado por secções para Word/PDF ou slides para PowerPoint.'
      },
      tableData: {
        type: Type.ARRAY,
        items: { type: Type.ARRAY, items: { type: Type.STRING } },
        description: 'Dados para Excel ou tabelas, em formato de matriz (Array de Arrays).'
      }
    },
    required: ['fileType', 'fileName', 'title']
  }
};

const App = () => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [attachedMedia, setAttachedMedia] = useState<MediaAsset[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const activeChat = useMemo(() => chats.find(c => c.id === activeChatId), [chats, activeChatId]);

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
      title: DEFAULT_TITLE,
      messages: [{ id: '1', role: 'assistant', content: "Bem-vindo ao OPCO Buddy. Sou o seu Assistente de Inteligência Artificial. em que posso ajudar?", timestamp: new Date().toISOString() }],
      createdAt: new Date().toISOString()
    };
    setChats(prev => [newChat, ...prev]);
    setActiveChatId(id);
    setSelectedDocId(null);
  };

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
      try {
        const content = await processFile(f);
        setDocuments(prev => [...prev, {
          id: Math.random().toString(36).substr(2, 9),
          name: f.name,
          content,
          size: `${(f.size / 1024).toFixed(1)} KB`,
          type: f.name.split('.').pop() || 'file'
        }]);
      } catch (err) {
        console.error("File error:", err);
      }
    }
    setIsUploading(false);
  };

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

  const generatePDF = (args: any): GeneratedFile => {
    const doc = new jsPDF();
    doc.setFillColor(202, 6, 7);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255);
    doc.setFontSize(22);
    doc.text(args.title, 15, 25);
    doc.setTextColor(0);
    doc.setFontSize(12);
    let y = 55;
    (args.sections || []).forEach((sec: any) => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.setFontSize(14);
      doc.setTextColor(202, 6, 7);
      doc.text(sec.heading || '', 15, y);
      y += 8;
      doc.setFontSize(10);
      doc.setTextColor(50);
      const lines = doc.splitTextToSize(sec.body || '', 180);
      doc.text(lines, 15, y);
      y += (lines.length * 5) + 12;
    });
    const blob = doc.output('blob');
    return { name: `${args.fileName}.pdf`, url: URL.createObjectURL(blob), type: 'pdf' };
  };

  const generateWord = async (args: any): Promise<GeneratedFile> => {
    const children = [
      new docx.Paragraph({
        text: args.title,
        heading: docx.HeadingLevel.HEADING_1,
        alignment: docx.AlignmentType.CENTER,
      }),
    ];
    (args.sections || []).forEach((sec: any) => {
      children.push(new docx.Paragraph({ text: sec.heading, heading: docx.HeadingLevel.HEADING_2, spacing: { before: 400 } }));
      children.push(new docx.Paragraph({ text: sec.body }));
    });
    const doc = new docx.Document({ sections: [{ children }] });
    const blob = await docx.Packer.toBlob(doc);
    return { name: `${args.fileName}.docx`, url: URL.createObjectURL(blob), type: 'docx' };
  };

  const generatePPT = async (args: any): Promise<GeneratedFile> => {
    const pres = new PptxGenJS();
    let slide = pres.addSlide();
    slide.addText(args.title, { x: 0.5, y: 1.5, w: '90%', h: 1, fontSize: 44, color: 'ca0607', align: 'center', bold: true });
    
    (args.sections || []).forEach((sec: any) => {
      let s = pres.addSlide();
      s.addText(sec.heading, { x: 0.5, y: 0.5, w: '90%', h: 0.5, fontSize: 32, color: 'ca0607', bold: true });
      s.addText(sec.body, { x: 0.5, y: 1.2, w: '90%', h: 4, fontSize: 18, color: '333333', valign: 'top' });
    });
    
    const blob = await pres.write({ outputType: 'blob' }) as unknown as Blob;
    return { name: `${args.fileName}.pptx`, url: URL.createObjectURL(blob), type: 'pptx' };
  };

  const generateExcel = (args: any): GeneratedFile => {
    const wb = XLSX.utils.book_new();
    const data = args.tableData || [[args.title], []];
    if (!args.tableData) {
      (args.sections || []).forEach((sec: any) => {
        data.push([sec.heading]);
        data.push([sec.body]);
        data.push([]);
      });
    }
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "Dados");
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    return { name: `${args.fileName}.xlsx`, url: URL.createObjectURL(blob), type: 'xlsx' };
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!input.trim() && attachedMedia.length === 0) || isTyping || !activeChatId) return;

    const focusedDoc = selectedDocId ? documents.find(d => d.id === selectedDocId) : null;
    const isFirstUserMessage = activeChat?.messages.filter(m => m.role === 'user').length === 0;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      attachedMedia: [...attachedMedia],
      timestamp: new Date().toISOString(),
      contextFile: focusedDoc ? focusedDoc.name : undefined
    };

    setChats(prev => prev.map(chat => chat.id === activeChatId ? { ...chat, messages: [...chat.messages, userMessage] } : chat));
    const capturedInput = input;
    setInput('');
    setAttachedMedia([]);
    setIsTyping(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      // Automatic Title Generation for new chats
      if (isFirstUserMessage) {
        ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `Gera um título muito curto (máximo 5 palavras) em Português que resuma esta mensagem de consulta de consultoria: "${capturedInput}". Responde APENAS com o título, sem aspas.`
        }).then(res => {
          const newTitle = res.text?.trim() || capturedInput.substring(0, 20) + "...";
          setChats(prev => prev.map(chat => chat.id === activeChatId ? { ...chat, title: newTitle } : chat));
        }).catch(err => console.error("Title gen failed", err));
      }

      const media = userMessage.attachedMedia || [];
      const hasImage = media.some(m => m.type === 'image');

      if (/(edita|altera|muda|filtro|remove|adiciona|gera|cria|imagem|foto|logo)/gi.test(capturedInput)) {
        setStatusMsg("A processar imagem...");
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: {
            parts: [
              ...(hasImage ? [{ inlineData: { data: media.find(m => m.type === 'image')!.base64!, mimeType: media.find(m => m.type === 'image')!.mimeType } }] : []),
              { text: `${capturedInput}. Estilo corporativo para a empresa OPCO.` }
            ]
          }
        });

        let imageUrls: string[] = [];
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) imageUrls.push(`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`);
        }
        
        if (imageUrls.length > 0) {
          addAssistantMessage("Aqui está o resultado:", { imageUrls });
        } else {
          addAssistantMessage(response.text || "Processamento concluído.");
        }
        setStatusMsg('');
        return;
      }

      let context = "";
      if (focusedDoc) {
        context = `FOCO NO DOCUMENTO SELECIONADO: ${focusedDoc.name}\nConteúdo:\n${focusedDoc.content}`;
      } else if (documents.length > 0) {
        context = "Documentos Base OPCO (Análise Global):\n" + documents.map(d => `--- ${d.name} ---\n${d.content}`).join('\n\n');
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `${context}\n\nUtilizador: ${capturedInput}`,
        config: {
          systemInstruction: `És o OPCO Buddy. Especialista em consultoria digital e formação. 
          ${focusedDoc ? `Estás focado exclusivamente no documento: ${focusedDoc.name}.` : `Estás a analisar todos os documentos disponíveis.`}
          Tens a capacidade de gerar ficheiros corporativos profissionais (Word, PDF, PowerPoint e Excel). 
          Utiliza a ferramenta generate_corporate_file sempre que o utilizador pedir para criar um documento, manual, apresentação ou folha de cálculo. 
          Sempre que apresentares dados estruturados no chat, usa o formato de tabela Markdown.`,
          tools: [{ functionDeclarations: [generateCorporateFileTool] }]
        }
      });

      let content = response.text || "";
      let files: GeneratedFile[] = [];

      if (response.functionCalls) {
        for (const fc of response.functionCalls) {
          if (fc.name === 'generate_corporate_file') {
            const args = fc.args as any;
            setStatusMsg(`A gerar ${args.fileType.toUpperCase()}...`);
            let file;
            if (args.fileType === 'pdf') file = generatePDF(args);
            else if (args.fileType === 'docx') file = await generateWord(args);
            else if (args.fileType === 'pptx') file = await generatePPT(args);
            else if (args.fileType === 'xlsx') file = generateExcel(args);
            
            if (file) {
              files.push(file);
              content += `\n\n**O ficheiro ${file.name} foi gerado com sucesso.**`;
            }
          }
        }
      }

      addAssistantMessage(content, { generatedFiles: files });

    } catch (error: any) {
      console.error(error);
      addAssistantMessage("Erro ao processar consulta. Tente novamente.");
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

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'pdf': return <FileText size={20} className="text-red-500" />;
      case 'docx': return <FileText size={20} className="text-blue-500" />;
      case 'pptx': return <Presentation size={20} className="text-orange-500" />;
      case 'xlsx': return <FileSpreadsheet size={20} className="text-green-600" />;
      default: return <FileText size={20} className="text-slate-400" />;
    }
  };

  return (
    <div className="flex h-[100dvh] bg-slate-50 overflow-hidden font-inter">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#111218] border-r border-slate-800/50 flex flex-col transition-transform duration-300 md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: `url("${NEURAL_BG_URL}")`, backgroundSize: 'cover' }}></div>
        <div className="relative z-10 flex flex-col h-full">
          <div className="p-6 flex items-center justify-between border-b border-white/5">
            <div className="flex items-center gap-2 text-white font-bold text-lg cursor-pointer" onClick={() => window.location.reload()}>
              <img src={OPCO_LOGO_URL} className="w-7 h-7" /> <span>OPCO Buddy</span>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-white/40"><X size={20}/></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5 custom-scrollbar">
            <button onClick={createNewChat} className="flex items-center gap-3 p-3 bg-[#ca0607] hover:bg-black border border-white/10 rounded-xl text-white text-xs font-bold transition-all shadow-lg active:scale-95">
              <PlusCircle size={16} /> Nova Consulta
            </button>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Base de Conhecimento</div>
                {selectedDocId && (
                  <button onClick={() => setSelectedDocId(null)} className="text-[9px] text-[#ca0607] font-bold hover:underline flex items-center gap-1">
                    <Layers size={10} /> Ver Todos
                  </button>
                )}
              </div>
              <div className="space-y-1">
                {documents.length === 0 ? (
                  <div className="p-3 text-[10px] text-slate-600 italic bg-white/5 rounded-lg border border-white/5">Nenhum ficheiro carregado</div>
                ) : (
                  documents.map(doc => (
                    <div 
                      key={doc.id} 
                      onClick={() => setSelectedDocId(doc.id)}
                      className={`group p-2.5 rounded-lg text-[10px] flex justify-between items-center cursor-pointer transition-all border ${selectedDocId === doc.id ? 'bg-[#ca0607]/20 border-[#ca0607]/40 text-white shadow-lg' : 'bg-white/5 border-white/5 text-slate-300 hover:bg-white/10'}`}
                    >
                      <div className="flex items-center gap-2 truncate flex-1 pr-2">
                        {selectedDocId === doc.id ? <CheckCircle2 size={12} className="text-[#ca0607] shrink-0" /> : <div className="w-3 h-3 rounded-full border border-white/20 shrink-0"></div>}
                        <span className="truncate">{doc.name}</span>
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setDocuments(prev => prev.filter(d => d.id !== doc.id)); if (selectedDocId === doc.id) setSelectedDocId(null); } } 
                        className="text-slate-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={12}/>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest px-1">Consultas Recentes</div>
              <div className="space-y-1">
                {chats.map(c => (
                  <div key={c.id} onClick={() => setActiveChatId(c.id)} className={`group relative p-3 rounded-lg text-[11px] truncate cursor-pointer transition-all flex items-center gap-2.5 border ${activeChatId === c.id ? 'bg-white/10 text-white border-white/20 shadow-lg' : 'text-slate-400 border-transparent hover:bg-white/5'}`}>
                    <MessageSquare size={12} className={activeChatId === c.id ? "text-[#ca0607]" : "text-slate-600"} />
                    <span className="truncate flex-1 font-medium">{c.title}</span>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setChats(currentChats => { const filtered = currentChats.filter(x => x.id !== c.id); if (activeChatId === c.id) setActiveChatId(filtered.length > 0 ? filtered[0].id : null); return filtered; }); }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-600 hover:text-red-500 transition-all"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="p-4 border-t border-white/5 bg-black/20">
             <button onClick={() => fileInputRef.current?.click()} className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg text-[11px] font-bold flex items-center justify-center gap-2 transition-colors border border-white/5">
               {isUploading ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
               {isUploading ? "A carregar..." : "Carregar Conhecimento"}
             </button>
             <input type="file" ref={fileInputRef} className="hidden" multiple accept=".pdf,.docx,.xlsx,.xls,.txt" onChange={handleFileUpload} />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative bg-white overflow-hidden">
        <header className="h-16 border-b bg-white/95 flex items-center justify-between px-6 shrink-0 z-30 shadow-sm">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 text-slate-500 hover:bg-slate-50 rounded-lg"><Menu size={22}/></button>
            <div className="flex items-center gap-2.5">
              <img src={OPCO_LOGO_URL} className="w-8 h-8" />
              <div>
                <h1 className="text-xs font-black uppercase tracking-wider text-slate-800">OPCO Buddy</h1>
                <div className="text-[9px] text-green-500 font-bold flex items-center gap-1.5"><div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div> ONLINE</div>
              </div>
            </div>
          </div>
          <div className="hidden lg:flex items-center gap-6">
            <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest"><FileText size={12} className="text-[#ca0607]"/> DOCS / PDF</div>
            <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest"><Presentation size={12} className="text-[#ca0607]"/> PPTX / Slides</div>
            <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest"><Table size={12} className="text-[#ca0607]"/> XLSX / Excel</div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-10 space-y-6 custom-scrollbar bg-[#f8fafc]">
          {activeChat?.messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
              <div className="flex flex-col gap-1.5 max-w-[92%] md:max-w-[85%]">
                {msg.contextFile && msg.role === 'user' && (
                   <div className="flex justify-end pr-2">
                     <span className="text-[8px] font-bold text-[#ca0607] uppercase tracking-wider bg-red-50 px-2 py-0.5 rounded-full border border-red-100 flex items-center gap-1 shadow-sm">
                       <FileText size={8} /> Focado em: {msg.contextFile}
                     </span>
                   </div>
                )}
                <div className={`p-5 rounded-2xl shadow-sm border ${msg.role === 'user' ? 'bg-[#1e293b] text-white border-slate-700' : 'bg-white text-slate-800 border-slate-100'}`}>
                  {msg.attachedMedia && msg.attachedMedia.length > 0 && (
                    <div className="mb-4 flex flex-wrap gap-2">
                      {msg.attachedMedia.map(m => (
                        <div key={m.id} className="w-16 h-16 rounded-lg overflow-hidden border border-slate-200">
                          <img src={m.url} className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  )}
                  <div className={`prose prose-sm max-w-none ${msg.role === 'user' ? 'prose-invert opacity-95 text-slate-100' : 'prose-slate'}`}>
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm]}
                      components={{ 
                        strong: ({...props}) => <strong className="text-[#ca0607] font-bold" {...props}/>,
                        table: ({...props}) => <div className="my-6 overflow-x-auto border border-slate-200 rounded-xl shadow-inner"><table className="min-w-full divide-y divide-slate-200 text-xs" {...props}/></div>,
                        thead: ({...props}) => <thead className="bg-slate-50" {...props}/>,
                        th: ({...props}) => <th className="px-4 py-3 text-left font-bold text-[#ca0607] uppercase tracking-wider" {...props}/>,
                        td: ({...props}) => <td className="px-4 py-3 border-t border-slate-100 bg-white" {...props}/>
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                  {msg.imageUrls && (
                    <div className="mt-4 grid grid-cols-1 gap-4">
                      {msg.imageUrls.map((url, i) => (
                        <div key={i} className="group relative rounded-xl overflow-hidden border border-slate-200 shadow-xl">
                          <img src={url} className="w-full" />
                          <a href={url} download={`opco-img-${i}.png`} className="absolute top-3 right-3 bg-black/50 hover:bg-[#ca0607] p-2 rounded-lg text-white transition-all backdrop-blur-md scale-90 group-hover:scale-100"><Download size={16}/></a>
                        </div>
                      ))}
                    </div>
                  )}
                  {msg.generatedFiles && msg.generatedFiles.length > 0 && (
                    <div className="mt-5 space-y-2">
                      {msg.generatedFiles.map((f, i) => (
                        <a key={i} href={f.url} download={f.name} className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl hover:border-[#ca0607] transition-all group shadow-sm hover:shadow-md">
                          <div className="p-2 bg-white rounded-lg shadow-sm">{getFileIcon(f.type)}</div>
                          <div className="flex-1 truncate">
                            <div className="text-[10px] font-bold text-slate-400 uppercase leading-none mb-1">Ficheiro {f.type.toUpperCase()} Gerado</div>
                            <div className="text-xs font-bold truncate text-slate-700">{f.name}</div>
                          </div>
                          <div className="p-2 text-slate-300 group-hover:text-[#ca0607] transition-colors"><Download size={16}/></div>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
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
        <div className="p-4 md:p-6 border-t bg-white relative z-40 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <div className="max-w-4xl mx-auto flex flex-col gap-3">
            {selectedDocId && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-100 rounded-lg self-start animate-fade-in">
                <FileText size={12} className="text-[#ca0607]" />
                <span className="text-[10px] font-bold text-[#ca0607] uppercase">Analisar: {documents.find(d => d.id === selectedDocId)?.name}</span>
                <button onClick={() => setSelectedDocId(null)} className="ml-1 text-[#ca0607] hover:text-black transition-colors"><X size={12} /></button>
              </div>
            )}
            
            {attachedMedia.length > 0 && (
              <div className="flex flex-wrap gap-2 animate-fade-in">
                {attachedMedia.map(m => (
                  <div key={m.id} className="relative">
                    <img src={m.url} className="w-10 h-10 object-cover rounded-lg border border-slate-200 shadow-sm" />
                    <button onClick={() => setAttachedMedia(prev => prev.filter(x => x.id !== m.id))} className="absolute -top-1.5 -right-1.5 bg-[#ca0607] text-white p-1 rounded-full shadow-lg hover:bg-black transition-colors"><X size={8}/></button>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleSendMessage} className="flex items-center gap-2 relative">
              <div className="flex items-center bg-slate-50 border border-slate-200 rounded-2xl flex-1 px-4 focus-within:border-[#ca0607] focus-within:ring-2 focus-within:ring-red-100 transition-all">
                <input 
                  type="text" 
                  value={input} 
                  onChange={e => setInput(e.target.value)} 
                  placeholder="O Seu assistente digital, escreva aqui as suas questões..." 
                  className="flex-1 bg-transparent py-3.5 focus:outline-none text-sm font-medium text-slate-700"
                />
              </div>
              <button type="submit" disabled={isTyping || (!input.trim() && attachedMedia.length === 0)} className="bg-[#ca0607] text-white w-12 h-12 rounded-2xl flex items-center justify-center hover:bg-black disabled:bg-slate-100 disabled:text-slate-300 shadow-lg active:scale-95 transition-all shrink-0">
                <Send size={18} />
              </button>
              <input type="file" ref={mediaInputRef} className="hidden" multiple accept="image/*" onChange={handleMediaUpload} />
              <input type="file" ref={docInputRef} className="hidden" multiple accept=".pdf,.docx,.xlsx,.xls,.txt" onChange={handleFileUpload} />
            </form>
            
            <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-3 opacity-60">
              <div className="flex flex-wrap justify-center gap-x-4 text-[8px] text-slate-500 font-bold uppercase tracking-[0.15em]">
                <div className="flex items-center gap-1.5"><MapPin size={9} className="text-[#ca0607]"/> Azeitão, Portugal</div>
                <div className="flex items-center gap-1.5"><Phone size={9} className="text-[#ca0607]"/> +351 210 152 492</div>
                <div className="flex items-center gap-1.5"><Mail size={9} className="text-[#ca0607]"/> opco@opco.pt</div>
              </div>
              <div className="text-[8px] text-slate-400 font-bold uppercase tracking-[0.1em]">OPCO Buddy &copy; {new Date().getFullYear()}</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);