const API_URL = '/api-backend';

function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : '',
  };
}

function getAuthHeadersNoContentType() {
  const token = localStorage.getItem('token');
  return {
    'Authorization': token ? `Bearer ${token}` : '',
  };
}

// ─── Auth ─────────────────────────────────────────────────────
export async function getMe() {
  const res = await fetch(`${API_URL}/auth/me`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Not authenticated');
  return res.json();
}

// ─── Rooms ────────────────────────────────────────────────────
export async function createRoom(name: string) {
  const res = await fetch(`${API_URL}/rooms`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error('Failed to create room');
  return res.json();
}

export async function joinRoom(code: string) {
  const res = await fetch(`${API_URL}/rooms/join`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ code }),
  });
  if (!res.ok) throw new Error('Failed to join room');
  return res.json();
}

export async function getRooms() {
  const res = await fetch(`${API_URL}/rooms`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch rooms');
  return res.json();
}

export async function getRoomDetails(roomId: string) {
  const res = await fetch(`${API_URL}/rooms/${roomId}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch room details');
  return res.json();
}

// ─── Documents ────────────────────────────────────────────────
export async function uploadDocument(roomId: string, file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_URL}/documents/upload/${roomId}`, {
    method: 'POST',
    headers: getAuthHeadersNoContentType(),
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to upload document');
  }
  return res.json();
}

// ─── AI Generation ────────────────────────────────────────────
export async function generateAITest(data: {
  roomId: string;
  documentId: string;
  title: string;
  duration: number;
  questionCount: number;
  difficulty?: string;
}) {
  const res = await fetch(`${API_URL}/ai/generate-test`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to generate AI test');
  }
  return res.json();
}

// ─── Tests ────────────────────────────────────────────────────
export async function generateTest(topic: string, roomId?: string) {
  const res = await fetch(`${API_URL}/tests/generate`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ topic, roomId }),
  });
  if (!res.ok) throw new Error('Failed to generate test');
  return res.json();
}

export async function getTests() {
  const res = await fetch(`${API_URL}/tests`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch tests');
  return res.json();
}

export async function getTestDetails(testId: string) {
  const res = await fetch(`${API_URL}/tests/${testId}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch test details');
  return res.json();
}

export async function publishTest(testId: string) {
  const res = await fetch(`${API_URL}/tests/${testId}/publish`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to publish test');
  return res.json();
}

export async function editQuestion(testId: string, questionId: string, data: any) {
  const res = await fetch(`${API_URL}/tests/${testId}/questions/${questionId}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to edit question');
  return res.json();
}

export async function deleteQuestion(testId: string, questionId: string) {
  const res = await fetch(`${API_URL}/tests/${testId}/questions/${questionId}/delete`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete question');
  return res.json();
}

export async function getTestsByRoom(roomId: string) {
  const res = await fetch(`${API_URL}/tests/room/${roomId}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch tests');
  return res.json();
}

// ─── Submissions / Attempts ───────────────────────────────────
export async function startTest(testId: string) {
  const res = await fetch(`${API_URL}/submissions/${testId}/start`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to start test');
  return res.json();
}

export async function submitTest(testId: string, answers: { questionId: string; selectedAnswer: number }[]) {
  const res = await fetch(`${API_URL}/submissions/${testId}/submit`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ answers }),
  });
  if (!res.ok) throw new Error('Failed to submit test');
  return res.json();
}

export async function getSubmissions() {
  const res = await fetch(`${API_URL}/submissions/me`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch submissions');
  return res.json();
}

export async function getSubmissionDetails(submissionId: string) {
  const res = await fetch(`${API_URL}/submissions/${submissionId}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch submission details');
  return res.json();
}

// ─── Leaderboard ──────────────────────────────────────────────
export async function getRoomLeaderboard(roomCode: string) {
  const res = await fetch(`${API_URL}/leaderboard/room/${roomCode}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch room leaderboard');
  return res.json();
}

export async function getGlobalWeeklyLeaderboard() {
  const res = await fetch(`${API_URL}/leaderboard/global/weekly`);
  if (!res.ok) throw new Error('Failed to fetch global leaderboard');
  return res.json();
}
