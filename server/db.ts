import { MongoClient, type Db } from 'mongodb';
import type {
  ChatMessageRecord,
  PdfDocumentRecord,
  QuizAttemptRecord,
  StudentProfileRecord,
} from './types.ts';

interface MemoryStore {
  pdfs: PdfDocumentRecord[];
  chats: ChatMessageRecord[];
  attempts: QuizAttemptRecord[];
  profiles: Map<string, StudentProfileRecord>;
}

const memoryStore: MemoryStore = {
  pdfs: [],
  chats: [],
  attempts: [],
  profiles: new Map(),
};

let mongoClient: MongoClient | null = null;
let mongoDb: Db | null = null;
let mongoInitPromise: Promise<Db | null> | null = null;
let lastMongoError: string | null = null;

async function connectMongo(): Promise<Db | null> {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    lastMongoError = 'MONGODB_URI is not set in environment variables.';
    return null;
  }

  try {
    mongoClient = new MongoClient(uri, {
      serverSelectionTimeoutMS: 6000,
      connectTimeoutMS: 6000,
    });
    await mongoClient.connect();
    const db = mongoClient.db();
    mongoDb = db;
    lastMongoError = null;

    // Create indexes in the background without blocking incoming requests
    void Promise.all([
      db.collection('pdfs').createIndex({ studentId: 1, uploadedAt: -1 }),
      db.collection('chats').createIndex({ studentId: 1, createdAt: 1 }),
      db.collection('quiz_attempts').createIndex({ studentId: 1, completedAt: -1 }),
      db.collection('profiles').createIndex({ studentId: 1 }, { unique: true }),
    ]).catch(() => {});

    return db;
  } catch (err) {
    lastMongoError = (err as Error).message;
    console.warn('MongoDB unavailable, using in-memory store:', lastMongoError);
    mongoDb = null;
    mongoInitPromise = null;
    return null;
  }
}

export function initDb(): Promise<Db | null> {
  if (mongoDb) return Promise.resolve(mongoDb);
  if (!mongoInitPromise) {
    mongoInitPromise = connectMongo();
  }
  return mongoInitPromise;
}

export async function getDbStatus(): Promise<{
  storage: 'mongodb' | 'memory';
  databaseName: string | null;
  configured: boolean;
  error: string | null;
}> {
  const configured = Boolean(process.env.MONGODB_URI?.trim());
  const db = await initDb();
  return {
    storage: db ? 'mongodb' : 'memory',
    databaseName: db ? db.databaseName : null,
    configured,
    error: db ? null : lastMongoError,
  };
}

async function getDb(): Promise<Db | null> {
  return initDb();
}

export type PdfMetaRecord = Omit<PdfDocumentRecord, 'pages'>;

export async function listPdfMeta(studentId: string): Promise<PdfMetaRecord[]> {
  const db = await getDb();
  if (db) {
    return db
      .collection<PdfDocumentRecord>('pdfs')
      .find({ studentId }, { projection: { _id: 0, pages: 0 } })
      .sort({ uploadedAt: -1 })
      .toArray();
  }
  return memoryStore.pdfs
    .filter((d) => d.studentId === studentId)
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
    .map(({ pages: _pages, ...meta }) => meta);
}

