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
  /** Internal: prevents a refresh loop when the refresh call itself 401s. */
  skipRefresh?: boolean;
};

/** Paths where a 401 means "bad credentials", not "expired token". */
const NO_REFRESH_PATHS = ['/auth/login', '/auth/register', '/auth/signup', '/auth/refresh'];

/**
 * Exchanges the httpOnly refresh cookie for a new access token.
 * Resolves to null when the session cannot be renewed.
 */
let refreshInFlight: Promise<string | null> | null = null;

export async function refreshSession(): Promise<string | null> {
  // Collapse concurrent refreshes: rotation invalidates the previous token, so
  // two parallel refreshes would revoke each other.
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        cache: 'no-store',
        body: '{}',
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { access_token?: string };
      if (!data?.access_token) return null;
      setToken(data.access_token);
      return data.access_token;
    } catch {
      return null;
    } finally {
      // Allow the next expiry to trigger a fresh refresh.
      setTimeout(() => {
        refreshInFlight = null;
      }, 0);
    }
  })();

  return refreshInFlight;
}

async function rawFetch(path: string, options: RequestOptions, token: string | null): Promise<Response> {
  const { method = 'GET', body, json = true } = options;
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined && json) headers['Content-Type'] = 'application/json';

  return fetch(`${API_URL}${path}`, {
    method,
    headers,
    // Sends the httpOnly refresh cookie on the same-origin proxy route.
    credentials: 'include',
    body: body === undefined ? undefined : json ? JSON.stringify(body) : (body as BodyInit),
    cache: 'no-store',
  });
}

export async function request<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  let res: Response;
  try {
    res = await rawFetch(path, options, getToken());
  } catch {
    throw new ApiError('Cannot reach the server. Is the backend running?', 0);
  }

  // Access tokens are short-lived by design. On expiry, rotate the refresh
  // token once and replay the request rather than bouncing the user to /login.
  if (res.status === 401 && !options.skipRefresh && !NO_REFRESH_PATHS.some((p) => path.startsWith(p))) {
    const renewed = await refreshSession();
    if (renewed) {
      try {
        res = await rawFetch(path, options, renewed);
      } catch {
        throw new ApiError('Cannot reach the server. Is the backend running?', 0);
      }
    }
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

export type Role = 'STUDENT' | 'TEACHER' | 'ADMIN';

export type UserStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'LOCKED' | 'DELETED';

export type AuthUser = {
  id: string;
  email: string;
  fullname: string | null;
  role: Role;
  status?: UserStatus;
  emailVerified?: boolean;
  createdAt?: string;
  lastLoginAt?: string | null;
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

/** Revokes the current session server-side and clears the refresh cookie. */
export function logout() {
  return request<{ success: boolean }>('/auth/logout', { method: 'POST', body: {} });
}

/** Revokes every session and invalidates all outstanding access tokens. */
export function logoutAll() {
  return request<{ success: boolean; sessionsRevoked: number }>('/auth/logout-all', {
    method: 'POST',
    body: {},
  });
}

export function changePassword(data: { currentPassword: string; newPassword: string }) {
  return request<{ success: boolean; sessionsRevoked: number }>('/auth/change-password', {
    method: 'POST',
    body: data,
  });
}

export function forgotPassword(email: string) {
  return request<{ success: boolean; message: string; resetToken?: string }>('/auth/forgot-password', {
    method: 'POST',
    body: { email },
  });
}

export function resetPassword(data: { token: string; password: string }) {
  return request<{ success: boolean; message: string }>('/auth/reset-password', {
    method: 'POST',
    body: data,
  });
}

export function verifyEmail(token: string) {
  return request<{ success: boolean }>('/auth/verify-email', { method: 'POST', body: { token } });
}

export function resendVerification() {
  return request<{ success: boolean; alreadyVerified?: boolean; verificationToken?: string }>(
    '/auth/resend-verification',
    { method: 'POST', body: {} },
  );
}

/* ─── Password policy (mirrors src/common/security/password-policy.ts) ── */

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password12', 'password123', 'password1234',
  'passw0rd', 'p@ssw0rd', 'p@ssword1', 'passwords',
  '123456', '1234567', '12345678', '123456789', '1234567890', 'qwerty',
  'qwerty123', 'qwertyuiop', 'letmein', 'letmein123', 'welcome', 'welcome1',
  'welcome123', 'admin', 'admin123', 'administrator', 'root', 'toor',
  'iloveyou', 'monkey', 'dragon', 'sunshine', 'princess', 'football',
  'baseball', 'master', 'shadow', 'superman', 'trustno1', 'abc123',
  'abcd1234', 'test1234', 'changeme', 'changeme123', 'secret', 'secret123',
  'classrank', 'classrank123', 'student', 'student123', 'teacher',
  'teacher123', 'school', 'school123', 'exam', 'exam1234',
]);

