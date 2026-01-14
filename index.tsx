
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
  MessageSquare,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  Image as LucideImage,
  Globe,
  Languages,
  ChevronDown,
  PieChart as PieIcon,
  TrendingUp,
  Files
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
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
  { code: 'en', name: 'Inglês', flag: '🇬🇧' },
  { code: 'fr', name: 'Francês', flag: '🇫🇷' },
  { code: 'de', name: 'Alemão', flag: '🇩🇪' },
  { code: 'es', name: 'Espanhol', flag: '🇪🇸' },
  { code: 'nl', name: 'Holandês', flag: '🇳🇱' },
  { code: 'zh', name: 'Mandarim', flag: '🇨🇳' },
  { code: 'ja', name: 'Japonês', flag: '🇯🇵' }
];

const TRANSLATIONS: Record<string, any> = {
  pt: {
    welcome: "Olá, sou o OPCO Buddy, o seu Assistente de Inteligência Artificial. Em que posso ajudar hoje?",
    placeholder: "Pergunte...",
    newChat: "Nova Consulta OPCO",
    files: "FICHEIROS",
    recent: "RECENTES",
    upload: "Upload de Ficheiros",
    active: "Ativo",
    dynamicTables: "Tabelas Dinâmicas",
    richPPT: "PPT Ricos",
    visualValidation: "Validação Visual",
    systemPrompt: "És o OPCO Buddy, especialista em consultoria. Responde sempre em Português.",
    fileGenerated: "Ficheiro Gerado",
    loading: "A gerar...",
    engine: "Motor OPCO Buddy",
    langHeading: "IDIOMA DO LAYOUT",
    chartTitle: "Visualização de Dados",
    searchingIn: "A pesquisar em:",
    allFiles: "Todos os ficheiros",
    selectedFile: "Ficheiro selecionado"
  },
  en: {
    welcome: "Hello, I am OPCO Buddy, your AI Assistant. How can I help today?",
    placeholder: "Ask anything...",
    newChat: "New OPCO Query",
    files: "FILES",
    recent: "RECENT",
    upload: "Upload Files",
    active: "Active",
    dynamicTables: "Dynamic Tables",
    richPPT: "Rich PPT",
    visualValidation: "Visual Validation",
    systemPrompt: "You are OPCO Buddy, a consulting specialist. Always respond in English.",
    fileGenerated: "File Generated",
    loading: "Loading...",
    engine: "OPCO Buddy Engine",
    langHeading: "LAYOUT LANGUAGE",
    chartTitle: "Data Visualization",
    searchingIn: "Searching in:",
    allFiles: "All files",
    selectedFile: "Selected file"
  }
};

// --- Models & Config ---
const OPCO_LOGO_URL = 'https://raw.githubusercontent.com/SurionPt/OCPCO/refs/heads/main/esfera%2050x47.png';
const NEURAL_BG_URL = 'https://raw.githubusercontent.com/SurionPt/OCPCO/refs/heads/main/neural.jpg';
const STORAGE_KEY = 'opco_buddy_chats_v8';
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

const generateCorporateFileTool: FunctionDeclaration = {
  name: 'generate_corporate_file',
  parameters: {
    type: Type.OBJECT,
    description: 'Gera documentos e apresentações profissionais de alta fidelidade.',
    properties: {
      fileType: { type: Type.STRING, description: 'Tipo: pdf, docx, pptx ou xlsx', enum: ['pdf', 'docx', 'pptx', 'xlsx'] },
      fileName: { type: Type.STRING, description: 'Nome do ficheiro' },
      title: { type: Type.STRING, description: 'Título principal' },
      sections: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            heading: { type: Type.STRING },
            body: { type: Type.STRING },
            visualDescription: { type: Type.STRING, description: 'Descrição rica para o elemento gráfico AI.' }
          }
        }
      },
      tableData: {
        type: Type.ARRAY,
        items: { type: Type.ARRAY, items: { type: Type.STRING } },
        description: 'Dados matriciais para Excel.'
      }
    },
    required: ['fileType', 'fileName', 'title']
  }
};

