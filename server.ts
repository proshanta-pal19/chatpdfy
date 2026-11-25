import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { answerFromDocuments, generateQuizFromDocuments } from './server/ai.ts';
import {
  clearChats,
  deletePdf,
  deleteQuizAttempt,
  getDbStatus,
  getPdfsByIds,
  getProfile,
  initDb,
  listChats,
  listPdfMeta,
  listQuizAttempts,
  saveChatMessage,
  savePdfs,
  saveQuizAttempt,
  upsertProfile,
} from './server/db.ts';
import { extractPdfPages } from './server/pdf.ts';
import type { PdfDocumentRecord, QuizAttemptRecord, QuizDifficulty } from './server/types.ts';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Proactively warm up MongoDB connection in the background at startup
void initDb();

app.use(express.json({ limit: '5mb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB per PDF
    files: 10,
  },
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype === 'application/pdf' ||
      file.originalname.toLowerCase().endsWith('.pdf')
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed.'));
    }
  },
});

function getStudentId(req: Request): string {
  const raw = req.header('x-student-id') ?? '';
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  return cleaned || 'default-scholar';
}

app.get('/api/health', async (_req: Request, res: Response) => {
  const dbStatus = await getDbStatus();
  res.json({ ok: true, ...dbStatus });
});

app.get('/api/pdfs', async (req: Request, res: Response) => {
  try {
    const studentId = getStudentId(req);
    const documents = await listPdfMeta(studentId);
    res.json({ documents });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message || 'Failed to load PDFs' });
  }
});

app.post('/api/pdfs/upload', upload.array('files', 10), async (req: Request, res: Response) => {
  try {
    const studentId = getStudentId(req);
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length === 0) {
      res.status(400).json({ error: 'Please select at least one PDF file.' });
      return;
    }

    const docRecords: PdfDocumentRecord[] = await Promise.all(
      files.map(async (file) => {
        const safeName = path.basename(file.originalname || 'document.pdf').slice(0, 140);
        const extracted = await extractPdfPages(file.buffer);
        return {
          id: crypto.randomUUID(),
          studentId,
          fileName: safeName,
          fileSize: file.size,
          pageCount: extracted.pageCount,
          charCount: extracted.charCount,
          pages: extracted.pages,
          uploadedAt: new Date().toISOString(),
        };
      }),
    );

    await savePdfs(docRecords);

    res.json({
      documents: docRecords.map(({ pages: _pages, ...meta }) => meta),
    });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message || 'Failed to parse PDF' });
  }
});

app.delete('/api/pdfs/:id', async (req: Request, res: Response) => {
  try {
    const studentId = getStudentId(req);
    const id = String(req.params.id || '').trim();
    if (!id) {
      res.status(400).json({ error: 'Document ID is required.' });
      return;
    }
    const deleted = await deletePdf(studentId, id);
    res.json({ deleted });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message || 'Failed to delete PDF' });
  }
});

app.get('/api/chat', async (req: Request, res: Response) => {
  try {
    const studentId = getStudentId(req);
    const messages = await listChats(studentId);
    res.json({ messages });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message || 'Failed to load chat history' });
  }
});

app.delete('/api/chat', async (req: Request, res: Response) => {
  try {
    const studentId = getStudentId(req);
    await clearChats(studentId);
    res.json({ cleared: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message || 'Failed to clear chat history' });
  }
});

app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const studentId = getStudentId(req);
    const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
    const documentIds = Array.isArray(req.body?.documentIds)
      ? req.body.documentIds.filter((id: unknown): id is string => typeof id === 'string')
      : undefined;

    if (!question) {
      res.status(400).json({ error: 'Please enter a question.' });
      return;
    }

    const docs = await getPdfsByIds(studentId, documentIds);
    if (docs.length === 0) {
      res.status(400).json({ error: 'Please upload at least one PDF before chatting.' });
      return;
    }

    const history = await listChats(studentId);
    const aiResult = await answerFromDocuments(question, docs, history);

    const userMsg = {
      id: crypto.randomUUID(),
      studentId,
      role: 'user' as const,
      content: question,
      documentIds: docs.map((d) => d.id),
      createdAt: new Date().toISOString(),
    };
    await saveChatMessage(userMsg);

    const assistantMsg = {
      id: crypto.randomUUID(),
      studentId,
      role: 'assistant' as const,
      content: aiResult.answer,
      notFound: aiResult.notFound,
      citations: aiResult.citations,
      documentIds: docs.map((d) => d.id),
      createdAt: new Date().toISOString(),
    };
    await saveChatMessage(assistantMsg);

    res.json({ userMessage: userMsg, assistantMessage: assistantMsg });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: (err as Error).message || 'Failed to generate answer' });
  }
});

