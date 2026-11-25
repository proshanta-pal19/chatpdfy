export interface PdfPage {
  pageNumber: number;
  text: string;
}

export interface PdfDocumentRecord {
  id: string;
  studentId: string;
  fileName: string;
  fileSize: number;
  pageCount: number;
  charCount: number;
  pages: PdfPage[];
  uploadedAt: string;
}

export interface Citation {
  documentName: string;
  pageNumber: number;
  excerpt: string;
}

export interface ChatMessageRecord {
  id: string;
  studentId: string;
  role: 'user' | 'assistant';
  content: string;
  notFound?: boolean;
  citations?: Citation[];
  documentIds?: string[];
  createdAt: string;
}

export type QuizDifficulty = 'Easy' | 'Medium' | 'Hard';

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  sourceDocument: string;
  sourcePage: number;
  sourceExcerpt: string;
}

export interface QuizAttemptRecord {
  id: string;
  studentId: string;
  title: string;
  difficulty: QuizDifficulty;
  documentNames: string[];
  totalQuestions: number;
  correctCount: number;
  scorePercent: number;
  timeLimitSeconds: number;
  timeSpentSeconds: number;
  questions: QuizQuestion[];
  userAnswers: number[];
  completedAt: string;
}

export interface StudentProfileRecord {
  studentId: string;
  displayName: string;
  studyGoal: string;
  updatedAt: string;
}
