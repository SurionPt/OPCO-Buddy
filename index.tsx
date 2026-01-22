
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
    doc.text("OPCO | RELATÓRIO DE INTELIGÊNCIA ESTRATÉGICA", margin, pageHeight - 10);
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
    <th className={`px-2 py-1 font-bold uppercase tracking-wider border-r last:border-r-0 ${isDark ? 'text-slate-400 border-slate-700' : 'text-slate-600 border-slate-200'}`}>
      {children}
    </th>
  ),
  td: ({ children }: any) => (
    <td className={`px-2 py-1 border-r last:border-r-0 align-top ${isDark ? 'text-slate-300 border-slate-800/50' : 'text-slate-700 border-slate-100'}`}>
      {children}
    </td>
  ),
  tr: ({ children }: any) => (
    <tr className={`border-b last:border-b-0 ${isDark ? 'border-slate-800/50 even:bg-slate-900/40' : 'border-slate-100 even:bg-slate-50/50'}`}>
      {children}
    </tr>
  ),
  p: ({ children }: any) => (
    <p className="mb-1.5 last:mb-0 leading-normal">{children}</p>
  ),
  code: ({ children, inline }: any) => (
    inline 
      ? <code className={`px-1 py-0.5 rounded text-[9px] ${isDark ? 'bg-slate-800 text-rose-300' : 'bg-slate-100 text-rose-600'}`}>{children}</code>
      : <pre className={`p-2 rounded-lg overflow-x-auto text-[9px] ${isDark ? 'bg-black/50' : 'bg-slate-50 border border-slate-200'}`}><code>{children}</code></pre>
  )
});

