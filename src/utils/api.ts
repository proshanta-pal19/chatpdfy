import { jsPDF } from 'jspdf';
import type {
  ChatMessage,
  GeneratedQuiz,
  PdfDocumentMeta,
  QuizAttempt,
  QuizDifficulty,
  StudentProfile,
} from '../types';

function getStudentId(): string {
  const key = 'chatpdfy-student-id';
  try {
    let id = localStorage.getItem(key);
    if (!id) {
      id = `stu-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
      localStorage.setItem(key, id);
    }
    return id;
  } catch {
    return 'default-scholar';
  }
}

async function apiFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('x-student-id', getStudentId());
  if (!(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, { ...init, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 413) {
      throw new Error(
        'File exceeds Vercel’s 4.5 MB serverless upload limit. Please upload a PDF under 4.5 MB.',
      );
    }
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  }
  return data as T;
}

export async function fetchPdfs(): Promise<PdfDocumentMeta[]> {
  const data = await apiFetch<{ documents: PdfDocumentMeta[] }>('/api/pdfs');
  return data.documents;
}

export async function uploadPdfs(files: File[]): Promise<PdfDocumentMeta[]> {
  const formData = new FormData();
  for (const file of files) {
    formData.append('files', file);
  }
  const data = await apiFetch<{ documents: PdfDocumentMeta[] }>('/api/pdfs/upload', {
    method: 'POST',
    body: formData,
  });
  return data.documents;
}

export async function removePdf(id: string): Promise<void> {
  await apiFetch(`/api/pdfs/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function fetchChatHistory(): Promise<ChatMessage[]> {
  const data = await apiFetch<{ messages: ChatMessage[] }>('/api/chat');
  return data.messages;
}

export async function clearChatHistory(): Promise<void> {
  await apiFetch('/api/chat', { method: 'DELETE' });
}

export async function sendChatQuestion(
  question: string,
  documentIds?: string[],
): Promise<{ userMessage: ChatMessage; assistantMessage: ChatMessage }> {
  return apiFetch('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ question, documentIds }),
  });
}

export async function generateQuiz(
  numQuestions: number,
  difficulty: QuizDifficulty,
  documentIds?: string[],
): Promise<GeneratedQuiz> {
  return apiFetch<GeneratedQuiz>('/api/quiz/generate', {
    method: 'POST',
    body: JSON.stringify({ numQuestions, difficulty, documentIds }),
  });
}

export async function submitQuizAttempt(payload: {
  title: string;
  difficulty: QuizDifficulty;
  documentNames: string[];
  timeLimitSeconds: number;
  timeSpentSeconds: number;
  questions: GeneratedQuiz['questions'];
  userAnswers: number[];
}): Promise<QuizAttempt> {
  const data = await apiFetch<{ attempt: QuizAttempt }>('/api/quiz/submit', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data.attempt;
}

export async function fetchProfile(): Promise<{
  profile: StudentProfile;
  attempts: QuizAttempt[];
}> {
  return apiFetch('/api/profile');
}

export async function updateProfile(payload: {
  displayName: string;
  studyGoal: string;
}): Promise<StudentProfile> {
  const data = await apiFetch<{ profile: StudentProfile }>('/api/profile', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return data.profile;
}

export async function deleteQuizAttempt(id: string): Promise<void> {
  await apiFetch(`/api/profile/attempts/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.max(0, seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function downloadQuizReport(attempt: QuizAttempt): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 44;
  const maxWidth = pageWidth - margin * 2;
  const letters = ['A', 'B', 'C', 'D'];
  let y = 48;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 44) {
      doc.addPage();
      y = 48;
    }
  };

  // Header Banner
  doc.setFillColor(8, 145, 178);
  doc.roundedRect(margin, y - 18, maxWidth, 56, 6, 6, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  const titleLines = doc.splitTextToSize(attempt.title || 'ChatPDFy Quiz Result', maxWidth - 28);
  doc.text(titleLines[0] || 'ChatPDFy Quiz Result', margin + 14, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(
    `Score: ${attempt.correctCount}/${attempt.totalQuestions} (${attempt.scorePercent}%)  |  Difficulty: ${attempt.difficulty}  |  Time: ${formatDuration(attempt.timeSpentSeconds)}`,
    margin + 14,
    y + 26,
  );
  y += 58;

  // Metadata
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(9.5);
  const metaText = `Completed: ${new Date(attempt.completedAt).toLocaleString()}  |  Source PDF(s): ${attempt.documentNames.join(', ') || 'Uploaded PDF'}`;
  const metaLines = doc.splitTextToSize(metaText, maxWidth);
  doc.text(metaLines, margin, y);
  y += metaLines.length * 13 + 10;

  doc.setDrawColor(203, 213, 225);
  doc.line(margin, y, pageWidth - margin, y);
  y += 20;

  attempt.questions.forEach((q, idx) => {
    const userIdx = attempt.userAnswers[idx];
    const isCorrect = userIdx === q.correctIndex;
    const isUnanswered = userIdx === -1 || userIdx === undefined;
    const statusLabel = isUnanswered ? 'UNANSWERED' : isCorrect ? 'CORRECT' : 'INCORRECT';

    const qLines = doc.splitTextToSize(`${idx + 1}. ${q.question}`, maxWidth);
    ensureSpace(qLines.length * 15 + 95);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(qLines, margin, y);
    y += qLines.length * 15 + 4;

    // Status tag line
    doc.setFontSize(9.5);
    if (isCorrect) {
      doc.setTextColor(5, 150, 105);
    } else if (isUnanswered) {
      doc.setTextColor(217, 119, 6);
    } else {
      doc.setTextColor(220, 38, 38);
    }
    doc.text(
      `Result: ${statusLabel}   |   Your Answer: ${
        userIdx >= 0 && q.options[userIdx] ? `${letters[userIdx]}. ${q.options[userIdx]}` : 'None'
      }`,
      margin,
      y,
    );
    y += 15;

    // Options
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    q.options.forEach((opt, optIdx) => {
      const prefix = optIdx === q.correctIndex ? '[Correct] ' : optIdx === userIdx ? '[Your Pick] ' : '';
      const optLines = doc.splitTextToSize(
        `${letters[optIdx]}. ${prefix}${opt}`,
        maxWidth - 14,
      );
      ensureSpace(optLines.length * 13 + 4);
      if (optIdx === q.correctIndex) {
        doc.setTextColor(5, 150, 105);
        doc.setFont('helvetica', 'bold');
      } else if (optIdx === userIdx) {
        doc.setTextColor(220, 38, 38);
        doc.setFont('helvetica', 'normal');
      } else {
        doc.setTextColor(51, 65, 85);
        doc.setFont('helvetica', 'normal');
      }
      doc.text(optLines, margin + 12, y);
      y += optLines.length * 13 + 2;
    });

    // PDF Explanation
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(8, 145, 178);
    const sourceHeader = `PDF Explanation (${q.sourceDocument} · Page ${q.sourcePage}):`;
    ensureSpace(34);
    doc.text(sourceHeader, margin + 12, y + 4);
    y += 17;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    const expLines = doc.splitTextToSize(q.explanation, maxWidth - 14);
    ensureSpace(expLines.length * 12 + 8);
    doc.text(expLines, margin + 12, y);
    y += expLines.length * 12 + 4;

    if (q.sourceExcerpt) {
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(100, 116, 139);
      const quoteLines = doc.splitTextToSize(`"${q.sourceExcerpt}"`, maxWidth - 14);
      ensureSpace(quoteLines.length * 12 + 12);
      doc.text(quoteLines, margin + 12, y);
      y += quoteLines.length * 12 + 8;
    } else {
      y += 8;
    }

    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, pageWidth - margin, y);
    y += 14;
  });

  const slug =
    attempt.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'quiz-result';
  doc.save(`${slug}-${attempt.scorePercent}pct.pdf`);
}
