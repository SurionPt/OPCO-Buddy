
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type, FunctionDeclaration } from '@google/genai';
import { 
  Send, 
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
  Sparkles,
  FileBadge,
  Table as TableIcon,
  Presentation,
  CheckCircle2,
  MessageSquare,
  Globe,
  Files,
  Trash2,
  Layout,
  BookOpen,
  Image as ImageIcon,
  FileSpreadsheet,
  FileJson,
  FileText as FileTextIcon,
  Copy,
  Check,
  DownloadCloud,
  Pencil,
  ExternalLink,
  Search,
  CheckSquare,
  Square
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import * as mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import PptxGenJS from 'pptxgenjs';
import { jsPDF } from 'jspdf';
import * as docx from 'docx';

// --- Utility Functions ---
const getSafeFileName = (name: string, ext: string) => {
  const base = name.replace(new RegExp(`\\.${ext}$`, 'i'), '');
  return `${base}.${ext}`;
};

/**
 * Componente auxiliar para destacar "OPCO" e "OPCO Buddy" em vermelho nas respostas do chat.
 */
const HighlightOpco = ({ children }: { children: any }) => {
  if (typeof children !== 'string') return children;
  const parts = children.split(/(OPCO Buddy|OPCO)/g);
  return (
    <>
      {parts.map((part, i) => 
        (part === 'OPCO Buddy' || part === 'OPCO') 
          ? <span key={i} className="opco-text-red font-bold">{part}</span> 
          : part
      )}
    </>
  );
};

// --- Localization Config ---
const LANGUAGES = [
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'nl', name: 'Nederlands', flag: '🇳🇱' },
  { code: 'zh', name: 'Mandarim', flag: '🇨🇳' },
  { code: 'ja', name: 'Japonês', flag: '🇯🇵' }
];

const TRANSLATIONS: Record<string, any> = {
  pt: {
    welcome: "Olá, sou o OPCO Buddy, o seu Assistente de Inteligência Artificial. Em que posso ajudar hoje?",
    placeholder: "Pergunte...",
    newChat: "NOVA PESQUISA",
    files: "FICHEIROS",
    recent: "RECENTES",
    upload: "Upload",
    active: "Ativo",
    richPPT: "PPT Inteligente",
    systemPrompt: "És o OPCO Buddy, o assistente oficial da OPCO (https://opco.pt). Atuas como um consultor sénior especializado em RAG e análise estratégica. Quando questionado sobre a OPCO, utiliza as informações fornecidas nos documentos selecionados e as ferramentas de pesquisa online se autorizadas. Transformas documentos complexos em briefings estruturados, apresentações PPTX, relatórios DOCX, tabelas EXCEL e infográficos. Quando gerares PPTX, cria sempre múltiplos slides lógicos. Para tabelas, usa o formato Markdown rigoroso. Quando te pedirem imagens ou infográficos, usa a ferramenta generate_infographic. RESPONDE SEMPRE EM PORTUGUÊS.",
    loading: "A analisar documentos...",
    engine: "OPCO Digital Systems",
    langHeading: "IDIOMA",
    searchingIn: "Análise:",
    allFiles: "Todos os Ficheiros",
    filesOnly: "Apenas Ficheiros",
    filesPlusWeb: "Ficheiros + Internet",
    generateBriefing: "GERAR BRIEFING PPT",
    briefingLoading: "A estruturar ativos corporativos...",
    generatingImage: "A desenhar infográfico...",
    exporting: "A exportar ficheiros...",
    errorMessage: "Ocorreu um erro ao processar. Por favor, tente novamente ou reduza o tamanho do documento.",
    copy: "Copiar",
    copied: "Copiado!",
    export: "Exportar Word",
    rename: "Renomear",
    save: "Guardar",
    sources: "Fontes de Pesquisa",
    multiFiles: "ficheiros selecionados"
  },
  en: {
    welcome: "Hello, I am OPCO Buddy, your AI Assistant. How can I help you today?",
    placeholder: "Ask anything...",
    newChat: "NEW SEARCH",
    files: "FILES",
    recent: "RECENT",
    upload: "Upload",
    active: "Active",
    richPPT: "Smart PPT",
    systemPrompt: "You are OPCO Buddy, the official assistant for OPCO (https://opco.pt). You act as a senior consultant specialized in RAG and strategic analysis. When asked about OPCO, use information from the provided documents and online search tools if authorized. Transform complex documents into structured briefings, PPTX presentations, DOCX reports, EXCEL tables, and infographics. ALWAYS RESPOND IN ENGLISH.",
    loading: "Analyzing documents...",
    engine: "OPCO Digital Systems",
    langHeading: "LANGUAGE",
    searchingIn: "Analysis:",
    allFiles: "All Files",
    filesOnly: "Files Only",
    filesPlusWeb: "Files + Web",
    generateBriefing: "GENERATE PPT BRIEFING",
    briefingLoading: "Structuring corporate assets...",
    generatingImage: "Drawing infographic...",
    exporting: "Exporting files...",
    errorMessage: "An error occurred. Please try again or reduce document size.",
    copy: "Copy",
    copied: "Copied!",
    export: "Export Word",
    rename: "Rename",
    save: "Save",
    sources: "Search Sources",
    multiFiles: "selected files"
  }
};

