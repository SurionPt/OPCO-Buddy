
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type, FunctionDeclaration, GenerateContentResponse } from '@google/genai';
import { 
  Send, 
  Loader2,
  Plus,
  X,
  Menu,
  UploadCloud,
  Trash2,
  FileText as FileTextIcon,
  Copy,
  Check,
  Activity,
  Reply as ReplyIcon,
  Globe,
  Database,
  CircleStop,
  Moon,
  Sun,
  MapPin,
  Phone,
  Mail,
  FileDown,
  Paperclip,
  ExternalLink
} from 'lucide-react';
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
const STORAGE_KEY = 'my_opco_v69_pro';

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
    .replace(/\*\*/g, '') 
    .replace(/#/g, '') 
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
    doc.text("OPCO | RELATÓRIO DE INTELIGÊNCIA ESTRATÉGICA", margin, pageHeight - 10);
    doc.text(`Página ${pageNumber}`, pageWidth - margin - 15, pageHeight - 10);
  };

  drawHeaderFooter(1);
  doc.setFontSize(24);
  doc.setTextColor(red[0], red[1], red[2]);
  doc.setFont("helvetica", "bold");
  doc.text("RELATÓRIO ESTRATÉGICO", margin, 40);
  y = 55;

  const lines = content.split('\n');
  let inTable = false;
  let tableRows: string[][] = [];

  const flushTable = () => {
    if (tableRows.length === 0) return;
    
    const colCount = tableRows[0].length;
    const colWidth = contentWidth / colCount;
    
    tableRows.forEach((row, rowIndex) => {
      // Check for page overflow
      if (y > pageHeight - 35) {
        doc.addPage();
        drawHeaderFooter(doc.getNumberOfPages());
        y = 30;
      }

      // Calculate max height for this row
      let maxHeight = 6;
      if (rowIndex === 0) doc.setFontSize(7.5); else doc.setFontSize(8.5);

      row.forEach((cell) => {
        const textLines = doc.splitTextToSize(cell, colWidth - 4);
        maxHeight = Math.max(maxHeight, textLines.length * 5);
      });

      if (rowIndex === 0) {
        // Header background
        doc.setFillColor(248, 248, 248);
        doc.rect(margin, y - 5, contentWidth, maxHeight + 4, 'F');
        doc.setFont("helvetica", "bold");
        doc.setTextColor(red[0], red[1], red[2]);
      } else {
        doc.setFont("helvetica", "normal");
        doc.setTextColor(45, 55, 72);
      }

      row.forEach((cell, colIndex) => {
        const textLines = doc.splitTextToSize(cell, colWidth - 4);
        doc.text(textLines, margin + (colIndex * colWidth) + 2, y);
      });

      // Horizontal separator line
      doc.setDrawColor(235, 235, 235);
      doc.setLineWidth(0.1);
      doc.line(margin, y + maxHeight - 2, pageWidth - margin, y + maxHeight - 2);

      y += maxHeight + 2;
    });

    tableRows = [];
    inTable = false;
    y += 5;
    doc.setFontSize(10); // Restore normal font size
  };

  lines.forEach((line) => {
    const isTableRow = line.trim().startsWith('|') && line.trim().endsWith('|');
    const isDivider = line.match(/^[:\s-|\d]+$/);

    if (isTableRow && !isDivider) {
      const cells = line.split('|').map(c => c.trim()).filter((c, i, a) => !( (i === 0 || i === a.length - 1) && c === ''));
      if (cells.length > 0) {
        tableRows.push(cells);
        inTable = true;
      }
    } else if (inTable && !isTableRow && !isDivider) {
      flushTable();
    } else if (!isTableRow && !isDivider) {
      const cleanLine = cleanMarkdownForPDF(line);
      if (!cleanLine) return;

      if (y > pageHeight - 20) {
        doc.addPage();
        drawHeaderFooter(doc.getNumberOfPages());
        y = 30;
      }

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(45, 55, 72);
      const wrappedLines = doc.splitTextToSize(cleanLine, contentWidth);
      wrappedLines.forEach((wLine: string) => {
        if (y > pageHeight - 20) { doc.addPage(); drawHeaderFooter(doc.getNumberOfPages()); y = 30; }
        doc.text(wLine, margin, y);
        y += 6;
      });
      y += 2;
    }
  });

  if (inTable) flushTable();

  doc.save(`Relatorio_OPCO_${Date.now()}.pdf`);
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
    XLSX.utils.book_append_sheet(wb, ws, "Dados_OPCO");
    XLSX.writeFile(wb, `Dados_OPCO_${Date.now()}.xlsx`);
  } catch (error) {
    console.error("Erro ao exportar Excel:", error);
  }
};

