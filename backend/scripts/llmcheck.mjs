import { readFileSync } from 'node:fs';

const BASE = 'http://localhost:3001';
const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
const line = env.split(/\r?\n/).find((l) => l.startsWith('OPENROUTER_API_KEY='));
const key = line.slice('OPENROUTER_API_KEY='.length).replace(/^"|"$/g, '').trim();

const prompt = `Generate exactly 3 multiple-choice questions on the topic of "Relational databases".
Rules:
- Each question must have exactly 4 distinct options and exactly one correct answer.
- "correctAnswer" must be the 0-based index (0-3) of the correct option.
Respond with raw JSON only: {"questions":[{"question":"...","options":["...","...","...","..."],"correctAnswer":0,"difficulty":"MEDIUM"}]}`;

const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'openai/gpt-4o-mini',
    max_tokens: 4000,
    temperature: 0.4,
    messages: [
      { role: 'system', content: 'You are an exam question generator. You reply with raw JSON only.' },
      { role: 'user', content: prompt },
    ],
  }),
});
const data = await res.json();
const content = data.choices?.[0]?.message?.content ?? '';
console.log('RAW CONTENT:\n', content.slice(0, 2000));
try {
  const parsed = JSON.parse(content);
  console.log('\nPARSED OK. question keys:', Object.keys(parsed.questions?.[0] ?? {}));
  console.log('first:', JSON.stringify(parsed.questions?.[0], null, 2));
  console.log('\nper-question type check:');
  for (const [i, q] of parsed.questions.entries()) {
    console.log(
      i,
      'text:', typeof q.question, JSON.stringify(q.question)?.slice(0, 30),
      '| options:', Array.isArray(q.options) ? q.options.length : typeof q.options,
      '| correct:', typeof q.correctAnswer, q.correctAnswer,
      '| difficulty:', typeof q.difficulty,
    );
    if (!Array.isArray(q.options)) continue;
    for (const [j, o] of q.options.entries()) {
      if (typeof o !== 'string') console.log(`   !! option ${j} is ${typeof o}:`, o);
    }
    if (new Set(q.options.map((o) => String(o).toLowerCase())).size !== q.options.length) {
      console.log('   !! duplicate options');
    }
  }
} catch (e) {
  console.log('parse failed:', e.message);
}
