/**
 * Single API client for the ClassRank backend.
 * All requests go through `request()` so auth headers, JSON handling and
 * error normalisation stay in one place.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api-backend';

export const TOKEN_KEY = 'classrank_token';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/* ─── token storage ─────────────────────────────────────────── */

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(TOKEN_KEY, token);
  // Mirrored into a cookie so edge middleware can gate protected routes.
  document.cookie = `${TOKEN_KEY}=${token}; path=/; max-age=${60 * 60 * 24 * 7}; samesite=lax`;
}

export function clearToken() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(TOKEN_KEY);
  document.cookie = `${TOKEN_KEY}=; path=/; max-age=0; samesite=lax`;
}

/* ─── core request helper ───────────────────────────────────── */

type RequestOptions = {
  method?: string;
  body?: unknown;
  /** Set to false for form-data uploads so the browser sets the boundary. */
  json?: boolean;
};

export async function request<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, json = true } = options;
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined && json) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : json ? JSON.stringify(body) : (body as BodyInit),
      cache: 'no-store',
    });
  } catch {
    throw new ApiError('Cannot reach the server. Is the backend running?', 0);
  }

  if (res.status === 401) {
    clearToken();
  }

  const text = await res.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!res.ok) {
    const record = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null;
    const rawMessage = record?.message;
    const message =
      (Array.isArray(rawMessage) ? rawMessage.join(', ') : typeof rawMessage === 'string' ? rawMessage : null) ||
      (typeof payload === 'string' && payload) ||
      `Request failed (${res.status})`;
    throw new ApiError(String(message), res.status);
  }

  return payload as T;
}

/* ─── types ─────────────────────────────────────────────────── */

export type Role = 'STUDENT' | 'TEACHER';

export type AuthUser = {
  id: string;
  email: string;
  fullname: string | null;
  role: Role;
  createdAt?: string;
};

export type Room = {
  id: string;
  code: string;
  name: string;
  subject?: string | null;
  description?: string | null;
  teacherId?: string;
  createdAt?: string;
  _count?: { members?: number; tests?: number };
};

export type RoomDetails = Room & {
  tests: TestSummary[];
  members: { id: string; studentId: string; joinedAt: string; student: AuthUser }[];
  qrCode: string;
  joinUrl: string;
};

export type Question = {
  id: string;
  questionText: string;
  options: string[];
  points: number;
  difficulty?: string | null;
  correctAnswer?: number;
};

export type TestSummary = {
  id: string;
  title: string;
  topic?: string | null;
  duration?: number | null;
  questionCount: number;
  difficulty?: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'CLOSED';
  createdAt: string;
  publishedAt?: string | null;
  roomId?: string | null;
  room?: { id: string; name: string; code: string } | null;
  _count?: { questions?: number; submissions?: number };
  submissions?: { id: string; score: number | null; percentage: number | null; submittedAt: string | null }[];
};

export type TestDetails = TestSummary & {
  questions: Question[];
  submissions?: Submission[];
};

export type Submission = {
  id: string;
  testId: string;
  score: number | null;
  percentage: number | null;
  correctAnswers: number | null;
  wrongAnswers: number | null;
  timeTaken: number | null;
  startedAt: string;
  submittedAt: string | null;
  test?: {
    id: string;
    title: string;
    topic?: string | null;
    duration?: number | null;
    questionCount?: number;
    room?: { id: string; name: string; code: string } | null;
  };
};

export type SubmissionDetails = {
  id: string;
  testId: string;
  score: number | null;
  percentage: number | null;
  correctAnswers: number | null;
  wrongAnswers: number | null;
  timeTaken: number | null;
  startedAt: string;
  submittedAt: string | null;
  test: {
    id: string;
    title: string;
    topic?: string | null;
    duration?: number | null;
    questionCount?: number;
    status: string;
    room?: { id: string; name: string; code: string } | null;
  };
  questions: (Question & { selectedAnswer: number | null; isCorrect: boolean })[];
};

