import { PrismaClient, Role, TestStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting DB seed...');

  // 1. Create Teacher
  const salt = await bcrypt.genSalt();
  const teacherPassword = await bcrypt.hash('password123', salt);
  const teacher = await prisma.user.upsert({
    where: { email: 'teacher@demo.com' },
    update: {},
    create: {
      email: 'teacher@demo.com',
      fullname: 'Prof. Jordan',
      password: teacherPassword,
      role: Role.TEACHER,
    },
  });
  console.log(`Teacher created: ${teacher.email}`);

  // 2. Create Students
  const studentPassword = await bcrypt.hash('password123', salt);
  const students = [];
  const names = ['Alice Smith', 'Bob Jones', 'Charlie Brown', 'Diana Prince', 'Eve Adams'];
  
  for (let i = 0; i < names.length; i++) {
    const s = await prisma.user.upsert({
      where: { email: `student${i+1}@demo.com` },
      update: {},
      create: {
        email: `student${i+1}@demo.com`,
        fullname: names[i],
        password: studentPassword,
        role: Role.STUDENT,
      },
    });
    students.push(s);
  }
  console.log(`Created ${students.length} students.`);

  // 3. Create the Demo Room
  const code = 'K7M4P2';
  let room = await prisma.room.findUnique({ where: { code } });
  if (!room) {
    room = await prisma.room.create({
      data: {
        name: 'BCA 5th Semester - DBMS',
        subject: 'Computer Science',
        description: 'Database Management Systems',
        code,
        teacherId: teacher.id,
      }
    });
  }
  console.log(`Demo Room created: ${room.name} (${room.code})`);

  // 4. Add Students to Room
  for (const s of students) {
    await prisma.roomMember.upsert({
      where: { roomId_studentId: { roomId: room.id, studentId: s.id } },
      update: {},
      create: {
        roomId: room.id,
        studentId: s.id,
      }
    });
  }
  console.log('Added students to room.');

  // 5. Create a Past Test to populate Leaderboards
  const pastTest = await prisma.test.create({
    data: {
      title: 'Week 1: Intro to Databases',
      topic: 'Databases',
      duration: 15,
      questionCount: 5,
      difficulty: 'easy',
      status: TestStatus.PUBLISHED,
      publishedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      roomId: room.id,
      creatorId: teacher.id,
      questions: {
        create: [
          { questionText: "What does SQL stand for?", options: ["Structured Query Language", "Strong Question Language", "Structured Question Language", "None of the above"], correctAnswer: 0, points: 1 },
          { questionText: "Which is a NoSQL database?", options: ["MySQL", "PostgreSQL", "MongoDB", "Oracle"], correctAnswer: 2, points: 1 },
          { questionText: "What is a primary key?", options: ["A key to a room", "Unique identifier for a record", "A foreign key", "A data type"], correctAnswer: 1, points: 1 },
          { questionText: "What does DBMS stand for?", options: ["Database Management System", "Data Base Management System", "Data Board Management System", "None of the above"], correctAnswer: 0, points: 1 },
          { questionText: "Which command is used to fetch data?", options: ["GET", "FETCH", "SELECT", "PULL"], correctAnswer: 2, points: 1 },
        ]
      }
    },
    include: { questions: true }
  });
  console.log(`Created past test: ${pastTest.title}`);

  // 6. Generate fake attempts for students to populate Global Leaderboard
  for (let t = 1; t <= 3; t++) {
    const test = await prisma.test.create({
      data: {
        title: `Pop Quiz ${t}`,
        topic: 'General DBMS',
        duration: 5,
        questionCount: 3,
        difficulty: 'medium',
        status: TestStatus.PUBLISHED,
        publishedAt: new Date(Date.now() - (t) * 24 * 60 * 60 * 1000), 
        roomId: room.id,
        creatorId: teacher.id,
        questions: {
          create: [
            { questionText: "Dummy Q1?", options: ["A", "B", "C", "D"], correctAnswer: 0, points: 1 },
            { questionText: "Dummy Q2?", options: ["A", "B", "C", "D"], correctAnswer: 1, points: 1 },
            { questionText: "Dummy Q3?", options: ["A", "B", "C", "D"], correctAnswer: 2, points: 1 },
          ]
        }
      },
      include: { questions: true }
    });

    for (const [idx, s] of students.entries()) {
      const correctAnswersCount = (idx + t) % 3 + 1; // 1, 2, or 3
      const percentage = Math.round((correctAnswersCount / 3) * 100);
      
      await prisma.submission.upsert({
        where: { testId_studentId: { testId: test.id, studentId: s.id } },
        update: {},
        create: {
          testId: test.id,
          studentId: s.id,
          startedAt: new Date(Date.now() - (t) * 24 * 60 * 60 * 1000),
          submittedAt: new Date(Date.now() - (t) * 24 * 60 * 60 * 1000 + 5 * 60000),
          score: correctAnswersCount,
          percentage: percentage,
          correctAnswers: correctAnswersCount,
          wrongAnswers: 3 - correctAnswersCount,
          timeTaken: 300,
          answers: {
            create: test.questions.map((q, qIdx) => ({
              questionId: q.id,
              selectedAnswer: qIdx < correctAnswersCount ? q.correctAnswer : (q.correctAnswer + 1) % 4,
              isCorrect: qIdx < correctAnswersCount
            }))
          }
        }
      });
    }
  }

  console.log('Seeding finished successfully. Demo environment is ready!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
