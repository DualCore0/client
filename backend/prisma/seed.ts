import { PrismaClient, Role, TestStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

/**
 * Demo seed. Idempotent: every record uses a deterministic id and is upserted,
 * so running it repeatedly (or after a partial failure) never duplicates the
 * demo room, tests or attempts.
 *
 *   npx tsx prisma/seed.ts            # create/refresh the demo data
 *   npx tsx prisma/seed.ts --reset    # delete the demo tests first, then reseed
 */
const prisma = new PrismaClient();
const RESET = process.argv.includes('--reset');

const ROOM_CODE = 'K7M4P2';
const STUDENT_NAMES = ['Alice Smith', 'Bob Jones', 'Charlie Brown', 'Diana Prince', 'Eve Adams'];

/** Stable id helpers so upserts stay idempotent. */
const id = (kind: string, key: string | number) => `demo-${kind}-${key}`;

const WEEK1_QUESTIONS = [
  {
    questionText: 'What does SQL stand for?',
    options: ['Structured Query Language', 'Strong Question Language', 'Structured Question Language', 'None of the above'],
    correctAnswer: 0,
  },
  {
    questionText: 'Which is a NoSQL database?',
    options: ['MySQL', 'PostgreSQL', 'MongoDB', 'Oracle'],
    correctAnswer: 2,
  },
  {
    questionText: 'What is a primary key?',
    options: ['A key to a room', 'Unique identifier for a record', 'A foreign key', 'A data type'],
    correctAnswer: 1,
  },
  {
    questionText: 'What does DBMS stand for?',
    options: ['Database Management System', 'Data Base Management System', 'Data Board Management System', 'None of the above'],
    correctAnswer: 0,
  },
  {
    questionText: 'Which command is used to fetch data?',
    options: ['GET', 'FETCH', 'SELECT', 'PULL'],
    correctAnswer: 2,
  },
];

const POP_QUIZ_QUESTIONS = [
  { questionText: 'Which normal form removes partial dependency?', options: ['1NF', '2NF', '3NF', 'BCNF'], correctAnswer: 1 },
  { questionText: 'Which key references another table?', options: ['Primary key', 'Foreign key', 'Candidate key', 'Super key'], correctAnswer: 1 },
  { questionText: 'Which property guarantees a committed transaction survives a crash?', options: ['Atomicity', 'Consistency', 'Isolation', 'Durability'], correctAnswer: 3 },
];

/** Deterministic answer distribution so re-seeding produces the same board. */
function scoreFor(studentIndex: number, round: number, total: number) {
  return ((studentIndex + round) % total) + 1;
}

async function main() {
  console.log(`Starting DB seed${RESET ? ' (reset mode)' : ''}...`);

  if (RESET) {
    const room = await prisma.room.findUnique({ where: { code: ROOM_CODE } });
    if (room) {
      await prisma.test.deleteMany({ where: { roomId: room.id } });
      console.log('Removed the existing demo tests.');
    }
  }

  /* Remove tests created by earlier seed versions, which used random ids.
     Their questions, submissions and answers cascade away with them. */
  {
    const room = await prisma.room.findUnique({ where: { code: ROOM_CODE } });
    if (room) {
      const stale = await prisma.test.findMany({
        where: { roomId: room.id, NOT: { id: { startsWith: 'demo-' } } },
        select: { id: true, title: true },
      });
      if (stale.length) {
        await prisma.test.deleteMany({ where: { id: { in: stale.map((t) => t.id) } } });
        console.log(`Removed ${stale.length} test(s) left over from an older seed: ${stale.map((t) => t.title).join(', ')}`);
      }
    }
  }

  /* 1. Teacher ------------------------------------------------------------- */
  const passwordHash = await bcrypt.hash('password123', 10);

  const teacher = await prisma.user.upsert({
    where: { email: 'teacher@demo.com' },
    // Reset the known demo password so the credentials always work.
    update: { fullname: 'Prof. Jordan', role: Role.TEACHER, password: passwordHash },
    create: {
      email: 'teacher@demo.com',
      fullname: 'Prof. Jordan',
      password: passwordHash,
      role: Role.TEACHER,
    },
  });
  console.log(`Teacher ready: ${teacher.email}`);

  /* 2. Students ------------------------------------------------------------ */
  const students = [];
  for (let i = 0; i < STUDENT_NAMES.length; i++) {
    const student = await prisma.user.upsert({
      where: { email: `student${i + 1}@demo.com` },
      update: { fullname: STUDENT_NAMES[i], role: Role.STUDENT, password: passwordHash },
      create: {
        email: `student${i + 1}@demo.com`,
        fullname: STUDENT_NAMES[i],
        password: passwordHash,
        role: Role.STUDENT,
      },
    });
    students.push(student);
  }
  console.log(`Students ready: ${students.length}`);

  /* 3. Room ---------------------------------------------------------------- */
  const room = await prisma.room.upsert({
    where: { code: ROOM_CODE },
    update: {},
    create: {
      code: ROOM_CODE,
      name: 'BCA 5th Semester - DBMS',
      subject: 'Computer Science',
      description: 'Database Management Systems',
      teacherId: teacher.id,
    },
  });
  console.log(`Room ready: ${room.name} (${room.code})`);

  /* 4. Membership ---------------------------------------------------------- */
  for (const student of students) {
    await prisma.roomMember.upsert({
      where: { roomId_studentId: { roomId: room.id, studentId: student.id } },
      update: {},
      create: { roomId: room.id, studentId: student.id },
    });
  }
  console.log('Students enrolled in the room.');

  /* 5. Tests --------------------------------------------------------------- */
  const week1 = await prisma.test.upsert({
    where: { id: id('test', 'week1') },
    update: { questionCount: WEEK1_QUESTIONS.length },
    create: {
      id: id('test', 'week1'),
      title: 'Week 1: Intro to Databases',
      topic: 'Databases',
      duration: 15,
      questionCount: WEEK1_QUESTIONS.length,
      difficulty: 'EASY',
      status: TestStatus.PUBLISHED,
      publishedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      roomId: room.id,
      creatorId: teacher.id,
    },
  });

  for (const [index, question] of WEEK1_QUESTIONS.entries()) {
    await prisma.question.upsert({
      where: { id: id('q-week1', index) },
      update: {},
      create: {
        id: id('q-week1', index),
        testId: week1.id,
        questionText: question.questionText,
        options: question.options,
        correctAnswer: question.correctAnswer,
        difficulty: 'EASY',
      },
    });
  }
  console.log(`Test ready: ${week1.title} (${WEEK1_QUESTIONS.length} questions)`);

  const quizzes = [];
  for (let round = 1; round <= 3; round++) {
    const quiz = await prisma.test.upsert({
      where: { id: id('test', `pop${round}`) },
      update: { questionCount: POP_QUIZ_QUESTIONS.length },
      create: {
        id: id('test', `pop${round}`),
        title: `Pop Quiz ${round}`,
        topic: 'Normalization & keys',
        duration: 5,
        questionCount: POP_QUIZ_QUESTIONS.length,
        difficulty: 'MEDIUM',
        status: TestStatus.PUBLISHED,
        publishedAt: new Date(Date.now() - round * 24 * 60 * 60 * 1000),
        roomId: room.id,
        creatorId: teacher.id,
      },
    });

    for (const [index, question] of POP_QUIZ_QUESTIONS.entries()) {
      await prisma.question.upsert({
        where: { id: id(`q-pop${round}`, index) },
        update: {},
        create: {
          id: id(`q-pop${round}`, index),
          testId: quiz.id,
          questionText: question.questionText,
          options: question.options,
          correctAnswer: question.correctAnswer,
          difficulty: 'MEDIUM',
        },
      });
    }
    quizzes.push(quiz);
  }
  console.log(`Pop quizzes ready: ${quizzes.length}`);

  /* 6. Attempts ------------------------------------------------------------ */
  const plan: { test: typeof week1; questions: typeof WEEK1_QUESTIONS; round: number; total: number }[] = [
    { test: week1, questions: WEEK1_QUESTIONS, round: 4, total: WEEK1_QUESTIONS.length },
    ...quizzes.map((quiz, index) => ({
      test: quiz,
      questions: POP_QUIZ_QUESTIONS,
      round: index + 1,
      total: POP_QUIZ_QUESTIONS.length,
    })),
  ];

  let attemptCount = 0;
  for (const { test, questions, round, total } of plan) {
    for (const [studentIndex, student] of students.entries()) {
      const correctCount = scoreFor(studentIndex, round, total);
      const percentage = Math.round((correctCount / total) * 100);
      const submittedAt = new Date(test.publishedAt!.getTime() + 5 * 60 * 1000);

      const submissionId = id('sub', `${test.id}-${studentIndex}`);
      await prisma.submission.upsert({
        where: { testId_studentId: { testId: test.id, studentId: student.id } },
        update: {},
        create: {
          id: submissionId,
          testId: test.id,
          studentId: student.id,
          startedAt: test.publishedAt!,
          submittedAt,
          score: correctCount,
          percentage,
          correctAnswers: correctCount,
          wrongAnswers: total - correctCount,
          timeTaken: 300,
        },
      });

      // Re-read the question rows so the answer key matches what is stored.
      const stored = await prisma.question.findMany({
        where: { testId: test.id },
        orderBy: { createdAt: 'asc' },
      });

      for (const [questionIndex, question] of stored.entries()) {
        const isCorrect = questionIndex < correctCount;
        await prisma.answer.upsert({
          where: { submissionId_questionId: { submissionId, questionId: question.id } },
          update: {},
          create: {
            submissionId,
            questionId: question.id,
            selectedAnswer: isCorrect ? question.correctAnswer : (question.correctAnswer + 1) % 4,
            isCorrect,
          },
        });
      }
      attemptCount++;
    }
  }
  console.log(`Attempts ready: ${attemptCount}`);

  console.log('\nSeeding finished. Demo environment is ready.');
  console.log(`  Teacher:  teacher@demo.com / password123`);
  console.log(`  Students: student1@demo.com … student5@demo.com / password123`);
  console.log(`  Room:     ${room.name} (code ${room.code})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