export async function listPdfs(studentId: string): Promise<PdfDocumentRecord[]> {
  const db = await getDb();
  if (db) {
    return db
      .collection<PdfDocumentRecord>('pdfs')
      .find({ studentId }, { projection: { _id: 0 } })
      .sort({ uploadedAt: -1 })
      .toArray();
  }
  return memoryStore.pdfs
    .filter((d) => d.studentId === studentId)
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

export async function getPdfsByIds(studentId: string, ids?: string[]): Promise<PdfDocumentRecord[]> {
  const db = await getDb();
  if (db) {
    const query =
      ids && ids.length > 0 ? { studentId, id: { $in: ids } } : { studentId };
    return db
      .collection<PdfDocumentRecord>('pdfs')
      .find(query, { projection: { _id: 0 } })
      .sort({ uploadedAt: -1 })
      .toArray();
  }

  const all = await listPdfs(studentId);
  if (!ids || ids.length === 0) return all;
  const idSet = new Set(ids);
  return all.filter((doc) => idSet.has(doc.id));
}

export async function savePdfs(docs: PdfDocumentRecord[]): Promise<void> {
  if (docs.length === 0) return;
  // Also keep in memory for immediate access, or write straight to DB
  const db = await getDb();
  if (db) {
    await db
      .collection<PdfDocumentRecord>('pdfs')
      .insertMany(docs.map((d) => ({ ...d })), { ordered: false });
    return;
  }
  memoryStore.pdfs.push(...docs);
}

export async function deletePdf(studentId: string, id: string): Promise<boolean> {
  const db = await getDb();
  if (db) {
    const res = await db.collection<PdfDocumentRecord>('pdfs').deleteOne({ studentId, id });
    return res.deletedCount > 0;
  }
  const idx = memoryStore.pdfs.findIndex((d) => d.studentId === studentId && d.id === id);
  if (idx === -1) return false;
  memoryStore.pdfs.splice(idx, 1);
  return true;
}

export async function listChats(studentId: string): Promise<ChatMessageRecord[]> {
  const db = await getDb();
  if (db) {
    return db
      .collection<ChatMessageRecord>('chats')
      .find({ studentId }, { projection: { _id: 0 } })
      .sort({ createdAt: 1 })
      .toArray();
  }
  return memoryStore.chats
    .filter((c) => c.studentId === studentId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function saveChatMessage(msg: ChatMessageRecord): Promise<void> {
  const db = await getDb();
  if (db) {
    await db.collection<ChatMessageRecord>('chats').insertOne({ ...msg });
    return;
  }
  memoryStore.chats.push(msg);
}

export async function clearChats(studentId: string): Promise<void> {
  const db = await getDb();
  if (db) {
    await db.collection<ChatMessageRecord>('chats').deleteMany({ studentId });
    return;
  }
  memoryStore.chats = memoryStore.chats.filter((c) => c.studentId !== studentId);
}

export async function listQuizAttempts(studentId: string): Promise<QuizAttemptRecord[]> {
  const db = await getDb();
  if (db) {
    return db
      .collection<QuizAttemptRecord>('quiz_attempts')
      .find({ studentId }, { projection: { _id: 0 } })
      .sort({ completedAt: -1 })
      .toArray();
  }
  return memoryStore.attempts
    .filter((a) => a.studentId === studentId)
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt));
}

export async function saveQuizAttempt(attempt: QuizAttemptRecord): Promise<void> {
  const db = await getDb();
  if (db) {
    await db.collection<QuizAttemptRecord>('quiz_attempts').insertOne({ ...attempt });
    return;
  }
  memoryStore.attempts.push(attempt);
}

export async function deleteQuizAttempt(studentId: string, id: string): Promise<boolean> {
  const db = await getDb();
  if (db) {
    const res = await db.collection<QuizAttemptRecord>('quiz_attempts').deleteOne({ studentId, id });
    return res.deletedCount > 0;
  }
  const idx = memoryStore.attempts.findIndex((a) => a.studentId === studentId && a.id === id);
  if (idx === -1) return false;
  memoryStore.attempts.splice(idx, 1);
  return true;
}

export async function getProfile(studentId: string): Promise<StudentProfileRecord> {
  const db = await getDb();
  if (db) {
    const found = await db
      .collection<StudentProfileRecord>('profiles')
      .findOne({ studentId }, { projection: { _id: 0 } });
    if (found) return found;
  } else {
    const found = memoryStore.profiles.get(studentId);
    if (found) return found;
  }

  return {
    studentId,
    displayName: 'Scholar',
    studyGoal: 'Master core concepts and score 90%+ on practice quizzes',
    updatedAt: new Date().toISOString(),
  };
}

export async function upsertProfile(profile: StudentProfileRecord): Promise<StudentProfileRecord> {
  const db = await getDb();
  if (db) {
    await db
      .collection<StudentProfileRecord>('profiles')
      .updateOne({ studentId: profile.studentId }, { $set: profile }, { upsert: true });
    return profile;
  }
  memoryStore.profiles.set(profile.studentId, profile);
  return profile;
}