export type RoomLeaderboardEntry = {
  rank: number;
  studentId: string;
  name: string;
  averagePercentage: number;
  testsCompleted: number;
  averageTimeTaken: number;
};

export type RoomLeaderboardResponse = {
  room: { id: string; code: string; name: string; subject?: string | null };
  leaderboard: RoomLeaderboardEntry[];
  viewer: RoomLeaderboardEntry | null;
  totalTests: number;
  totalParticipants: number;
};

export type GlobalLeaderboardEntry = {
  rank: number;
  studentId: string;
  name: string;
  globalScore: number;
  avgPercentage: number;
  accuracy: number;
  participation: number;
  testsCompleted: number;
};

export type GlobalLeaderboardResponse = {
  weekStart: string;
  weekEnd: string;
  minTestsRequired: number;
  weights: { average: number; accuracy: number; participation: number };
  leaderboard: GlobalLeaderboardEntry[];
  viewer: GlobalLeaderboardEntry | null;
};

export type PublicProfile = {
  id: string;
  name: string;
  role: Role;
  joinedAt: string;
  primaryRoom: { name: string; code: string; count: number } | null;
  stats: {
    testsCompleted: number;
    averagePercentage: number | null;
    accuracy: number | null;
    highPercentage: number | null;
  };
  recentTests: {
    submissionId: string;
    testId: string;
    title: string;
    topic?: string | null;
    room: string | null;
    percentage: number | null;
    score: number | null;
    submittedAt: string | null;
  }[];
};

export type DocumentRecord = {
  id: string;
  roomId?: string;
  fileName: string;
  status: 'PROCESSING' | 'READY' | 'FAILED';
  chunkCount?: number;
  error?: string | null;
  createdAt?: string;
  _count?: { tests: number };
};

/* ─── Auth ──────────────────────────────────────────────────── */

export function register(data: { email: string; password: string; fullname: string; role: Role }) {
  return request<{ access_token: string; user: AuthUser }>('/auth/register', {
    method: 'POST',
    body: data,
  });
}

export function login(data: { email: string; password: string }) {
  return request<{ access_token: string; user: AuthUser }>('/auth/login', {
    method: 'POST',
    body: data,
  });
}

export function getMe() {
  return request<AuthUser>('/auth/me');
}

/* ─── Rooms ─────────────────────────────────────────────────── */

export function createRoom(data: { name: string; subject?: string; description?: string }) {
  return request<Room>('/rooms', { method: 'POST', body: data });
}

export function getRooms() {
  return request<Room[]>('/rooms');
}

export function joinRoom(code: string) {
  return request<{ id: string; room: Room }>('/rooms/join', { method: 'POST', body: { code } });
}

export function getRoomByCode(code: string) {
  return request<{
    id: string;
    code: string;
    name: string;
    subject?: string | null;
    description?: string | null;
    instructor: string;
    memberCount: number;
    testCount: number;
  }>(`/rooms/code/${encodeURIComponent(code)}`);
}

export function getPublicRoomPreview(code: string) {
  return request<{
    id: string;
    code: string;
    name: string;
    subject?: string | null;
    description?: string | null;
    instructor: string;
    memberCount: number;
    testCount: number;
  }>(`/public/rooms/${encodeURIComponent(code)}`);
}

export function getRoomDetails(roomId: string) {
  return request<RoomDetails>(`/rooms/${roomId}`);
}

/* ─── Documents ─────────────────────────────────────────────── */

export function uploadDocument(roomId: string, file: File) {
  const form = new FormData();
  form.append('file', file);
  return request<DocumentRecord>(`/documents/upload/${roomId}`, {
    method: 'POST',
    body: form,
    json: false,
  });
}

export function getDocument(id: string) {
  return request<DocumentRecord>(`/documents/${id}`);
}

export function getRoomDocuments(roomId: string) {
  return request<DocumentRecord[]>(`/documents/room/${roomId}`);
}

/* ─── AI ────────────────────────────────────────────────────── */

export function generateAITest(data: {
  roomId: string;
  documentId: string;
  title: string;
  duration: number;
  questionCount: number;
  difficulty?: string;
  topic?: string;
}) {
  return request<TestDetails>('/ai/generate-test', { method: 'POST', body: data });
}

