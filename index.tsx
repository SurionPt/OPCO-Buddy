
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type, FunctionDeclaration, GenerateContentResponse } from '@google/genai';
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
  Square,
  StopCircle,
  BarChart as BarChartIcon,
  PieChart as PieChartIcon,
  TrendingUp,
  AlertTriangle,
  ChevronDown,
  FileDown,
  Reply as ReplyIcon,
  Zap,
  Maximize2,
  Key
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import * as mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import * as docx from 'docx';
import pptxgen from "pptxgenjs";
import { 
  BarChart as ReBarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  LineChart as ReLineChart,
  Line,
  PieChart as RePieChart,
  Pie,
  Cell
} from 'recharts';

// --- Utility Functions ---
const getSafeFileName = (name: string, ext: string) => {
  if (!name) return `documento.${ext}`;
  const base = name.replace(new RegExp(`\\.${ext}$`, 'i'), '').replace(/[^a-z0-9]/gi, '_').toLowerCase();
  return `${base}.${ext}`;
};

const HighlightOpco = ({ children }: { children?: any }) => {
  if (!children) return null;
  if (typeof children !== 'string') return children;
  const parts = children.split(/(My OPCO|OPCO)/g);
  return (
    <>
      {parts.map((part, i) => 
        (part === 'My OPCO' || part === 'OPCO') 
          ? <span key={i} className="opco-text-red font-bold">{part}</span> 
          : part
      )}
    </>
  );
};

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

// --- Chart Component ---
const OPCO_COLORS = ['#ca0607', '#75b1d9', '#1e293b', '#475569', '#94a3b8', '#cbd5e1'];

