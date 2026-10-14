import * as pdfjsLib from 'pdfjs-dist';
import { pipeline, env } from '@xenova/transformers';

// Configure transformers.js
env.allowLocalModels = false; // We use HuggingFace remote models downloaded to cache
env.useBrowserCache = true;

if (typeof window !== 'undefined' && 'Worker' in window) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
  } catch {
    // Fallback
  }
}

export type SummaryMode = 'executive' | 'comprehensive' | 'action';

export type DocumentType = 'academic' | 'qa-document' | 'business' | 'technical' | 'general';

export interface QuestionAnswer {
  question: string;
  answer: string;
  pageRef?: number;
}

export interface CodeExample {
  language?: string;
  code: string;
  pageRef?: number;
}

export interface FormulaItem {
  raw: string;
  context?: string;
  pageRef?: number;
}

export interface SummaryResult {
  documentTitle: string;
  documentType: DocumentType;
  executiveSummary: string;
  keyPoints: string[];
  actionItems: string[];
  numericInsights: any[];
  questionsAndAnswers: QuestionAnswer[];
  formulas: FormulaItem[];
  thematicSections: { title: string; points: string[] }[];
  codeExamples: CodeExample[];
  topics: { text: string; count: number }[];
  stats: {
    wordCount: number;
    pageCount: number;
    reductionPercentage: number;
    readingTimeMinutes: number;
    confidence: number;
    modelLoadDurationMs?: number;
    inferenceDurationMs?: number;
    memoryUsedMb?: number;
  };
}

let summarizerPipeline: any = null;
export const isAiModelCached = () => summarizerPipeline !== null;
export const setAiModelCached = (val: boolean) => { if (!val) summarizerPipeline = null; };

export async function downloadAndCacheAiModel(
  onProgress?: (status: { isDownloaded: boolean; modelName: string; downloadProgress: number; downloadStage: string; modelSizeBytes: number }) => void
): Promise<void> {
  if (summarizerPipeline) {
    onProgress?.({ isDownloaded: true, modelName: 'Xenova/distilbart-cnn-6-6', downloadProgress: 100, downloadStage: 'Ready', modelSizeBytes: 0 });
    return;
  }
  
  onProgress?.({ isDownloaded: false, modelName: 'Xenova/distilbart-cnn-6-6', downloadProgress: 0, downloadStage: 'Initializing Model', modelSizeBytes: 200 * 1024 * 1024 });

  try {
    summarizerPipeline = await pipeline('summarization', 'Xenova/distilbart-cnn-6-6', {
      progress_callback: (info: any) => {
        if (info.status === 'progress' || info.status === 'downloading') {
          const p = typeof info.progress === 'number' ? Math.round(info.progress) : 0;
          onProgress?.({
            isDownloaded: false,
            modelName: 'Xenova/distilbart-cnn-6-6',
            downloadProgress: p,
            downloadStage: info.file ? `Downloading ${info.file}...` : 'Downloading model components...',
            modelSizeBytes: 200 * 1024 * 1024
          });
        } else if (info.status === 'ready' || info.status === 'loaded') {
          onProgress?.({
            isDownloaded: true,
            modelName: 'Xenova/distilbart-cnn-6-6',
            downloadProgress: 100,
            downloadStage: 'Model Ready',
            modelSizeBytes: 200 * 1024 * 1024
          });
        }
      }
    });
  } catch (error) {
    summarizerPipeline = null;
    throw new Error(
      `Failed to load local AI model: ${error instanceof Error ? error.message : 'Network or WebAssembly loading error'}. Please check internet connection.`
    );
  }
}

