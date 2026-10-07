export const mockRoom = {
  id: "K7M4P2",
  name: "BCA 5th Semester - DBMS",
  subject: "Database Management System",
  instructor: "Alex Morgan",
  cohortCount: 42,
  passingRate: 94.2,
  department: "Department of Computer Applications",
  term: "Fall 2025",
  activeAssessment: {
    title: "DBMS Normalization Quiz",
    status: "Live Now"
  },
  tests: 8,
  avgAccuracy: 84,
  liveExams: 2,
};

export const mockLeaderboard = [
  { id: "24BCA018", name: "Sophia Chen", initials: "SC", score: 98, time: "14m 10s", verified: true, percentile: 99 },
  { id: "24BCA042", name: "Elena Rostova", initials: "ER", score: 94, time: "18m 42s", verified: false, percentile: 95 },
  { id: "24BCA009", name: "Alex Rivera", initials: "AR", score: 92, time: "21m 05s", verified: false, percentile: 92 },
  { id: "24BCA011", name: "David Kim", initials: "DK", score: 89, time: "22m 15s", verified: true, percentile: 88 },
  { id: "24BCA055", name: "Jordan Blake", initials: "JB", score: 86, time: "20m 30s", verified: true, percentile: 84 },
  { id: "24BCA023", name: "Priya Sharma", initials: "PS", score: 85, time: "24m 00s", verified: false, percentile: 80 },
  { id: "24BCA077", name: "Michael Chang", initials: "MC", score: 82, time: "25m 00s", verified: true, percentile: 75 },
  { id: "24BCA034", name: "Emma Watson", initials: "EW", score: 78, time: "19m 45s", verified: false, percentile: 68 },
  { id: "24BCA088", name: "Liam O'Connor", initials: "LO", score: 75, time: "23m 10s", verified: true, percentile: 60 },
  { id: "24BCA045", name: "Noah Smith", initials: "NS", score: 72, time: "25m 00s", verified: false, percentile: 55 },
];

export const mockActiveTests = [
  {
    id: "test-1",
    title: "DBMS Normalization & BCNF",
    duration: "25 Mins",
    hall: "Exam Hall A",
    details: "20 Objective MCQs • Chapter 4 & 5",
    submissions: 38,
    totalStudents: 42,
    closesIn: "45m",
    status: "LIVE"
  },
  {
    id: "test-2",
    title: "Relational Algebra Midterm",
    duration: "20 Mins",
    hall: "Scheduled",
    details: "15 MCQs • Queries, Projections & Joins",
    submissions: 0,
    totalStudents: 42,
    closesIn: "Today at 6:00 PM",
    status: "SCHEDULED"
  }
];

export const mockGeneratedTest = {
  id: "gen-1",
  title: "OS CPU Scheduling",
  questionsCount: 15,
  duration: "25 Mins",
  difficulty: "Medium",
  source: {
    filename: "Operating_Systems_Ch4_Scheduling.pdf",
    size: "2.4 MB",
    engine: "Claude 3.5 Sonnet"
  },
  questions: [
    {
      id: "q1",
      number: "Q1",
      difficulty: "Medium",
      points: 2,
      text: "Which CPU scheduling algorithm gives the minimum average waiting time for a given set of processes?",
      options: [
        { id: "a", label: "A", text: "First-Come, First-Served (FCFS)", isCorrect: false },
        { id: "b", label: "B", text: "Shortest Job First (SJF)", isCorrect: true },
        { id: "c", label: "C", text: "Priority Scheduling", isCorrect: false },
        { id: "d", label: "D", text: "Round Robin with large quantum", isCorrect: false }
      ],
      rationale: "SJF is provably optimal for minimizing average waiting time by executing shorter jobs ahead of lengthy ones, thus decreasing wait queue latency."
    },
    {
      id: "q2",
      number: "Q2",
      difficulty: "Hard",
      points: 3,
      text: "What is a major limitation of the multilevel feedback queue (MLFQ) scheduling algorithm?",
      options: [
        { id: "a", label: "A", text: "Inability to handle interactive and I/O-bound processes effectively", isCorrect: false },
        { id: "b", label: "B", text: "High configuration complexity and susceptibility to process starvation", isCorrect: true },
        { id: "c", label: "C", text: "Strict requirement for deterministic prior knowledge of burst times", isCorrect: false },
        { id: "d", label: "D", text: "Excessive context switching when CPU quanta are set too large", isCorrect: false }
      ],
      rationale: "MLFQ requires intricate tuning (number of queues, scheduling algorithm per queue, upgrade/demotion criteria) and lower queues risk starvation without aging mechanisms."
    }
  ]
};

