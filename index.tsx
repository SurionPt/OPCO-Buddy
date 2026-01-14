
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
  ChevronDown
} from 'lucide-react';
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
    loading: "A carregar...",
    engine: "Motor OPCO Buddy",
    langHeading: "IDIOMA DO LAYOUT"
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
    langHeading: "LAYOUT LANGUAGE"
  },
  fr: {
    welcome: "Bonjour, je suis OPCO Buddy, votre assistant IA. Comment puis-je vous aider aujourd'hui ?",
    placeholder: "Demandez n'importe quoi...",
    newChat: "Nouvelle Requête OPCO",
    files: "FICHIERS",
    recent: "RÉCENTS",
    upload: "Télécharger des fichiers",
    active: "Actif",
    dynamicTables: "Tableaux dynamiques",
    richPPT: "PPT Riches",
    visualValidation: "Validation visuelle",
    systemPrompt: "Vous êtes OPCO Buddy, un spécialiste du conseil. Répondez toujours en français.",
    fileGenerated: "Fichier généré",
    loading: "Chargement...",
    engine: "Moteur OPCO Buddy",
    langHeading: "LANGUE DU LAYOUT"
  },
  de: {
    welcome: "Hallo, ich bin OPCO Buddy, Ihr KI-Assistent. Wie kann ich heute helfen?",
    placeholder: "Fragen Sie etwas...",
    newChat: "Neue OPCO-Anfrage",
    files: "DATEIEN",
    recent: "AKTUELL",
    upload: "Dateien hochladen",
    active: "Aktiv",
    dynamicTables: "Dynamische Tabellen",
    richPPT: "Reichhaltiges PPT",
    visualValidation: "Visuelle Validierung",
    systemPrompt: "Sie sind OPCO Buddy, ein Beratungsspezialist. Antworten Sie immer auf Deutsch.",
    fileGenerated: "Datei generiert",
    loading: "Laden...",
    engine: "OPCO Buddy Engine",
    langHeading: "LAYOUT-SPRACHE"
  },
  es: {
    welcome: "Hola, soy OPCO Buddy, tu asistente de IA. ¿Cómo puedo ayudarte hoy?",
    placeholder: "Pregunta algo...",
    newChat: "Nueva Consulta OPCO",
    files: "ARCHIVOS",
    recent: "RECIENTES",
    upload: "Subir Archivos",
    active: "Activo",
    dynamicTables: "Tablas Dinámicas",
    richPPT: "PPT Ricos",
    visualValidation: "Validación Visual",
    systemPrompt: "Eres OPCO Buddy, un especialista en consultoría. Responde siempre en español.",
    fileGenerated: "Archivo generado",
    loading: "Cargando...",
    engine: "Motor OPCO Buddy",
    langHeading: "IDIOMA DEL DISEÑO"
  },
  nl: {
    welcome: "Hallo, ik ben OPCO Buddy, je AI-assistent. Hoe kan ik vandaag helpen?",
    placeholder: "Vraag iets...",
    newChat: "Nieuwe OPCO Vraag",
    files: "BESTANDEN",
    recent: "RECENT",
    upload: "Bestanden Uploaden",
    active: "Actief",
    dynamicTables: "Dynamische Tabellen",
    richPPT: "Rijke PPT",
    visualValidation: "Visuele Validatie",
    systemPrompt: "Je bent OPCO Buddy, een adviesspecialist. Antwoord altijd in het Nederlands.",
    fileGenerated: "Bestand gegenereerd",
    loading: "Laden...",
    engine: "OPCO Buddy Engine",
    langHeading: "LAYOUT TAAL"
  },
  zh: {
    welcome: "您好，我是 OPCO Buddy，您的 AI 助手。今天有什么可以帮您的？",
    placeholder: "提问...",
    newChat: "新 OPCO 查询",
    files: "文件",
    recent: "最近",
    upload: "上传文件",
    active: "在线",
    dynamicTables: "动态表格",
    richPPT: "丰富 PPT",
    visualValidation: "视觉验证",
    systemPrompt: "您是 OPCO Buddy，一位咨询专家。请始终用中文回答。",
    fileGenerated: "文件已生成",
    loading: "加载中...",
    engine: "OPCO Buddy 引擎",
    langHeading: "布局语言"
  },
  ja: {
    welcome: "こんにちは、OPCO Buddyです。あなたのAIアシスタントです。本日はどのようなお手伝いができますか？",
    placeholder: "質問する...",
    newChat: "新規 OPCO クエリ",
    files: "ファイル",
    recent: "最近",
    upload: "ファイルをアップロード",
    active: "アクティブ",
    dynamicTables: "動的テーブル",
    richPPT: "リッチPPT",
    visualValidation: "視覚的検証",
    systemPrompt: "あなたはOPCO Buddy、コンサルティングのスペシャリストです。常に日本語で答えてください。",
    fileGenerated: "ファイルが生成されました",
    loading: "読み込み中...",
    engine: "OPCO Buddy エンジン",
    langHeading: "レイアウト言語"
  }
};

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