const OPCO_LOGO_URL = 'https://raw.githubusercontent.com/SurionPt/OCPCO/refs/heads/main/esfera%2050x47.png';
const OPCO_DIGITAL_SYSTEMS_LOGO_URL = 'https://raw.githubusercontent.com/SurionPt/OCPCO/refs/heads/main/OPCO%20Digital%20Systems.png';
const NEURAL_BG_URL = 'https://raw.githubusercontent.com/SurionPt/OCPCO/refs/heads/main/neural.jpg';
const STORAGE_KEY = 'opco_buddy_v19_multi_rag';

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
  type: 'pdf' | 'docx' | 'pptx' | 'xlsx' | 'image';
}

interface GroundingSource {
  title: string;
  uri: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  generatedFiles?: GeneratedFile[];
  groundingSources?: GroundingSource[];
  contextFiles?: string[];
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
    description: 'Cria ativos corporativos (PPTX, DOCX, PDF, XLSX) baseados no conteúdo.',
    properties: {
      fileType: { type: Type.STRING, enum: ['pptx', 'docx', 'pdf', 'xlsx'] },
      fileName: { type: Type.STRING },
      title: { type: Type.STRING },
      slides: {
        type: Type.ARRAY,
        description: 'Conteúdo detalhado para slides (se PPTX).',
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            bullets: { type: Type.ARRAY, items: { type: Type.STRING } },
            footer: { type: Type.STRING }
          }
        }
      },
      reportContent: { type: Type.STRING, description: 'Conteúdo estruturado para DOCX ou PDF.' },
      tableData: {
        type: Type.ARRAY,
        description: 'Dados para Excel (array de arrays).',
        items: { type: Type.ARRAY, items: { type: Type.STRING } }
      }
    },
    required: ['fileType', 'fileName', 'title']
  }
};

const generateInfographicTool: FunctionDeclaration = {
  name: 'generate_infographic',
  parameters: {
    type: Type.OBJECT,
    description: 'Gera um infográfico visual baseado em conceitos.',
    properties: {
      prompt: { type: Type.STRING },
      aspectRatio: { type: Type.STRING, enum: ["1:1", "16:9", "4:3", "9:16"] }
    },
    required: ['prompt']
  }
};