const DataVisualization = ({ chartData }: { chartData: ChartData }) => {
  const { type, title, data } = chartData;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-slate-200 shadow-xl rounded-lg text-xs">
          <p className="font-bold text-slate-800 mb-1">{label}</p>
          <p className="text-[#ca0607] font-black">{payload[0].value.toLocaleString()}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="my-6 w-full bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden animate-fade-in">
      <div className="bg-slate-50 px-5 py-3 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-600 flex items-center gap-2">
          {type === 'bar' && <BarChartIcon size={14} className="text-[#ca0607]" />}
          {type === 'line' && <TrendingUp size={14} className="text-[#ca0607]" />}
          {type === 'pie' && <PieChartIcon size={14} className="text-[#ca0607]" />}
          {title}
        </h3>
      </div>
      <div className="p-4 h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          {type === 'bar' ? (
            <ReBarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="label" fontSize={10} axisLine={false} tickLine={false} />
              <YAxis fontSize={10} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" fill="#75b1d9" radius={[4, 4, 0, 0]} />
            </ReBarChart>
          ) : type === 'line' ? (
            <ReLineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="label" fontSize={10} axisLine={false} tickLine={false} />
              <YAxis fontSize={10} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="value" stroke="#ca0607" strokeWidth={3} dot={{ r: 4, fill: '#ca0607' }} activeDot={{ r: 6 }} />
            </ReLineChart>
          ) : (
            <RePieChart>
              <Pie
                data={data}
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
                nameKey="label"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={OPCO_COLORS[index % OPCO_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
            </RePieChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// --- Localization Config ---
const LANGUAGES = [
  { code: 'pt', name: 'Português', iso: 'pt' },
  { code: 'en', name: 'English', iso: 'gb' },
  { code: 'fr', name: 'Français', iso: 'fr' },
  { code: 'de', name: 'Deutsch', iso: 'de' },
  { code: 'es', name: 'Español', iso: 'es' },
  { code: 'nl', name: 'Nederlands', iso: 'nl' },
  { code: 'zh', name: 'Mandarim', iso: 'cn' },
  { code: 'ja', name: 'Japonês', iso: 'jp' }
];

const TRANSLATIONS: Record<string, any> = {
  pt: {
    welcome: "Olá, sou o My OPCO, o seu Assistente de Inteligência Artificial da OPCO. Em que posso ajudar hoje?",
    placeholder: "Escreva a sua pergunta aqui... (Shift+Enter para nova linha)",
    newChat: "NOVA CONVERSA",
    exportChat: "EXPORTAR CONVERSA",
    files: "FICHEIROS",
    recent: "RECENTES",
    upload: "Upload",
    active: "Ativo",
    clearHistory: "LIMPAR HISTÓRICO",
    systemPrompt: "És o My OPCO, assistente oficial da OPCO. REGRAS CRÍTICAS: 1. Só chamas 'generate_corporate_file' se o utilizador quiser exportar ficheiros. 2. Só chamas 'generate_data_visualization' se houver dados numéricos que beneficiem de um gráfico. 3. Responde sempre em Português de forma profissional.",
    loading: "A analisar...",
    langHeading: "IDIOMA",
    searchingIn: "ANÁLISE:",
    allFiles: "Todos os Ficheiros",
    filesOnly: "APENAS FICHEIROS",
    filesPlusWeb: "FICHEIROS + INTERNET",
    exporting: "A exportar...",
    errorMessage: "Erro de processamento. Tente novamente.",
    quotaErrorMessage: "Limite atingido. Aguarde 1 minuto.",
    export: "EXPORTAR PARA WORD",
    sources: "Fontes",
    multiFiles: "ficheiros",
    stop: "PARAR",
    copy: "Copiar",
    copied: "Copiado!",
    reply: "Responder",
    replyingTo: "Respondendo a",
    fileSuccess: (name: string) => `Ficheiro **${name}** gerado.`,
    userLabel: "UTILIZADOR",
    aiLabel: "MY OPCO",
    fastMode: "RESPOSTA RÁPIDA",
    imageAnalysis: "A analisar imagem...",
    modesLabel: "MODOS"
  },
  en: {
    welcome: "Hello, I am My OPCO, your official AI Assistant from OPCO. How can I help you today?",
    placeholder: "Type your question here... (Shift+Enter for new line)",
    newChat: "NEW CONVERSATION",
    exportChat: "EXPORT CHAT",
    files: "FILES",
    recent: "RECENT",
    upload: "Upload",
    active: "Active",
    clearHistory: "CLEAR HISTORY",
    systemPrompt: "You are My OPCO, official assistant of OPCO. RULES: 1. Use 'generate_corporate_file' for exports. 2. Use 'generate_data_visualization' for charts. 3. Reply professionally in English.",
    loading: "Analysing...",
    langHeading: "LANGUAGE",
    searchingIn: "CONTEXT:",
    allFiles: "All Files",
    filesOnly: "FILES ONLY",
    filesPlusWeb: "FILES + INTERNET",
    exporting: "Exporting...",
    errorMessage: "Processing error. Please try again.",
    quotaErrorMessage: "Quota exceeded. Please wait 1 minute.",
    export: "EXPORT TO WORD",
    sources: "Sources",
    multiFiles: "files",
    stop: "STOP",
    copy: "Copy",
    copied: "Copied!",
    reply: "Reply",
    replyingTo: "Replying to",
    fileSuccess: (name: string) => `File **${name}** generated.`,
    userLabel: "USER",
    aiLabel: "MY OPCO",
    fastMode: "FAST RESPONSE",
    imageAnalysis: "Analysing image...",
    modesLabel: "MODOS"
  },
  fr: {
    welcome: "Bonjour, je suis My OPCO, votre assistant officiel d'IA d'OPCO. Comment puis-je vous aider aujourd'hui?",
    placeholder: "Tapez votre question aqui...",
    newChat: "NOUVELLE CONVERSATION",
    exportChat: "EXPORTER LA CONVERSATION",
    files: "FICHIERS",
    recent: "RÉCENT",
    upload: "Télécharger",
    active: "Actif",
    clearHistory: "EFFACER L'HISTORIQUE",
    systemPrompt: "Vous êtes My OPCO, assistant officiel d'OPCO. Répondez professionnellement en français.",
    loading: "Analyse en cours...",
    langHeading: "LANGUE",
    searchingIn: "CONTEXTE:",
    allFiles: "Tous les fichiers",
    filesOnly: "FICHIERS UNIQUEMENT",
    filesPlusWeb: "FICHIERS + INTERNET",
    exporting: "Exportation...",
    errorMessage: "Erreur de traitement.",
    quotaErrorMessage: "Quota dépassé.",
    export: "EXPORTER VERS WORD",
    sources: "Sources",
    multiFiles: "fichiers",
    stop: "ARRÊTER",
    copy: "Copier",
    copied: "Copié!",
    reply: "Répondre",
    replyingTo: "Répondre à",
    fileSuccess: (name: string) => `Fichier **${name}** généré.`,
    userLabel: "UTILISATEUR",
    aiLabel: "MY OPCO",
    fastMode: "RÉPONSE RAPIDE",
    imageAnalysis: "Analyse de l'image...",
    modesLabel: "MODES"
  }
};

const OPCO_LOGO_URL = 'https://raw.githubusercontent.com/SurionPt/OCPCO/refs/heads/main/esfera%2050x47.png';
const OPCO_DIGITAL_SYSTEMS_LOGO_URL = 'https://raw.githubusercontent.com/SurionPt/OCPCO/refs/heads/main/OPCO%20Digital%20Systems.png';
const NEURAL_BG_URL = 'https://raw.githubusercontent.com/SurionPt/OCPCO/refs/heads/main/neural.jpg';
const STORAGE_KEY = 'my_opco_v33_lite';

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

interface ChartData {
  type: 'bar' | 'line' | 'pie';
  title: string;
  data: { label: string; value: number }[];
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
  chartData?: ChartData;
  groundingSources?: GroundingSource[];
  contextFiles?: string[];
  attachedImage?: string;
  replyTo?: {
    id: string;
    content: string;
    role: 'user' | 'assistant';
  };
  isError?: boolean;
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
    description: 'Cria ativos corporativos de alta qualidade (Word, Excel, PPTX, PDF) para download imediato.',
    properties: {
      fileType: { type: Type.STRING, enum: ['docx', 'xlsx', 'pptx', 'pdf'] },
      fileName: { type: Type.STRING, description: 'Nome do ficheiro sugerido.' },
      title: { type: Type.STRING, description: 'Título principal do relatório.' },
      subtitle: { type: Type.STRING, description: 'Subtítulo ou departamento.' },
      reportContent: { type: Type.STRING, description: 'Conteúdo textual estruturado em parágrafos.' },
      tableData: { 
        type: Type.ARRAY, 
        items: { type: Type.ARRAY, items: { type: Type.STRING } },
        description: 'Dados em grelha para Excel ou tabelas em Word/PDF.'
      },
      chartHint: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING, enum: ['bar', 'line', 'pie'] },
          labels: { type: Type.ARRAY, items: { type: Type.STRING } },
          values: { type: Type.ARRAY, items: { type: Type.NUMBER } }
        },
        description: 'Dica de dados para incluir gráficos na apresentação (PPTX).'
      }
    },
    required: ['fileType', 'fileName', 'title']
  }
};

