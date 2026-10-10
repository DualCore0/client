import {
  normalizeQuestions,
  parseJsonFromText,
  fallbackQuestions,
} from './question-generator.js';

describe('normalizeQuestions', () => {
  const valid = {
    question: 'What does SQL stand for?',
    options: ['Structured Query Language', 'Simple Query Language', 'Standard Query Language', 'None'],
    correctAnswer: 0,
    difficulty: 'EASY',
  };

  it('accepts a well-formed question', () => {
    const result = normalizeQuestions([valid]);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      questionText: 'What does SQL stand for?',
      options: valid.options,
      correctAnswer: 0,
      difficulty: 'EASY',
    });
  });

  it('returns an empty array for non-array input', () => {
    expect(normalizeQuestions(null)).toEqual([]);
    expect(normalizeQuestions({ questions: [valid] })).toEqual([]);
    expect(normalizeQuestions('nope')).toEqual([]);
  });

  it('drops questions without exactly 4 options', () => {
    expect(normalizeQuestions([{ ...valid, options: ['a', 'b', 'c'] }])).toEqual([]);
    expect(normalizeQuestions([{ ...valid, options: ['a', 'b', 'c', 'd', 'e'] }])).toEqual([]);
  });

  it('drops questions with duplicate options', () => {
    expect(normalizeQuestions([{ ...valid, options: ['a', 'a', 'b', 'c'] }])).toEqual([]);
  });

  it('drops questions with blank text or blank options', () => {
    expect(normalizeQuestions([{ ...valid, question: '   ' }])).toEqual([]);
    expect(normalizeQuestions([{ ...valid, options: ['a', '', 'c', 'd'] }])).toEqual([]);
  });

  it('rejects a correctAnswer outside 0-3', () => {
    expect(normalizeQuestions([{ ...valid, correctAnswer: 4 }])).toEqual([]);
    expect(normalizeQuestions([{ ...valid, correctAnswer: -1 }])).toEqual([]);
    expect(normalizeQuestions([{ ...valid, correctAnswer: 1.5 }])).toEqual([]);
  });

  it('maps letter answers onto indexes', () => {
    const result = normalizeQuestions([{ ...valid, correctAnswer: 'C' }]);
    expect(result[0].correctAnswer).toBe(2);
  });

  it('normalises an unknown difficulty to MEDIUM', () => {
    expect(normalizeQuestions([{ ...valid, difficulty: 'impossible' }])[0].difficulty).toBe('MEDIUM');
    expect(normalizeQuestions([{ ...valid, difficulty: undefined }])[0].difficulty).toBe('MEDIUM');
  });

  it('deduplicates repeated questions', () => {
    const result = normalizeQuestions([valid, { ...valid }]);
    expect(result).toHaveLength(1);
  });

  it('keeps the valid questions from a partly broken batch', () => {
    const result = normalizeQuestions([valid, { ...valid, question: 'Second?', correctAnswer: 9 }, { ...valid, question: 'Third?', options: ['a', 'b', 'c', 'd'] }]);
    expect(result.map((q) => q.questionText)).toEqual(['What does SQL stand for?', 'Third?']);
  });
});

describe('parseJsonFromText', () => {
  it('parses raw JSON', () => {
    expect(parseJsonFromText('{"questions":[]}')).toEqual({ questions: [] });
  });

  it('parses JSON wrapped in a fenced code block', () => {
    const text = 'Here you go:\n```json\n{"questions":[{"a":1}]}\n```\nHope that helps!';
    expect(parseJsonFromText(text)).toEqual({ questions: [{ a: 1 }] });
  });

  it('parses JSON surrounded by prose', () => {
    const text = 'Sure! {"questions":[{"a":1}]} Let me know.';
    expect(parseJsonFromText(text)).toEqual({ questions: [{ a: 1 }] });
  });

  it('returns null for unparsable output', () => {
    expect(parseJsonFromText('no json here')).toBeNull();
    expect(parseJsonFromText('')).toBeNull();
  });
});

describe('fallbackQuestions', () => {
  it('produces the requested number of valid questions', () => {
    const questions = fallbackQuestions('DBMS', 7);
    expect(questions).toHaveLength(7);
    for (const q of questions) {
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options).size).toBe(4);
      expect(q.correctAnswer).toBe(0);
    }
  });

  it('passes its own validator', () => {
    const questions = fallbackQuestions('DBMS', 5);
    expect(normalizeQuestions(questions)).toHaveLength(5);
  });
});