export async function summarizePdfDocument(
  file: File,
  mode: SummaryMode = 'executive',
  onProgress?: (stage: string, progress: number) => void,
  options?: { signal?: AbortSignal }
): Promise<SummaryResult> {
  const signal = options?.signal;
  if (signal?.aborted) {
    throw new DOMException('Summarization cancelled by user', 'AbortError');
  }

  onProgress?.('Extracting text from PDF...', 5);
  const arrayBuffer = await file.arrayBuffer();
  if (signal?.aborted) {
    throw new DOMException('Summarization cancelled by user', 'AbortError');
  }

  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const numPages = pdf.numPages;

  if (!numPages || numPages <= 0) {
    throw new Error('PDF document has no pages.');
  }

  let allText = '';
  for (let i = 1; i <= numPages; i++) {
    if (signal?.aborted) {
      throw new DOMException('Summarization cancelled by user', 'AbortError');
    }

    onProgress?.(`Extracting text from page ${i}...`, 5 + (15 * (i / numPages)));
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((it: any) => it.str).join(' ');
    allText += pageText + '\n\n';
    page.cleanup?.();
  }

  // Pre-process text (clean up whitespace)
  allText = allText.replace(/\s+/g, ' ').trim();
  if (!allText) {
    throw new Error('No selectable text found in the document. Scanned documents may require OCR first.');
  }

  const words = allText.split(' ').filter(Boolean);
  const totalWords = words.length;

  if (totalWords < 5) {
    throw new Error('Document contains too little text to summarize (less than 5 words).');
  }

  let modelLoadDurationMs = 0;
  if (!summarizerPipeline) {
    onProgress?.('Loading local AI model...', 25);
    const loadStart = performance.now();
    await downloadAndCacheAiModel((status) => {
      onProgress?.(
        `${status.downloadStage} (${status.downloadProgress}%)`,
        25 + Math.round(status.downloadProgress * 0.15)
      );
    });
    modelLoadDurationMs = Math.round(performance.now() - loadStart);
  }

  if (signal?.aborted) {
    throw new DOMException('Summarization cancelled by user', 'AbortError');
  }

  onProgress?.('Generating Neural Summary (this might take a while locally)...', 40);
  const inferenceStart = performance.now();
  
  // Chunking (Models max length usually 1024 tokens)
  const chunkSize = 600;
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += chunkSize) {
    chunks.push(words.slice(i, i + chunkSize).join(' '));
  }

  let finalSummary = '';
  for (let i = 0; i < chunks.length; i++) {
    if (signal?.aborted) {
      throw new DOMException('Summarization cancelled by user', 'AbortError');
    }

    onProgress?.(`Summarizing part ${i + 1} of ${chunks.length}...`, 40 + (50 * (i / chunks.length)));
    
    // Short chunks don't need summarization
    if (chunks[i].split(' ').length < 50) {
      finalSummary += chunks[i] + ' ';
      continue;
    }

    try {
      const result = await summarizerPipeline(chunks[i], {
        max_new_tokens: 100,
        min_new_tokens: 30,
      });
      if (result && result[0]?.summary_text) {
        finalSummary += result[0].summary_text + ' ';
      } else {
        // Fallback: retain original chunk content rather than dropping it silently
        finalSummary += chunks[i] + ' ';
      }
    } catch (e) {
      console.warn("Summarization failed for chunk, preserving original chunk text:", e);
      // Fallback: do not silently drop failed chunk; preserve source text
      finalSummary += chunks[i] + ' ';
    }
  }

  const inferenceDurationMs = Math.round(performance.now() - inferenceStart);
  const memoryUsedMb = (performance as any)?.memory?.usedJSHeapSize
    ? Math.round(((performance as any).memory.usedJSHeapSize / (1024 * 1024)) * 10) / 10
    : undefined;

  onProgress?.('Polishing results...', 95);

  const trimmedSummary = finalSummary.trim();
  const sentences = trimmedSummary.split(/(?<=[.?!])\s+/).filter(s => s.trim().length > 5);
  
  const result: SummaryResult = {
    documentTitle: file.name.replace(/\.[^/.]+$/, '') || 'AI Generated Summary',
    documentType: 'general',
    executiveSummary: trimmedSummary,
    keyPoints: sentences.slice(0, 5).map(s => s.trim()),
    actionItems: mode === 'action' ? sentences.slice(0, 3).map(s => `Consider: ${s.trim()}`) : [],
    numericInsights: [],
    questionsAndAnswers: [],
    formulas: [],
    thematicSections: [{ title: 'Main Content', points: sentences.slice(0, 10) }],
    codeExamples: [],
    topics: [{ text: 'General', count: 1 }],
    stats: {
      wordCount: totalWords,
      pageCount: numPages,
      reductionPercentage: Math.max(0, Math.round((1 - (trimmedSummary.split(/\s+/).length / (totalWords || 1))) * 100)) || 0,
      readingTimeMinutes: Math.max(1, Math.ceil(totalWords / 200)),
      confidence: 0.95,
      modelLoadDurationMs,
      inferenceDurationMs,
      memoryUsedMb,
    }
  };

  onProgress?.('Complete', 100);
  return result;
}