const generateDataVisualizationTool: FunctionDeclaration = {
  name: 'generate_data_visualization',
  parameters: {
    type: Type.OBJECT,
    description: 'Gera um gráfico interativo no chat para visualização de dados.',
    properties: {
      type: { type: Type.STRING, enum: ['bar', 'line', 'pie'], description: 'Tipo de gráfico.' },
      title: { type: Type.STRING, description: 'Título do gráfico.' },
      data: { 
        type: Type.ARRAY, 
        items: { 
          type: Type.OBJECT,
          properties: {
            label: { type: Type.STRING },
            value: { type: Type.NUMBER }
          }
        },
        description: 'Dados formatados como array de objetos {label, value}.'
      }
    },
    required: ['type', 'title', 'data']
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
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

  // New features state
  const [isFastMode, setIsFastMode] = useState(false);
  const [attachedImage, setAttachedImage] = useState<{ data: string, mimeType: string } | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const t = useMemo(() => TRANSLATIONS[currentLang] || TRANSLATIONS.pt, [currentLang]);
  const activeLang = useMemo(() => LANGUAGES.find(l => l.code === currentLang) || LANGUAGES[0], [currentLang]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const activeChat = useMemo(() => chats.find(c => c.id === activeChatId), [chats, activeChatId]);
  const focusedDocs = useMemo(() => documents.filter(d => selectedDocIds.includes(d.id)), [selectedDocIds, documents]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  useEffect(() => {
    window.scrollTo(0, 0);
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) { 
      try { 
        const parsed = JSON.parse(saved); 
        if (parsed.length > 0) { 
          setChats(parsed); 
          setActiveChatId(parsed[0].id); 
        } else createNewChat(); 
      } catch (e) { createNewChat(); } 
    } else createNewChat();
  }, []);
  
  useEffect(() => { if (chats.length > 0) localStorage.setItem(STORAGE_KEY, JSON.stringify(chats)); }, [chats]);
  
  useEffect(() => { 
    if (isTyping || activeChat?.messages.length) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); 
    }
  }, [chats, isTyping, activeChatId]);

  useEffect(() => {
    setChats(prev => prev.map(chat => {
      const isDefaultTitle = Object.values(TRANSLATIONS).some(trans => trans.newChat.toUpperCase() === chat.title.toUpperCase());
      const isInitialChat = chat.messages.length > 0 && chat.messages[0].id === '1' && Object.values(TRANSLATIONS).some(trans => trans.welcome === chat.messages[0].content);
      let updatedChat = { ...chat };
      if (isDefaultTitle) updatedChat.title = t.newChat;
      if (isInitialChat) {
        updatedChat.messages = chat.messages.map((m, idx) => idx === 0 ? { ...m, content: t.welcome } : m);
      }
      return updatedChat;
    }));
  }, [currentLang, t.newChat, t.welcome]);

  const createNewChat = () => {
    const id = Date.now().toString();
    setChats(prev => [{ id, title: t.newChat, messages: [{ id: '1', role: 'assistant', content: t.welcome, timestamp: new Date().toISOString() }], createdAt: new Date().toISOString() }, ...prev]);
    setActiveChatId(id);
    setSelectedDocIds([]);
    setIsSidebarOpen(false);
    setReplyingTo(null);
    setInput('');
    setAttachedImage(null);
    window.scrollTo(0, 0);
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsTyping(false);
      setStatusMsg('');
    }
  };

  const exportFullChatToWord = async () => {
    if (!activeChat || activeChat.messages.length < 2) return;
    setStatusMsg(t.exporting);
    try {
      const sections = [{
        children: [
          new docx.Paragraph({
            children: [
              new docx.TextRun({ text: `Histórico de Conversa: ${activeChat.title}`, bold: true, size: 32, color: "75b1d9" }),
            ],
            spacing: { after: 400 },
          }),
          ...activeChat.messages.flatMap(msg => [
            new docx.Paragraph({
              children: [
                new docx.TextRun({ text: `${msg.role === 'user' ? t.userLabel : t.aiLabel}:`, bold: true, color: msg.role === 'user' ? "75b1d9" : "ca0607" }),
              ],
              spacing: { before: 200 },
            }),
            new docx.Paragraph({
              children: [
                new docx.TextRun({ text: msg.content }),
              ],
              spacing: { after: 200 },
            }),
          ]),
        ],
      }];

      const doc = new docx.Document({ sections });
      const blob = await docx.Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const safeName = getSafeFileName(activeChat.title, 'docx');
      const a = document.createElement('a');
      a.href = url;
      a.download = safeName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      console.error('Export error:', e);
    } finally {
      setStatusMsg('');
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isTyping || !activeChatId) return;
    
    const userMsg: Message = { 
      id: Date.now().toString(), 
      role: 'user', 
      content: input, 
      timestamp: new Date().toISOString(), 
      contextFiles: focusedDocs.map(d => d.name),
      attachedImage: attachedImage?.data ? `data:${attachedImage.mimeType};base64,${attachedImage.data}` : undefined,
      replyTo: replyingTo ? { id: replyingTo.id, content: replyingTo.content, role: replyingTo.role } : undefined
    };
    
    setChats(prev => prev.map(c => {
      if (c.id === activeChatId) {
        const isNewChat = c.messages.length === 1 && c.messages[0].id === '1';
        const newTitle = isNewChat ? (input.length > 28 ? input.substring(0, 25) + '...' : input) : c.title;
        return { ...c, title: newTitle, messages: [...c.messages, userMsg] };
      }
      return c;
    }));

    const currentInput = input; 
    const currentReplyTo = replyingTo;
    const currentAttachedImage = attachedImage;
    setInput(''); 
    setAttachedImage(null);
    setIsTyping(true); 
    setStatusMsg(currentAttachedImage ? t.imageAnalysis : t.loading);
    setReplyingTo(null);
    abortControllerRef.current = new AbortController();
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const docs = focusedDocs.length > 0 ? focusedDocs : documents;
      const context = docs.slice(0, 10).map(d => `[FILE: ${d.name}]\n${d.content.substring(0, 4000)}`).join('\n---\n');
      
      let finalPrompt = currentInput;
      if (currentReplyTo) finalPrompt = `[Responding to: "${currentReplyTo.content}"]\n\n${currentInput}`;

      let generatedFiles: any[] = [];
      let chartData: ChartData | undefined;
      let sources: GroundingSource[] = [];
      let assistantContent = "";

      const modelToUse = currentAttachedImage ? 'gemini-3-pro-preview' : (isFastMode ? 'gemini-flash-lite-latest' : 'gemini-3-pro-preview');
      
      const parts: any[] = [{ text: `${context}\n\n${finalPrompt}` }];
      if (currentAttachedImage) {
        parts.unshift({
          inlineData: {
            data: currentAttachedImage.data,
            mimeType: currentAttachedImage.mimeType
          }
        });
      }

      const tools: any[] = isWebSearchEnabled 
        ? [{ googleSearch: {} }] 
        : [{ functionDeclarations: [generateCorporateFileTool, generateDataVisualizationTool] }];

      const res = await ai.models.generateContent({
        model: modelToUse,
        contents: { parts },
        config: { 
          systemInstruction: t.systemPrompt as string, 
          tools: tools,
        }
      });
      
      assistantContent = res.text || "";
      if (res.candidates && res.candidates[0]) {
        const chunks = res.candidates[0].groundingMetadata?.groundingChunks;
        if (chunks) chunks.forEach((c: any) => { if (c.web?.uri) sources.push({ title: c.web.title || c.web.uri, uri: c.web.uri }); });
        
        if (res.functionCalls) {
          for (const fc of res.functionCalls) {
            if (fc.name === 'generate_corporate_file') {
               const fileData = await handleFileToolExecution(fc.args);
               if (fileData) generatedFiles.push(fileData);
            } else if (fc.name === 'generate_data_visualization') {
               chartData = fc.args as any;
            }
          }
        }
      }
      
      if (!assistantContent && generatedFiles.length > 0) assistantContent = t.fileSuccess(generatedFiles[0].name);
      if (!assistantContent && chartData) assistantContent = `${t.aiLabel}: ${chartData.title}`;
      
      addAssistantMessage(assistantContent || t.errorMessage, { groundingSources: sources, generatedFiles, chartData });
    } catch (e: any) { 
      if (e.name !== 'AbortError') {
        addAssistantMessage(t.errorMessage, { isError: true });
      }
    } finally { setIsTyping(false); setStatusMsg(''); abortControllerRef.current = null; }
  };

  const handleFileToolExecution = async (args: any) => {
    const { fileType, fileName, title, subtitle, reportContent, tableData, chartHint } = args;
    try {
      let blob;
      if (fileType === 'docx') {
        const children: any[] = [
          new docx.Paragraph({ 
            children: [new docx.TextRun({ text: title, bold: true, size: 36, color: "ca0607" })],
            alignment: docx.AlignmentType.CENTER,
            spacing: { after: 200 }
          })
        ];

        if (subtitle) {
          children.push(new docx.Paragraph({
            // Fix: Change 'italic' to 'italics' for docx TextRun options as 'italic' is not a valid property in IRunOptions
            children: [new docx.TextRun({ text: subtitle, italics: true, size: 24, color: "75b1d9" })],
            alignment: docx.AlignmentType.CENTER,
            spacing: { after: 400 }
          }));
        }

        if (reportContent) {
          reportContent.split('\n').forEach((line: string) => {
            children.push(new docx.Paragraph({
              children: [new docx.TextRun({ text: line, size: 22 })],
              spacing: { before: 100, after: 100 }
            }));
          });
        }

        if (tableData && tableData.length > 0) {
          const table = new docx.Table({
            rows: tableData.map((row: string[]) => new docx.TableRow({
              children: row.map(cell => new docx.TableCell({
                children: [new docx.Paragraph({ children: [new docx.TextRun({ text: cell, size: 18 })] })]
              }))
            })),
            width: { size: 100, type: docx.WidthType.PERCENTAGE }
          });
          children.push(new docx.Paragraph({ text: "" })); // spacer
          children.push(table);
        }

        const doc = new docx.Document({ sections: [{ children }] });
        blob = await docx.Packer.toBlob(doc);
      } else if (fileType === 'xlsx') {
        const ws = XLSX.utils.aoa_to_sheet(tableData || [[title], [t.aiLabel]]);
        const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Relatório");
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }); blob = new Blob([wbout], { type: 'application/octet-stream' });
      } else if (fileType === 'pdf') {
        const doc = new jsPDF(); 
        doc.setTextColor(202, 6, 7); 
        doc.setFontSize(22); 
        doc.text(title, 20, 30); 
        if (subtitle) {
          doc.setTextColor(117, 177, 217);
          doc.setFontSize(14);
          doc.text(subtitle, 20, 40);
        }
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(11);
        const splitText = doc.splitTextToSize(reportContent || "", 170);
        doc.text(splitText, 20, 55);
        
        if (tableData && tableData.length > 0) {
          let y = 55 + (splitText.length * 7);
          tableData.slice(0, 15).forEach((row: string[]) => {
            doc.text(row.join(' | '), 20, y);
            y += 8;
          });
        }
        blob = doc.output('blob');
      } else if (fileType === 'pptx') {
        const pres = new pptxgen();
        const slide = pres.addSlide();
        slide.addText(title, { x: 0.5, y: 0.5, w: "90%", h: 1, fontSize: 32, color: "ca0607", bold: true, align: pres.AlignH.center });
        if (subtitle) slide.addText(subtitle, { x: 0.5, y: 1.5, w: "90%", h: 0.5, fontSize: 20, color: "75b1d9", align: pres.AlignH.center });
        
        if (reportContent) {
           slide.addText(reportContent.substring(0, 500), { x: 0.5, y: 2.5, w: "90%", h: 2, fontSize: 14 });
        }

        if (chartHint && chartHint.labels && chartHint.values) {
          const chartData = [
            {
              name: "Dados",
              labels: chartHint.labels,
              values: chartHint.values,
            },
          ];
          const slide2 = pres.addSlide();
          slide2.addText("Visualização de Dados", { x: 0.5, y: 0.5, fontSize: 24, color: "ca0607" });
          const chartTypeMap: any = { bar: pres.ChartType.bar, line: pres.ChartType.line, pie: pres.ChartType.pie };
          slide2.addChart(chartTypeMap[chartHint.type] || pres.ChartType.bar, chartData, { x: 0.5, y: 1.0, w: 9, h: 4 });
        }

        blob = await pres.write({ outputType: "blob" }) as Blob;
      }

      if (blob) { 
        const url = URL.createObjectURL(blob); const safeName = getSafeFileName(fileName, fileType); 
        const a = document.createElement('a'); a.href = url; a.download = safeName; document.body.appendChild(a); a.click(); document.body.removeChild(a); 
        return { name: safeName, url, type: fileType as any }; 
      }
    } catch (e) { console.error(e); } return null;
  };

  const addAssistantMessage = (content: string, extra = {}) => {
    setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, messages: [...c.messages, { id: Date.now().toString(), role: 'assistant', content, timestamp: new Date().toISOString(), ...extra }] } : c));
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopySuccess(id);
    setTimeout(() => setCopySuccess(null), 2000);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsUploading(true);
    setStatusMsg(t.loading);
    const newDocs: Document[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        let content = '';
        if (file.name.toLowerCase().endsWith('.docx')) {
          const ab = await file.arrayBuffer();
          const res = await mammoth.extractRawText({ arrayBuffer: ab }); content = res.value;
        } else if (file.name.toLowerCase().endsWith('.xlsx')) {
          const ab = await file.arrayBuffer();
          const wb = XLSX.read(ab); content = wb.SheetNames.map(sn => XLSX.utils.sheet_to_txt(wb.Sheets[sn])).join('\n');
        } else if (file.type.startsWith('image/')) {
          const base64 = await blobToBase64(file);
          setAttachedImage({ data: base64, mimeType: file.type });
          setIsUploading(false); setStatusMsg('');
          return;
        } else content = await file.text();
        newDocs.push({ id: `${Date.now()}-${i}`, name: file.name, content, size: `${(file.size / 1024).toFixed(1)} KB`, type: file.type || 'text/plain' });
      } catch (err) { console.error(err); }
    }
    setDocuments(prev => [...prev, ...newDocs]);
    setIsUploading(false); setStatusMsg('');
  };

  const deleteChat = (e: React.MouseEvent, id: string) => { 
    e.stopPropagation(); 
    setChats(prev => { 
      const filt = prev.filter(c => c.id !== id); 
      if (filt.length === 0) createNewChat(); 
      if (activeChatId === id && filt.length > 0) setActiveChatId(filt[0].id); 
      return filt; 
    }); 
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-inter text-slate-800 relative">
      <aside className={`fixed inset-y-0 left-0 z-[60] w-72 bg-[#75b1d9] border-r border-slate-800/50 flex flex-col transition-transform duration-300 md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="absolute inset-0 opacity-30 pointer-events-none" style={{ backgroundImage: `url("${NEURAL_BG_URL}")`, backgroundSize: 'cover' }}></div>
        <div className="relative z-10 flex flex-col h-full">
          <div className="p-6 flex items-center justify-between border-b border-white/10">
            <div className="flex items-center gap-2 text-white font-bold text-lg"><img src={OPCO_LOGO_URL} className="w-8 h-8" alt="Logo" /> <span>My OPCO</span></div>
            <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-white/40"><X size={24}/></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6 custom-scrollbar">
             
             <div className="px-2 space-y-3">
                <div className="text-[10px] text-white font-bold uppercase flex items-center gap-2"><Zap size={12}/> {t.modesLabel}</div>
                <button 
                  onClick={() => setIsFastMode(!isFastMode)} 
                  className={`w-full p-3 rounded-xl border flex items-center justify-between transition-all ${isFastMode ? 'bg-white text-[#75b1d9] border-white' : 'bg-white/5 text-white/80 border-white/20 hover:bg-white/10'}`}
                >
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider">
                    <Zap size={14} className={isFastMode ? 'text-yellow-500' : ''}/> {t.fastMode}
                  </div>
                  {isFastMode && <CheckCircle2 size={14}/>}
                </button>
             </div>

             <div className="px-2">
               <div className="text-[10px] text-white font-bold uppercase mb-2 flex items-center gap-2"><Globe size={12}/> {t.langHeading}</div>
               <div className="relative">
                 <button onClick={() => setIsLangMenuOpen(!isLangMenuOpen)} className="w-full bg-white/10 border border-white/20 rounded-xl py-2.5 px-3 text-xs text-white flex items-center justify-between hover:bg-white/20 transition-all outline-none">
                   <div className="flex items-center gap-2">
                     <img src={`https://flagcdn.com/w40/${activeLang.iso}.png`} className="w-4 h-3 object-cover rounded-sm shadow-sm" alt={activeLang.name} />
                     <span>{activeLang.name}</span>
                   </div>
                   <ChevronDown size={14} className={`transition-transform ${isLangMenuOpen ? 'rotate-180' : ''}`} />
                 </button>
                 {isLangMenuOpen && (
                   <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-[100] animate-fade-in max-h-48 overflow-y-auto">
                     {LANGUAGES.map(lang => (
                       <button key={lang.code} onClick={() => { setCurrentLang(lang.code); setIsLangMenuOpen(false); }} className={`w-full px-3 py-2 text-left text-xs flex items-center gap-2 hover:bg-slate-50 transition-colors ${currentLang === lang.code ? 'bg-[#75b1d9]/10 text-[#75b1d9] font-bold' : 'text-slate-600'}`}>
                         <img src={`https://flagcdn.com/w40/${lang.iso}.png`} className="w-4 h-3 object-cover rounded-sm shadow-sm" alt={lang.name} />
                         {lang.name}
                       </button>
                     ))}
                   </div>
                 )}
               </div>
             </div>

             <div className="flex flex-col gap-2">
                <button onClick={createNewChat} className="flex items-center gap-3 p-4 bg-white hover:bg-slate-50 rounded-xl text-[#75b1d9] text-xs font-black transition-all uppercase tracking-wider shadow-lg"><PlusCircle size={18} /> {t.newChat}</button>
                <button onClick={() => activeChat && activeChat.messages.length > 1 && exportFullChatToWord()} disabled={!activeChat || activeChat.messages.length < 2} className="flex items-center gap-3 p-4 bg-white/10 hover:bg-white/20 border border-white/30 rounded-xl text-white text-[10px] font-bold transition-all uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"><FileDown size={18} /> {t.exportChat}</button>
             </div>
             
             <div className="space-y-4">
                <div className="text-[10px] text-white font-bold uppercase px-2 flex items-center gap-2"><FileBadge size={12}/> {t.files}</div>
                <div className="space-y-1">
                  {documents.map(doc => (
                    <div key={doc.id} onClick={() => setSelectedDocIds(prev => prev.includes(doc.id) ? prev.filter(x => x !== doc.id) : [...prev, doc.id])} className={`p-3 rounded-lg text-[10px] flex items-center gap-2 cursor-pointer border transition-all ${selectedDocIds.includes(doc.id) ? 'bg-[#ca0607] text-white border-[#ca0607]' : 'bg-white/5 text-white/80 border-white/20 hover:bg-white/10'}`}>
                      <span className="truncate flex-1">{doc.name}</span>
                      <X size={14} className="hover:text-red-300" onClick={(e) => { e.stopPropagation(); setDocuments(d => d.filter(x => x.id !== doc.id)); }} />
                    </div>
                  ))}
                </div>
             </div>

             <div className="space-y-1 overflow-hidden">
               <div className="text-[10px] text-white font-bold uppercase px-2 mb-2 flex items-center gap-2"><MessageSquare size={12}/> {t.recent}</div>
               {chats.map(c => (
                 <div key={c.id} onClick={() => { setActiveChatId(c.id); setIsSidebarOpen(false); }} className={`group p-3 rounded-lg text-[11px] flex items-center gap-2 cursor-pointer border transition-all ${activeChatId === c.id ? 'bg-white/20 text-white font-bold border-white/40' : 'text-white/70 border-transparent hover:bg-white/5'}`}>
                   <span className="truncate flex-1">{c.title}</span>
                   <Trash2 size={12} onClick={(e) => deleteChat(e, c.id)} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                 </div>
               ))}
             </div>
          </div>
          <div className="p-4 border-t border-white/10">
            <button onClick={() => fileInputRef.current?.click()} className="w-full py-4 bg-white/10 hover:bg-white/20 text-white rounded-xl text-[11px] font-bold flex items-center justify-center gap-2 uppercase transition-all shadow-md">{isUploading ? <Loader2 size={18} className="animate-spin" /> : <UploadCloud size={18} />} {t.upload}</button>
            <input type="file" ref={fileInputRef} className="hidden" multiple accept=".docx,.xlsx,.txt,image/*" onChange={handleFileUpload} />
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative bg-white h-full overflow-hidden">
        <header className="h-16 border-b bg-white/95 flex items-center justify-between px-4 md:px-6 z-40 shadow-sm sticky top-0 shrink-0">
           <div className="flex items-center gap-3">
             <button onClick={() => setIsSidebarOpen(true)} className="md:hidden text-slate-500 p-2 -ml-2"><Menu size={24}/></button>
             <div className="flex items-center gap-2">
               <img src={OPCO_LOGO_URL} className="w-8 h-8" alt="Logo" />
               <div className="text-xs md:text-base font-black uppercase tracking-tighter text-slate-800 hidden sm:block">My OPCO <Sparkles size={14} className="inline text-[#ca0607] ml-1"/></div>
             </div>
           </div>
           <div className="flex items-center gap-4">
              <div className="text-[10px] md:text-xs text-green-600 font-bold uppercase flex items-center gap-2"><div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div> {t.active}</div>
           </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 bg-[#F8FAFC] custom-scrollbar pb-32">
          {activeChat?.messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in group/row`}>
              <div className={`flex flex-col gap-1 max-w-[95%] sm:max-w-[90%] md:max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                {msg.replyTo && (
                  <div className={`mb-[-8px] px-3 py-2 bg-slate-200/50 rounded-t-xl border-l-4 border-[#75b1d9] text-[10px] max-w-full truncate text-slate-500 opacity-80 ${msg.role === 'user' ? 'mr-4' : 'ml-4 shadow-sm'}`}>
                    <span className="font-bold block text-[8px] uppercase">{msg.replyTo.role === 'user' ? t.userLabel : t.aiLabel}</span>
                    {msg.replyTo.content}
                  </div>
                )}
                <div className={`px-4 py-3 md:px-6 md:py-4 shadow-sm border relative group w-fit ${
                  msg.role === 'user' ? 'bg-[#75b1d9] text-white rounded-2xl rounded-tr-none border-[#75b1d9]/50' : msg.isError ? 'bg-red-50 text-red-700 rounded-2xl border-red-200 shadow-red-100/50' : 'bg-white text-slate-800 rounded-2xl rounded-tl-none border-slate-200'
                }`}>
                  <div className="absolute -top-3 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none group-hover:pointer-events-auto">
                    <button onClick={() => { setReplyingTo(msg); textareaRef.current?.focus(); }} className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 shadow-md hover:bg-slate-50" title={t.reply}><ReplyIcon size={14} /></button>
                    <button onClick={() => handleCopy(msg.id, msg.content)} className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 shadow-md hover:bg-slate-50" title={t.copy}>
                      {copySuccess === msg.id ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                    </button>
                  </div>

                  {msg.attachedImage && (
                    <div className="mb-3 overflow-hidden rounded-xl border border-white/20 shadow-lg max-w-[280px] sm:max-w-[350px]">
                      <img src={msg.attachedImage} alt="User Attached" className="w-full object-contain" />
                    </div>
                  )}

                  <div className={`prose prose-sm md:prose-base max-w-none break-words ${msg.role === 'user' ? 'prose-invert text-white' : 'prose-slate'}`}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                        p: ({ children }: any) => <p className="mb-2 leading-relaxed text-[13px] md:text-[15px] whitespace-pre-wrap"><HighlightOpco>{children}</HighlightOpco></p>,
                        table: ({children}) => (<div className="overflow-x-auto my-3 rounded-xl border border-slate-200 shadow-sm bg-white text-slate-900"><table className="min-w-full border-collapse">{children}</table></div>),
                        thead: ({children}) => <thead className="bg-[#ca0607] text-white font-bold">{children}</thead>,
                        td: ({ children }: any) => <td className="px-3 py-2 text-[11px] md:text-[13px] border-t border-slate-200 font-medium"><HighlightOpco>{children}</HighlightOpco></td>
                    }}>{msg.content}</ReactMarkdown>
                  </div>
                  
                  {msg.chartData && <DataVisualization chartData={msg.chartData} />}

                  {msg.generatedFiles?.length ? (
                    <div className="mt-4 flex flex-wrap gap-3">
                      {msg.generatedFiles.map((f, i) => (
                        <a key={i} href={f.url} download={f.name} className="flex items-center gap-3 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[10px] md:text-[11px] font-black uppercase text-slate-700 hover:border-[#ca0607] hover:text-[#ca0607] transition-all shadow-sm">
                          {f.type === 'xlsx' ? <FileSpreadsheet size={16} className="text-green-600"/> : f.type === 'docx' ? <FileTextIcon size={16} className="text-blue-600"/> : f.type === 'pptx' ? <Presentation size={16} className="text-orange-600"/> : <DownloadCloud size={16} className="text-[#ca0607]"/>}
                          {f.name}
                        </a>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className={`text-[8px] md:text-[10px] opacity-40 font-bold px-2 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            </div>
          ))}
          {isTyping && (<div className="bg-white px-4 py-2.5 rounded-2xl border border-slate-100 shadow-sm inline-flex items-center gap-3 w-fit"><div className="flex gap-1"><div className="w-1.5 h-1.5 bg-[#75b1d9] rounded-full animate-bounce"></div><div className="w-1.5 h-1.5 bg-[#75b1d9] rounded-full animate-bounce [animation-delay:0.1s]"></div><div className="w-1.5 h-1.5 bg-[#75b1d9] rounded-full animate-bounce [animation-delay:0.2s]"></div></div><span className="text-[10px] font-black text-[#75b1d9] uppercase tracking-tighter">{statusMsg}</span></div>)}
          <div ref={messagesEndRef} className="h-4" />
        </div>

        <div className="p-4 md:p-6 border-t bg-white absolute bottom-0 left-0 right-0 z-50 shadow-[0_-4px_20px_0_rgba(0,0,0,0.03)] shrink-0">
          <div className="max-w-4xl mx-auto flex flex-col gap-3">
            
            {attachedImage && (
              <div className="flex items-center gap-3 p-2 bg-slate-100 rounded-xl border border-slate-200 animate-fade-in group">
                <img src={`data:${attachedImage.mimeType};base64,${attachedImage.data}`} className="w-10 h-10 object-cover rounded-lg border border-white shadow-sm" alt="Preview" />
                <span className="text-[10px] font-bold text-slate-500 uppercase flex-1 truncate">{attachedImage.mimeType}</span>
                <button onClick={() => setAttachedImage(null)} className="p-1 hover:bg-slate-200 rounded-full text-slate-400"><X size={16}/></button>
              </div>
            )}

            {replyingTo && (
              <div className="bg-slate-50 p-3 rounded-t-xl border-l-4 border-[#75b1d9] flex justify-between items-center animate-fade-in shadow-inner border border-b-0 border-slate-200">
                <div className="flex-1 overflow-hidden pr-4">
                  <div className="text-[10px] font-black text-[#75b1d9] uppercase flex items-center gap-2">
                    <ReplyIcon size={10} /> {t.replyingTo} {replyingTo.role === 'user' ? t.userLabel : t.aiLabel}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">{replyingTo.content}</div>
                </div>
                <button onClick={() => setReplyingTo(null)} className="p-1 hover:bg-slate-200 rounded-full transition-colors text-slate-400"><X size={16} /></button>
              </div>
            )}
            
            <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
               <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-tight whitespace-nowrap">{t.searchingIn}</span>
                  <div className="flex gap-1">
                    {focusedDocs.length ? <div className="bg-[#75b1d9]/10 text-[#75b1d9] px-3 py-1.5 rounded-full border border-[#75b1d9]/20 text-[10px] font-bold flex items-center gap-2 shadow-sm shrink-0 whitespace-nowrap">{focusedDocs.length} {t.multiFiles} <X size={12} className="cursor-pointer hover:text-red-500" onClick={() => setSelectedDocIds([])} /></div> : <div className="bg-slate-100 text-slate-500 px-3 py-1.5 rounded-full border text-[10px] font-bold shadow-sm whitespace-nowrap">{t.allFiles}</div>}
                  </div>
               </div>
               <div className="flex items-center bg-slate-100 rounded-full p-1 border shadow-sm shrink-0">
                  <button onClick={() => setIsWebSearchEnabled(false)} className={`px-3 py-1 rounded-full text-[9px] md:text-[10px] font-black uppercase transition-all whitespace-nowrap ${!isWebSearchEnabled ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>{t.filesOnly}</button>
                  <button onClick={() => setIsWebSearchEnabled(true)} className={`px-3 py-1 rounded-full text-[9px] md:text-[10px] font-black uppercase transition-all whitespace-nowrap ${isWebSearchEnabled ? 'bg-white text-[#75b1d9] shadow-sm' : 'text-slate-500'}`}>{t.filesPlusWeb}</button>
               </div>
            </div>
            
            <div className="flex items-end gap-2 w-full">
              <button 
                type="button" 
                onClick={() => imageInputRef.current?.click()} 
                className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-2xl border mb-1 transition-all shadow-sm shrink-0"
                title="Upload Image for Analysis"
              >
                <ImageIcon size={20} />
              </button>
              <input type="file" ref={imageInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
              
              <div className={`flex-1 bg-slate-50 border border-slate-200 shadow-sm transition-all relative ${replyingTo ? 'rounded-b-2xl rounded-t-none' : 'rounded-2xl'} focus-within:border-[#75b1d9] focus-within:ring-2 focus-within:ring-[#75b1d9]/5 overflow-hidden`}>
                <textarea 
                  ref={textareaRef}
                  value={input} 
                  onChange={e => setInput(e.target.value)} 
                  onKeyDown={handleKeyDown}
                  placeholder={t.placeholder} 
                  rows={1}
                  className="w-full bg-transparent px-4 py-3 focus:outline-none text-[14px] md:text-[15px] font-medium resize-none max-h-[120px] block custom-scrollbar"
                />
              </div>
              <div className="flex items-center gap-2 shrink-0 mb-1">
                {isTyping && (
                  <button type="button" onClick={handleStop} className="bg-white border-2 border-[#75b1d9] text-[#75b1d9] w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center transition-all shadow-md active:scale-95 group relative">
                    <StopCircle size={20} />
                  </button>
                )}
                <button 
                  onClick={() => handleSendMessage()} 
                  disabled={isTyping || !input.trim()} 
                  className={`${input.trim() ? 'bg-[#75b1d9]' : 'bg-slate-300'} text-white w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center transition-all shadow-lg active:scale-95 disabled:cursor-not-allowed`}
                >
                  <Send size={20} />
                </button>
              </div>
            </div>
            
            <div className="pt-3 hidden sm:flex flex-col md:flex-row items-center justify-between gap-2 border-t border-slate-100">
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-[9px] text-slate-400 font-bold uppercase">
                <div className="flex items-center gap-1"><MapPin size={11} className="text-slate-300"/> Azeitão, Portugal</div>
                <div className="flex items-center gap-1"><Phone size={11} className="text-slate-300"/> +351 210 152 492</div>
                <div className="flex items-center gap-1"><Mail size={11} className="text-slate-300"/><a href="mailto:geral@opco.pt" className="hover:text-[#75b1d9] transition-colors underline decoration-slate-200">geral@opco.pt</a></div>
              </div>
              <img src={OPCO_DIGITAL_SYSTEMS_LOGO_URL} className="h-8 md:h-10 object-contain opacity-60 hover:opacity-100 transition-opacity" alt="OPCO Digital Systems" />
            </div>
          </div>
        </div>
      </main>
      
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 md:hidden" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) { const root = createRoot(rootElement); root.render(<App />); }
