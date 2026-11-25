export interface PdfDocumentMeta {
  id: string;
  fileName: string;
  fileSize: number;
  pageCount: number;
  charCount: number;
  uploadedAt: string;
}

export interface Citation {
  documentName: string;
  pageNumber: number;
  excerpt: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  notFound?: boolean;
  citations?: Citation[];
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

export interface GeneratedQuiz {
  title: string;
  difficulty: QuizDifficulty;
  documentNames: string[];
  totalQuestions: number;
  timeLimitSeconds: number;
  questions: QuizQuestion[];
}

export interface QuizAttempt {
  id: string;
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

export interface StudentProfile {
  studentId: string;
  displayName: string;
  studyGoal: string;
  updatedAt: string;
}

export type AppView = 'home' | 'chat' | 'quiz' | 'profile';
