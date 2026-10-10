import { Logger } from '@nestjs/common';

const logger = new Logger('QuestionGenerator');

export const DEFAULT_AI_MODEL = 'openai/gpt-4o-mini';
export const AI_MAX_TOKENS = 4000;

export type GeneratedQuestion = {
  questionText: string;
  options: string[];
  correctAnswer: number;
  difficulty: string;
};

const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'];

/**
 * Validates and normalises raw question objects coming from an LLM.
 * Rules from the spec: exactly 4 non-empty options, non-empty text,
 * correctAnswer within 0-3, no duplicate options.
 * Invalid questions are dropped rather than failing the whole batch.
 */
export function normalizeQuestions(raw: unknown): GeneratedQuestion[] {
  if (!Array.isArray(raw)) return [];

  const out: GeneratedQuestion[] = [];
  const seen = new Set<string>();

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const q = item as Record<string, unknown>;

    const text = String(q.question ?? q.questionText ?? q.text ?? '').trim();
    if (!text) continue;

    const key = text.toLowerCase();
    if (seen.has(key)) continue;

    const rawOptions = q.options ?? q.choices;
    if (!Array.isArray(rawOptions)) continue;

    const options = rawOptions.map((o) => String(o ?? '').trim()).filter((o) => o.length > 0);
    if (options.length !== 4) continue;
    if (new Set(options.map((o) => o.toLowerCase())).size !== 4) continue;

    let correctAnswer = Number(q.correctAnswer ?? q.answer ?? q.correct);
    if (!Number.isInteger(correctAnswer) || correctAnswer < 0 || correctAnswer > 3) {
      // Some models answer "A"/"B"/"C"/"D" instead of an index.
      const letter = String(q.correctAnswer ?? q.answer ?? '').trim().toUpperCase();
      const idx = ['A', 'B', 'C', 'D'].indexOf(letter);
      if (idx === -1) continue;
      correctAnswer = idx;
    }

    const difficulty = String(q.difficulty ?? 'MEDIUM').trim().toUpperCase();

    seen.add(key);
    out.push({
      questionText: text,
      options,
      correctAnswer,
      difficulty: DIFFICULTIES.includes(difficulty) ? difficulty : 'MEDIUM',
    });
  }

  return out;
}

/** Extracts a JSON object from an LLM reply that may be wrapped in prose or code fences. */
export function parseJsonFromText(text: string): unknown {
  if (!text) return null;

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;

  try {
    return JSON.parse(candidate);
  } catch {
    // fall through to brace matching
  }

  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(candidate.slice(start, end + 1));
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Calls the LLM and returns validated questions. Retries on transport errors,
 * unparsable JSON, or a batch that fails validation.
 */
export async function generateQuestionsWithLlm(opts: {
  apiKey: string;
  model?: string;
  prompt: string;
  expected: number;
  attempts?: number;
}): Promise<GeneratedQuestion[]> {
  const { apiKey, prompt, expected } = opts;
  const model = opts.model || process.env.AI_MODEL || DEFAULT_AI_MODEL;
  const attempts = opts.attempts ?? 3;
  let lastError = 'unknown error';

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:3000',
          'X-Title': 'ClassRank',
        },
        body: JSON.stringify({
          model,
          max_tokens: AI_MAX_TOKENS,
          temperature: 0.4,
          messages: [
            {
              role: 'system',
              content:
                'You are an exam question generator. You reply with raw JSON only — no markdown, no commentary.',
            },
            { role: 'user', content: prompt },
          ],
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        lastError = `HTTP ${response.status}: ${body.slice(0, 200)}`;
        logger.warn(`LLM attempt ${attempt}/${attempts} failed: ${lastError}`);
        continue;
      }

      const data = (await response.json()) as any;
      const text = data?.choices?.[0]?.message?.content ?? '';
      const parsed = parseJsonFromText(text) as any;
      const rawQuestions = Array.isArray(parsed) ? parsed : parsed?.questions;
      const questions = normalizeQuestions(rawQuestions);

      if (questions.length === 0) {
        lastError = 'model returned no valid questions';
        logger.warn(`LLM attempt ${attempt}/${attempts} failed: ${lastError}`);
        continue;
      }

      if (questions.length < Math.min(expected, 3)) {
        lastError = `model returned only ${questions.length} valid question(s)`;
        logger.warn(`LLM attempt ${attempt}/${attempts}: ${lastError}`);
        continue;
      }

      return questions;
    } catch (error: any) {
      lastError = error?.message || String(error);
      logger.warn(`LLM attempt ${attempt}/${attempts} threw: ${lastError}`);
    }
  }

  throw new Error(`Question generation failed after ${attempts} attempts (${lastError})`);
}

/** Deterministic fallback questions used when no LLM key is configured (local demo mode). */
export function fallbackQuestions(topic: string, count: number, difficulty = 'MEDIUM'): GeneratedQuestion[] {
  const subject = topic?.trim() || 'the study material';
  const templates = [
    { stem: `Which statement about ${subject} is correct?`, right: 'It is defined by the material covered in this unit' },
    { stem: `Which of these best summarises a core idea of ${subject}?`, right: 'The key concept described in the source document' },
    { stem: `In the context of ${subject}, which option is accurate?`, right: 'The documented definition from the material' },
    { stem: `Which option is NOT related to ${subject}?`, right: 'An unrelated topic outside this unit' },
    { stem: `What is the main purpose of the concept taught in ${subject}?`, right: 'To organise and query the data described in the unit' },
  ];

  return Array.from({ length: count }).map((_, i) => {
    const t = templates[i % templates.length];
    const distractors = [
      'None of the above',
      'All of the above',
      'It is unrelated to this unit',
      'This concept is not part of the syllabus',
    ];
    const options = [t.right, ...distractors.filter((d) => d !== t.right)].slice(0, 4);
    return {
      questionText: `${t.stem} (auto-generated ${i + 1})`,
      options,
      correctAnswer: 0,
      difficulty,
    };
  });
}