/* ─── Tests ─────────────────────────────────────────────────── */

export function generateTest(topic: string, roomId?: string, questionCount = 5) {
  return request<TestDetails>('/tests/generate', {
    method: 'POST',
    body: { topic, roomId, questionCount },
  });
}

export function getTests() {
  return request<TestSummary[]>('/tests');
}

export function getTestsByRoom(roomId: string) {
  return request<TestSummary[]>(`/tests/room/${roomId}`);
}

export function getTestDetails(testId: string) {
  return request<TestDetails>(`/tests/${testId}`);
}

export function publishTest(testId: string) {
  return request<TestSummary>(`/tests/${testId}/publish`, { method: 'POST' });
}

export function editQuestion(
  testId: string,
  questionId: string,
  data: { questionText?: string; options?: string[]; correctAnswer?: number; difficulty?: string; points?: number },
) {
  return request<Question>(`/tests/${testId}/questions/${questionId}`, { method: 'PATCH', body: data });
}

export function deleteQuestion(testId: string, questionId: string) {
  return request<TestSummary>(`/tests/${testId}/questions/${questionId}/delete`, { method: 'POST' });
}

export function getTestResults(testId: string) {
  return request<{
    test: {
      id: string;
      title: string;
      topic?: string | null;
      status: string;
      duration?: number | null;
      difficulty?: string | null;
      questionCount: number;
      room?: { id: string; name: string; code: string } | null;
      publishedAt?: string | null;
    };
    summary: {
      attemptCount: number;
      averagePercentage: number | null;
      highPercentage: number | null;
      lowPercentage: number | null;
      passRate: number | null;
    };
    attempts: {
      rank: number;
      submissionId: string;
      studentId: string;
      name: string;
      email: string;
      score: number | null;
      percentage: number | null;
      correctAnswers: number | null;
      wrongAnswers: number | null;
      timeTaken: number | null;
      submittedAt: string | null;
    }[];
  }>(`/tests/${testId}/results`);
}

/* ─── Attempts / submissions ────────────────────────────────── */

export function startTest(testId: string) {
  return request<Submission>(`/submissions/${testId}/start`, { method: 'POST' });
}

export function getAttemptState(testId: string) {
  return request<{
    test: { id: string; title: string; duration: number | null; status: string };
    submissionId: string | null;
    startedAt: string | null;
    submittedAt: string | null;
    deadline: string | null;
    score: number | null;
    percentage: number | null;
  }>(`/submissions/attempt/${testId}`);
}

export function submitTest(
  testId: string,
  answers: { questionId: string; selectedAnswer: number }[],
) {
  return request<Submission>(`/submissions/${testId}/submit`, {
    method: 'POST',
    body: { answers },
  });
}

export function getSubmissions() {
  return request<Submission[]>('/submissions/me');
}

export function getSubmissionDetails(submissionId: string) {
  return request<SubmissionDetails>(`/submissions/${submissionId}`);
}

/* ─── Leaderboards ──────────────────────────────────────────── */

export function getRoomLeaderboard(roomCode: string) {
  return request<RoomLeaderboardResponse>(`/leaderboard/room/${encodeURIComponent(roomCode)}`);
}

export function getGlobalWeeklyLeaderboard() {
  return request<GlobalLeaderboardResponse>('/leaderboard/global/weekly');
}

/* ─── Profiles ──────────────────────────────────────────────── */

export function getPublicProfile(userId: string) {
  return request<PublicProfile>(`/users/${userId}`);
}

/* ─── helpers ───────────────────────────────────────────────── */

export function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return `${date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}, ${date.toLocaleTimeString(
    undefined,
    { hour: '2-digit', minute: '2-digit' },
  )}`;
}

export function formatDuration(seconds?: number | null) {
  if (seconds === null || seconds === undefined) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

export function initialsOf(name?: string | null) {
  if (!name) return '??';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export function percent(value?: number | null, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${Number(value).toFixed(digits)}%`;
}