const SEQUENCES = ['abcdefghijklmnopqrstuvwxyz', '0123456789', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

const deLeet = (value: string) =>
  value
    .replace(/[@4]/g, 'a')
    .replace(/0/g, 'o')
    .replace(/[1!|]/g, 'i')
    .replace(/3/g, 'e')
    .replace(/[$5]/g, 's')
    .replace(/7/g, 't')
    .replace(/8/g, 'b');

const plainSkeleton = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
const skeleton = (value: string) => deLeet(value.toLowerCase()).replace(/[^a-z0-9]/g, '');

/**
 * Client-side mirror of the server policy so the user gets immediate feedback.
 * The server re-validates everything; this is UX only.
 */
export function validatePassword(
  password: string,
  context: { email?: string; fullname?: string } = {},
): { ok: boolean; errors: string[]; score: number } {
  const errors: string[] = [];

  if (!password) return { ok: false, errors: ['Password is required'], score: 0 };

  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`At least ${PASSWORD_MIN_LENGTH} characters`);
  }
  if (password.length > PASSWORD_MAX_LENGTH) errors.push('Too long');
  if (!/[a-z]/.test(password)) errors.push('One lowercase letter');
  if (!/[A-Z]/.test(password)) errors.push('One uppercase letter');
  if (!/[0-9]/.test(password)) errors.push('One digit');
  if (!/[^A-Za-z0-9]/.test(password)) errors.push('One symbol');

  const bare = plainSkeleton(password);
  const leet = skeleton(password);
  if (COMMON_PASSWORDS.has(password.toLowerCase()) || COMMON_PASSWORDS.has(bare) || COMMON_PASSWORDS.has(leet)) {
    errors.push('Not a common password');
  }
  if (/(.)\1{3,}/i.test(password)) errors.push('No four repeated characters');

  let hasSequence = false;
  for (const sequence of SEQUENCES) {
    for (let i = 0; i + 4 <= sequence.length; i++) {
      if (password.toLowerCase().includes(sequence.slice(i, i + 4))) {
        hasSequence = true;
        break;
      }
    }
    if (hasSequence) break;
  }
  if (hasSequence) errors.push('No keyboard or alphabet runs');

  const identities = [context.email?.split('@')[0], context.fullname]
    .filter((v): v is string => Boolean(v && v.trim().length >= 4))
    .map((v) => ({ plain: plainSkeleton(v), leet: skeleton(v), alphabetic: /^[a-z]+$/i.test(v.replace(/[^a-z0-9]/gi, '')) }))
    .filter((t) => t.plain.length >= 4);

  if (identities.some((t) => bare.includes(t.plain) || (t.alphabetic && leet.includes(t.leet)))) {
    errors.push('Not your name or email');
  }

  // Simple 0-4 score for the strength meter.
  const satisfied = [
    password.length >= PASSWORD_MIN_LENGTH,
    /[A-Z]/.test(password) && /[a-z]/.test(password),
    /[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password),
    password.length >= 16,
  ].filter(Boolean).length;

  return { ok: errors.length === 0, errors, score: errors.length === 0 ? Math.max(2, satisfied) : satisfied };
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
