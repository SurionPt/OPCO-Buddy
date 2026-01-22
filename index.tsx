
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type, FunctionDeclaration, GenerateContentResponse } from '@google/genai';
import { 
  Send, 
  Loader2,
  Plus,
  X,
  Menu,
  UploadCloud,
  Target,
  Trash2,
  FileText as FileTextIcon,
  Copy,
  Check,
  Square,
  Cpu,
  Activity,
  Reply as ReplyIcon,
  ChevronDown,
  TrendingUp,
  BarChart as BarChartIcon,
  ThumbsUp,
  ThumbsDown,
  Globe,
  Database,
  MessageSquare,
  CircleStop,
  Moon,
  Sun,
  Bell,
  MapPin,
  Phone,
  Mail,
  FileDown,
  FileSpreadsheet,
  Download,
  FileText,
  Paperclip,
  CornerDownRight,
  ClipboardPaste,
  ImageIcon
} from 'lucide-react';
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
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import * as mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';

// Declare pdfjsLib global variable from script tag
declare const pdfjsLib: any;

// --- Constants ---
const SPHERE_LOGO_URL = 'https://raw.githubusercontent.com/SurionPt/OCPCO/refs/heads/main/esfera%2050x47.png';
const OPCO_LOGO_URL = 'https://raw.githubusercontent.com/SurionPt/OCPCO/refs/heads/main/OPCO%20Digital%20Systems.png';
const NEURAL_BG_URL = 'https://raw.githubusercontent.com/SurionPt/OCPCO/refs/heads/main/neural.jpg';
const STORAGE_KEY = 'my_opco_v65_pro';

type SearchMode = 'docs' | 'hybrid';

// --- Interfaces ---
interface Document {
  id: string;
  name: string;
  content: string;
  size: string;
  type: string;
  visualPages?: { data: string, mimeType: string }[];
}

interface Chat {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
}

interface ChartData {
  type: 'bar' | 'line' | 'pie';
  title: string;
  data: { label: string; value: number }[];
}

interface GroundingChunk {
  web?: { uri?: string; title?: string };
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  isError?: boolean;
  replyTo?: { id: string; content: string; role: string; };
  sources?: GroundingChunk[];
  image?: { data: string, mimeType: string };
  chartData?: ChartData;
  autoDocument?: 'pdf' | 'excel';
}

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

// --- Utility Functions ---

const processPdfWithVision = async (file: File): Promise<{ text: string, visualPages: { data: string, mimeType: string }[] }> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    if (!pdfjsLib) throw new Error("PDF.js não carregado");
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    const visualPages: { data: string, mimeType: string }[] = [];
    const pagesToCapture = Math.min(pdf.numPages, 5); 
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += `[PÁGINA ${i}]\n${pageText}\n`;
      
      if (i <= pagesToCapture) {
        const viewport = page.getViewport({ scale: 1.5 }); 
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (context) {
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          await page.render({ canvasContext: context, viewport }).promise;
          const base64Image = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
          visualPages.push({ data: base64Image, mimeType: 'image/jpeg' });
        }
      }
    }
    return { text: fullText, visualPages };
  } catch (error) {
    console.error("Erro no PDF:", error);
    return { text: `Erro no processamento do ficheiro PDF.`, visualPages: [] };
  }
};