export const mockAllRooms = [
  {
    id: "K7M4P2",
    name: "BCA 5th Semester - DBMS",
    subject: "Database Management System",
    instructor: "Alex Morgan",
    cohortCount: 42,
    passingRate: 94.2,
    status: "Active",
    liveExams: 2
  },
  {
    id: "X9J2R1",
    name: "CS 301 - Data Structures",
    subject: "Data Structures & Algorithms",
    instructor: "Dr. Sarah Chen",
    cohortCount: 64,
    passingRate: 88.5,
    status: "Inactive",
    liveExams: 0
  },
  {
    id: "B4N8M9",
    name: "BCA 3rd - Computer Networks",
    subject: "Computer Networks",
    instructor: "Prof. James Wilson",
    cohortCount: 58,
    passingRate: 91.0,
    status: "Live",
    liveExams: 1
  }
];

export const mockUpcomingExams = [
  {
    id: "exam-1",
    title: "Relational Algebra Midterm",
    roomName: "BCA 5th Semester - DBMS",
    roomId: "K7M4P2",
    date: "Today",
    time: "6:00 PM",
    duration: "20 Mins",
    details: "15 MCQs • Queries, Projections & Joins"
  },
  {
    id: "exam-2",
    title: "Graph Algorithms Quiz",
    roomName: "CS 301 - Data Structures",
    roomId: "X9J2R1",
    date: "Tomorrow",
    time: "10:00 AM",
    duration: "15 Mins",
    details: "10 MCQs • BFS, DFS, Dijkstra"
  },
  {
    id: "exam-3",
    title: "Subnetting Assignment",
    roomName: "BCA 3rd - Computer Networks",
    roomId: "B4N8M9",
    date: "Oct 15",
    time: "11:59 PM",
    duration: "30 Mins",
    details: "25 MCQs • IPv4 & IPv6 Subnetting"
  }
];
export const mockTestHistory = [
  {
    id: "hist-1",
    title: "DBMS Normalization Quiz",
    date: "Oct 1, 2025",
    room: "BCA 5th Semester - DBMS",
    score: "94%",
    percentile: "95th",
    topScorer: "Sophia Chen (98%)",
    passRate: 92,
    failRate: 8
  },
  {
    id: "hist-2",
    title: "Data Structures Midterm",
    date: "Sep 28, 2025",
    room: "CS 301 - Data Structures",
    score: "88%",
    percentile: "82nd",
    topScorer: "David Kim (100%)",
    passRate: 78,
    failRate: 22
  },
  {
    id: "hist-3",
    title: "Network Topologies Quiz",
    date: "Sep 15, 2025",
    room: "BCA 3rd - Computer Networks",
    score: "92%",
    percentile: "89th",
    topScorer: "Jordan Blake (96%)",
    passRate: 85,
    failRate: 15
  }
];

export const mockGlobalLeaderboard = [
  { rank: 1, id: "24BCA011", name: "David Kim", university: "MIT", score: 99.2, badges: ["Perfect Score", "Fastest"] },
  { rank: 2, id: "24BCA018", name: "Sophia Chen", university: "Stanford", score: 98.5, badges: ["Consistent"] },
  { rank: 3, id: "24BCA055", name: "Jordan Blake", university: "Oxford", score: 97.8, badges: ["Top 1%"] },
  { rank: 4, id: "24BCA042", name: "Elena Rostova", university: "MIT", score: 96.4, badges: [] },
  { rank: 5, id: "24BCA009", name: "Alex Rivera", university: "Stanford", score: 95.9, badges: [] },
];
