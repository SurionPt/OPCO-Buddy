
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
  FileSpreadsheet,
  CheckCircle2,
  MessageSquare,
  Globe,
  ChevronDown,
  Files,
  Mic,
  MicOff,
  Trash2,
  AlertCircle,
  FileJson
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import * as mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import * as docx from 'docx';
import PptxGenJS from 'pptxgenjs';

// --- Localization Config ---
const LANGUAGES = [
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'en', name: 'Inglês', flag: '🇬🇧' }
];

const TRANSLATIONS: Record<string, any> = {
  pt: {
    welcome: "Olá, sou o OPCO Buddy, o seu Assistente de Inteligência Artificial especializado em consultoria. Em que posso ajudar hoje?",
    placeholder: "Pergunte ou peça uma análise...",
    placeholderVoice: "A ouvir... fale agora",
    newChat: "NOVA PESQUISA",
    files: "FICHEIROS",
    recent: "RECENTES",
    upload: "Upload de Ficheiros",
    active: "Ativo",
    dynamicTables: "Tabelas Dinâmicas",
    richPPT: "PPT Ricos",
    visualValidation: "Validação Visual",
    systemPrompt: "És o OPCO Buddy, especialista em consultoria e RAG. Quando gerares tabelas no texto, fá-lo sempre de forma clara. Oferece-te para exportar os dados para PDF, Excel, Word ou PPT se for útil para o utilizador.",
    fileGenerated: "Ficheiro Gerado",
    loading: "A processar...",
    engine: "Motor OPCO Buddy",
    langHeading: "IDIOMA DO LAYOUT",
    searchingIn: "A pesquisar em:",
    allFiles: "Todos os ficheiros",
    voiceInput: "Prompt por Voz",
    apiKeyRequired: "Configurar Chave API",
    exporting: "A gerar ficheiro profissional..."
  }
};

const OPCO_LOGO_URL = 'https://raw.githubusercontent.com/SurionPt/OCPCO/refs/heads/main/esfera%2050x47.png';
const NEURAL_BG_URL = 'https://raw.githubusercontent.com/SurionPt/OCPCO/refs/heads/main/neural.jpg';
const STORAGE_KEY = 'opco_buddy_chats_v15';
const CHART_COLORS = ['#ca0607', '#333333', '#99a288', '#666666', '#ca0607cc', '#333333cc'];

interface Document {
  id: string;
  name: string;
  content: string;
  size: string;
  type: string;
}

interface ChartData {
  chartType: 'bar' | 'line' | 'pie';
  title: string;
  data: Array<{ label: string; value: number }>;
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
  chart?: ChartData;
  contextFile?: string;
}

interface Chat {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
}

// --- Tools Definitions ---
const generateCorporateFileTool: FunctionDeclaration = {
  name: 'generate_corporate_file',
  parameters: {
    type: Type.OBJECT,
    description: 'Gera documentos profissionais de alta qualidade (PDF, DOCX, XLSX, PPTX) baseados nos dados analisados.',
    properties: {
      fileType: { type: Type.STRING, description: 'Tipo: pdf, docx, pptx ou xlsx', enum: ['pdf', 'docx', 'pptx', 'xlsx'] },
      fileName: { type: Type.STRING, description: 'Nome do ficheiro sem extensão' },
      title: { type: Type.STRING, description: 'Título principal do documento' },
      tableData: {
        type: Type.ARRAY,
        items: { type: Type.ARRAY, items: { type: Type.STRING } },
        description: 'Dados em formato de matriz (linhas e colunas) para tabelas em Excel/Word/PPT.'
      },
      content: { type: Type.STRING, description: 'Conteúdo textual principal ou resumo.' }
    },
    required: ['fileType', 'fileName', 'title']
  }
};

const generateChartTool: FunctionDeclaration = {
  name: 'generate_chart',
  parameters: {
    type: Type.OBJECT,
    description: 'Gera um gráfico visual interativo baseado em dados numéricos.',
    properties: {
      chartType: { type: Type.STRING, enum: ['bar', 'line', 'pie'] },
      title: { type: Type.STRING },
      data: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            label: { type: Type.STRING },
            value: { type: Type.NUMBER }
          },
          required: ['label', 'value']
        }
      }
    },
    required: ['chartType', 'title', 'data']
  }
};