const cleanMarkdownForPDF = (text: string) => {
  return text
    .replace(/\[PDF_REPORT_READY\]/g, '')
    .replace(/\[EXCEL_READY\]/g, '')
    .replace(/\|?\s*[:\-]+\s*\|?\s*[:\-]+\s*\|?/g, '') 
    .replace(/\|\s+\*\*/g, '|') 
    .replace(/\*\*\s+\|/g, '|') 
    .replace(/\*\*/g, '') 
    .replace(/#/g, '') 
    .replace(/\|/g, '  ') 
    .trim();
};

const runExportToPDF = (content: string, chartData: ChartData | null) => {
  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);
  let y = 45;

  const red = [202, 6, 7];
  const dark = [26, 36, 51];

  const drawHeaderFooter = (pageNumber: number) => {
    doc.setFillColor(dark[0], dark[1], dark[2]);
    doc.rect(0, 0, pageWidth, 5, 'F');
    doc.addImage(SPHERE_LOGO_URL, 'PNG', pageWidth - 25, 10, 8, 8);
    doc.setDrawColor(red[0], red[1], red[2]);
    doc.setLineWidth(0.7);
    doc.line(margin, 22, pageWidth - margin, 22);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text("OPCO DIGITAL SYSTEMS | RELATÓRIO DE INTELIGÊNCIA ESTRATÉGICA", margin, pageHeight - 10);
    doc.text(`Página ${pageNumber}`, pageWidth - margin - 15, pageHeight - 10);
  };

  drawHeaderFooter(1);
  doc.setFontSize(24);
  doc.setTextColor(red[0], red[1], red[2]);
  doc.setFont("helvetica", "bold");
  doc.text("RELATÓRIO ESTRATÉGICO", margin, 40);
  y = 55;

  const rawText = cleanMarkdownForPDF(content);
  const sections = rawText.split('\n');

  sections.forEach((section) => {
    let line = section.trim();
    if (!line) return;
    if (y > pageHeight - 30) { doc.addPage(); drawHeaderFooter(doc.getNumberOfPages()); y = 30; }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    doc.setTextColor(45, 55, 72);
    const wrappedLines = doc.splitTextToSize(line, contentWidth);
    wrappedLines.forEach((wLine: string) => {
      if (y > pageHeight - 20) { doc.addPage(); drawHeaderFooter(doc.getNumberOfPages()); y = 30; }
      doc.text(wLine, margin, y);
      y += 6;
    });
    y += 3;
  });

  if (chartData && chartData.data) {
    if (y > pageHeight - 100) { doc.addPage(); drawHeaderFooter(doc.getNumberOfPages()); y = 30; }
    y += 10;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, y, contentWidth, 80, 5, 5, 'F');
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(red[0], red[1], red[2]);
    doc.text(`MÉTRICAS: ${chartData.title.toUpperCase()}`, margin + 10, y + 15);
    
    let barY = y + 30;
    const maxVal = Math.max(...chartData.data.map(d => d.value)) || 1;
    chartData.data.forEach((item) => {
      const barWidth = (item.value / maxVal) * (contentWidth - 70);
      doc.setFontSize(9);
      doc.setTextColor(dark[0], dark[1], dark[2]);
      doc.text(item.label.toUpperCase(), margin + 10, barY);
      doc.setFillColor(red[0], red[1], red[2]);
      doc.rect(margin + 50, barY - 3.5, barWidth, 5, 'F');
      doc.text(item.value.toString(), margin + 50 + barWidth + 3, barY);
      barY += 12;
    });
    y += 90;
  }

  doc.save(`Relatorio_Executivo_OPCO_${Date.now()}.pdf`);
};

const runExportToExcel = (content: string) => {
  try {
    const lines = content.split('\n');
    const rows = lines.map(line => {
      if (line.includes('|')) {
        return line.split('|').map(c => c.trim()).filter(c => c !== '');
      }
      return [line.trim()];
    }).filter(row => row.length > 0 && !row.every(cell => cell.match(/^[:\s-]+$/)));

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Extração OPCO");
    XLSX.writeFile(wb, `Extracao_OPCO_${Date.now()}.xlsx`);
  } catch (error) {
    console.error("Erro ao exportar Excel:", error);
  }
};