const base64ToUint8Array = (base64: string) => {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

// --- Models & Config ---
const OPCO_LOGO_URL = 'https://raw.githubusercontent.com/SurionPt/OCPCO/refs/heads/main/esfera%2050x47.png';
const NEURAL_BG_URL = 'https://raw.githubusercontent.com/SurionPt/OCPCO/refs/heads/main/neural.jpg';
const STORAGE_KEY = 'opco_buddy_chats_v6';

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
    description: 'Gera documentos e apresentações profissionais de alta fidelidade com conteúdo gráfico editável e rico.',
    properties: {
      fileType: { type: Type.STRING, description: 'Tipo: pdf, docx, pptx ou xlsx', enum: ['pdf', 'docx', 'pptx', 'xlsx'] },
      fileName: { type: Type.STRING, description: 'Nome do ficheiro' },
      title: { type: Type.STRING, description: 'Título principal' },
      sections: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            heading: { type: Type.STRING, description: 'Título da secção' },
            body: { type: Type.STRING, description: 'Texto detalhado. Use quebras de linha para listas.' },
            visualDescription: { type: Type.STRING, description: 'Descrição rica para o elemento gráfico AI.' },
            layoutType: { type: Type.STRING, description: 'Sugestão de layout', enum: ['standard', 'columns', 'graphic-heavy'] }
          }
        },
        description: 'Conteúdo estruturado.'
      },
      tableData: {
        type: Type.ARRAY,
        items: { type: Type.ARRAY, items: { type: Type.STRING } },
        description: 'Dados matriciais.'
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

  // Sync Welcome Message and Titles when language changes
  useEffect(() => {
    setChats(prev => prev.map(chat => {
      // Check if the title is one of the standard translated "New Query" titles
      const isStandardTitle = Object.values(TRANSLATIONS).some(trans => trans.newChat === chat.title);
      
      const updatedMessages = chat.messages.map((msg, index) => {
        // If it's the first assistant message and matches a standard welcome message
        if (index === 0 && msg.role === 'assistant') {
           const isStandardWelcome = Object.values(TRANSLATIONS).some(trans => trans.welcome === msg.content);
           if (isStandardWelcome) {
             return { ...msg, content: t.welcome };
           }
        }
        return msg;
      });

      return {
        ...chat,
        title: isStandardTitle ? t.newChat : chat.title,
        messages: updatedMessages
      };
    }));
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
        } catch (e) { return "Error reading PDF."; }
      case 'docx':
        try {
          const result = await mammoth.extractRawText({ arrayBuffer: buffer });
          return result.value;
        } catch (e) { return "Error reading DOCX."; }
      case 'xlsx':
      case 'xls':
        try {
          const wb = XLSX.read(buffer, { type: 'array' });
          return wb.SheetNames.map(n => `Sheet: ${n}\n${XLSX.utils.sheet_to_txt(wb.Sheets[n])}`).join('\n');
        } catch (e) { return "Error reading Excel."; }
      default:
        return await file.text();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setIsUploading(true);
    for (const f of Array.from(files) as File[]) {
      try {
        const content = await processFile(f);
        setDocuments(prev => [...prev, {
          id: Math.random().toString(36).substr(2, 9),
          name: f.name,
          content,
          size: `${(f.size / 1024).toFixed(1)} KB`,
          type: f.name.split('.').pop() || 'file'
        }]);
      } catch (err) { console.error(err); }
    }
    setIsUploading(false);
  };

  const generatePDF = (args: any): GeneratedFile => {
    const doc = new jsPDF();
    doc.setFillColor(202, 6, 7);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255);
    doc.setFontSize(22);
    doc.text(args.title, 15, 25);
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
    return { name: `${args.fileName}.pdf`, url: URL.createObjectURL(doc.output('blob')), type: 'pdf' };
  };

  const generateWord = async (args: any): Promise<GeneratedFile> => {
    const children: any[] = [
      new docx.Paragraph({ text: args.title, heading: docx.HeadingLevel.HEADING_1, alignment: docx.AlignmentType.CENTER, spacing: { after: 400 } }),
    ];
    for (const sec of (args.sections || [])) {
      children.push(new docx.Paragraph({ text: sec.heading, heading: docx.HeadingLevel.HEADING_2, spacing: { before: 400, after: 200 } }));
      children.push(new docx.Paragraph({ text: sec.body, spacing: { after: 200 } }));
      if (sec.base64Image) {
        children.push(new docx.Paragraph({
          children: [new docx.ImageRun({ data: base64ToUint8Array(sec.base64Image), transformation: { width: 500, height: 300 } } as any)],
          alignment: docx.AlignmentType.CENTER
        }));
      }
    }
    const doc = new docx.Document({ sections: [{ children }] });
    const blob = await docx.Packer.toBlob(doc);
    return { name: `${args.fileName}.docx`, url: URL.createObjectURL(blob), type: 'docx' };
  };

  const generatePPT = async (args: any): Promise<GeneratedFile> => {
    const pres = new PptxGenJS();
    pres.layout = 'LAYOUT_16x9';
    let titleSlide = pres.addSlide();
    titleSlide.background = { color: 'FFFFFF' };
    titleSlide.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 1.5, fill: { color: 'ca0607' } });
    titleSlide.addText(args.title, { x: 0, y: 0.3, w: '100%', h: 1, fontSize: 38, color: 'FFFFFF', align: 'center', bold: true, fontFace: 'Inter' });
    titleSlide.addText("OPCO Business Intelligence", { x: 0, y: 3.5, w: '100%', h: 0.5, fontSize: 14, color: 'ca0607', align: 'center', fontFace: 'Inter' });
    for (const sec of (args.sections || [])) {
      let s = pres.addSlide();
      s.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: 0.2, h: '100%', fill: { color: 'ca0607' } });
      s.addText(sec.heading, { x: 0.5, y: 0.3, w: '90%', h: 0.7, fontSize: 24, color: 'ca0607', bold: true, fontFace: 'Inter' });
      if (sec.base64Image) {
        s.addText(sec.body, { x: 0.5, y: 1.2, w: 4.5, h: 3.5, fontSize: 14, color: '333333', valign: 'top', fontFace: 'Inter' });
        s.addImage({ data: `data:image/png;base64,${sec.base64Image}`, x: 5.3, y: 1.3, w: 4.2, h: 3.3 });
      } else {
        s.addText(sec.body, { x: 0.5, y: 1.2, w: '90%', h: 3.5, fontSize: 16, color: '333333', valign: 'top', fontFace: 'Inter' });
      }
    }
    const blob = await pres.write({ outputType: 'blob' }) as Blob;
    return { name: `${args.fileName}.pptx`, url: URL.createObjectURL(blob), type: 'pptx' };
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isTyping || !activeChatId) return;

    const focusedDoc = selectedDocId ? documents.find(d => d.id === selectedDocId) : null;
    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: input, timestamp: new Date().toISOString(), contextFile: focusedDoc?.name };
    setChats(prev => prev.map(chat => chat.id === activeChatId ? { ...chat, messages: [...chat.messages, userMessage] } : chat));
    const capturedInput = input;
    setInput(''); setIsTyping(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      let context = focusedDoc ? `CONTEXTO: ${focusedDoc.content}` : `CONTEXTO GLOBAL: ${documents.map(d => d.content).join('\n')}`;
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `${context}\n\nUtilizador: ${capturedInput}`,
        config: {
          systemInstruction: `${t.systemPrompt}
          - If the user asks for a presentation (PPTX), create rich content segmented by slides.
          - Use visualDescription for images.
          - Validate all linguistic content in images.`,
          tools: [{ functionDeclarations: [generateCorporateFileTool] }]
        }
      });

      let content = response.text || "";
      let files: GeneratedFile[] = [];

      if (response.functionCalls) {
        for (const fc of response.functionCalls) {
          if (fc.name === 'generate_corporate_file') {
            const args = fc.args as any;
            if (args.sections) {
              for (let i = 0; i < args.sections.length; i++) {
                const sec = args.sections[i];
                if (sec.visualDescription) {
                  setStatusMsg(`${t.loading} (${i+1})`);
                  const imgRes = await ai.models.generateContent({
                    model: 'gemini-2.5-flash-image',
                    contents: { parts: [{ text: `Professional corporate slide visual about: ${sec.visualDescription}. TEXT IN ${currentLangName.toUpperCase()}.` }] }
                  });
                  const imgPart = imgRes.candidates[0].content.parts.find(p => p.inlineData);
                  if (imgPart?.inlineData) {
                    const validationRes = await ai.models.generateContent({
                      model: 'gemini-3-flash-preview',
                      contents: {
                        parts: [
                          { inlineData: { data: imgPart.inlineData.data, mimeType: imgPart.inlineData.mimeType } },
                          { text: `Analyze the text in this image. Are there spelling errors in ${currentLangName}? If correct, reply 'VALIDATED'.` }
                        ]
                      }
                    });
                    if (validationRes.text?.includes('VALIDATED')) args.sections[i].base64Image = imgPart.inlineData.data;
                    else {
                      const retryRes = await ai.models.generateContent({
                        model: 'gemini-2.5-flash-image',
                        contents: { parts: [{ text: `FIX spelling in ${currentLangName.toUpperCase()} for: ${sec.visualDescription}.` }] }
                      });
                      const retryPart = retryRes.candidates[0].content.parts.find(p => p.inlineData);
                      if (retryPart?.inlineData) args.sections[i].base64Image = retryPart.inlineData.data;
                      else args.sections[i].base64Image = imgPart.inlineData.data;
                    }
                  }
                }
              }
            }
            let file;
            if (args.fileType === 'pdf') file = generatePDF(args);
            else if (args.fileType === 'docx') file = await generateWord(args);
            else if (args.fileType === 'pptx') file = await generatePPT(args);
            else if (args.fileType === 'xlsx') {
              const wb = XLSX.utils.book_new();
              XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(args.tableData || [['A']]), "Data");
              file = { name: `${args.fileName}.xlsx`, url: URL.createObjectURL(new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })])), type: 'xlsx' };
            }
            if (file) { files.push(file); content += `\n\n📄 **[${t.fileGenerated}]: ${file.name}**`; }
          }
        }
      }
      addAssistantMessage(content, { generatedFiles: files });
    } catch (e) { addAssistantMessage("Error."); } finally { setIsTyping(false); setStatusMsg(''); }
  };

  const addAssistantMessage = (content: string, extra = {}) => {
    const msg: Message = { id: Date.now().toString(), role: 'assistant', content, timestamp: new Date().toISOString(), ...extra };
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
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#99a288] border-r border-slate-800/50 flex flex-col transition-transform duration-300 md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: `url("${NEURAL_BG_URL}")`, backgroundSize: 'cover' }}></div>
        <div className="relative z-10 flex flex-col h-full">
          <div className="p-6 flex items-center justify-between border-b border-white/10">
            <div className="flex items-center gap-2 text-white font-bold text-lg cursor-pointer" onClick={() => window.location.reload()}>
              <img src={OPCO_LOGO_URL} className="w-8 h-8" /> <span>OPCO Buddy</span>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-white/40"><X size={20}/></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6 custom-scrollbar">
            
            <div className="px-2">
              <div className="text-[10px] text-white font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
                <Globe size={12} className="text-white/60"/> {t.langHeading}
              </div>
              <div className="relative group">
                <select 
                  value={currentLang}
                  onChange={(e) => setCurrentLang(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-xl py-2.5 px-4 text-xs text-white focus:outline-none focus:ring-2 focus:ring-[#ca0607]/50 focus:border-[#ca0607] transition-all appearance-none cursor-pointer"
                >
                  {LANGUAGES.map(lang => (
                    <option key={lang.code} value={lang.code} className="bg-[#99a288] text-white">
                      {lang.flag} {lang.name}
                    </option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-white/40 group-hover:text-white/60 transition-colors">
                  <ChevronDown size={14} />
                </div>
              </div>
            </div>

            <button onClick={createNewChat} className="flex items-center gap-3 p-3.5 bg-[#ca0607] hover:bg-black border border-white/10 rounded-xl text-white text-xs font-bold transition-all shadow-lg active:scale-95 uppercase tracking-wider">
              <PlusCircle size={16} /> {t.newChat}
            </button>
            
            <div className="space-y-4">
              <div className="text-[10px] text-white font-bold uppercase tracking-widest px-2 flex items-center gap-2">
                <FileBadge size={12} className="text-white/60"/> {t.files}
              </div>
              <div className="space-y-1">
                {documents.map(doc => (
                  <div key={doc.id} onClick={() => setSelectedDocId(doc.id)} className={`group p-2.5 rounded-lg text-[10px] flex justify-between items-center cursor-pointer transition-all border ${selectedDocId === doc.id ? 'bg-white/20 border-white/40 text-white font-bold' : 'bg-white/5 border-transparent text-white/80 hover:bg-white/10'}`}>
                    <span className="truncate flex-1">{doc.name}</span>
                    <button onClick={(e) => { e.stopPropagation(); setDocuments(prev => prev.filter(d => d.id !== doc.id)); }} className="text-white/40 hover:text-white"><X size={12}/></button>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <div className="text-[10px] text-white font-bold uppercase tracking-widest px-2 flex items-center gap-2">
                <MessageSquare size={12} className="text-white/60"/> {t.recent}
              </div>
              <div className="space-y-1">
                {chats.map(c => (
                  <div key={c.id} onClick={() => setActiveChatId(c.id)} className={`p-3 rounded-lg text-[11px] truncate cursor-pointer transition-all border ${activeChatId === c.id ? 'bg-white/20 text-white font-bold border-white/30' : 'text-white/70 border-transparent hover:bg-white/5'}`}>
                    <span className="truncate">{c.title}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="p-4 border-t border-white/10 bg-black/5">
             <button onClick={() => fileInputRef.current?.click()} className="w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-[11px] font-bold flex items-center justify-center gap-2 transition-all border border-white/10 uppercase tracking-wide">
               {isUploading ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
               {isUploading ? "..." : t.upload}
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
              <img src={OPCO_LOGO_URL} className="w-9 h-9" />
              <div>
                <h1 className="text-sm font-black uppercase tracking-tighter text-slate-800 flex items-center gap-2">
                  OPCO Buddy <Sparkles size={14} className="text-[#ca0607]"/>
                </h1>
                <div className="text-[9px] text-green-600 font-bold flex items-center gap-1.5 uppercase tracking-widest">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div> {t.active}
                </div>
              </div>
            </div>
          </div>
          <div className="hidden lg:flex items-center gap-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            <span className="flex items-center gap-1.5"><TableIcon size={14}/> {t.dynamicTables}</span>
            <span className="flex items-center gap-1.5"><Presentation size={14}/> {t.richPPT}</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 size={14}/> {t.visualValidation}</span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 custom-scrollbar bg-[#F8FAFC]">
          {activeChat?.messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
              <div className="flex flex-col gap-2 max-w-[95%] md:max-w-[85%]">
                <div className={`p-6 rounded-3xl shadow-lg border ${msg.role === 'user' ? 'bg-[#9B9B9B] text-white border-slate-300' : 'bg-white text-slate-800 border-slate-100'}`}>
                  <div className={`prose prose-sm max-w-none ${msg.role === 'user' ? 'prose-invert text-white' : 'prose-slate text-slate-700 font-medium'}`}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                  </div>
                  {msg.generatedFiles && msg.generatedFiles.length > 0 && (
                    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3">
                      {msg.generatedFiles.map((f, i) => (
                        <a key={i} href={f.url} download={f.name} className="flex items-center gap-4 p-5 bg-slate-50 border border-slate-200 rounded-2xl hover:border-[#ca0607] hover:bg-white transition-all group shadow-sm">
                          <div className="p-3 bg-white rounded-xl shadow-inner">{getFileIcon(f.type)}</div>
                          <div className="flex-1 truncate">
                            <div className="text-[9px] font-black text-slate-400 uppercase mb-1 tracking-widest">{t.fileGenerated}</div>
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
            <div className="flex flex-col gap-3">
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-md inline-flex items-center gap-4 w-fit">
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 bg-[#ca0607] rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-[#ca0607] rounded-full animate-bounce [animation-delay:0.2s]"></div>
                  <div className="w-2 h-2 bg-[#ca0607] rounded-full animate-bounce [animation-delay:0.4s]"></div>
                </div>
                {statusMsg && <span className="text-[11px] font-black text-[#ca0607] animate-pulse uppercase tracking-tighter">{statusMsg}</span>}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} className="h-4" />
        </div>

        <div className="p-6 md:p-8 border-t bg-white relative z-40 shadow-2xl">
          <div className="max-w-4xl mx-auto flex flex-col gap-4">
            <form onSubmit={handleSendMessage} className="flex items-center gap-3">
              <div className="flex items-center bg-slate-50 border-2 border-slate-100 rounded-3xl flex-1 px-6 focus-within:border-[#ca0607] focus-within:bg-white transition-all shadow-inner">
                <input 
                  type="text" value={input} onChange={e => setInput(e.target.value)} 
                  placeholder={t.placeholder} 
                  className="flex-1 bg-transparent py-4 focus:outline-none text-sm font-semibold text-slate-700"
                />
              </div>
              <button 
                type="submit" 
                disabled={isTyping || !input.trim()} 
                className="bg-[#ca0607] text-white w-14 h-14 rounded-3xl flex items-center justify-center hover:bg-black disabled:bg-slate-200 disabled:text-slate-400 shadow-xl active:scale-95 transition-all shrink-0"
              >
                <Send size={22} />
              </button>
            </form>
            <div className="pt-4 border-t border-slate-50 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex flex-wrap justify-center gap-x-6 text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                <div className="flex items-center gap-2"><MapPin size={10} className="text-[#ca0607]"/> Azeitão, Portugal</div>
                <div className="flex items-center gap-2"><Phone size={10} className="text-[#ca0607]"/> +351 210 152 492</div>
                <div className="flex items-center gap-2"><Mail size={10} className="text-[#ca0607]"/> opco@opco.pt</div>
              </div>
              <div className="text-[10px] text-slate-300 font-black uppercase tracking-tighter">{t.engine} v4.2</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