// --- Swipe Logic Helper ---
const useSwipeReply = (onSwipe: () => void) => {
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const swipeThreshold = 50;

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    const diff = touchEndX.current - touchStartX.current;
    if (diff > swipeThreshold && touchEndX.current !== 0) { 
      onSwipe();
    }
    touchStartX.current = 0;
    touchEndX.current = 0;
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
    const newChats = chats.filter(c => c.id !== id);
    setChats(newChats);
    if (activeChatId === id) {
      if (newChats.length > 0) {
        setActiveChatId(newChats[0].id);
      } else {
        createNewChat();
      }
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
    }
    else createNewChat();
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
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
      if (!isInput || target === promptRef.current) {
        handlePasteAction(e);
      }
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

  const removeDocument = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDocuments(prev => prev.filter(doc => doc.id !== id));
    setSelectedDocIds(prev => prev.filter(selectedId => selectedId !== id));
    addToast("Documento removido", "info");
  };

  const handleSendMessage = async () => {
    if ((!input.trim() && !pastedImage) || isTyping || !activeChatId) return;
    
    const controller = new AbortController();
    abortControllerRef.current = controller;
    
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

    let assistantMsgId = Date.now().toString();
    const assistantMsg: Message = { 
      id: assistantMsgId, 
      role: 'assistant', 
      content: "", 
      timestamp: new Date().toISOString()
    };
    setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, messages: [...c.messages, assistantMsg] } : c));

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const contextDocs = documents.filter(d => selectedDocIds.includes(d.id));
      const history = (activeChat?.messages || []).slice(-15).map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [
          ...(m.image ? [{ inlineData: { data: m.image.data, mimeType: m.image.mimeType } }] : []),
          { text: (m.replyTo ? `[RESPONDENDO A: "${m.replyTo.content.slice(0, 100)}..."]\n` : "") + m.content }
        ]
      }));

      const currentTurnParts: any[] = [];
      contextDocs.forEach(d => {
        if (d.visualPages) d.visualPages.forEach(vp => currentTurnParts.push({ inlineData: { data: vp.data, mimeType: vp.mimeType } }));
        currentTurnParts.push({ text: `[CONHECIMENTO OPCO: ${d.name}]\n${d.content}` });
      });
      if (userMsg.replyTo) currentTurnParts.push({ text: `[USUÁRIO RESPONDEU À: "${userMsg.replyTo.content}"]` });
      if (currentImage) currentTurnParts.push({ inlineData: { data: currentImage.data, mimeType: currentImage.mimeType } });
      currentTurnParts.push({ text: currentInput || "Analise o contexto visual." });

      const stream = await ai.models.generateContentStream({
        model: 'gemini-3-flash-preview',
        contents: [...history, { role: 'user', parts: currentTurnParts }],
        config: {
          systemInstruction: "És o MY OPCO, Consultor de Inteligência da OPCO. Quando questionado sobre a OPCO, utiliza prioritariamente informações do site oficial https://opco.pt/ através da ferramenta de pesquisa e complementa com dados relevantes da internet. Responde sempre em Português de Portugal. Remove qualquer referência a 'OPCO Digital Systems' das tuas respostas. Use Markdown executivo. Se houver comandos [PDF_REPORT_READY] ou [EXCEL_READY], inclua-os no final.",
          tools: searchMode === 'hybrid' ? [{ googleSearch: {} }] : []
        }
      });

      let fullResponse = "";
      let grounding: GroundingChunk[] = [];

      for await (const chunk of stream) {
        if (controller.signal.aborted) break;
        const chunkText = chunk.text;
        fullResponse += chunkText;
        
        // Extract grounding chunks if available
        const metadata = chunk.candidates?.[0]?.groundingMetadata;
        if (metadata?.groundingChunks) {
          grounding = metadata.groundingChunks;
        }

        setChats(prev => prev.map(c => c.id === activeChatId ? {
          ...c,
          messages: c.messages.map(m => m.id === assistantMsgId ? { ...m, content: fullResponse, sources: grounding.length > 0 ? grounding : m.sources } : m)
        } : c));
      }

      // Final processing for auto-documents
      if (!controller.signal.aborted) {
        let finalContent = fullResponse;
        let autoDoc: 'pdf' | 'excel' | undefined = undefined;
        if (finalContent.includes("[PDF_REPORT_READY]")) { autoDoc = 'pdf'; finalContent = finalContent.replace("[PDF_REPORT_READY]", "").trim(); }
        if (finalContent.includes("[EXCEL_READY]")) { autoDoc = 'excel'; finalContent = finalContent.replace("[EXCEL_READY]", "").trim(); }
        
        setChats(prev => prev.map(c => c.id === activeChatId ? {
          ...c,
          messages: c.messages.map(m => m.id === assistantMsgId ? { ...m, content: finalContent, autoDocument: autoDoc, sources: grounding } : m)
        } : c));
      }

    } catch (e: any) {
      if (e.name !== 'AbortError') addToast("Falha na Rede OPCO", "error");
    } finally { 
      setIsTyping(false); 
      abortControllerRef.current = null;
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsTyping(false);
      addToast("Interrompido pelo utilizador", "info");
    }
  };

  const MessageBubble = ({ msg }: { msg: Message }) => {
    const isUser = msg.role === 'user';
    const swipeHandlers = useSwipeReply(() => {
      setReplyingTo(msg);
      promptRef.current?.focus();
    });

    const copyToClipboard = () => {
      navigator.clipboard.writeText(msg.content);
      addToast("Copiado!", "success");
    };

    return (
      <div 
        {...swipeHandlers}
        className={`flex flex-col mb-2.5 w-full group/msg relative transition-all duration-300 ${isUser ? 'items-end' : 'items-start'}`}
      >
        <div className={`flex flex-col max-w-[88%] md:max-w-[75%] ${isUser ? 'items-end' : 'items-start'}`}>
          {msg.replyTo && (
            <div className={`mb-0.5 px-2 py-1 rounded-t-lg text-[8px] border-x border-t ${isDark ? 'bg-slate-800/40 border-slate-700 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-500'} flex items-center gap-1.5 opacity-80 max-w-full truncate`}>
              <ReplyIcon size={9} className="text-[#ca0607]" />
              <span className="truncate italic">"{msg.replyTo.content.slice(0, 50)}..."</span>
            </div>
          )}

          <div className={`relative px-2.5 py-1.5 rounded-2xl shadow-sm border transition-all inline-block w-auto min-w-[60px] ${
            isUser 
              ? (isDark ? 'bg-[#ca0607] border-transparent text-white rounded-tr-none' : 'bg-[#0f172a] border-transparent text-white rounded-tr-none') 
              : (isDark ? 'bg-slate-900 border-slate-800 text-slate-100 rounded-tl-none' : 'bg-white border-slate-200 text-slate-800 rounded-tl-none')
          }`}>
            {msg.image && (
              <div className="mb-1.5 rounded-lg overflow-hidden border border-white/5 max-w-full">
                <img src={`data:${msg.image.mimeType};base64,${msg.image.data}`} className="w-full max-h-[220px] object-contain" alt="Pasted" />
              </div>
            )}
            
            <div className={`prose prose-invert max-w-none text-[10.5px] leading-tight ${isDark ? '' : (isUser ? '' : 'prose-slate text-slate-800')}`}>
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownComponents(isDark)}>{msg.content}</ReactMarkdown>
            </div>

            {msg.sources && msg.sources.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-700/30 pt-2">
                <span className="text-[7px] font-bold uppercase opacity-40 w-full mb-0.5">Fontes:</span>
                {msg.sources.map((src, i) => src.web && (
                  <a 
                    key={i} 
                    href={src.web.uri} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[7px] font-bold truncate max-w-[120px] transition-colors ${isDark ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                  >
                    <ExternalLink size={8} /> {src.web.title || 'Referência'}
                  </a>
                ))}
              </div>
            )}

            {msg.autoDocument && (
              <div className={`mt-2 p-1.5 rounded-xl border flex items-center justify-between gap-3 ${isDark ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center gap-1.5">
                  <FileDown size={12} className="text-[#ca0607]" />
                  <span className="text-[8px] font-bold uppercase">Relatório</span>
                </div>
                <button onClick={() => msg.autoDocument === 'pdf' ? runExportToPDF(msg.content, null) : runExportToExcel(msg.content)} className="px-2 py-0.5 bg-[#ca0607] text-white text-[8px] font-bold rounded-lg hover:bg-red-700 transition-colors">Download</button>
              </div>
            )}

            <div className={`absolute top-0 ${isUser ? '-left-12' : '-right-12'} opacity-0 group-hover/msg:opacity-100 transition-opacity flex flex-col gap-1 hidden md:flex`}>
              <button onClick={copyToClipboard} className="p-1 rounded-full bg-slate-800 text-slate-300 hover:text-white border border-slate-700"><Copy size={11}/></button>
              <button onClick={() => { setReplyingTo(msg); promptRef.current?.focus(); }} className="p-1 rounded-full bg-[#ca0607] text-white"><ReplyIcon size={11}/></button>
            </div>
            
            <div className="flex justify-end mt-0.5 opacity-30 text-[7px] font-medium">
              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`flex h-screen overflow-hidden transition-colors duration-500 ${isDark ? 'bg-slate-950 text-white dark' : 'bg-[#f8fafc] text-slate-900'}`}>
      
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-60 bg-[#0f172a] border-r border-slate-800 transition-transform md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full shadow-2xl'}`}>
        <div className="absolute inset-0 pointer-events-none opacity-[0.03] z-0">
          <img src={NEURAL_BG_URL} className="w-full h-full object-cover grayscale" alt="Neural" />
        </div>
        <div className="relative z-10 flex flex-col h-full">
          <div className="p-4 border-b border-slate-800/50 flex items-center gap-2.5 bg-slate-900/30 backdrop-blur-md">
            <img src={SPHERE_LOGO_URL} className="w-4 h-4 object-contain" alt="Sphere" />
            <span className="font-bold text-[9px] uppercase tracking-widest text-white">MY OPCO</span>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            <button onClick={createNewChat} className="w-full py-2 bg-[#ca0607] rounded-xl text-white text-[8px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg hover:bg-red-700 transition-all mb-6 active:scale-95 group">
              <Plus size={12} strokeWidth={3} className="group-hover:rotate-90 transition-transform" /> NOVA ANÁLISE
            </button>
            <div className="space-y-2">
              <p className="text-[6px] font-bold text-slate-500 uppercase tracking-widest px-1 mb-1.5">Recentes</p>
              {chats.map(chat => (
                <div key={chat.id} className="group relative flex items-center mb-1 last:mb-0">
                  <button 
                    onClick={() => { setActiveChatId(chat.id); setIsSidebarOpen(false); }} 
                    className={`w-full p-2.5 pr-8 rounded-lg text-left text-[8px] font-semibold border transition-all truncate block uppercase tracking-tight ${activeChatId === chat.id ? 'bg-[#ca0607] border-red-500 text-white shadow-md' : 'bg-slate-800/40 border-slate-700/50 text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'}`}
                  >
                    {chat.title}
                  </button>
                  <button 
                    onClick={(e) => deleteChat(chat.id, e)} 
                    className="absolute right-2 opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-black/20 text-white/40 hover:text-white transition-all z-10"
                    title="Apagar Análise"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              ))}
            </div>

            {documents.length > 0 && (
              <div className="mt-6 space-y-2">
                <p className="text-[6px] font-bold text-slate-500 uppercase tracking-widest px-1 mb-1.5">Conhecimento</p>
                {documents.map(doc => (
                  <div 
                    key={doc.id}
                    onClick={() => setSelectedDocIds(prev => prev.includes(doc.id) ? prev.filter(id => id !== doc.id) : [...prev, doc.id])}
                    className={`group w-full p-2 rounded-lg border transition-all flex items-center justify-between cursor-pointer ${selectedDocIds.includes(doc.id) ? 'bg-[#ca0607]/10 border-[#ca0607]/30 text-white' : 'bg-slate-800/20 border-slate-700/50 text-slate-400'}`}
                  >
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      <FileTextIcon size={10} className={selectedDocIds.includes(doc.id) ? 'text-[#ca0607]' : 'text-slate-500'} />
                      <span className="text-[7px] font-bold truncate uppercase">{doc.name}</span>
                    </div>
                    <button onClick={(e) => removeDocument(doc.id, e)} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded text-slate-500 hover:text-red-500"><Trash2 size={9} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-4 border-t border-slate-800/50 bg-slate-900/40">
             <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileUpload} />
             <button onClick={() => fileInputRef.current?.click()} className="w-full py-2 bg-slate-800 text-white rounded-xl text-[8px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 mb-2.5 hover:bg-slate-700 transition-all border border-slate-700">
               {isUploading ? <Loader2 size={12} className="animate-spin text-[#ca0607]"/> : <UploadCloud size={12} className="text-[#ca0607]"/>} Arquivos
             </button>
             <div className="w-full">
                <button onClick={() => setIsDark(!isDark)} className="w-full py-1.5 bg-slate-800/50 text-slate-400 text-[7px] font-bold rounded-lg uppercase flex items-center justify-center gap-1.5 hover:text-white transition-colors border border-slate-700/50">
                  {isDark ? <Sun size={10}/> : <Moon size={10}/>} Modo
                </button>
             </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative overflow-hidden">
        <header className={`h-12 border-b flex items-center justify-between px-5 sticky top-0 z-40 ${isDark ? 'bg-slate-950/90 border-slate-800' : 'bg-white/90 border-slate-200'} backdrop-blur-xl transition-all`}>
           <div className="flex items-center gap-3">
             <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="md:hidden p-2 text-slate-500"><Menu size={18}/></button>
             <div className="flex items-center gap-1.5">
               <div className="relative">
                 <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                 <div className="absolute inset-0 w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping opacity-30" />
               </div>
               <span className={`text-[8px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>OPCO Intel Network</span>
             </div>
           </div>
           <div className="flex items-center">
              <img src={OPCO_LOGO_URL} className="h-8 w-auto" alt="OPCO" />
           </div>
        </header>

        <div className="flex-1 overflow-y-auto p-3 sm:p-6 custom-scrollbar max-w-3xl mx-auto w-full">
           {activeChat?.messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}
           {isTyping && (
             <div className="flex items-center gap-1.5 text-[#ca0607] animate-pulse py-3 px-2">
               <div className="flex gap-0.5">
                 <div className="w-1 h-1 bg-[#ca0607] rounded-full animate-bounce" style={{animationDelay: '0ms'}} />
                 <div className="w-1 h-1 bg-[#ca0607] rounded-full animate-bounce" style={{animationDelay: '150ms'}} />
                 <div className="w-1 h-1 bg-[#ca0607] rounded-full animate-bounce" style={{animationDelay: '300ms'}} />
               </div>
               <span className="text-[7px] font-bold uppercase tracking-widest opacity-60">Consultando...</span>
             </div>
           )}
           <div ref={messagesEndRef} className="h-20" />
        </div>

        <div className={`p-3 sm:p-5 border-t ${isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-white/80 border-slate-200'} backdrop-blur-2xl relative z-40`}>
          <div className="max-w-2xl mx-auto relative">
             
             {pastedImage && (
               <div className="absolute bottom-full left-0 mb-3 animate-in slide-in-from-bottom-2">
                 <div className="relative group rounded-lg overflow-hidden border border-[#ca0607] bg-white dark:bg-slate-900 p-0.5 shadow-lg">
                    <img src={`data:${pastedImage.mimeType};base64,${pastedImage.data}`} className="w-16 h-16 object-cover rounded-md" alt="Preview" />
                    <button onClick={() => setPastedImage(null)} className="absolute -top-1.5 -right-1.5 bg-red-600 text-white p-0.5 rounded-full shadow-md"><X size={8} /></button>
                 </div>
               </div>
             )}

             {replyingTo && (
               <div className="mb-2 px-3 py-1.5 bg-[#0f172a]/5 dark:bg-white/5 border-l-2 border-[#ca0607] flex items-center justify-between rounded-r-lg animate-in slide-in-from-bottom-2 backdrop-blur-md">
                 <div className="text-[9px] font-medium opacity-80 truncate pr-3">
                   <span className="font-bold text-[#ca0607] uppercase mr-1.5 tracking-widest text-[7px]">Resp:</span>
                   {replyingTo.content.slice(0, 80)}...
                 </div>
                 <button onClick={() => setReplyingTo(null)} className="text-slate-400 p-1"><X size={12} /></button>
               </div>
             )}

             <div className="flex items-center justify-center mb-3">
                <div className={`p-0.5 rounded-lg border flex items-center gap-0.5 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-300/50'}`}>
                  <button onClick={() => setSearchMode('docs')} className={`px-4 py-1.5 rounded-md text-[8px] font-bold uppercase tracking-widest transition-all flex items-center gap-1 ${searchMode === 'docs' ? (isDark ? 'bg-slate-800 text-white shadow-sm' : 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200') : 'text-slate-500'}`}><Database size={10} /> Docs ({selectedDocIds.length})</button>
                  <button onClick={() => setSearchMode('hybrid')} className={`px-4 py-1.5 rounded-md text-[8px] font-bold uppercase tracking-widest transition-all flex items-center gap-1 ${searchMode === 'hybrid' ? 'bg-[#ca0607] text-white shadow-sm' : 'text-slate-500'}`}><Globe size={10} /> Web</button>
                </div>
             </div>

             <div className={`flex flex-col border rounded-[22px] p-1.5 transition-all shadow-md ${isDark ? 'bg-slate-900 border-slate-800 focus-within:border-slate-700' : 'bg-white border-slate-200 focus-within:border-[#ca0607]/50'}`}>
                <div className="flex items-center px-1.5">
                   <button onClick={() => fileInputRef.current?.click()} className="w-8 h-8 flex-shrink-0 flex items-center justify-center text-slate-400 hover:text-[#ca0607] transition-all" title="Anexar"><Paperclip size={16} /></button>
                   <textarea 
                    ref={promptRef}
                    value={input} 
                    onChange={e => setInput(e.target.value)} 
                    onPaste={handlePasteAction}
                    placeholder="Sua pergunta estratégica..."
                    className="flex-1 bg-transparent px-2 py-2 focus:outline-none resize-none text-[11px] font-medium placeholder:text-slate-400 max-h-[120px] custom-scrollbar"
                    rows={1}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())}
                   />
                   <div className="flex items-center pl-1.5">
                      {isTyping ? (
                        <button onClick={handleStop} className="w-8 h-8 flex items-center justify-center text-red-600 animate-pulse" title="Parar Resposta"><CircleStop size={22} strokeWidth={2.5} /></button>
                      ) : (
                        <button onClick={handleSendMessage} disabled={!input.trim() && !pastedImage} className={`w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90 ${input.trim() || pastedImage ? 'bg-[#ca0607] text-white hover:bg-red-700' : 'bg-slate-200 text-slate-400'}`}>
                          <Send size={14} strokeWidth={2.5} />
                        </button>
                      )}
                   </div>
                </div>
             </div>
             
             <div className="mt-4 flex flex-wrap justify-center gap-x-8 gap-y-1 opacity-20 text-[7px] font-bold uppercase tracking-widest pointer-events-none select-none">
                <div className="flex items-center gap-1"><MapPin size={8} className="text-[#ca0607]" /> Azeitão, PT</div>
                <div className="flex items-center gap-1"><Phone size={8} className="text-[#ca0607]" /> +351 210 152 492</div>
                <div className="flex items-center gap-1"><Mail size={8} className="text-[#ca0607]" /> geral@opco.pt</div>
             </div>
          </div>
        </div>
      </main>
      
      {/* Toast System */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-[240px]">
        {toasts.map(t => (
          <div key={t.id} className={`px-3 py-2 rounded-lg shadow-lg border-l-2 text-[8px] font-bold uppercase tracking-widest animate-fade-in backdrop-blur-xl transition-all ${
            t.type === 'success' ? 'bg-emerald-500/10 border-emerald-600 text-emerald-700' :
            t.type === 'error' ? 'bg-rose-500/10 border-rose-600 text-rose-700' :
            'bg-slate-500/10 border-slate-600 text-slate-700'
          }`}>
            <div className="flex items-center gap-1.5">
              {t.type === 'success' ? <Check size={12}/> : <Activity size={12}/>}
              {t.message}
            </div>
          </div>
        ))}
      </div>
      
      {isSidebarOpen && <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[45] md:hidden transition-all duration-500" onClick={() => setIsSidebarOpen(false)} />}
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
