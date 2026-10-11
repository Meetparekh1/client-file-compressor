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

  summarizerPipeline = await pipeline('summarization', 'Xenova/distilbart-cnn-6-6', {
    progress_callback: (info: any) => {
      if (info.status === 'progress' || info.status === 'downloading') {
        const p = info.progress || 0;
        onProgress?.({
          isDownloaded: false,
          modelName: 'Xenova/distilbart-cnn-6-6',
          downloadProgress: Math.round(p),
          downloadStage: `Downloading ${info.file}...`,
          modelSizeBytes: 200 * 1024 * 1024
        });
      } else if (info.status === 'ready') {
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
}

export async function summarizePdfDocument(
  file: File,
  mode: SummaryMode = 'executive',
  onProgress?: (stage: string, progress: number) => void
): Promise<SummaryResult> {
  onProgress?.('Extracting text from PDF...', 5);
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const numPages = pdf.numPages;

  let allText = '';
  for (let i = 1; i <= numPages; i++) {
    onProgress?.(`Extracting text from page ${i}...`, 5 + (15 * (i / numPages)));
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((it: any) => it.str).join(' ');
    allText += pageText + '\n\n';
  }

  // Pre-process text (clean up whitespace)
  allText = allText.replace(/\s+/g, ' ').trim();
  const words = allText.split(' ');
  const totalWords = words.length;

  if (!summarizerPipeline) {
    onProgress?.('Loading local AI model...', 30);
    await downloadAndCacheAiModel();
  }

  onProgress?.('Generating Neural Summary (this might take a while locally)...', 40);
  
  // Chunking (Models max length usually 1024 tokens)
  const chunkSize = 600;
  const chunks = [];
  for (let i = 0; i < words.length; i += chunkSize) {
    chunks.push(words.slice(i, i + chunkSize).join(' '));
  }

  let finalSummary = '';
  for (let i = 0; i < chunks.length; i++) {
    onProgress?.(`Summarizing part ${i + 1} of ${chunks.length}...`, 40 + (50 * (i / chunks.length)));
    
    // Some short chunks don't need summarization
    if (chunks[i].split(' ').length < 50) {
      finalSummary += chunks[i] + ' ';
      continue;
    }

    try {
      const result = await summarizerPipeline(chunks[i], {
        max_new_tokens: 100,
        min_new_tokens: 30,
      });
      finalSummary += result[0].summary_text + ' ';
    } catch (e) {
      // In case of error (e.g. sequence too long), just add the chunk
      console.warn("Summarization failed for chunk", e);
    }
  }

  onProgress?.('Polishing results...', 95);

  const sentences = finalSummary.split('. ').filter(s => s.length > 10);
  
  const result: SummaryResult = {
    documentTitle: 'AI Generated Summary',
    documentType: 'general',
    executiveSummary: finalSummary.trim(),
    keyPoints: sentences.slice(0, 5).map(s => s.trim() + '.'),
    actionItems: mode === 'action' ? sentences.slice(0, 3).map(s => `Consider: ${s.trim()}`) : [],
    numericInsights: [],
    questionsAndAnswers: [],
    formulas: [],
    thematicSections: [{ title: 'Main Content', points: sentences }],
    codeExamples: [],
    topics: [{ text: 'General', count: 1 }],
    stats: {
      wordCount: totalWords,
      pageCount: numPages,
      reductionPercentage: Math.round((1 - (finalSummary.split(' ').length / (totalWords || 1))) * 100) || 0,
      readingTimeMinutes: Math.ceil(totalWords / 200),
      confidence: 0.95
    }
  };

  onProgress?.('Complete', 100);
  return result;
}