const App = () => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [isWebSearchEnabled, setIsWebSearchEnabled] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [currentLang, setCurrentLang] = useState('pt');
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [tempChatTitle, setTempChatTitle] = useState('');

  const t = useMemo(() => TRANSLATIONS[currentLang] || TRANSLATIONS.pt, [currentLang]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeChat = useMemo(() => chats.find(c => c.id === activeChatId), [chats, activeChatId]);
  const focusedDocs = useMemo(() => documents.filter(d => selectedDocIds.includes(d.id)), [selectedDocIds, documents]);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.length > 0) { 
          setChats(parsed); 
          setActiveChatId(parsed[0].id); 
        } else {
          createNewChat();
        }
      } catch (e) { 
        createNewChat(); 
      }
    } else {
      createNewChat();
    }
  }, []);

  useEffect(() => {
    if (chats.length > 0) localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
  }, [chats]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chats, isTyping]);

  useEffect(() => {
    setChats(prev => prev.map(chat => {
      const isDefaultWelcome = Object.values(TRANSLATIONS).some(lang => lang.welcome === chat.messages[0].content);
      if (chat.messages.length === 1 && chat.messages[0].role === 'assistant' && isDefaultWelcome) {
          const isTitleDefault = Object.values(TRANSLATIONS).some(lang => lang.newChat === chat.title);
          return {
            ...chat,
            title: isTitleDefault ? t.newChat : chat.title,
            messages: [{ ...chat.messages[0], content: t.welcome }]
          };
      }
      return chat;
    }));
  }, [currentLang]);

  const createNewChat = () => {
    const id = Date.now().toString();
    const newChat: Chat = {
      id, title: t.newChat,
      messages: [{ id: '1', role: 'assistant', content: t.welcome, timestamp: new Date().toISOString() }],
      createdAt: new Date().toISOString()
    };
    setChats(prev => [newChat, ...prev]);
    setActiveChatId(id);
    setSelectedDocIds([]);
  };

  const deleteChat = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setChats(prev => {
      const filtered = prev.filter(c => c.id !== id);
      if (filtered.length === 0) { createNewChat(); return prev; }
      if (activeChatId === id) setActiveChatId(filtered[0].id);
      return filtered;
    });
  };

  const toggleDocSelection = (docId: string) => {
    setSelectedDocIds(prev => prev.includes(docId) ? prev.filter(id => id !== docId) : [...prev, docId]);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setIsUploading(true);
    for (const f of Array.from(files)) {
      try {
        const ext = f.name.split('.').pop()?.toLowerCase();
        let content = "";
        const buffer = await f.arrayBuffer();
        if (ext === 'pdf') {
          const pdf = await (window as any).pdfjsLib.getDocument({ data: buffer }).promise;
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            content += (await page.getTextContent()).items.map((it: any) => it.str).join(' ') + '\n';
          }
        } else if (ext === 'docx') content = (await mammoth.extractRawText({ arrayBuffer: buffer })).value;
        else if (ext?.includes('xls')) {
          const wb = XLSX.read(buffer, { type: 'array' });
          content = wb.SheetNames.map(n => XLSX.utils.sheet_to_txt(wb.Sheets[n])).join('\n');
        } else content = await f.text();
        setDocuments(prev => [...prev, { id: Math.random().toString(36).substr(2, 9), name: f.name, content: content.substring(0, 100000), size: `${(f.size/1024).toFixed(1)}KB`, type: ext || 'file' }]);
      } catch (err) { console.error(err); }
    }
    setIsUploading(false);
  };

  const exportEntireChat = async () => {
    if (!activeChat) return;
    setStatusMsg(t.exporting);

    const doc = new docx.Document({
      sections: [{
        children: activeChat.messages.flatMap(m => [
          new docx.Paragraph({
            children: [
              new docx.TextRun({
                text: `${m.role === 'user' ? 'UTILIZADOR' : 'OPCO BUDDY'} (${new Date(m.timestamp).toLocaleString()})`,
                bold: true,
                color: m.role === 'user' ? "666666" : "ca0607"
              })
            ],
            spacing: { before: 400 }
          }),
          ...m.content.split('\n').map(line => new docx.Paragraph({
            text: line,
            spacing: { after: 100 }
          })),
          new docx.Paragraph({
            children: [new docx.TextRun({ text: "__________________________________________________", color: "EEEEEE" })]
          })
        ])
      }]
    });

    const blob = await docx.Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `opco_buddy_chat_${activeChat.title.replace(/\s+/g, '_')}.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setStatusMsg('');
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopyingId(id);
      setTimeout(() => setCopyingId(null), 2000);
    });
  };

  const startRenaming = (e: React.MouseEvent, chat: Chat) => {
    e.stopPropagation();
    setEditingChatId(chat.id);
    setTempChatTitle(chat.title);
  };

  const saveChatTitle = (e: React.FormEvent | React.FocusEvent) => {
    e.preventDefault();
    if (!editingChatId) return;
    setChats(prev => prev.map(c => c.id === editingChatId ? { ...c, title: tempChatTitle || c.title } : c));
    setEditingChatId(null);
  };

  const generatePresentation = async (args: any): Promise<GeneratedFile> => {
    const pres = new PptxGenJS();
    pres.layout = 'LAYOUT_16x9';
    const slideCapa = pres.addSlide();
    slideCapa.background = { color: 'ca0607' };
    slideCapa.addText(args.title || 'Briefing', { x: 0.5, y: 1.5, w: 9, h: 2, fontSize: 44, color: 'FFFFFF', bold: true, align: 'center' });
    if (args.slides) args.slides.forEach((s: any) => {
      const slide = pres.addSlide();
      slide.addText(s.title, { x: 0.5, y: 0.5, w: 8.5, fontSize: 24, color: 'ca0607', bold: true });
      if (s.bullets) slide.addText(s.bullets, { x: 0.5, y: 1.5, w: 8.5, fontSize: 16, color: '333333', bullet: true });
    });
    const blob = await pres.write({ outputType: 'blob' }) as Blob;
    return { name: getSafeFileName(args.fileName, 'pptx'), url: URL.createObjectURL(blob), type: 'pptx' };
  };

  const generateDocx = async (args: any): Promise<GeneratedFile> => {
    const doc = new docx.Document({ sections: [{ children: [new docx.Paragraph({ text: args.title, heading: docx.HeadingLevel.HEADING_1 }), ... (args.reportContent || "").split('\n').map((line: string) => new docx.Paragraph({ text: line, spacing: { before: 200 } }))] }] });
    const blob = await docx.Packer.toBlob(doc);
    return { name: getSafeFileName(args.fileName, 'docx'), url: URL.createObjectURL(blob), type: 'docx' };
  };

  const generatePdf = async (args: any): Promise<GeneratedFile> => {
    const doc = new jsPDF();
    doc.setFontSize(20).setTextColor(202, 6, 7).text(args.title, 20, 20);
    const splitText = doc.setFontSize(10).setTextColor(50, 50, 50).splitTextToSize(args.reportContent || "", 170);
    doc.text(splitText, 20, 35);
    return { name: getSafeFileName(args.fileName, 'pdf'), url: URL.createObjectURL(doc.output('blob')), type: 'pdf' };
  };

  const generateExcel = async (args: any): Promise<GeneratedFile> => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(args.tableData || [["No Data"]]), "OPCO Data");
    const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    return { name: getSafeFileName(args.fileName, 'xlsx'), url: URL.createObjectURL(new Blob([out])), type: 'xlsx' };
  };

  const handleSendMessage = async (e?: React.FormEvent, customInput?: string) => {
    e?.preventDefault();
    const finalInput = customInput || input;
    if (!finalInput.trim() || isTyping || !activeChatId) return;

    const userMsg: Message = { 
      id: Date.now().toString(), 
      role: 'user', 
      content: finalInput, 
      timestamp: new Date().toISOString(), 
      contextFiles: focusedDocs.map(d => d.name) 
    };
    setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, messages: [...c.messages, userMsg] } : c));
    setInput(''); setIsTyping(true); setStatusMsg(t.loading);

    try {
      const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
      
      // Aggregate context from selected documents
      const docsToAnalyze = focusedDocs.length > 0 ? focusedDocs : documents;
      const context = docsToAnalyze.map(d => `[FICHEIRO: ${d.name}]\n${d.content.substring(0, 50000)}`).join('\n---\n');
      
      const tools: any[] = [{ functionDeclarations: [generateCorporateFileTool, generateInfographicTool] }];
      if (isWebSearchEnabled) tools.push({ googleSearch: {} });

      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `${context}\n\nUtilizador: ${finalInput}`,
        config: { systemInstruction: t.systemPrompt, tools }
      });

      let content = response.text || "";
      let files: GeneratedFile[] = [];
      let sources: GroundingSource[] = [];

      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks) {
        chunks.forEach((chunk: any) => {
          if (chunk.web && chunk.web.uri) {
            sources.push({ title: chunk.web.title || chunk.web.uri, uri: chunk.web.uri });
          }
        });
      }

      if (response.functionCalls) {
        for (const fc of response.functionCalls) {
          try {
            if (fc.name === 'generate_corporate_file') {
              setStatusMsg(t.exporting);
              const args = fc.args as any;
              if (args.fileType === 'pptx') files.push(await generatePresentation(args));
              else if (args.fileType === 'docx') files.push(await generateDocx(args));
              else if (args.fileType === 'pdf') files.push(await generatePdf(args));
              else if (args.fileType === 'xlsx') files.push(await generateExcel(args));
            } else if (fc.name === 'generate_infographic') {
              setStatusMsg(t.generatingImage);
              const imgRes = await ai.models.generateContent({ model: 'gemini-2.5-flash-image', contents: { parts: [{ text: (fc.args as any).prompt }] } });
              const imgPart = imgRes.candidates[0].content.parts.find(p => p.inlineData);
              if (imgPart) files.push({ name: `infographic_${Date.now()}.png`, url: `data:image/png;base64,${imgPart.inlineData.data}`, type: 'image' });
            }
          } catch (err) { console.error("Export Error:", err); }
        }
      }
      addAssistantMessage(content || "Processamento concluído.", { generatedFiles: files, groundingSources: sources });
    } catch (e: any) { 
      console.error(e); 
      addAssistantMessage(t.errorMessage); 
    } finally { setIsTyping(false); setStatusMsg(''); }
  };

  const addAssistantMessage = (content: string, extra = {}) => {
    const msg: Message = { id: Date.now().toString(), role: 'assistant', content, timestamp: new Date().toISOString(), ...extra };
    setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, messages: [...c.messages, msg] } : c));
  };

  return (
    <div className="flex h-[100dvh] bg-slate-50 overflow-hidden font-inter text-slate-800">
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#99a288] border-r border-slate-800/50 flex flex-col transition-transform duration-300 md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: `url("${NEURAL_BG_URL}")`, backgroundSize: 'cover' }}></div>
        <div className="relative z-10 flex flex-col h-full">
          <div className="p-6 flex items-center justify-between border-b border-white/10">
            <div className="flex items-center gap-2 text-white font-bold text-lg cursor-pointer" onClick={() => window.location.reload()}><img src={OPCO_LOGO_URL} className="w-8 h-8" alt="Logo" /> <span>OPCO Buddy</span></div>
            <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-white/40"><X size={20}/></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6 custom-scrollbar">
             <div className="px-2">
               <div className="text-[10px] text-white font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
                 <Globe size={12}/> {t.langHeading}
               </div>
               <select 
                 value={currentLang} 
                 onChange={(e) => setCurrentLang(e.target.value)} 
                 className="w-full bg-white/10 border border-white/20 rounded-xl py-2 px-3 text-xs text-white appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-white/50"
               >
                 {LANGUAGES.map(lang => (
                   <option key={lang.code} value={lang.code} className="bg-[#99a288] text-white">
                     {lang.flag} {lang.name}
                   </option>
                 ))}
               </select>
             </div>
             <button onClick={createNewChat} className="flex items-center gap-3 p-3.5 bg-[#ca0607] hover:bg-black border border-white/10 rounded-xl text-white text-xs font-bold transition-all shadow-lg uppercase tracking-wider"><PlusCircle size={16} /> {t.newChat}</button>
             <div className="space-y-4">
                <div className="text-[10px] text-white font-bold uppercase tracking-widest px-2 flex items-center gap-2">
                  <FileBadge size={12}/> {t.files}
                </div>
                <div className="space-y-1">
                  {documents.map(doc => {
                    const isSelected = selectedDocIds.includes(doc.id);
                    return (
                      <div 
                        key={doc.id} 
                        onClick={() => toggleDocSelection(doc.id)} 
                        className={`group p-2.5 rounded-lg text-[10px] flex items-center gap-2 cursor-pointer transition-all border ${isSelected ? 'bg-[#ca0607] text-white border-white/40 shadow-lg' : 'bg-white/5 text-white/80 hover:bg-white/10 border-transparent'}`}
                      >
                        {isSelected ? <CheckSquare size={12} className="shrink-0" /> : <Square size={12} className="shrink-0" />}
                        <span className="truncate flex-1">{doc.name}</span>
                        <button onClick={(e) => { e.stopPropagation(); setDocuments(d => d.filter(item => item.id !== doc.id)); setSelectedDocIds(prev => prev.filter(id => id !== doc.id)); }}><X size={12}/></button>
                      </div>
                    );
                  })}
                </div>
             </div>
             <div className="space-y-4">
               <div className="text-[10px] text-white font-bold uppercase tracking-widest px-2 flex items-center gap-2">
                 <MessageSquare size={12}/> {t.recent}
                </div>
                <div className="space-y-1 overflow-hidden">
               {chats.map(c => {
                 const isDefaultTitle = Object.values(TRANSLATIONS).some(lang => lang.newChat === c.title);
                 const isActive = activeChatId === c.id;
                 const isEditing = editingChatId === c.id;

                 return (
                   <div key={c.id} onClick={() => !isEditing && setActiveChatId(c.id)} className={`group p-3 rounded-lg text-[11px] flex items-center gap-2 cursor-pointer transition-all border ${isActive ? 'bg-white/20 text-white font-bold border-white/30' : 'text-white/70 border-transparent hover:bg-white/5'}`}>
                     {isEditing ? (
                       <form onSubmit={saveChatTitle} className="flex-1 flex gap-1">
                         <input 
                           autoFocus 
                           className="bg-white/10 text-white text-[10px] p-1 rounded w-full outline-none border border-white/30" 
                           value={tempChatTitle} 
                           onChange={e => setTempChatTitle(e.target.value)}
                           onBlur={saveChatTitle}
                         />
                         <button type="submit" className="text-white"><Check size={12}/></button>
                       </form>
                     ) : (
                       <>
                         <span className="truncate flex-1">{isDefaultTitle ? t.newChat : c.title}</span>
                         <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                           <button onClick={(e) => startRenaming(e, c)} className="hover:text-white"><Pencil size={12}/></button>
                           <button onClick={(e) => deleteChat(e, c.id)} className="hover:text-white"><Trash2 size={12}/></button>
                         </div>
                       </>
                     )}
                   </div>
                 );
               })}
             </div></div>
          </div>
          <div className="p-4 border-t border-white/10"><button onClick={() => fileInputRef.current?.click()} className="w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-[11px] font-bold flex items-center justify-center gap-2 border border-white/10 uppercase tracking-wide transition-all">{isUploading ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />} {t.upload}</button><input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileUpload} /></div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative bg-white shadow-2xl">
        <header className="h-16 border-b bg-white/95 flex items-center justify-between px-6 shrink-0 z-30 shadow-sm backdrop-blur-md">
           <div className="flex items-center gap-4">
             <button onClick={() => setIsSidebarOpen(true)} className="md:hidden text-slate-500 p-2"><Menu size={22}/></button>
             <div className="flex items-center gap-3">
               <img src={OPCO_LOGO_URL} className="w-9 h-9" alt="Logo" />
               <div>
                 <h1 className="text-sm font-black uppercase tracking-tighter text-slate-800">OPCO Buddy <Sparkles size={14} className="inline text-[#ca0607]"/></h1>
                 <div className="text-[9px] text-green-600 font-bold uppercase tracking-widest flex items-center gap-1">
                   <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div> {t.active}
                 </div>
               </div>
             </div>
           </div>
           <div className="flex items-center gap-4">
             <div className="hidden lg:flex items-center gap-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
               <span><Presentation size={14} className="inline mr-1 opco-text-red"/> {t.richPPT}</span>
               <span><BookOpen size={14} className="inline mr-1"/> Briefing</span>
               <span><ImageIcon size={14} className="inline mr-1"/> Infographics</span>
             </div>
             <button 
               onClick={exportEntireChat} 
               className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full text-[10px] font-black uppercase tracking-widest transition-all"
               title={t.export}
             >
               <FileText size={14} /> {t.export}
             </button>
           </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 custom-scrollbar bg-[#F8FAFC]">
          {activeChat?.messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
              <div className="flex flex-col gap-2 max-w-[95%] md:max-w-[85%]">
                <div className={`p-6 rounded-3xl shadow-lg border relative group ${msg.role === 'user' ? 'bg-[#9B9B9B] text-white shadow-slate-300' : 'bg-white text-slate-800 shadow-slate-200'}`}>
                  {msg.contextFiles && msg.contextFiles.length > 0 && <div className="text-[10px] font-bold opacity-60 mb-3 uppercase tracking-widest flex items-center gap-2"><Layout size={12}/> ANALYST MODE: {msg.contextFiles.join(', ')}</div>}
                  
                  <div className={`absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity`}>
                    <button 
                      onClick={() => copyToClipboard(msg.content, msg.id)} 
                      className={`p-1.5 rounded-lg transition-colors ${msg.role === 'user' ? 'bg-white/10 hover:bg-white/20' : 'bg-slate-50 hover:bg-slate-100'}`}
                      title={t.copy}
                    >
                      {copyingId === msg.id ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                    </button>
                  </div>

                  <div className={`prose prose-sm max-w-none ${msg.role === 'user' ? 'prose-invert text-white' : 'prose-slate'}`}>
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm]} 
                      components={{
                        p: ({children}) => <p><HighlightOpco>{children}</HighlightOpco></p>,
                        li: ({children}) => <li><HighlightOpco>{children}</HighlightOpco></li>,
                        h1: ({children}) => <h1><HighlightOpco>{children}</HighlightOpco></h1>,
                        h2: ({children}) => <h2><HighlightOpco>{children}</HighlightOpco></h2>,
                        h3: ({children}) => <h3><HighlightOpco>{children}</HighlightOpco></h3>,
                        h4: ({children}) => <h4><HighlightOpco>{children}</HighlightOpco></h4>,
                        strong: ({children}) => <strong><HighlightOpco>{children}</HighlightOpco></strong>,
                        em: ({children}) => <em><HighlightOpco>{children}</HighlightOpco></em>,
                        table: ({children}) => (<div className="overflow-x-auto my-6 rounded-xl border border-slate-300 shadow-md bg-white"><table className="min-w-full border-collapse text-left">{children}</table></div>),
                        thead: ({children}) => <thead className="bg-[#ca0607] text-white font-bold">{children}</thead>,
                        th: ({children}) => <th className="px-5 py-4 text-[10px] uppercase tracking-wider border-r border-white/20 last:border-0"><HighlightOpco>{children}</HighlightOpco></th>,
                        td: ({children}) => <td className="px-5 py-4 text-xs border-t border-slate-200 border-r border-slate-100 last:border-r-0 font-medium"><HighlightOpco>{children}</HighlightOpco></td>,
                        tr: ({children}) => <tr className="hover:bg-slate-50 transition-colors even:bg-slate-50/50">{children}</tr>
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>

                  {msg.groundingSources && msg.groundingSources.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                        <Globe size={12}/> {t.sources}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {msg.groundingSources.map((s, idx) => (
                          <a 
                            key={idx} 
                            href={s.uri} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-full text-[10px] font-bold text-slate-600 hover:border-[#ca0607] hover:text-[#ca0607] transition-all"
                          >
                            <ExternalLink size={10} /> {s.title}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {msg.generatedFiles && msg.generatedFiles.length > 0 && (
  <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
    {msg.generatedFiles.map((f, i) => 
      f.type === 'image' ? (
        <div key={i} className="col-span-full group relative overflow-hidden rounded-2xl border border-slate-200 shadow-xl bg-white p-2">
          <img src={f.url} alt="Infográfico" className="w-full h-auto rounded-xl" />
          <a href={f.url} download={f.name} className="absolute bottom-4 right-4 bg-white/95 p-4 rounded-full shadow-2xl text-[#ca0607] hover:scale-110 transition-transform">
            <Download size={22} />
          </a>
        </div>
      ) : (
        <a key={i} href={f.url} download={f.name} className="flex items-center gap-4 p-5 bg-white border border-slate-200 rounded-2xl hover:border-[#ca0607] hover:shadow-lg transition-all group relative overflow-hidden">
          <div className="p-3 bg-slate-50 rounded-xl text-[#ca0607]">
            {f.type === 'pptx' && <Presentation size={24}/>}
            {f.type === 'docx' && <FileTextIcon size={24}/>}
            {f.type === 'pdf' && <FileJson size={24}/>}
            {f.type === 'xlsx' && <FileSpreadsheet size={24}/>}
          </div>
          <div className="flex-1 truncate">
            <div className="text-[9px] font-black text-slate-400 uppercase mb-1">PRO EXPORT</div>
            <div className="text-xs font-bold truncate text-slate-800">{f.name}</div>
          </div>
          <Download size={18} className="text-[#ca0607] group-hover:scale-125 transition-transform"/>
        </a>
      )
    )}
  </div>
)}
                </div>
              </div>
            </div>
          ))}
          {isTyping && (<div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-md inline-flex items-center gap-4 w-fit"><div className="flex gap-1.5"><div className="w-2 h-2 bg-[#ca0607] rounded-full animate-bounce"></div><div className="w-2 h-2 bg-[#ca0607] rounded-full animate-bounce [animation-delay:0.2s]"></div><div className="w-2 h-2 bg-[#ca0607] rounded-full animate-bounce [animation-delay:0.4s]"></div></div>{statusMsg && <span className="text-[11px] font-black text-[#ca0607] uppercase tracking-tighter">{statusMsg}</span>}</div>)}
          <div ref={messagesEndRef} className="h-4" />
        </div>

        <div className="p-6 md:p-8 border-t bg-white relative z-40 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)]">
          <div className="max-w-4xl mx-auto flex flex-col gap-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
               <div className="flex items-center gap-3">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0">{t.searchingIn}</span>
                  <div className="flex flex-wrap gap-2">
                    {focusedDocs.length > 0 ? (
                      <div className="flex items-center gap-2 bg-[#ca0607]/10 text-[#ca0607] px-3 py-1.5 rounded-full border border-[#ca0607]/20 text-[10px] font-bold shadow-sm">
                        <Files size={12}/> {focusedDocs.length} {t.multiFiles}
                        <button onClick={() => setSelectedDocIds([])} className="hover:bg-[#ca0607] hover:text-white rounded-full p-0.5"><X size={10}/></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 bg-slate-100 text-slate-500 px-3 py-1.5 rounded-full border border-slate-200 text-[10px] font-bold shadow-sm">
                        <Files size={12}/> {t.allFiles}
                      </div>
                    )}
                  </div>
               </div>
               
               {/* Analysis Mode Toggle */}
               <div className="flex items-center bg-slate-100 rounded-full p-1 border border-slate-200">
                  <button 
                    onClick={() => setIsWebSearchEnabled(false)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${!isWebSearchEnabled ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    <FileText size={12}/> {t.filesOnly}
                  </button>
                  <button 
                    onClick={() => setIsWebSearchEnabled(true)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${isWebSearchEnabled ? 'bg-white text-[#ca0607] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    <Search size={12}/> {t.filesPlusWeb}
                  </button>
               </div>
            </div>

            <form onSubmit={handleSendMessage} className="flex items-center gap-3">
              <div className="flex items-center bg-slate-50 border-2 border-slate-100 rounded-3xl flex-1 px-6 focus-within:border-[#ca0607] focus-within:bg-white transition-all shadow-inner relative">
                <input 
                  type="text" 
                  value={input} 
                  onChange={e => setInput(e.target.value)} 
                  placeholder={t.placeholder} 
                  className="flex-1 bg-transparent py-4 focus:outline-none text-sm font-semibold text-slate-700" 
                />
              </div>
              <button type="submit" disabled={isTyping || !input.trim() || !activeChatId} className="bg-[#ca0607] text-white w-14 h-14 rounded-3xl flex items-center justify-center hover:bg-black disabled:bg-slate-200 shadow-xl transition-all shrink-0">
                <Send size={22} />
              </button>
            </form>

            <div className="pt-4 flex flex-col md:flex-row items-center justify-between gap-4 border-t border-slate-100">
              <div className="flex flex-wrap justify-center gap-x-6 text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                <div className="flex items-center gap-2"><MapPin size={10} className="opco-text-red"/> Azeitão, Portugal</div>
                <div className="flex items-center gap-2"><Mail size={10} className="opco-text-red"/> opco@opco.pt</div>
                <div className="flex items-center gap-2 font-black text-slate-500"><Phone size={10} className="opco-text-red"/> OPCO +351 210 152 492</div>
              </div>
              <div className="transition-all hover:scale-105 cursor-help" title="OPCO Digital Systems">
                <img src={OPCO_DIGITAL_SYSTEMS_LOGO_URL} className="h-10 md:h-12 object-contain" alt="OPCO Digital Systems" />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) { const root = createRoot(rootElement); root.render(<App />); }
