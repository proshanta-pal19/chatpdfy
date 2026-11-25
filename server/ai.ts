import { GoogleGenAI, ThinkingLevel, Type, type GenerateContentResponse } from '@google/genai';
import type {
  ChatMessageRecord,
  Citation,
  PdfDocumentRecord,
  QuizDifficulty,
  QuizQuestion,
} from './types.ts';

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim() || process.env.API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured. Please add your Gemini API key in Settings > Secrets.',
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function isQuotaOrRateError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('429') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.toLowerCase().includes('quota') ||
    msg.toLowerCase().includes('rate limit')
  );
}

function isTransientDemandError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  return (
    msg.includes('503') ||
    msg.includes('500') ||
    msg.includes('UNAVAILABLE') ||
    lower.includes('high demand') ||
    lower.includes('overloaded') ||
    lower.includes('temporarily unavailable')
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatReadableAiError(err: unknown): Error {
  const raw = err instanceof Error ? err.message : String(err);

  if (isQuotaOrRateError(err)) {
    return new Error(
      'Gemini API quota limit reached for your current free-tier key. Wait a little while before retrying or switch to a billing-enabled API key in Settings > Secrets.',
    );
  }

  if (isTransientDemandError(err)) {
    return new Error(
      'The AI model is temporarily busy due to high traffic. Please click try again in a few seconds.',
    );
  }

  if (raw.includes('API_KEY_INVALID') || raw.includes('PERMISSION_DENIED') || raw.includes('403')) {
    return new Error(
      'Your Gemini API key appears invalid or lacks access. Please check GEMINI_API_KEY in Settings > Secrets.',
    );
  }

  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string } };
    if (parsed?.error?.message) {
      return new Error(parsed.error.message.split('\n')[0]);
    }
  } catch {
    // raw wasn't pure JSON
  }

  return new Error(raw.length > 260 ? `${raw.slice(0, 260)}...` : raw);
}

async function generateWithFallback(
  ai: GoogleGenAI,
  buildRequest: (
    model: string,
    thinkingLevel: ThinkingLevel,
  ) => Parameters<GoogleGenAI['models']['generateContent']>[0],
  primaryThinking: ThinkingLevel,
): Promise<GenerateContentResponse> {
  const attempts: Array<{ model: string; thinking: ThinkingLevel; delayMs: number }> = [
    { model: 'gemini-3.1-flash-lite', thinking: ThinkingLevel.MINIMAL, delayMs: 0 },
    { model: 'gemini-4-hydrogen', thinking: primaryThinking, delayMs: 250 },
  ];

  let lastErr: unknown;
  for (const step of attempts) {
    if (step.delayMs > 0) {
      await sleep(step.delayMs);
    }
    try {
      return await ai.models.generateContent(buildRequest(step.model, step.thinking));
    } catch (err) {
      lastErr = err;
      if (isQuotaOrRateError(err) || isTransientDemandError(err)) {
        continue;
      }
      throw formatReadableAiError(err);
    }
  }

  throw formatReadableAiError(lastErr);
}

function buildDocumentContext(documents: PdfDocumentRecord[], maxChars = 45000): string {
  const blocks: string[] = [];
  let total = 0;

  for (const doc of documents) {
    for (const page of doc.pages) {
      const header = `\n--- [DOCUMENT: "${doc.fileName}" | PAGE: ${page.pageNumber}] ---\n`;
      const chunk = `${header}${page.text}`;
      if (total + chunk.length > maxChars) {
        const remaining = maxChars - total;
        if (remaining > 200) {
          blocks.push(chunk.slice(0, remaining));
        }
        return blocks.join('\n');
      }
      blocks.push(chunk);
      total += chunk.length;
    }
  }

  return blocks.join('\n');
}

export async function answerFromDocuments(
  question: string,
  documents: PdfDocumentRecord[],
  recentHistory: ChatMessageRecord[],
): Promise<{
  answer: string;
  notFound: boolean;
  citations: Citation[];
}> {
  const ai = getAiClient();
  const contextText = buildDocumentContext(documents);

  const historyLines = recentHistory
    .slice(-6)
    .map((m) => `${m.role === 'user' ? 'Student' : 'Tutor'}: ${m.content}`)
    .join('\n');

  const prompt = [
    'UPLOADED PDF DOCUMENT EXCERPTS:',
    contextText,
    '',
    historyLines ? `RECENT CONVERSATION:\n${historyLines}\n` : '',
    `STUDENT QUESTION: ${question}`,
  ].join('\n');

  const response = await generateWithFallback(
    ai,
    (model, thinkingLevel) => ({
      model,
      contents: prompt,
      config: {
        thinkingConfig: { thinkingLevel },
        systemInstruction: [
          'You are a strict document-grounded study assistant.',
          'Rule 1: Answer the student question using ONLY facts explicitly written in the UPLOADED PDF DOCUMENT EXCERPTS.',
          'Rule 2: NEVER use outside knowledge, assumptions, or general world knowledge.',
          'Rule 3: If the answer is not directly supported by the uploaded PDF content, set found=false, answer="Not Found in the document", and citations=[].',
          'Rule 4: When found=true, format the answer cleanly using Markdown with real newline characters (\\n): start with a 1-2 sentence summary paragraph, followed by blank-line separated sections, bold subheadings or bulleted/numbered lists (each bullet on its own line starting with "- " or "1. "). NEVER pack multiple bullets into a single paragraph.',
          'Rule 5: Include 1 to 3 exact verbatim quotes from the PDF in citations (with exact documentName and pageNumber).',
        ].join(' '),
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            found: {
              type: Type.BOOLEAN,
              description: 'True only if the answer is explicitly contained in the uploaded PDFs.',
            },
            answer: {
              type: Type.STRING,
              description:
                'Well-structured Markdown answer with real newlines, headings, and bullet points (one item per line), or exactly "Not Found in the document" when found is false.',
            },
            citations: {
              type: Type.ARRAY,
              description: 'Verbatim excerpts from the PDF supporting the answer.',
              items: {
                type: Type.OBJECT,
                properties: {
                  documentName: { type: Type.STRING },
                  pageNumber: { type: Type.INTEGER },
                  excerpt: { type: Type.STRING },
                },
                required: ['documentName', 'pageNumber', 'excerpt'],
              },
            },
          },
          required: ['found', 'answer', 'citations'],
        },
      },
    }),
    ThinkingLevel.LOW,
  );

  const rawText = (response.text ?? '{}').trim();
  const parsed = JSON.parse(rawText) as {
    found?: boolean;
    answer?: string;
    citations?: Citation[];
  };

  const citations = Array.isArray(parsed.citations) ? parsed.citations : [];
  const notFound = !parsed.found || citations.length === 0;
  if (notFound) {
    return {
      answer: 'Not Found in the document',
      notFound: true,
      citations: [],
    };
  }

  return {
    answer: parsed.answer?.trim() || 'Not Found in the document',
    notFound: false,
    citations: citations.slice(0, 4),
  };
}