app.post('/api/quiz/generate', async (req: Request, res: Response) => {
  try {
    const studentId = getStudentId(req);
    const rawCount = Number(req.body?.numQuestions ?? 5);
    const numQuestions = Number.isFinite(rawCount) ? Math.max(5, Math.min(25, Math.round(rawCount))) : 5;
    const rawDiff = req.body?.difficulty;
    const difficulty: QuizDifficulty =
      rawDiff === 'Easy' || rawDiff === 'Medium' || rawDiff === 'Hard' ? rawDiff : 'Medium';
    const documentIds = Array.isArray(req.body?.documentIds)
      ? req.body.documentIds.filter((id: unknown): id is string => typeof id === 'string')
      : undefined;

    const docs = await getPdfsByIds(studentId, documentIds);
    if (docs.length === 0) {
      res.status(400).json({ error: 'Please upload at least one PDF before generating a quiz.' });
      return;
    }

    const quiz = await generateQuizFromDocuments(docs, numQuestions, difficulty);
    const secondsPerQuestion = difficulty === 'Easy' ? 30 : difficulty === 'Medium' ? 45 : 60;

    res.json({
      title: quiz.title,
      difficulty,
      documentNames: docs.map((d) => d.fileName),
      totalQuestions: quiz.questions.length,
      timeLimitSeconds: quiz.questions.length * secondsPerQuestion,
      questions: quiz.questions,
    });
  } catch (err) {
    console.error('Quiz generation error:', err);
    res.status(500).json({ error: (err as Error).message || 'Failed to generate quiz' });
  }
});

app.post('/api/quiz/submit', async (req: Request, res: Response) => {
  try {
    const studentId = getStudentId(req);
    const body = req.body ?? {};
    const questions = Array.isArray(body.questions) ? body.questions : [];
    const userAnswers = Array.isArray(body.userAnswers)
      ? body.userAnswers.map((v: unknown) => (typeof v === 'number' ? v : -1))
      : [];

    if (questions.length < 1) {
      res.status(400).json({ error: 'Invalid quiz submission.' });
      return;
    }

    let correctCount = 0;
    for (let i = 0; i < questions.length; i += 1) {
      if (userAnswers[i] === questions[i].correctIndex) {
        correctCount += 1;
      }
    }

    const scorePercent = Math.round((correctCount / questions.length) * 100);
    const difficulty: QuizDifficulty =
      body.difficulty === 'Easy' || body.difficulty === 'Medium' || body.difficulty === 'Hard'
        ? body.difficulty
        : 'Medium';

    const attempt: QuizAttemptRecord = {
      id: crypto.randomUUID(),
      studentId,
      title: typeof body.title === 'string' && body.title.trim() ? body.title.trim() : 'PDF Quiz',
      difficulty,
      documentNames: Array.isArray(body.documentNames)
        ? body.documentNames.filter((n: unknown): n is string => typeof n === 'string')
        : [],
      totalQuestions: questions.length,
      correctCount,
      scorePercent,
      timeLimitSeconds: Math.max(30, Number(body.timeLimitSeconds) || questions.length * 45),
      timeSpentSeconds: Math.max(0, Number(body.timeSpentSeconds) || 0),
      questions,
      userAnswers,
      completedAt: new Date().toISOString(),
    };

    await saveQuizAttempt(attempt);
    res.json({ attempt });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message || 'Failed to save quiz attempt' });
  }
});

app.get('/api/profile', async (req: Request, res: Response) => {
  try {
    const studentId = getStudentId(req);
    const [profile, attempts] = await Promise.all([
      getProfile(studentId),
      listQuizAttempts(studentId),
    ]);
    res.json({ profile, attempts });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message || 'Failed to load profile' });
  }
});

app.patch('/api/profile', async (req: Request, res: Response) => {
  try {
    const studentId = getStudentId(req);
    const existing = await getProfile(studentId);
    const displayName =
      typeof req.body?.displayName === 'string' && req.body.displayName.trim()
        ? req.body.displayName.trim().slice(0, 60)
        : existing.displayName;
    const studyGoal =
      typeof req.body?.studyGoal === 'string' && req.body.studyGoal.trim()
        ? req.body.studyGoal.trim().slice(0, 160)
        : existing.studyGoal;

    const updated = await upsertProfile({
      studentId,
      displayName,
      studyGoal,
      updatedAt: new Date().toISOString(),
    });
    res.json({ profile: updated });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message || 'Failed to update profile' });
  }
});

app.delete('/api/profile/attempts/:id', async (req: Request, res: Response) => {
  try {
    const studentId = getStudentId(req);
    const id = String(req.params.id || '').trim();
    const deleted = await deleteQuizAttempt(studentId, id);
    res.json({ deleted });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message || 'Failed to delete quiz attempt' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ChatPDFy server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