const generateChartTool: FunctionDeclaration = {
  name: 'generate_chart',
  parameters: {
    type: Type.OBJECT,
    description: 'Gera um gráfico visual para exibição direta no chat baseado em dados numéricos fornecidos.',
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

const base64ToUint8Array = (base64: string) => {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
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

  const t = useMemo(() => TRANSLATIONS[currentLang] || TRANSLATIONS.pt, [currentLang]);
  const currentLangName = useMemo(() => LANGUAGES.find(l => l.code === currentLang)?.name || 'Português', [currentLang]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeChat = useMemo(() => chats.find(c => c.id === activeChatId), [chats, activeChatId]);
  const focusedDoc = useMemo(() => selectedDocId ? documents.find(d => d.id === selectedDocId) : null, [selectedDocId, documents]);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setChats(parsed);
          if (parsed.length > 0) setActiveChatId(parsed[0].id);
        } else createNewChat();
      } catch (e) { createNewChat(); }
    } else createNewChat();
  }, []);

  useEffect(() => {
    if (Array.isArray(chats) && chats.length > 0) localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
    else if (Array.isArray(chats) && chats.length === 0) localStorage.removeItem(STORAGE_KEY);
  }, [chats]);

  useEffect(() => {
    setChats(prev => {
      if (!Array.isArray(prev)) return [];
      return prev.map(chat => {
        if (!chat || !Array.isArray(chat.messages)) return chat;
        const isStandardTitle = Object.values(TRANSLATIONS).some(trans => trans.newChat === chat.title);
        const updatedMessages = chat.messages.map((msg, index) => {
          if (index === 0 && msg && msg.role === 'assistant') {
             const isStandardWelcome = Object.values(TRANSLATIONS).some(trans => trans.welcome === msg.content);
             if (isStandardWelcome) return { ...msg, content: t.welcome };
          }
          return msg;
        });
        return { ...chat, title: isStandardTitle ? t.newChat : chat.title, messages: updatedMessages };
      });
    });
  }, [currentLang, t.newChat, t.welcome]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chats, isTyping]);

  const createNewChat = () => {
    const id = Date.now().toString();
    const newChat: Chat = {
      id,
      title: t.newChat,
      messages: [{ id: '1', role: 'assistant', content: t.welcome, timestamp: new Date().toISOString() }],
      createdAt: new Date().toISOString()
    };
    setChats(prev => [newChat, ...(Array.isArray(prev) ? prev : [])]);
    setActiveChatId(id);
    setSelectedDocId(null);
  };

  const deleteChat = (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    setChats(prev => {
      const newChats = prev.filter(c => c && c.id !== chatId);
      if (activeChatId === chatId) setActiveChatId(newChats.length > 0 ? newChats[0].id : null);
      return newChats;
    });
  };

  const toggleDocSelection = (docId: string) => {
    setSelectedDocId(prev => prev === docId ? null : docId);
  };

  const generatePDF = (args: any): GeneratedFile => {
    const doc = new jsPDF();
    doc.setFillColor(202, 6, 7);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255);
    doc.setFontSize(22);
    doc.text(args.title || 'Relatório', 15, 25);
    let y = 55;
    (args.sections || []).forEach((sec: any) => {
      if (y > 220) { doc.addPage(); y = 20; }
      doc.setFontSize(14); doc.setTextColor(202, 6, 7);
      doc.text(sec.heading || '', 15, y); y += 8;
      doc.setFontSize(10); doc.setTextColor(50);
      const lines = doc.splitTextToSize(sec.body || '', 180);
      doc.text(lines, 15, y); y += (lines.length * 5) + 5;
      if (sec.base64Image) {
        try { doc.addImage(`data:image/png;base64,${sec.base64Image}`, 'PNG', 15, y, 180, 80); y += 90; } catch (e) {}
      }
    });
    return { name: `${args.fileName || 'doc'}.pdf`, url: URL.createObjectURL(doc.output('blob')), type: 'pdf' };
  };

  const generateWord = async (args: any): Promise<GeneratedFile> => {
    const children = [new docx.Paragraph({ text: args.title || 'Relatório', heading: docx.HeadingLevel.HEADING_1, alignment: docx.AlignmentType.CENTER, spacing: { after: 400 } })];
    for (const sec of (args.sections || [])) {
      children.push(new docx.Paragraph({ text: sec.heading || '', heading: docx.HeadingLevel.HEADING_2, spacing: { before: 400, after: 200 } }));
      children.push(new docx.Paragraph({ text: sec.body || '', spacing: { after: 200 } }));
      if (sec.base64Image) {
        try { children.push(new docx.Paragraph({ children: [new docx.ImageRun({ data: base64ToUint8Array(sec.base64Image), transformation: { width: 500, height: 300 } } as any)], alignment: docx.AlignmentType.CENTER })); } catch (e) {}
      }
    }
    const blob = await docx.Packer.toBlob(new docx.Document({ sections: [{ children }] }));
    return { name: `${args.fileName || 'doc'}.docx`, url: URL.createObjectURL(blob), type: 'docx' };
  };

  const generatePPT = async (args: any): Promise<GeneratedFile> => {
    const pres = new PptxGenJS();
    let titleSlide = pres.addSlide();
    titleSlide.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 1.5, fill: { color: 'ca0607' } });
    titleSlide.addText(args.title || 'Apresentação', { x: 0, y: 0.3, w: '100%', h: 1, fontSize: 38, color: 'FFFFFF', align: 'center', bold: true });
    for (const sec of (args.sections || [])) {
      let s = pres.addSlide();
      s.addText(sec.heading || 'Slide', { x: 0.5, y: 0.3, w: '90%', h: 0.7, fontSize: 24, color: 'ca0607', bold: true });
      if (sec.base64Image) {
        s.addText(sec.body || '', { x: 0.5, y: 1.2, w: 4.5, h: 3.5, fontSize: 14 });
        try { s.addImage({ data: `data:image/png;base64,${sec.base64Image}`, x: 5.3, y: 1.3, w: 4.2, h: 3.3 }); } catch (e) {}
      } else s.addText(sec.body || '', { x: 0.5, y: 1.2, w: '90%', h: 3.5, fontSize: 16 });
    }
    const blob = await pres.write({ outputType: 'blob' }) as Blob;
    return { name: `${args.fileName || 'pres'}.pptx`, url: URL.createObjectURL(blob), type: 'pptx' };
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isTyping || !activeChatId) return;

    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: input, timestamp: new Date().toISOString(), contextFile: focusedDoc?.name };
    setChats(prev => prev.map(chat => chat.id === activeChatId ? { ...chat, messages: [...chat.messages, userMessage] } : chat));
    
    const capturedInput = input;
    setInput(''); 
    setIsTyping(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      let context = focusedDoc 
        ? `CONTEXTO RESTRITO (RESPONDA APENAS COM BASE NESTE FICHEIRO): Documento "${focusedDoc.name}" - Conteúdo: ${focusedDoc.content}` 
        : `CONTEXTO GLOBAL (PESQUISE EM TODOS ESTES FICHEIROS): ${documents.map(d => `[${d.name}]: ${d.content}`).join('\n')}`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `${context}\n\nUtilizador: ${capturedInput}`,
        config: {
          systemInstruction: `${t.systemPrompt} 
          - Se houver um ficheiro selecionado no contexto, use apenas a informação desse ficheiro. 
          - Se não houver, pesquise no contexto global de todos os uploads.
          - Use ferramentas para gráficos e ficheiros se solicitado.`,
          tools: [{ functionDeclarations: [generateCorporateFileTool, generateChartTool] }]
        }
      });

      let content = response.text || "";
      let files: GeneratedFile[] = [];
      let chartData: ChartData | undefined = undefined;

      if (response.functionCalls) {
        for (const fc of response.functionCalls) {
          if (fc.name === 'generate_chart') chartData = fc.args as any;
          else if (fc.name === 'generate_corporate_file') {
            const args = fc.args as any;
            if (args.sections) {
              for (let i = 0; i < args.sections.length; i++) {
                if (args.sections[i].visualDescription) {
                  setStatusMsg(`${t.loading} (${i+1}/${args.sections.length})`);
                  const imgRes = await ai.models.generateContent({
                    model: 'gemini-2.5-flash-image',
                    contents: { parts: [{ text: `Professional corporate visual: ${args.sections[i].visualDescription}. Text in ${currentLangName}.` }] }
                  });
                  const imgPart = imgRes.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
                  if (imgPart?.inlineData) args.sections[i].base64Image = imgPart.inlineData.data;
                }
              }
            }
            let file;
            if (args.fileType === 'pdf') file = generatePDF(args);
            else if (args.fileType === 'docx') file = await generateWord(args);
            else if (args.fileType === 'pptx') file = await generatePPT(args);
            else if (args.fileType === 'xlsx') {
              const wb = XLSX.utils.book_new();
              XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(args.tableData || [['No data']]), "Data");
              file = { name: `${args.fileName || 'data'}.xlsx`, url: URL.createObjectURL(new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })])), type: 'xlsx' as const };
            }
            if (file) { files.push(file); content += `\n\n📄 **[${t.fileGenerated}]: ${file.name}**`; }
          }
        }
      }
      addAssistantMessage(content, { generatedFiles: files, chart: chartData });
    } catch (e) { 
      console.error(e);
      addAssistantMessage("Ocorreu um erro no motor de IA."); 
    } finally { setIsTyping(false); setStatusMsg(''); }
  };

  const addAssistantMessage = (content: string, extra = {}) => {
    const msg: Message = { id: Date.now().toString(), role: 'assistant', content: content || "", timestamp: new Date().toISOString(), ...extra };
    setChats(prev => prev.map(chat => chat.id === activeChatId ? { ...chat, messages: [...chat.messages, msg] } : chat));
  };

  const renderChart = (chart: ChartData) => {
    if (!chart || !Array.isArray(chart.data)) return null;
    return (
      <div className="mt-6 p-6 bg-slate-50 rounded-3xl border border-slate-200 shadow-inner h-72 w-full overflow-hidden">
        <h3 className="text-xs font-black uppercase tracking-widest text-slate-800 mb-4">{chart.title || 'Dados'}</h3>
        <ResponsiveContainer width="100%" height="100%">
          {chart.chartType === 'bar' ? (
            <BarChart data={chart.data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#ca0607" radius={[4, 4, 0, 0]} />
            </BarChart>
          ) : chart.chartType === 'line' ? (
            <LineChart data={chart.data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#ca0607" strokeWidth={3} dot={{ fill: '#ca0607' }} />
            </LineChart>
          ) : (
            <PieChart>
              <Pie data={chart.data} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={80} fill="#ca0607" label={{ fontSize: 10 }}>
                {chart.data.map((_, index) => <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          )}
        </ResponsiveContainer>
      </div>
    );
  };

  // @ts-ignore
  const pdfjsLib = window['pdfjs-dist/build/pdf'] || window.pdfjsLib;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setIsUploading(true);
    for (const f of Array.from(files)) {
      try {
        const ext = f.name.split('.').pop()?.toLowerCase();
        const buffer = await f.arrayBuffer();
        let content = "";
        if (ext === 'pdf') {
          const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const tc = await page.getTextContent();
            content += tc.items.map((item: any) => item.str).join(' ') + '\n';
          }
        } else if (ext === 'docx') {
          const res = await mammoth.extractRawText({ arrayBuffer: buffer });
          content = res.value;
        } else if (ext === 'xlsx' || ext === 'xls') {
          const wb = XLSX.read(buffer, { type: 'array' });
          content = wb.SheetNames.map(n => XLSX.utils.sheet_to_txt(wb.Sheets[n])).join('\n');
        } else content = await f.text();

        setDocuments(prev => [...prev, { id: Math.random().toString(36).substr(2, 9), name: f.name, content: content || "", size: `${(f.size / 1024).toFixed(1)} KB`, type: ext || 'file' }]);
      } catch (err) { console.error(err); }
    }
    setIsUploading(false);
  };

  return (
    <div className="flex h-[100dvh] bg-slate-50 overflow-hidden font-inter">
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
              <div className="relative group">
                <select value={currentLang} onChange={(e) => setCurrentLang(e.target.value)} className="w-full bg-white/10 border border-white/20 rounded-xl py-2.5 px-4 text-xs text-white focus:outline-none focus:ring-2 focus:ring-[#ca0607]/50 appearance-none cursor-pointer">
                  {LANGUAGES.map(lang => <option key={lang.code} value={lang.code} className="bg-[#99a288] text-white">{lang.flag} {lang.name}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
              </div>
            </div>
            <button onClick={createNewChat} className="flex items-center gap-3 p-3.5 bg-[#ca0607] hover:bg-black border border-white/10 rounded-xl text-white text-xs font-bold transition-all shadow-lg uppercase tracking-wider">
              <PlusCircle size={16} /> {t.newChat}
            </button>
            <div className="space-y-4">
              <div className="text-[10px] text-white font-bold uppercase tracking-widest px-2 flex items-center gap-2"><FileBadge size={12} className="text-white/60"/> {t.files}</div>
              <div className="space-y-1">
                {documents.map(doc => (
                  <div key={doc.id} onClick={() => toggleDocSelection(doc.id)} className={`group p-2.5 rounded-lg text-[10px] flex justify-between items-center cursor-pointer transition-all border ${selectedDocId === doc.id ? 'bg-[#ca0607] border-white/40 text-white font-bold shadow-lg' : 'bg-white/5 border-transparent text-white/80 hover:bg-white/10'}`}>
                    <span className="truncate flex-1">{doc.name}</span>
                    <button onClick={(e) => { e.stopPropagation(); setDocuments(d => d.filter(item => item.id !== doc.id)); if (selectedDocId === doc.id) setSelectedDocId(null); }} className="ml-2 hover:scale-110"><X size={12}/></button>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <div className="text-[10px] text-white font-bold uppercase tracking-widest px-2 flex items-center gap-2"><MessageSquare size={12} className="text-white/60"/> {t.recent}</div>
              <div className="space-y-1">
                {chats.map(c => (
                  <div key={c.id} onClick={() => setActiveChatId(c.id)} className={`group p-3 rounded-lg text-[11px] flex justify-between items-center cursor-pointer transition-all border ${activeChatId === c.id ? 'bg-white/20 text-white font-bold border-white/30' : 'text-white/70 border-transparent hover:bg-white/5'}`}>
                    <span className="truncate flex-1">{c.title}</span>
                    <button onClick={(e) => deleteChat(e, c.id)} className="ml-2 opacity-0 group-hover:opacity-100"><X size={14}/></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="p-4 border-t border-white/10">
             <button onClick={() => fileInputRef.current?.click()} className="w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-[11px] font-bold flex items-center justify-center gap-2 border border-white/10 uppercase tracking-wide">
               {isUploading ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />} {t.upload}
             </button>
             <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileUpload} />
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative bg-white overflow-hidden shadow-2xl">
        <header className="h-16 border-b bg-white/95 flex items-center justify-between px-6 shrink-0 z-30 shadow-sm backdrop-blur-md">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 text-slate-500 hover:bg-slate-50 rounded-lg"><Menu size={22}/></button>
            <div className="flex items-center gap-3">
              <img src={OPCO_LOGO_URL} className="w-9 h-9" alt="Logo" />
              <div>
                <h1 className="text-sm font-black uppercase tracking-tighter text-slate-800">OPCO Buddy <Sparkles size={14} className="inline text-[#ca0607]"/></h1>
                <div className="text-[9px] text-green-600 font-bold flex items-center gap-1.5 uppercase tracking-widest">
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

        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 custom-scrollbar bg-[#F8FAFC]">
          {activeChat?.messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
              <div className="flex flex-col gap-2 max-w-[95%] md:max-w-[85%]">
                <div className={`p-6 rounded-3xl shadow-lg border ${msg.role === 'user' ? 'bg-[#9B9B9B] text-white' : 'bg-white text-slate-800'}`}>
                  {msg.contextFile && <div className="text-[10px] font-bold opacity-60 mb-2 uppercase tracking-widest flex items-center gap-1"><FileText size={10}/> Contexto: {msg.contextFile}</div>}
                  <div className={`prose prose-sm max-w-none ${msg.role === 'user' ? 'prose-invert text-white' : 'prose-slate'}`}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content || ""}</ReactMarkdown>
                  </div>
                  {msg.chart && renderChart(msg.chart)}
                  {msg.generatedFiles && msg.generatedFiles.length > 0 && (
                    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3">
                      {msg.generatedFiles.map((f, i) => (
                        <a key={i} href={f.url} download={f.name} className="flex items-center gap-4 p-5 bg-slate-50 border border-slate-200 rounded-2xl hover:border-[#ca0607] hover:bg-white transition-all group shadow-sm">
                          <div className="p-3 bg-white rounded-xl shadow-inner">
                            {f.type === 'pdf' ? <FileText size={20} className="text-red-500" /> : f.type === 'docx' ? <FileText size={20} className="text-blue-500" /> : f.type === 'pptx' ? <Presentation size={20} className="text-orange-500" /> : <FileSpreadsheet size={20} className="text-green-600" />}
                          </div>
                          <div className="flex-1 truncate">
                            <div className="text-[9px] font-black text-slate-400 uppercase mb-1">{t.fileGenerated}</div>
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

        <div className="p-6 md:p-8 border-t bg-white relative z-40 shadow-2xl">
          <div className="max-w-4xl mx-auto flex flex-col gap-2">
            
            {/* Context Selection Badge */}
            <div className="flex items-center gap-2 mb-1 px-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.searchingIn}</span>
              {focusedDoc ? (
                <div className="flex items-center gap-2 bg-[#ca0607]/10 text-[#ca0607] px-3 py-1.5 rounded-full border border-[#ca0607]/20 text-[10px] font-bold shadow-sm animate-fade-in">
                  <FileText size={12}/> {focusedDoc.name}
                  <button onClick={() => setSelectedDocId(null)} className="hover:bg-[#ca0607] hover:text-white rounded-full p-0.5 transition-colors"><X size={10}/></button>
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-slate-100 text-slate-600 px-3 py-1.5 rounded-full border border-slate-200 text-[10px] font-bold shadow-sm">
                  <Files size={12}/> {t.allFiles}
                </div>
              )}
            </div>

            <form onSubmit={handleSendMessage} className="flex items-center gap-3">
              <div className="flex items-center bg-slate-50 border-2 border-slate-100 rounded-3xl flex-1 px-6 focus-within:border-[#ca0607] focus-within:bg-white transition-all shadow-inner">
                <input type="text" value={input} onChange={e => setInput(e.target.value)} placeholder={t.placeholder} className="flex-1 bg-transparent py-4 focus:outline-none text-sm font-semibold text-slate-700" />
              </div>
              <button type="submit" disabled={isTyping || !input.trim() || !activeChatId} className="bg-[#ca0607] text-white w-14 h-14 rounded-3xl flex items-center justify-center hover:bg-black disabled:bg-slate-200 shadow-xl transition-all shrink-0"><Send size={22} /></button>
            </form>
            
            <div className="pt-4 flex flex-col md:flex-row items-center justify-between gap-4 border-t border-slate-50">
              <div className="flex flex-wrap justify-center gap-x-6 text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                <div className="flex items-center gap-2"><MapPin size={10} className="text-[#ca0607]"/> Azeitão, Portugal</div>
                <div className="flex items-center gap-2"><Phone size={10} className="text-[#ca0607]"/> +351 210 152 492</div>
                <div className="flex items-center gap-2"><Mail size={10} className="text-[#ca0607]"/> opco@opco.pt</div>
              </div>
              <div className="text-[10px] text-slate-300 font-black uppercase tracking-tighter">{t.engine} v7.0 (Focus Context)</div>
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