export async function generateQuizFromDocuments(
  documents: PdfDocumentRecord[],
  numQuestions: number,
  difficulty: QuizDifficulty,
): Promise<{
  title: string;
  questions: QuizQuestion[];
}> {
  const ai = getAiClient();
  const contextText = buildDocumentContext(documents);
  const clampedCount = Math.max(5, Math.min(30, Math.round(numQuestions)));

  const difficultyGuidance =
    difficulty === 'Easy'
      ? 'Focus on clear definitions, key facts, and direct statements found in the notes.'
      : difficulty === 'Medium'
        ? 'Focus on conceptual understanding, cause-and-effect, comparisons, and applied examples from the notes.'
        : 'Focus on deep comprehension, subtle distinctions, multi-step reasoning, and synthesis across sections of the notes.';

  const prompt = [
    `Generate a ${difficulty} difficulty multiple-choice quiz with EXACTLY ${clampedCount} questions based strictly on the following PDF documents.`,
    difficultyGuidance,
    '',
    'UPLOADED PDF DOCUMENT CONTENT:',
    contextText,
  ].join('\n');

  const response = await generateWithFallback(
    ai,
    (model, thinkingLevel) => ({
      model,
      contents: prompt,
      config: {
        thinkingConfig: { thinkingLevel },
        systemInstruction: [
          'You are an academic assessment designer.',
          'Create multiple-choice questions strictly from the provided PDF content.',
          `You MUST generate exactly ${clampedCount} unique, non-overlapping questions.`,
          'Each question MUST have exactly 4 answer options, with 1 unambiguously correct answer (correctIndex from 0 to 3).',
          'For every question, include sourceDocument (exact PDF filename), sourcePage (integer page number), sourceExcerpt (verbatim sentence or short passage from that PDF page), and explanation (clear explanation referencing the PDF excerpt).',
        ].join(' '),
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description: 'Short descriptive quiz title derived from the PDF topic.',
            },
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING },
                  options: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  correctIndex: { type: Type.INTEGER },
                  explanation: { type: Type.STRING },
                  sourceDocument: { type: Type.STRING },
                  sourcePage: { type: Type.INTEGER },
                  sourceExcerpt: { type: Type.STRING },
                },
                required: [
                  'question',
                  'options',
                  'correctIndex',
                  'explanation',
                  'sourceDocument',
                  'sourcePage',
                  'sourceExcerpt',
                ],
              },
            },
          },
          required: ['title', 'questions'],
        },
      },
    }),
    ThinkingLevel.MEDIUM,
  );

  const rawText = (response.text ?? '{}').trim();
  const parsed = JSON.parse(rawText) as {
    title?: string;
    questions?: Array<Omit<QuizQuestion, 'id'>>;
  };

  const validQuestions: QuizQuestion[] = (parsed.questions ?? [])
    .filter((q) => Array.isArray(q.options) && q.options.length >= 4 && typeof q.question === 'string')
    .slice(0, clampedCount)
    .map((q, idx) => ({
      id: `q-${idx + 1}-${Date.now()}`,
      question: q.question.trim(),
      options: q.options.slice(0, 4).map((o) => String(o).trim()),
      correctIndex: Math.max(0, Math.min(3, Number(q.correctIndex) || 0)),
      explanation: q.explanation?.trim() || 'Refer to the cited document excerpt.',
      sourceDocument: q.sourceDocument?.trim() || documents[0]?.fileName || 'Uploaded PDF',
      sourcePage: Math.max(1, Number(q.sourcePage) || 1),
      sourceExcerpt: q.sourceExcerpt?.trim() || '',
    }));

  if (validQuestions.length < 5) {
    throw new Error('Could not generate at least 5 valid questions from the uploaded PDF content.');
  }

  return {
    title: parsed.title?.trim() || `${documents[0]?.fileName.replace(/\.pdf$/i, '') || 'PDF'} Quiz`,
    questions: validQuestions,
  };
}