// --- Custom Components ---
const MarkdownComponents = (isDark: boolean) => ({
  table: ({ children }: any) => (
    <div className={`my-8 overflow-hidden rounded-[20px] border shadow-xl transition-all hover:shadow-2xl ${isDark ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-white'}`}>
      <div className="overflow-x-auto custom-scrollbar">
        <table className="min-w-full border-collapse text-left">
          {children}
        </table>
      </div>
    </div>
  ),
  thead: ({ children }: any) => (
    <thead className={`${isDark ? 'bg-slate-800/80' : 'bg-slate-50'} border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
      {children}
    </thead>
  ),
  th: ({ children }: any) => (
    <th className={`px-6 py-5 text-[9px] font-black uppercase tracking-[0.2em] border-r last:border-r-0 ${isDark ? 'text-slate-400 border-slate-700' : 'text-slate-500 border-slate-200'}`}>
      <div className="flex items-center gap-2">
        <div className="w-1 h-3 rounded-full bg-[#ca0607]" />
        {children}
      </div>
    </th>
  ),
  td: ({ children }: any) => (
    <td className={`px-6 py-4 text-[11px] font-bold border-r last:border-r-0 leading-relaxed align-top ${isDark ? 'text-slate-300 border-slate-800/50' : 'text-slate-700 border-slate-100'}`}>
      {children}
    </td>
  ),
  tr: ({ children }: any) => (
    <tr className={`border-b last:border-b-0 transition-colors ${isDark ? 'border-slate-800/50 even:bg-slate-900/40 hover:bg-slate-800/60' : 'border-slate-100 even:bg-slate-50/50 hover:bg-slate-100/50'}`}>
      {children}
    </tr>
  )
});

// --- Swipe Logic Helper ---
const useSwipe = (onSwipeRight: () => void) => {
  const touchStartRef = useRef(0);
  const touchEndRef = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndRef.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (touchStartRef.current - touchEndRef.current < -80 && touchEndRef.current !== 0) {
      onSwipeRight();
    }
    touchStartRef.current = 0;
    touchEndRef.current = 0;
  };

  return { onTouchStart: handleTouchStart, onTouchMove: handleTouchMove, onTouchEnd: handleTouchEnd };
};

const App = () => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [searchMode, setSearchMode] = useState<SearchMode>('docs');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [pastedImage, setPastedImage] = useState<{ data: string, mimeType: string } | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeChat = useMemo(() => chats.find(c => c.id === activeChatId), [chats, activeChatId]);

  const addToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(curr => curr.filter(t => t.id !== id)), 4000);
  };

  const createNewChat = () => {
    const id = Date.now().toString();
    const newChat: Chat = {
      id, title: "NOVA ANÁLISE",
      messages: [{ id: '1', role: 'assistant', content: "Olá, sou o **My OPCO**. Carregue ou selecione documentos e inicie a sua consulta estratégica.", timestamp: new Date().toISOString() }],
      createdAt: new Date().toISOString()
    };
    setChats(prev => [newChat, ...prev]);
    setActiveChatId(id);
    setIsSidebarOpen(false);
  };

  const deleteChat = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const filtered = chats.filter(c => c.id !== id);
    setChats(filtered);
    if (activeChatId === id) {
      if (filtered.length > 0) setActiveChatId(filtered[0].id);
      else createNewChat();
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) { 
      try { 
        const parsed = JSON.parse(saved);
        setChats(parsed); 
        if (parsed.length > 0) setActiveChatId(parsed[0].id);
        else createNewChat();
      } catch (e) { createNewChat(); } 
    }
    else createNewChat();
  }, []);

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(chats)); }, [chats]);

  // Scroll to bottom
  useEffect(() => {
    if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [activeChat?.messages, isTyping]);

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const base64Data = (event.target?.result as string).split(',')[1];
            setPastedImage({ data: base64Data, mimeType: items[i].type });
            addToast("Imagem colada com sucesso", "success");
          };
          reader.readAsDataURL(blob);
        }
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsUploading(true);
    const newDocs: Document[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        let content = '';
        let visualPages: { data: string, mimeType: string }[] = [];
        const ext = file.name.toLowerCase();

        if (ext.endsWith('.pdf')) {
          const result = await processPdfWithVision(file);
          content = result.text;
          visualPages = result.visualPages;
        } else if (ext.endsWith('.docx')) {
          const ab = await file.arrayBuffer();
          content = (await mammoth.extractRawText({ arrayBuffer: ab })).value;
        } else if (ext.endsWith('.xlsx') || ext.endsWith('.xls')) {
          const ab = await file.arrayBuffer();
          const wb = XLSX.read(ab);
          content = wb.SheetNames.map(sn => XLSX.utils.sheet_to_txt(wb.Sheets[sn])).join('\n');
        } else {
          content = await file.text();
        }

        newDocs.push({
          id: Date.now() + '-' + i,
          name: file.name,
          content,
          size: (file.size / 1024).toFixed(1) + ' KB',
          type: file.type,
          visualPages
        });
      } catch (err) {
        addToast(`Erro em ${file.name}`, 'error');
      }
    }
    
    setDocuments(prev => [...prev, ...newDocs]);
    setSelectedDocIds(prev => [...prev, ...newDocs.map(d => d.id)]);
    setIsUploading(false);
    addToast(`${newDocs.length} documentos adicionados`, 'success');
  };

  const handleSendMessage = async () => {
    if ((!input.trim() && !pastedImage) || isTyping || !activeChatId) return;
    abortControllerRef.current = new AbortController();
    
    const userMsg: Message = { 
      id: Date.now().toString(), 
      role: 'user', 
      content: input, 
      timestamp: new Date().toISOString(),
      replyTo: replyingTo ? { id: replyingTo.id, content: replyingTo.content, role: replyingTo.role } : undefined,
      image: pastedImage || undefined
    };
    
    setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, title: c.title === "NOVA ANÁLISE" ? input.slice(0, 30).toUpperCase() : c.title, messages: [...c.messages, userMsg] } : c));
    const currentInput = input;
    const currentImage = pastedImage;
    setInput(''); setIsTyping(true); setReplyingTo(null); setPastedImage(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const contextDocs = documents.filter(d => selectedDocIds.includes(d.id));
      const history = activeChat?.messages.slice(-12).map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [
          ...(m.image ? [{ inlineData: { data: m.image.data, mimeType: m.image.mimeType } }] : []),
          { text: (m.replyTo ? `[EM RESPOSTA A: ${m.replyTo.content.slice(0, 100)}...]\n` : "") + m.content }
        ]
      })) || [];

      const currentTurnParts: any[] = [];
      
      // Add docs context
      contextDocs.forEach(d => {
        if (d.visualPages) {
          d.visualPages.forEach(vp => {
            currentTurnParts.push({ inlineData: { data: vp.data, mimeType: vp.mimeType } });
          });
        }
        currentTurnParts.push({ text: `[DOC CONTEXTO: ${d.name}]\n${d.content}` });
      });
      
      // Add reply context
      if (userMsg.replyTo) {
        currentTurnParts.push({ text: `[CONTEXTO DE RESPOSTA À MENSAGEM: "${userMsg.replyTo.content}"]` });
      }

      // Add pasted image
      if (currentImage) {
        currentTurnParts.push({ inlineData: { data: currentImage.data, mimeType: currentImage.mimeType } });
      }
      
      currentTurnParts.push({ text: currentInput || "Analise esta imagem/contexto" });

      const contents = [...history, { role: 'user', parts: currentTurnParts }];
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents,
        config: {
          systemInstruction: `És o MY OPCO, Consultor Estratégico da OPC Digital Systems.
          - Responde de forma técnica e executiva.
          - Se houver uma imagem ou anexo, analisa-o detalhadamente.
          - Se houver contexto de resposta (replyTo), foca a tua resposta nesse contexto específico.
          - Usa tabelas Markdown sempre que houver dados estruturados.
          - Termina relatórios com [PDF_REPORT_READY] para ativação do exportador.`,
          tools: searchMode === 'hybrid' ? [{ googleSearch: {} }] : []
        }
      });

      let finalContent = response.text || "";
      let autoDoc: 'pdf' | 'excel' | undefined = undefined;

      if (finalContent.includes("[PDF_REPORT_READY]")) { autoDoc = 'pdf'; finalContent = finalContent.replace("[PDF_REPORT_READY]", "").trim(); }
      if (finalContent.includes("[EXCEL_READY]")) { autoDoc = 'excel'; finalContent = finalContent.replace("[EXCEL_READY]", "").trim(); }

      const assistantMsg: Message = { 
        id: Date.now().toString(), 
        role: 'assistant', 
        content: finalContent, 
        timestamp: new Date().toISOString(),
        autoDocument: autoDoc
      };
      setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, messages: [...c.messages, assistantMsg] } : c));
    } catch (e: any) {
      if (e.name !== 'AbortError') addToast("Falha na rede neuronal OPCO", "error");
    } finally { setIsTyping(false); }
  };

  const MessageBubble = ({ msg }: { msg: Message }) => {
    const swipeHandlers = useSwipe(() => {
      setReplyingTo(msg);
      if (window.navigator.vibrate) window.navigator.vibrate(10);
    });

    return (
      <div 
        {...swipeHandlers}
        className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-4 duration-500 group/msg select-none relative w-full mb-6`}
      >
        {msg.replyTo && (
          <div className={`flex items-center gap-2 mb-1 opacity-50 text-[8px] font-black uppercase ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <CornerDownRight size={10} /> Em resposta a: {msg.replyTo.content.slice(0, 50)}...
          </div>
        )}

        <div className={`relative max-w-[92%] sm:max-w-[85%] rounded-[24px] shadow-lg ring-1 transition-all overflow-hidden ${
          msg.role === 'user' 
            ? (isDark ? 'bg-[#ca0607] ring-transparent text-white' : 'bg-slate-900 ring-slate-800 text-white') 
            : (isDark ? 'bg-slate-900 border-slate-800 ring-slate-800 text-slate-100' : 'bg-white border-slate-100 ring-slate-50 text-slate-800')
        }`}>
          {msg.image && (
            <div className="w-full mb-2 overflow-hidden border-b border-white/10">
              <img src={`data:${msg.image.mimeType};base64,${msg.image.data}`} className="w-full h-auto object-contain max-h-[300px]" alt="Pasted context" />
            </div>
          )}
          
          <div className={`p-5 prose prose-sm max-w-none ${isDark ? 'prose-invert' : ''}`}>
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownComponents(isDark)}>{msg.content}</ReactMarkdown>
          </div>
          
          {msg.autoDocument && (
            <div className={`mx-4 mb-4 p-3 rounded-xl border flex items-center justify-between ${isDark ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center gap-2">
                <FileDown size={14} className="text-[#ca0607]" />
                <p className="text-[8px] font-black uppercase tracking-widest">Documento Estratégico Pronto</p>
              </div>
              <button onClick={() => msg.autoDocument === 'pdf' ? runExportToPDF(msg.content, null) : runExportToExcel(msg.content)} className="px-3 py-1.5 bg-[#ca0607] text-white text-[8px] font-black uppercase rounded-lg">Baixar</button>
            </div>
          )}
          
          {/* Action Hover Controls */}
          <div className={`absolute top-2 ${msg.role === 'assistant' ? '-right-12' : '-left-12'} opacity-0 group-hover/msg:opacity-100 transition-opacity flex flex-col gap-2 md:flex hidden`}>
             <button onClick={() => { navigator.clipboard.writeText(msg.content); addToast("Copiado!", "success"); }} className="p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white transition-colors"><Copy size={12}/></button>
             <button onClick={() => setInput(prev => prev + " " + msg.content)} className="p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white transition-colors"><ClipboardPaste size={12}/></button>
             <button onClick={() => setReplyingTo(msg)} className="p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white transition-colors"><ReplyIcon size={12}/></button>
          </div>
        </div>
        <span className="text-[7px] font-black uppercase tracking-tighter mt-2 opacity-30 px-4">{new Date(msg.timestamp).toLocaleTimeString()}</span>
      </div>
    );
  };

  return (
    <div className={`flex h-screen overflow-hidden font-inter transition-colors duration-500 ${isDark ? 'bg-slate-950 text-white dark' : 'bg-[#fcfcfc] text-slate-900'}`}>
      
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#1a2433] border-r border-slate-800 transition-transform md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="absolute inset-0 pointer-events-none opacity-[0.08] z-0"><img src={NEURAL_BG_URL} className="w-full h-full object-cover grayscale" /></div>
        <div className="relative z-10 flex flex-col h-full">
          <div className="p-4 border-b border-slate-800 flex items-center gap-3 bg-slate-900/40">
            <img src={SPHERE_LOGO_URL} className="w-5 h-5" alt="Sphere" />
            <span className="font-black text-[10px] uppercase tracking-[0.2em] text-white">MY OPCO</span>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            <button onClick={createNewChat} className="w-full py-3 bg-[#ca0607] rounded-xl text-white text-[8px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg mb-6">
              <Plus size={14} /> NOVA ANÁLISE
            </button>
            <div className="space-y-2">
              <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest px-2 mb-2">Recentes</p>
              {chats.map(chat => (
                <button key={chat.id} onClick={() => setActiveChatId(chat.id)} className={`w-full p-3 rounded-xl text-left text-[9px] font-bold border transition-all ${activeChatId === chat.id ? 'bg-[#ca0607] border-red-500 text-white shadow-md' : 'bg-slate-800/50 border-slate-700 text-slate-400'}`}>
                  {chat.title}
                </button>
              ))}
            </div>
            <div className="mt-8">
              <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest px-2 mb-2">Conhecimento</p>
              {documents.map(doc => (
                <div key={doc.id} onClick={() => setSelectedDocIds(prev => prev.includes(doc.id) ? prev.filter(i => i !== doc.id) : [...prev, doc.id])} className={`p-2.5 rounded-xl border mb-1 cursor-pointer transition-all ${selectedDocIds.includes(doc.id) ? 'bg-[#75b1d9]/20 border-[#75b1d9]' : 'bg-slate-800/30 border-slate-700 opacity-60'}`}>
                  <span className="text-[8px] font-bold text-white uppercase truncate block">{doc.name}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="p-4 border-t border-slate-800">
             <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileUpload} />
             <button onClick={() => fileInputRef.current?.click()} className="w-full py-3 bg-[#75b1d9] text-white rounded-xl text-[8px] font-black uppercase tracking-widest flex items-center justify-center gap-2 mb-3">
               {isUploading ? <Loader2 size={12} className="animate-spin"/> : <UploadCloud size={12}/>} Upload
             </button>
             <button onClick={() => setIsDark(!isDark)} className="w-full py-2 bg-slate-800 text-slate-400 text-[8px] font-black rounded-xl uppercase tracking-widest">{isDark ? 'Modo Claro' : 'Modo Escuro'}</button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative">
        <header className={`h-14 border-b flex items-center justify-between px-6 sticky top-0 z-40 ${isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-white/80 border-slate-200'} backdrop-blur-md`}>
           <div className="flex items-center gap-4">
             <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="md:hidden text-slate-500"><Menu size={20}/></button>
             <img src={SPHERE_LOGO_URL} className="h-5" />
           </div>
           <img src={OPCO_LOGO_URL} className="h-5 opacity-80" />
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-10 custom-scrollbar max-w-5xl mx-auto w-full">
           {activeChat?.messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}
           {isTyping && (
             <div className="flex items-center gap-2 text-[#ca0607] animate-pulse">
               <Activity size={12} className="animate-spin" />
               <span className="text-[8px] font-black uppercase tracking-widest">OPCO Intelligence Unit em processamento...</span>
             </div>
           )}
           <div ref={messagesEndRef} className="h-20" />
        </div>

        <div className={`p-4 sm:p-6 border-t ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-100'}`}>
          <div className="max-w-4xl mx-auto relative">
             
             {/* Pasted Image Preview */}
             {pastedImage && (
               <div className="absolute bottom-full left-0 mb-4 animate-in slide-in-from-bottom-4">
                 <div className="relative group">
                    <img src={`data:${pastedImage.mimeType};base64,${pastedImage.data}`} className="w-20 h-20 object-cover rounded-xl border-2 border-[#ca0607] shadow-xl" />
                    <button onClick={() => setPastedImage(null)} className="absolute -top-2 -right-2 bg-red-600 text-white p-1 rounded-full shadow-lg"><X size={10} /></button>
                 </div>
               </div>
             )}

             {/* Reply Overlay */}
             {replyingTo && (
               <div className="mb-3 px-4 py-2 bg-slate-800/10 dark:bg-slate-100/10 border-l-4 border-[#ca0607] flex items-center justify-between rounded-r-xl animate-in slide-in-from-bottom-2">
                 <div className="text-[9px] font-medium opacity-70 truncate max-w-[85%]">
                   <span className="font-black text-[#ca0607] uppercase mr-2">A responder:</span>
                   {replyingTo.content}
                 </div>
                 <button onClick={() => setReplyingTo(null)} className="text-slate-400"><X size={14} /></button>
               </div>
             )}

             <div className={`flex flex-col border rounded-[28px] p-2 transition-all shadow-2xl ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'} focus-within:ring-2 focus-within:ring-[#ca0607]/20`}>
                <div className="flex items-center px-2">
                   <button onClick={() => fileInputRef.current?.click()} className="w-10 h-10 flex-shrink-0 flex items-center justify-center text-slate-400 hover:text-[#ca0607]"><Paperclip size={18} /></button>
                   <textarea 
                    value={input} 
                    onChange={e => setInput(e.target.value)} 
                    onPaste={handlePaste}
                    placeholder="Solicite uma análise clínica ou anexe dados..."
                    className="flex-1 bg-transparent px-2 py-4 focus:outline-none resize-none text-[12px] font-medium placeholder:text-slate-400 max-h-[150px]"
                    rows={1}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())}
                   />
                   <div className="flex items-center gap-1">
                      {isTyping ? (
                        <button onClick={() => abortControllerRef.current?.abort()} className="w-10 h-10 flex items-center justify-center text-red-600"><CircleStop size={22} /></button>
                      ) : (
                        <button onClick={handleSendMessage} disabled={!input.trim() && !pastedImage} className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all ${input.trim() || pastedImage ? 'bg-[#ca0607] text-white hover:scale-110' : 'bg-slate-300 text-white'}`}>
                          <Send size={16} />
                        </button>
                      )}
                   </div>
                </div>
             </div>
             
             <div className="mt-4 flex flex-wrap justify-center gap-x-8 gap-y-2 opacity-30 grayscale text-[8px] font-black uppercase tracking-[0.1em]">
                <div className="flex items-center gap-1"><MapPin size={8} /> Azeitão, PT</div>
                <div className="flex items-center gap-1"><Phone size={8} /> +351 210 152 492</div>
                <div className="flex items-center gap-1"><Mail size={8} /> geral@opco.pt</div>
             </div>
          </div>
        </div>
      </main>
      
      {/* Toasts */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map(t => (
          <div key={t.id} className={`px-5 py-3 rounded-2xl shadow-2xl border text-[10px] font-black uppercase tracking-widest animate-in slide-in-from-right-6 backdrop-blur-xl ${
            t.type === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-600' :
            t.type === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-600' :
            'bg-[#75b1d9]/10 border-[#75b1d9]/30 text-[#75b1d9]'
          }`}>
            {t.message}
          </div>
        ))}
      </div>
      
      {isSidebarOpen && <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[45] md:hidden" onClick={() => setIsSidebarOpen(false)} />}
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