const App = () => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [currentLang, setCurrentLang] = useState('pt');
  const [isRecording, setIsRecording] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(true);

  const t = useMemo(() => TRANSLATIONS[currentLang] || TRANSLATIONS.pt, [currentLang]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  const activeChat = useMemo(() => chats.find(c => c.id === activeChatId), [chats, activeChatId]);
  const focusedDoc = useMemo(() => selectedDocId ? documents.find(d => d.id === selectedDocId) : null, [selectedDocId, documents]);

  useEffect(() => {
    if (window.aistudio?.hasSelectedApiKey) {
      window.aistudio.hasSelectedApiKey().then((has: boolean) => setHasApiKey(has));
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = currentLang === 'pt' ? 'pt-PT' : 'en-US';
      recognition.onresult = (e: any) => {
        let text = '';
        for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
        setInput(text);
      };
      recognition.onstart = () => setIsRecording(true);
      recognition.onend = () => setIsRecording(false);
      recognition.onerror = () => setIsRecording(false);
      recognitionRef.current = recognition;
    }

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setChats(parsed);
          setActiveChatId(parsed[0].id);
        } else createNewChat();
      } catch (e) { createNewChat(); }
    } else createNewChat();

    return () => { if (recognitionRef.current) recognitionRef.current.stop(); };
  }, []);

  useEffect(() => {
    if (Array.isArray(chats) && chats.length > 0) localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
  }, [chats]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chats, isTyping]);

  const toggleRecording = () => {
    if (!recognitionRef.current) return;
    if (isRecording) recognitionRef.current.stop();
    else {
      try { recognitionRef.current.start(); } catch (e) {}
    }
  };

  const createNewChat = () => {
    const id = Date.now().toString();
    const newChat: Chat = {
      id,
      title: t.newChat,
      messages: [{ id: '1', role: 'assistant', content: t.welcome, timestamp: new Date().toISOString() }],
      createdAt: new Date().toISOString()
    };
    setChats(prev => [newChat, ...prev]);
    setActiveChatId(id);
    setSelectedDocId(null);
  };

  const deleteChat = (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    setChats(prev => {
      const filtered = prev.filter(c => c.id !== chatId);
      if (activeChatId === chatId) setActiveChatId(filtered[0]?.id || null);
      return filtered;
    });
  };

  // --- Export Generators ---

  const generatePDF = (args: any): GeneratedFile => {
    const doc = new jsPDF();
    doc.setFillColor(202, 6, 7);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255);
    doc.setFontSize(18);
    doc.text(args.title || 'Relatório OPCO', 15, 25);
    doc.setTextColor(50);
    doc.setFontSize(10);
    doc.text(`Gerado por OPCO Buddy em ${new Date().toLocaleDateString()}`, 15, 35);
    
    let y = 55;
    if (args.content) {
      const splitText = doc.splitTextToSize(args.content, 180);
      doc.text(splitText, 15, y);
      y += (splitText.length * 5) + 10;
    }

    if (args.tableData && args.tableData.length > 0) {
      // Basic PDF Table Fallback (For better PDF tables, autoTable would be used, but keeping it simple with vanilla jsPDF)
      args.tableData.forEach((row: any[], i: number) => {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.setFont(i === 0 ? "helvetica" : "helvetica", i === 0 ? "bold" : "normal");
        let x = 15;
        row.forEach((cell: string, j: number) => {
          doc.text(String(cell).substring(0, 20), x, y);
          x += 35;
        });
        y += 7;
        doc.setDrawColor(230);
        doc.line(15, y - 5, 200, y - 5);
      });
    }

    return { name: `${args.fileName}.pdf`, url: URL.createObjectURL(doc.output('blob')), type: 'pdf' };
  };

  const generateXLSX = (args: any): GeneratedFile => {
    const ws = XLSX.utils.aoa_to_sheet(args.tableData || [['No data']]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Dados");
    const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    return { name: `${args.fileName}.xlsx`, url: URL.createObjectURL(blob), type: 'xlsx' };
  };

  const generateDOCX = async (args: any): Promise<GeneratedFile> => {
    const docObj = new docx.Document({
      sections: [{
        properties: {},
        children: [
          new docx.Paragraph({ text: args.title, heading: docx.HeadingLevel.HEADING_1 }),
          new docx.Paragraph({ text: args.content || "" }),
          new docx.Table({
            rows: (args.tableData || []).map((row: string[]) => 
              new docx.TableRow({
                children: row.map(cell => new docx.TableCell({ children: [new docx.Paragraph(cell)] }))
              })
            )
          })
        ]
      }]
    });
    const blob = await docx.Packer.toBlob(docObj);
    return { name: `${args.fileName}.docx`, url: URL.createObjectURL(blob), type: 'docx' };
  };

  const generatePPTX = (args: any): GeneratedFile => {
    const pres = new PptxGenJS();
    const slide = pres.addSlide();
    slide.addText(args.title, { x: 0.5, y: 0.5, fontSize: 24, color: 'ca0607', bold: true });
    if (args.tableData) {
      slide.addTable(args.tableData, { x: 0.5, y: 1.5, w: 9, h: 4, border: { pt: 1, color: 'E2E8F0' }, fill: { color: 'F8FAFC' } });
    }
    // Fix: Using correct output type options for PptxGenJS write method
    const blobPromise = pres.write({ outputType: 'blob' });
    // This is async in real life, but for the mock tool we handle the promise inside handleSendMessage
    return { name: `${args.fileName}.pptx`, url: "", type: 'pptx' }; // Placeholder for the actual blob
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isTyping || !activeChatId) return;

    if (isRecording) recognitionRef.current?.stop();

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input, timestamp: new Date().toISOString(), contextFile: focusedDoc?.name };
    setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, messages: [...c.messages, userMsg] } : c));
    
    const capturedInput = input;
    setInput('');
    setIsTyping(true);

    try {
      // Fix: Strictly following initialization guidelines for @google/genai
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const context = focusedDoc 
        ? `CONTEXTO FICHEIRO: "${focusedDoc.name}"\n${focusedDoc.content}` 
        : documents.map(d => `[${d.name}]: ${d.content}`).join('\n---\n');

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `${context}\n\nUtilizador: ${capturedInput}`,
        config: {
          systemInstruction: t.systemPrompt,
          tools: [{ functionDeclarations: [generateCorporateFileTool, generateChartTool] }]
        }
      });

      let content = response.text || "";
      let files: GeneratedFile[] = [];
      let chartData: ChartData | undefined = undefined;

      if (response.functionCalls) {
        setStatusMsg(t.exporting);
        for (const fc of response.functionCalls) {
          const args = fc.args as any;
          if (fc.name === 'generate_chart') chartData = args;
          else if (fc.name === 'generate_corporate_file') {
            let file;
            if (args.fileType === 'pdf') file = generatePDF(args);
            else if (args.fileType === 'xlsx') file = generateXLSX(args);
            else if (args.fileType === 'docx') file = await generateDOCX(args);
            else if (args.fileType === 'pptx') {
              // Handle PPT async khusus
              const pres = new PptxGenJS();
              const slide = pres.addSlide();
              slide.addText(args.title, { x: 0.5, y: 0.5, fontSize: 24, color: 'ca0607', bold: true });
              if (args.tableData) slide.addTable(args.tableData, { x: 0.5, y: 1.5, w: 9 });
              // Fix: Using correct output type options for PptxGenJS write method
              const blob = await pres.write({ outputType: 'blob' }) as Blob;
              file = { name: `${args.fileName}.pptx`, url: URL.createObjectURL(blob), type: 'pptx' as const };
            }
            if (file) files.push(file);
          }
        }
      }
      addAssistantMessage(content, { generatedFiles: files, chart: chartData });
    } catch (e) {
      console.error(e);
      addAssistantMessage("Ocorreu um erro no processamento. Verifique sua conexão e chave API.");
    } finally { setIsTyping(false); setStatusMsg(''); }
  };

  const addAssistantMessage = (content: string, extra = {}) => {
    const msg: Message = { id: Date.now().toString(), role: 'assistant', content, timestamp: new Date().toISOString(), ...extra };
    setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, messages: [...c.messages, msg] } : c));
  };

  return (
    <div className="flex h-[100dvh] bg-slate-50 overflow-hidden font-inter">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#99a288] border-r border-slate-800/50 flex flex-col transition-transform duration-300 md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: `url("${NEURAL_BG_URL}")`, backgroundSize: 'cover' }}></div>
        <div className="relative z-10 flex flex-col h-full">
          <div className="p-6 flex items-center justify-between border-b border-white/10">
            <div className="flex items-center gap-2 text-white font-bold text-lg cursor-pointer" onClick={() => window.location.reload()}>
              <img src={OPCO_LOGO_URL} className="w-8 h-8" alt="Logo" /> <span>OPCO Buddy</span>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-white/40"><X size={20}/></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6 custom-scrollbar">
            <div className="px-2">
              <div className="text-[10px] text-white font-bold uppercase tracking-widest mb-2 flex items-center gap-2"><Globe size={12} className="text-white/60"/> {t.langHeading}</div>
              <select value={currentLang} onChange={(e) => setCurrentLang(e.target.value)} className="w-full bg-white/10 border border-white/20 rounded-xl py-2 px-3 text-xs text-white focus:outline-none appearance-none cursor-pointer">
                {LANGUAGES.map(lang => <option key={lang.code} value={lang.code} className="bg-[#99a288]">{lang.flag} {lang.name}</option>)}
              </select>
            </div>
            <button onClick={createNewChat} className="flex items-center gap-3 p-3.5 bg-[#ca0607] hover:bg-black border border-white/10 rounded-xl text-white text-xs font-bold transition-all shadow-lg uppercase tracking-wider">
              <PlusCircle size={16} /> {t.newChat}
            </button>
            <div className="space-y-4">
              <div className="text-[10px] text-white font-bold uppercase tracking-widest px-2 flex items-center gap-2"><FileBadge size={12}/> {t.files}</div>
              <div className="space-y-1">
                {documents.map(doc => (
                  <div key={doc.id} onClick={() => setSelectedDocId(prev => prev === doc.id ? null : doc.id)} className={`group p-2.5 rounded-lg text-[10px] flex items-center gap-2 cursor-pointer transition-all border ${selectedDocId === doc.id ? 'bg-[#ca0607] text-white border-white/40 shadow-lg' : 'bg-white/5 text-white/80 hover:bg-white/10 border-transparent'}`}>
                    <FileText size={12} className="shrink-0" />
                    <span className="truncate flex-1">{doc.name}</span>
                    <button onClick={(e) => { e.stopPropagation(); setDocuments(d => d.filter(item => item.id !== doc.id)); if (selectedDocId === doc.id) setSelectedDocId(null); }}><X size={12}/></button>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <div className="text-[10px] text-white font-bold uppercase tracking-widest px-2 flex items-center gap-2"><MessageSquare size={12}/> {t.recent}</div>
              <div className="space-y-1">
                {chats.map(c => (
                  <div key={c.id} onClick={() => setActiveChatId(c.id)} className={`group p-3 rounded-lg text-[11px] flex justify-between items-center cursor-pointer transition-all border ${activeChatId === c.id ? 'bg-white/20 text-white font-bold border-white/30' : 'text-white/70 border-transparent hover:bg-white/5'}`}>
                    <span className="truncate flex-1">{c.title}</span>
                    <button onClick={(e) => deleteChat(e, c.id)} className="opacity-0 group-hover:opacity-100"><Trash2 size={12}/></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="p-4 border-t border-white/10">
             <button onClick={() => fileInputRef.current?.click()} className="w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-[11px] font-bold flex items-center justify-center gap-2 border border-white/10 uppercase tracking-wide">
               {isUploading ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />} {t.upload}
             </button>
             <input type="file" ref={fileInputRef} className="hidden" multiple onChange={(e) => {
               const files = e.target.files;
               if (!files) return;
               setIsUploading(true);
               Array.from(files).forEach(async f => {
                 const ext = f.name.split('.').pop()?.toLowerCase();
                 let content = "";
                 try {
                   if (ext === 'pdf') {
                     const pdf = await (window as any).pdfjsLib.getDocument({ data: await f.arrayBuffer() }).promise;
                     for (let i = 1; i <= pdf.numPages; i++) {
                       const page = await pdf.getPage(i);
                       content += (await page.getTextContent()).items.map((it: any) => it.str).join(' ') + '\n';
                     }
                   } else if (ext === 'docx') content = (await mammoth.extractRawText({ arrayBuffer: await f.arrayBuffer() })).value;
                   else if (ext?.includes('xls')) {
                     const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' });
                     content = wb.SheetNames.map(n => XLSX.utils.sheet_to_txt(wb.Sheets[n])).join('\n');
                   } else content = await f.text();
                   setDocuments(prev => [...prev, { id: Math.random().toString(36).substr(2, 9), name: f.name, content, size: `${(f.size/1024).toFixed(1)}KB`, type: ext || 'file' }]);
                 } catch (err) {}
                 setIsUploading(false);
               });
             }} />
          </div>
        </div>
      </aside>

      {/* Main Content */}
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
          <div className="hidden lg:flex items-center gap-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            <span><TableIcon size={14} className="inline mr-1"/> {t.dynamicTables}</span>
            <span><Presentation size={14} className="inline mr-1"/> {t.richPPT}</span>
            <span><CheckCircle2 size={14} className="inline mr-1"/> {t.visualValidation}</span>
          </div>
        </header>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 custom-scrollbar bg-[#F8FAFC]">
          {activeChat?.messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
              <div className="flex flex-col gap-2 max-w-[95%] md:max-w-[85%]">
                <div className={`p-6 rounded-3xl shadow-lg border ${msg.role === 'user' ? 'bg-[#9B9B9B] text-white' : 'bg-white text-slate-800'}`}>
                  {msg.contextFile && <div className="text-[10px] font-bold opacity-60 mb-3 uppercase tracking-widest flex items-center gap-1"><FileText size={10}/> CONTEXTO: {msg.contextFile}</div>}
                  <div className={`prose prose-sm max-w-none ${msg.role === 'user' ? 'prose-invert text-white' : 'prose-slate'}`}>
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm]}
                      components={{
                        table: ({children}) => (
                          <div className="overflow-x-auto my-6 rounded-xl border border-slate-200 shadow-sm">
                            <table className="min-w-full divide-y divide-slate-200">
                              {children}
                            </table>
                          </div>
                        ),
                        thead: ({children}) => <thead className="bg-[#ca0607] text-white">{children}</thead>,
                        th: ({children}) => <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest">{children}</th>,
                        td: ({children}) => <td className="px-4 py-3 text-xs border-t border-slate-100">{children}</td>,
                        tr: ({children}) => <tr className="hover:bg-slate-50 transition-colors">{children}</tr>
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                  
                  {msg.chart && (
                    <div className="mt-6 p-6 bg-slate-50 rounded-3xl border border-slate-200 shadow-inner h-72 w-full">
                      <h3 className="text-xs font-black uppercase tracking-widest text-slate-800 mb-4">{msg.chart.title}</h3>
                      <ResponsiveContainer width="100%" height="100%">
                        {msg.chart.chartType === 'bar' ? (
                          <BarChart data={msg.chart.data}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis dataKey="label" fontSize={10} />
                            <Tooltip />
                            <Bar dataKey="value" fill="#ca0607" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        ) : (
                          <PieChart>
                            <Pie data={msg.chart.data} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={80}>
                              {msg.chart.data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        )}
                      </ResponsiveContainer>
                    </div>
                  )}

                  {msg.generatedFiles && msg.generatedFiles.length > 0 && (
                    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3">
                      {msg.generatedFiles.map((f, i) => (
                        <a key={i} href={f.url} download={f.name} className="flex items-center gap-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl hover:border-[#ca0607] hover:bg-white transition-all group shadow-sm">
                          <div className="p-3 bg-white rounded-xl shadow-inner text-[#ca0607]">
                            {f.type === 'xlsx' ? <FileSpreadsheet size={20}/> : f.type === 'pptx' ? <Presentation size={20}/> : <FileText size={20}/>}
                          </div>
                          <div className="flex-1 truncate">
                            <div className="text-[9px] font-black text-slate-400 uppercase mb-1">{f.type.toUpperCase()} PROFISSIONAL</div>
                            <div className="text-xs font-bold truncate text-slate-800">{f.name}</div>
                          </div>
                          <Download size={18} className="text-slate-300 group-hover:text-[#ca0607]" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-md inline-flex items-center gap-4 w-fit">
              <div className="flex gap-1.5"><div className="w-2 h-2 bg-[#ca0607] rounded-full animate-bounce"></div><div className="w-2 h-2 bg-[#ca0607] rounded-full animate-bounce [animation-delay:0.2s]"></div><div className="w-2 h-2 bg-[#ca0607] rounded-full animate-bounce [animation-delay:0.4s]"></div></div>
              {statusMsg && <span className="text-[11px] font-black text-[#ca0607] uppercase tracking-tighter">{statusMsg}</span>}
            </div>
          )}
          <div ref={messagesEndRef} className="h-4" />
        </div>

        {/* Input Controls */}
        <div className="p-6 md:p-8 border-t bg-white relative z-40 shadow-2xl">
          <div className="max-w-4xl mx-auto flex flex-col gap-2">
            <div className="flex items-center gap-2 mb-1 px-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.searchingIn}</span>
              {focusedDoc ? (
                <div className="flex items-center gap-2 bg-[#ca0607]/10 text-[#ca0607] px-3 py-1.5 rounded-full border border-[#ca0607]/20 text-[10px] font-bold shadow-sm animate-fade-in">
                  <FileBadge size={12}/> {focusedDoc.name}
                  <button onClick={() => setSelectedDocId(null)} className="hover:bg-[#ca0607] hover:text-white rounded-full p-0.5"><X size={10}/></button>
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-slate-100 text-slate-600 px-3 py-1.5 rounded-full border border-slate-200 text-[10px] font-bold shadow-sm">
                  <Files size={12}/> {t.allFiles}
                </div>
              )}
            </div>
            <form onSubmit={handleSendMessage} className="flex items-center gap-3">
              <div className="flex items-center bg-slate-50 border-2 border-slate-100 rounded-3xl flex-1 px-6 focus-within:border-[#ca0607] focus-within:bg-white transition-all shadow-inner relative">
                <input 
                  type="text" 
                  value={input} 
                  onChange={e => setInput(e.target.value)} 
                  placeholder={isRecording ? t.placeholderVoice : t.placeholder} 
                  className="flex-1 bg-transparent py-4 focus:outline-none text-sm font-semibold text-slate-700 pr-12" 
                />
                <button 
                  type="button" 
                  onClick={toggleRecording} 
                  className={`p-2 transition-all rounded-full ${isRecording ? 'text-red-500 bg-red-50 animate-pulse' : 'text-slate-400 hover:text-red-500'}`}
                >
                  {isRecording ? <MicOff size={22} /> : <Mic size={22} />}
                </button>
              </div>
              <button type="submit" disabled={isTyping || !input.trim() || !activeChatId} className="bg-[#ca0607] text-white w-14 h-14 rounded-3xl flex items-center justify-center hover:bg-black disabled:bg-slate-200 shadow-xl transition-all shrink-0"><Send size={22} /></button>
            </form>
            <div className="pt-4 flex flex-col md:flex-row items-center justify-between gap-4 border-t border-slate-50">
              <div className="flex flex-wrap justify-center gap-x-6 text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                <div className="flex items-center gap-2"><MapPin size={10} className="text-[#ca0607]"/> Azeitão, Portugal</div>
                <div className="flex items-center gap-2"><Phone size={10} className="text-[#ca0607]"/> +351 210 152 492</div>
                <div className="flex items-center gap-2"><Mail size={10} className="text-[#ca0607]"/> opco@opco.pt</div>
              </div>
              <div className="text-[10px] text-slate-300 font-black uppercase tracking-tighter">{t.engine} v15.0 (Export Multi-Format)</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(<App />);
}