// --- Custom Components ---
const MarkdownComponents = (isDark: boolean) => ({
  table: ({ children }: any) => (
    <div className={`my-3 overflow-hidden rounded-lg border shadow-sm max-w-full ${isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-200 bg-white'}`}>
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full border-collapse text-left text-[9px]">
          {children}
        </table>
      </div>
    </div>
  ),
  thead: ({ children }: any) => (
    <thead className={`${isDark ? 'bg-slate-800' : 'bg-slate-50/80'} border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
      {children}
    </thead>
  ),
  th: ({ children }: any) => (
    <th className={`px-2 py-1.5 font-bold uppercase tracking-wider border-r last:border-r-0 ${isDark ? 'text-slate-400 border-slate-700' : 'text-slate-600 border-slate-200'}`}>
      {children}
    </th>
  ),
  td: ({ children }: any) => (
    <td className={`px-2 py-1.5 border-r last:border-r-0 align-top ${isDark ? 'text-slate-300 border-slate-800/50' : 'text-slate-700 border-slate-100'}`}>
      {children}
    </td>
  ),
  tr: ({ children }: any) => (
    <tr className={`border-b last:border-b-0 ${isDark ? 'border-slate-800/50 even:bg-slate-900/40' : 'border-slate-100 even:bg-slate-50/50'}`}>
      {children}
    </tr>
  ),
  p: ({ children }: any) => (
    <p className="mb-2 last:mb-0 leading-normal">{children}</p>
  ),
  code: ({ children, inline }: any) => (
    inline 
      ? <code className={`px-1 py-0.5 rounded text-[9px] ${isDark ? 'bg-slate-800 text-rose-300' : 'bg-slate-100 text-rose-600'}`}>{children}</code>
      : <pre className={`p-2 rounded-lg overflow-x-auto text-[9px] ${isDark ? 'bg-black/50' : 'bg-slate-50 border border-slate-200'}`}><code>{children}</code></pre>
  )
});

const useSwipeReply = (onSwipe: () => void) => {
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const swipeThreshold = 50;

  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.targetTouches[0].clientX; };
  const handleTouchMove = (e: React.TouchEvent) => { touchEndX.current = e.targetTouches[0].clientX; };
  const handleTouchEnd = () => {
    const diff = touchEndX.current - touchStartX.current;
    if (diff > swipeThreshold && touchEndX.current !== 0) { onSwipe(); }
    touchStartX.current = 0; touchEndX.current = 0;
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
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const activeChat = useMemo(() => chats.find(c => c.id === activeChatId), [chats, activeChatId]);

  const addToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(curr => curr.filter(t => t.id !== id)), 2500);
  };

  const createNewChat = () => {
    const id = Date.now().toString() + Math.random().toString(36).substring(7);
    const newChat: Chat = {
      id, title: "NOVA ANÁLISE",
      messages: [{ id: 'init-1', role: 'assistant', content: "Olá, sou o **My OPCO**. Carregue ou selecione documentos e inicie a sua consulta estratégica.", timestamp: new Date().toISOString() }],
      createdAt: new Date().toISOString()
    };
    setChats(prev => [newChat, ...prev]);
    setActiveChatId(id);
    setIsSidebarOpen(false);
  };

  const deleteChat = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newChats = chats.filter(c => c.id !== id);
    setChats(newChats);
    if (activeChatId === id) {
      if (newChats.length > 0) setActiveChatId(newChats[0].id);
      else createNewChat();
    }
    addToast("Análise apagada", "info");
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
    } else createNewChat();
  }, []);

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(chats)); }, [chats]);

  useEffect(() => {
    if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [activeChat?.messages, isTyping]);

  const handlePasteAction = useCallback((e: ClipboardEvent | React.ClipboardEvent) => {
    const clipboardData = (e as any).clipboardData || (e as any).nativeEvent?.clipboardData;
    if (!clipboardData) return;
    const items = clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === 'file' && items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const fullResult = event.target?.result as string;
            if (fullResult && fullResult.includes(',')) {
              const base64Data = fullResult.split(',')[1];
              setPastedImage({ data: base64Data, mimeType: file.type });
              addToast("Imagem anexada", "success");
            }
          };
          reader.readAsDataURL(file);
        }
      }
    }
  }, []);

  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA' || target === promptRef.current) handlePasteAction(e);
    };
    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, [handlePasteAction]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsUploading(true);
    const newDocs: Document[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        let content = ''; let visualPages: { data: string, mimeType: string }[] = [];
        const ext = file.name.toLowerCase();
        if (ext.endsWith('.pdf')) { const r = await processPdfWithVision(file); content = r.text; visualPages = r.visualPages; }
        else if (ext.endsWith('.docx')) { const ab = await file.arrayBuffer(); content = (await mammoth.extractRawText({ arrayBuffer: ab })).value; }
        else if (ext.endsWith('.xlsx') || ext.endsWith('.xls')) { const ab = await file.arrayBuffer(); const wb = XLSX.read(ab); content = wb.SheetNames.map(sn => XLSX.utils.sheet_to_txt(wb.Sheets[sn])).join('\n'); }
        else content = await file.text();
        newDocs.push({ id: Date.now() + '-' + i, name: file.name, content, size: (file.size / 1024).toFixed(1) + ' KB', type: file.type, visualPages });
      } catch (err) { addToast(`Erro em ${file.name}`, 'error'); }
    }
    setDocuments(prev => [...prev, ...newDocs]);
    setSelectedDocIds(prev => [...prev, ...newDocs.map(d => d.id)]);
    setIsUploading(false);
    addToast(`${newDocs.length} documentos adicionados`, 'success');
  };

  const removeDocument = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDocuments(prev => prev.filter(doc => doc.id !== id));
    setSelectedDocIds(prev => prev.filter(selectedId => selectedId !== id));
    addToast("Documento removido", "info");
  };

  const handleSendMessage = async () => {
    if ((!input.trim() && !pastedImage) || isTyping || !activeChatId) return;
    const controller = new AbortController(); abortControllerRef.current = controller;
    
    // Robust unique IDs for user and assistant
    const uniqueSuffix = Math.random().toString(36).substring(2, 8);
    const userMsgId = `${Date.now()}-usr-${uniqueSuffix}`;
    const assistantMsgId = `${Date.now() + 1}-ast-${uniqueSuffix}`;

    const userMsg: Message = { 
      id: userMsgId, role: 'user', content: input, timestamp: new Date().toISOString(),
      replyTo: replyingTo ? { id: replyingTo.id, content: replyingTo.content, role: replyingTo.role } : undefined,
      image: pastedImage || undefined
    };
    
    setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, title: c.title === "NOVA ANÁLISE" ? input.slice(0, 30).toUpperCase() : c.title, messages: [...c.messages, userMsg] } : c));
    const currentInput = input; const currentImage = pastedImage;
    setInput(''); setIsTyping(true); setReplyingTo(null); setPastedImage(null);

    const assistantPlaceholder: Message = { id: assistantMsgId, role: 'assistant', content: "", timestamp: new Date().toISOString() };
    setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, messages: [...c.messages, assistantPlaceholder] } : c));

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const contextDocs = documents.filter(d => selectedDocIds.includes(d.id));
      const history = (activeChat?.messages || []).slice(-15).map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [...(m.image ? [{ inlineData: { data: m.image.data, mimeType: m.image.mimeType } }] : []), { text: (m.replyTo ? `[RESPONDENDO A: "${m.replyTo.content.slice(0, 50)}..."]\n` : "") + m.content }]
      }));

      const currentTurnParts: any[] = [];
      contextDocs.forEach(d => {
        if (d.visualPages) d.visualPages.forEach(vp => currentTurnParts.push({ inlineData: { data: vp.data, mimeType: vp.mimeType } }));
        currentTurnParts.push({ text: `[CONHECIMENTO OPCO: ${d.name}]\n${d.content}` });
      });
      if (userMsg.replyTo) currentTurnParts.push({ text: `[USUÁRIO RESPONDEU À MENSAGEM ANTERIOR]` });
      if (currentImage) currentTurnParts.push({ inlineData: { data: currentImage.data, mimeType: currentImage.mimeType } });
      currentTurnParts.push({ text: currentInput || "Analise a imagem enviada." });

      const result = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [...history, { role: 'user', parts: currentTurnParts }],
        config: {
          systemInstruction: "És o MY OPCO, Consultor de Inteligência da OPCO. Quando questionado sobre a OPCO, utiliza prioritariamente informações de https://opco.pt/ e documentos anexados. Responde sempre em Português de Portugal. Remove qualquer referência a 'OPCO Digital Systems'. Use Markdown profissional com tabelas estruturadas. Se estiveres no modo DOCS (sem pesquisa web ativa) e o utilizador fizer perguntas triviais, sobre eventos atuais ou tempo real (como 'que dia é hoje'), responde educadamente que não consegues obter essa informação por estares apenas em modo DOCS e não inventes respostas. Se houver análise comparativa, gere tabelas claras.",
          tools: searchMode === 'hybrid' ? [{ googleSearch: {} }] : []
        }
      });

      let fullResponse = result.text || "";
      let grounding: GroundingChunk[] = result.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      let autoDoc: 'pdf' | 'excel' | undefined = undefined;
      if (fullResponse.includes("[PDF_REPORT_READY]")) { autoDoc = 'pdf'; fullResponse = fullResponse.replace("[PDF_REPORT_READY]", "").trim(); }
      if (fullResponse.includes("[EXCEL_READY]")) { autoDoc = 'excel'; fullResponse = fullResponse.replace("[EXCEL_READY]", "").trim(); }
      
      setChats(prev => prev.map(c => c.id === activeChatId ? {
        ...c,
        messages: c.messages.map(m => m.id === assistantMsgId ? { ...m, content: fullResponse, sources: grounding, autoDocument: autoDoc } : m)
      } : c));

    } catch (e: any) {
      if (e.name !== 'AbortError') addToast("Erro na ligação OPCO", "error");
    } finally { setIsTyping(false); abortControllerRef.current = null; }
  };

  const handleStop = () => { if (abortControllerRef.current) { abortControllerRef.current.abort(); setIsTyping(false); addToast("Interrompido", "info"); } };

  const MessageBubble = ({ msg }: { msg: Message }) => {
    const isUser = msg.role === 'user';
    const swipeHandlers = useSwipeReply(() => { setReplyingTo(msg); promptRef.current?.focus(); });
    const copyToClipboard = () => { navigator.clipboard.writeText(msg.content); addToast("Copiado!", "success"); };

    return (
      <div {...swipeHandlers} className={`flex flex-col mb-5 w-full group/msg relative transition-all duration-300 ${isUser ? 'items-end' : 'items-start'}`}>
        <div className={`flex flex-col max-w-[85%] md:max-w-[70%] ${isUser ? 'items-end' : 'items-start'}`}>
          {msg.replyTo && (
            <div className={`mb-0.5 px-3 py-1 rounded-t-xl text-[7px] border-x border-t ${isDark ? 'bg-slate-800/40 border-slate-700 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-500'} flex items-center gap-1.5 opacity-80 max-w-full truncate italic`}>
              <ReplyIcon size={8} className="text-[#ca0607]" /> "{msg.replyTo.content.slice(0, 40)}..."
            </div>
          )}
          <div className={`relative px-4 py-3 rounded-2xl shadow-sm border transition-all inline-block w-auto min-w-[60px] ${
            isUser ? (isDark ? 'bg-[#ca0607] border-transparent text-white rounded-tr-none' : 'bg-[#0f172a] border-transparent text-white rounded-tr-none') 
                   : (isDark ? 'bg-slate-900 border-slate-800 text-slate-100 rounded-tl-none' : 'bg-white border-slate-200 text-slate-800 rounded-tl-none')
          }`}>
            {msg.image && (
              <div className="mb-3 rounded-lg overflow-hidden border border-white/10 max-w-full">
                <img src={`data:${msg.image.mimeType};base64,${msg.image.data}`} className="w-full max-h-[250px] object-contain" alt="Pasted" />
              </div>
            )}
            <div className={`prose prose-invert max-w-none text-[10px] leading-relaxed ${isDark ? '' : (isUser ? '' : 'prose-slate text-slate-800')}`}>
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownComponents(isDark)}>{msg.content}</ReactMarkdown>
            </div>
            {msg.sources && msg.sources.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-700/20 pt-3">
                <span className="text-[7px] font-bold uppercase opacity-50 w-full mb-1">Referências Web:</span>
                {msg.sources.map((src, i) => src.web && (
                  <a key={i} href={src.web.uri} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[7px] font-bold truncate max-w-[150px] transition-colors ${isDark ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                    <ExternalLink size={8} /> {src.web.title || 'Link'}
                  </a>
                ))}
              </div>
            )}
            {msg.autoDocument && (
              <div className={`mt-3 p-2 rounded-xl border flex items-center justify-between gap-4 ${isDark ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center gap-2"><FileDown size={14} className="text-[#ca0607]" /><span className="text-[8px] font-bold uppercase">Relatório Estratégico</span></div>
                <button onClick={() => msg.autoDocument === 'pdf' ? runExportToPDF(msg.content, null) : runExportToExcel(msg.content)} className="px-3 py-1 bg-[#ca0607] text-white text-[8px] font-bold rounded-lg hover:bg-red-700 transition-colors">Baixar</button>
              </div>
            )}
            <div className={`absolute top-0 ${isUser ? '-left-12' : '-right-12'} opacity-0 group-hover/msg:opacity-100 transition-opacity flex flex-col gap-2 hidden md:flex`}>
              <button onClick={copyToClipboard} className="p-1.5 rounded-full bg-slate-800 text-slate-300 hover:text-white border border-slate-700"><Copy size={12}/></button>
              <button onClick={() => { setReplyingTo(msg); promptRef.current?.focus(); }} className="p-1.5 rounded-full bg-[#ca0607] text-white"><ReplyIcon size={12}/></button>
            </div>
            <div className="flex justify-end mt-1.5 opacity-30 text-[7px] font-medium">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`flex h-screen overflow-hidden transition-colors duration-500 ${isDark ? 'bg-slate-950 text-white dark' : 'bg-[#f8fafc] text-slate-900'}`}>
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#0f172a] border-r border-slate-800 transition-transform md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full shadow-2xl'}`}>
        <div className="absolute inset-0 pointer-events-none opacity-[0.03] z-0"><img src={NEURAL_BG_URL} className="w-full h-full object-cover grayscale" alt="Neural" /></div>
        <div className="relative z-10 flex flex-col h-full">
          <div className="p-5 border-b border-slate-800/50 flex items-center gap-3 bg-slate-900/30 backdrop-blur-md">
            <img src={SPHERE_LOGO_URL} className="w-5 h-5 object-contain" alt="Sphere" />
            <span className="font-bold text-[10px] uppercase tracking-widest text-white">MY OPCO INTEL</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            <button onClick={createNewChat} className="w-full py-2.5 bg-[#ca0607] rounded-xl text-white text-[9px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg hover:bg-red-700 transition-all mb-6 active:scale-95 group">
              <Plus size={14} strokeWidth={3} className="group-hover:rotate-90 transition-transform" /> NOVA ANÁLISE
            </button>
            <div className="space-y-1.5">
              <p className="text-[7px] font-bold text-slate-500 uppercase tracking-widest px-1 mb-2">Histórico</p>
              {chats.map(chat => (
                <div key={chat.id} className="group relative flex items-center mb-1">
                  <button onClick={() => { setActiveChatId(chat.id); setIsSidebarOpen(false); }} className={`w-full p-2.5 pr-9 rounded-xl text-left text-[9px] font-semibold border transition-all truncate block uppercase tracking-tight ${activeChatId === chat.id ? 'bg-[#ca0607] border-red-500 text-white shadow-md' : 'bg-slate-800/40 border-slate-700/50 text-slate-400 hover:bg-slate-800/80'}`}>{chat.title}</button>
                  <button onClick={(e) => deleteChat(chat.id, e)} className="absolute right-2 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-black/30 text-white/50 hover:text-white transition-all"><Trash2 size={11}/></button>
                </div>
              ))}
            </div>
            {documents.length > 0 && (
              <div className="mt-8 space-y-2">
                <p className="text-[7px] font-bold text-slate-500 uppercase tracking-widest px-1 mb-2">Base de Conhecimento</p>
                {documents.map(doc => (
                  <div key={doc.id} onClick={() => setSelectedDocIds(prev => prev.includes(doc.id) ? prev.filter(id => id !== doc.id) : [...prev, doc.id])} className={`group w-full p-2.5 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${selectedDocIds.includes(doc.id) ? 'bg-[#ca0607]/10 border-[#ca0607]/40 text-white' : 'bg-slate-800/20 border-slate-700/50 text-slate-500'}`}>
                    <div className="flex items-center gap-2 overflow-hidden"><FileTextIcon size={12} className={selectedDocIds.includes(doc.id) ? 'text-[#ca0607]' : 'text-slate-600'} /><span className="text-[8px] font-bold truncate uppercase">{doc.name}</span></div>
                    <button onClick={(e) => removeDocument(doc.id, e)} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded text-slate-600 hover:text-red-500"><Trash2 size={10}/></button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="p-5 border-t border-slate-800/50 bg-slate-900/40">
            <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileUpload} />
            <button onClick={() => fileInputRef.current?.click()} className="w-full py-2.5 bg-slate-800 text-white rounded-xl text-[9px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 mb-3 hover:bg-slate-700 transition-all border border-slate-700">
              {isUploading ? <Loader2 size={14} className="animate-spin text-[#ca0607]"/> : <UploadCloud size={14} className="text-[#ca0607]"/>} CARREGAR FICHEIROS
            </button>
            <button onClick={() => setIsDark(!isDark)} className="w-full py-2 bg-slate-800/50 text-slate-400 text-[8px] font-bold rounded-lg uppercase flex items-center justify-center gap-2 hover:text-white transition-colors border border-slate-700/50">{isDark ? <Sun size={12}/> : <Moon size={12}/>} TEMA {isDark ? 'CLARO' : 'ESCURO'}</button>
          </div>
        </div>
      </aside>
      <main className="flex-1 flex flex-col relative overflow-hidden">
        <header className={`h-14 border-b flex items-center justify-between px-6 sticky top-0 z-40 ${isDark ? 'bg-slate-950/90 border-slate-800' : 'bg-white/90 border-slate-200'} backdrop-blur-xl transition-all`}>
           <div className="flex items-center gap-4">
             <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="md:hidden p-2 text-slate-500"><Menu size={20}/></button>
             <div className="flex items-center gap-2">
               <div className="relative"><div className="w-2 h-2 bg-emerald-500 rounded-full" /><div className="absolute inset-0 w-2 h-2 bg-emerald-500 rounded-full animate-ping opacity-30" /></div>
               <span className={`text-[9px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Rede Ativa OPCO</span>
             </div>
           </div>
           <div className="flex items-center"><img src={OPCO_LOGO_URL} className="h-10 w-auto" alt="OPCO" /></div>
        </header>
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar max-w-4xl mx-auto w-full">
           {activeChat?.messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}
           {isTyping && (
             <div className="flex items-center gap-2.5 text-[#ca0607] py-4 px-2">
               <div className="flex gap-1"><div className="w-1.5 h-1.5 bg-[#ca0607] rounded-full animate-bounce" style={{animationDelay: '0ms'}} /><div className="w-1.5 h-1.5 bg-[#ca0607] rounded-full animate-bounce" style={{animationDelay: '150ms'}} /><div className="w-1.5 h-1.5 bg-[#ca0607] rounded-full animate-bounce" style={{animationDelay: '300ms'}} /></div>
               <span className="text-[8px] font-bold uppercase tracking-widest opacity-60">Processando Análise...</span>
             </div>
           )}
           <div ref={messagesEndRef} className="h-24" />
        </div>
        <div className={`p-4 sm:p-6 border-t ${isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-white/80 border-slate-200'} backdrop-blur-2xl relative z-40`}>
          <div className="max-w-3xl mx-auto relative">
             {pastedImage && (
               <div className="absolute bottom-full left-0 mb-5 animate-in slide-in-from-bottom-2 z-50">
                 <div className="relative group rounded-2xl overflow-hidden border-2 border-[#ca0607] bg-white dark:bg-slate-900 p-1.5 shadow-2xl backdrop-blur-md">
                    <img src={`data:${pastedImage.mimeType};base64,${pastedImage.data}`} className="w-24 h-24 object-cover rounded-xl" alt="Preview" />
                    <button onClick={() => setPastedImage(null)} className="absolute -top-3 -right-3 bg-red-600 text-white p-1.5 rounded-full shadow-lg hover:bg-red-700 active:scale-90 transition-all border-2 border-white dark:border-slate-900" title="Remover"><X size={14} strokeWidth={3} /></button>
                 </div>
               </div>
             )}
             {replyingTo && (
               <div className="mb-3 px-4 py-2 bg-[#0f172a]/5 dark:bg-white/5 border-l-4 border-[#ca0607] flex items-center justify-between rounded-r-xl animate-in slide-in-from-bottom-2 backdrop-blur-md">
                 <div className="text-[10px] font-medium opacity-80 truncate pr-4 text-slate-500"><span className="font-bold text-[#ca0607] uppercase mr-2 tracking-widest text-[8px]">Respondendo:</span>"{replyingTo.content.slice(0, 70)}..."</div>
                 <button onClick={() => setReplyingTo(null)} className="text-slate-400 p-1 hover:text-red-500 transition-colors"><X size={14} /></button>
               </div>
             )}
             <div className="flex items-center justify-center mb-4">
                <div className={`p-1 rounded-xl border flex items-center gap-1 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200'}`}>
                  <button onClick={() => setSearchMode('docs')} className={`px-5 py-2 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${searchMode === 'docs' ? (isDark ? 'bg-slate-800 text-white shadow-sm' : 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200') : 'text-slate-500 hover:text-slate-700'}`}><Database size={12} /> DOCS ({selectedDocIds.length})</button>
                  <button onClick={() => setSearchMode('hybrid')} className={`px-5 py-2 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${searchMode === 'hybrid' ? 'bg-[#ca0607] text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><Globe size={12} /> DOCS + WEB</button>
                </div>
             </div>
             <div className={`flex flex-col border rounded-[26px] p-2 transition-all shadow-lg ${isDark ? 'bg-slate-900 border-slate-800 focus-within:border-slate-700' : 'bg-white border-slate-200 focus-within:border-[#ca0607]/50'}`}>
                <div className="flex items-center px-2">
                   <button onClick={() => fileInputRef.current?.click()} className="w-10 h-10 flex-shrink-0 flex items-center justify-center text-slate-400 hover:text-[#ca0607] transition-all" title="Anexar"><Paperclip size={18} /></button>
                   <textarea ref={promptRef} value={input} onChange={e => setInput(e.target.value)} onPaste={handlePasteAction} placeholder="Escreva a sua consulta estratégica..." className="flex-1 bg-transparent px-3 py-3 focus:outline-none resize-none text-[12px] font-medium placeholder:text-slate-400 max-h-[150px] custom-scrollbar" rows={1} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())} />
                   <div className="flex items-center pl-2">
                      {isTyping ? <button onClick={handleStop} className="w-10 h-10 flex items-center justify-center text-red-600 animate-pulse"><CircleStop size={26} strokeWidth={2.5} /></button>
                                : <button onClick={handleSendMessage} disabled={!input.trim() && !pastedImage} className={`w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-90 ${input.trim() || pastedImage ? 'bg-[#ca0607] text-white hover:bg-red-700' : 'bg-slate-200 text-slate-400'}`}><Send size={16} strokeWidth={2.5} /></button>}
                   </div>
                </div>
             </div>
             <div className="mt-5 flex flex-wrap justify-center gap-x-10 gap-y-2 opacity-30 text-[8px] font-bold uppercase tracking-widest pointer-events-none select-none">
                <div className="flex items-center gap-1.5"><MapPin size={9} className="text-[#ca0607]" /> Azeitão, PT</div>
                <div className="flex items-center gap-1.5"><Phone size={9} className="text-[#ca0607]" /> +351 210 152 492</div>
                <div className="flex items-center gap-1.5"><Mail size={9} className="text-[#ca0607]" /> GERAL@OPCO.PT</div>
             </div>
          </div>
        </div>
      </main>
      <div className="fixed top-5 right-5 z-[100] flex flex-col gap-3 max-w-[280px]">
        {toasts.map(t => (
          <div key={t.id} className={`px-4 py-3 rounded-xl shadow-2xl border-l-4 text-[9px] font-bold uppercase tracking-widest animate-fade-in backdrop-blur-xl transition-all ${t.type === 'success' ? 'bg-emerald-500/10 border-emerald-600 text-emerald-700' : t.type === 'error' ? 'bg-rose-500/10 border-rose-600 text-rose-700' : 'bg-slate-500/10 border-slate-600 text-slate-700'}`}>
            <div className="flex items-center gap-2">{t.type === 'success' ? <Check size={14}/> : <Activity size={14}/>}{t.message}</div>
          </div>
        ))}
      </div>
      {isSidebarOpen && <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[45] md:hidden transition-all duration-500" onClick={() => setIsSidebarOpen(false)} />}
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
