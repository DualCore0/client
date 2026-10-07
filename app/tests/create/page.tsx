"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { uploadDocument, generateAITest, publishTest, editQuestion, deleteQuestion } from "@/lib/api";

export default function CreateAITest() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [roomId, setRoomId] = useState("");

  useEffect(() => {
    const rid = searchParams.get("roomId");
    if (rid) setRoomId(rid);
  }, [searchParams]);

  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [docId, setDocId] = useState("");
  const [uploading, setUploading] = useState(false);

  const [testConfig, setTestConfig] = useState({
    title: "",
    duration: 30,
    questionCount: 5,
    difficulty: "medium",
  });
  const [generating, setGenerating] = useState(false);
  const [testData, setTestData] = useState<any>(null);
  const [toastMsg, setToastMsg] = useState("");

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3000);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !roomId) return alert("Please select a file and ensure you are in a valid room.");
    
    setUploading(true);
    try {
      const doc = await uploadDocument(roomId, file);
      setDocId(doc.id);
      showToast("Document processed successfully!");
      setStep(2);
    } catch (err: any) {
      alert(err.message || "Failed to upload document");
    } finally {
      setUploading(false);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docId) return alert("Document not found");
    setGenerating(true);
    try {
      const test = await generateAITest({
        roomId,
        documentId: docId,
        title: testConfig.title || "AI Generated Test",
        duration: testConfig.duration,
        questionCount: testConfig.questionCount,
        difficulty: testConfig.difficulty,
      });
      setTestData(test);
      setStep(3);
      showToast("Test generated successfully!");
    } catch (err: any) {
      alert(err.message || "Failed to generate test");
    } finally {
      setGenerating(false);
    }
  };

  const handleDeleteQ = async (qId: string) => {
    if (!confirm("Delete this question?")) return;
    try {
      await deleteQuestion(testData.id, qId);
      setTestData((prev: any) => ({
        ...prev,
        questions: prev.questions.filter((q: any) => q.id !== qId)
      }));
      showToast("Question deleted");
    } catch (err: any) {
      alert("Failed to delete question");
    }
  };

  const handlePublish = async () => {
    try {
      await publishTest(testData.id);
      showToast("Test published to Room!");
      setTimeout(() => {
        router.push(`/rooms/${roomId}`);
      }, 1000);
    } catch (err: any) {
      alert("Failed to publish test");
    }
  };

  return (
    <div className="flex flex-col w-full min-h-screen bg-surface pb-24">
      {toastMsg && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-inverse-surface text-inverse-on-surface px-4 py-2 rounded-lg shadow-lg font-body-sm text-sm">
          {toastMsg}
        </div>
      )}

      {/* Header */}
      <header className="fixed top-0 w-full z-40 pt-safe bg-surface/85 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="h-16 px-gutter-mobile flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 -ml-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-full transition-colors">
            <span className="material-symbols-outlined text-[24px]">arrow_back</span>
          </button>
          <div className="flex flex-col">
            <span className="font-label-mono-sm text-[10px] uppercase text-primary font-semibold tracking-wider">AI Wizard</span>
            <h1 className="font-headline-sm text-headline-sm text-on-surface leading-tight">Create Assessment</h1>
          </div>
        </div>
      </header>

      <div className="pt-24 px-margin-mobile flex flex-col max-w-md mx-auto w-full gap-6">
        
        {/* Progress Tracker */}
        <div className="flex items-center justify-between relative px-2">
          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-surface-container-high -z-10 -translate-y-1/2"></div>
          <div className="absolute top-1/2 left-0 h-0.5 bg-primary -z-10 -translate-y-1/2 transition-all duration-300" style={{ width: step === 1 ? '0%' : step === 2 ? '50%' : '100%' }}></div>
          
          {[1, 2, 3].map((s) => (
            <div key={s} className={`w-8 h-8 rounded-full flex items-center justify-center font-label-mono-sm text-sm font-bold transition-colors shadow-sm ${step >= s ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'}`}>
              {s}
            </div>
          ))}
        </div>

        {/* STEP 1: Upload */}
        {step === 1 && (
          <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm border border-surface-container animate-in fade-in slide-in-from-bottom-4">
            <h2 className="font-headline-sm text-lg text-on-surface mb-2">Step 1: Upload Context</h2>
            <p className="font-body-sm text-sm text-on-surface-variant mb-6">Upload a PDF document to generate questions from.</p>
            
            <form onSubmit={handleUpload} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-label-mono-sm text-xs uppercase text-secondary font-semibold tracking-wider">Target Room ID</label>
                <input 
                  type="text" 
                  required 
                  value={roomId}
                  onChange={e => setRoomId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-surface-container-low text-on-surface font-body-sm rounded-lg focus:outline-none focus:ring-1 focus:ring-primary border border-surface-container transition-all" 
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-label-mono-sm text-xs uppercase text-secondary font-semibold tracking-wider">PDF Material</label>
                <input 
                  type="file" 
                  accept="application/pdf"
                  required 
                  onChange={e => setFile(e.target.files?.[0] || null)}
                  className="w-full text-sm text-on-surface-variant file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 transition-all cursor-pointer bg-surface-container-low p-2 rounded-lg border border-surface-container"
                />
              </div>
              <button 
                type="submit" 
                disabled={uploading}
                className="w-full mt-2 h-11 bg-primary text-on-primary font-headline-sm text-sm rounded-lg shadow-md hover:bg-primary/95 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {uploading ? (
                  <><span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span> Processing Knowledge...</>
                ) : (
                  <>Continue <span className="material-symbols-outlined text-[18px]">arrow_forward</span></>
                )}
              </button>
            </form>
          </div>
        )}

        {/* STEP 2: Configure */}
        {step === 2 && (
          <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm border border-surface-container animate-in fade-in slide-in-from-bottom-4">
            <h2 className="font-headline-sm text-lg text-on-surface mb-2">Step 2: Generate Parameters</h2>
            <p className="font-body-sm text-sm text-on-surface-variant mb-6">Configure how the AI should generate your assessment.</p>
            
            <form onSubmit={handleGenerate} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-label-mono-sm text-xs uppercase text-secondary font-semibold tracking-wider">Test Title</label>
                <input 
                  type="text" 
                  required 
                  placeholder="e.g. Midterm Unit 1"
                  value={testConfig.title}
                  onChange={e => setTestConfig({...testConfig, title: e.target.value})}
                  className="w-full px-3 py-2.5 bg-surface-container-low text-on-surface font-body-sm rounded-lg focus:outline-none focus:ring-1 focus:ring-primary border border-surface-container transition-all" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="font-label-mono-sm text-xs uppercase text-secondary font-semibold tracking-wider">Questions</label>
                  <input 
                    type="number" 
                    required 
                    min={1}
                    max={20}
                    value={testConfig.questionCount}
                    onChange={e => setTestConfig({...testConfig, questionCount: parseInt(e.target.value)})}
                    className="w-full px-3 py-2.5 bg-surface-container-low text-on-surface font-body-sm rounded-lg focus:outline-none focus:ring-1 focus:ring-primary border border-surface-container transition-all" 
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-label-mono-sm text-xs uppercase text-secondary font-semibold tracking-wider">Duration (min)</label>
                  <input 
                    type="number" 
                    required
                    min={1} 
                    value={testConfig.duration}
                    onChange={e => setTestConfig({...testConfig, duration: parseInt(e.target.value)})}
                    className="w-full px-3 py-2.5 bg-surface-container-low text-on-surface font-body-sm rounded-lg focus:outline-none focus:ring-1 focus:ring-primary border border-surface-container transition-all" 
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-label-mono-sm text-xs uppercase text-secondary font-semibold tracking-wider">Difficulty Level</label>
                <div className="grid grid-cols-3 gap-2 bg-surface-container-low p-1.5 rounded-lg border border-surface-container">
                  {['easy', 'medium', 'hard'].map(level => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setTestConfig({...testConfig, difficulty: level})}
                      className={`py-1.5 rounded-md text-xs font-semibold uppercase tracking-wide transition-colors ${testConfig.difficulty === level ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              <button 
                type="submit" 
                disabled={generating}
                className="w-full mt-4 h-11 bg-primary text-on-primary font-headline-sm text-sm rounded-lg shadow-md hover:bg-primary/95 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {generating ? (
                  <><span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span> Generating with OpenRouter...</>
                ) : (
                  <>Generate Test <span className="material-symbols-outlined text-[18px]">magic_button</span></>
                )}
              </button>
            </form>
          </div>
        )}

        {/* STEP 3: Review */}
        {step === 3 && testData && (
          <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4">
            <div className="bg-surface-container-lowest p-5 rounded-xl shadow-sm border border-surface-container flex items-center justify-between">
              <div>
                <h2 className="font-headline-sm text-lg text-on-surface tracking-tight">{testData.title}</h2>
                <div className="flex items-center gap-2 text-on-surface-variant mt-1">
                  <span className="font-label-mono-sm text-[11px] uppercase">{testData.questions.length} Questions</span>
                  <span className="w-1 h-1 rounded-full bg-outline-variant"></span>
                  <span className="font-label-mono-sm text-[11px] uppercase">{testData.duration} Mins</span>
                </div>
              </div>
              <button 
                onClick={handlePublish}
                className="px-4 h-10 bg-tertiary text-on-tertiary font-headline-sm text-sm rounded-lg shadow-md hover:bg-tertiary/90 active:scale-95 transition-all flex items-center gap-2"
              >
                Publish <span className="material-symbols-outlined text-[16px]">send</span>
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {testData.questions.map((q: any, i: number) => (
                <div key={q.id} className="bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-surface-container relative">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <span className="w-7 h-7 shrink-0 rounded-full bg-primary/10 text-primary font-label-mono text-sm font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <p className="flex-1 font-body-md text-on-surface text-sm">{q.questionText}</p>
                    <button 
                      onClick={() => handleDeleteQ(q.id)}
                      className="text-error hover:bg-error-container/50 p-1.5 rounded-lg transition-colors shrink-0"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                  <div className="flex flex-col gap-2 pl-11">
                    {q.options.map((opt: string, optIdx: number) => (
                      <div key={optIdx} className={`p-2.5 rounded-lg border text-sm flex items-start gap-2 ${optIdx === q.correctAnswer ? 'bg-tertiary/5 border-tertiary text-on-surface font-medium' : 'bg-surface-container-lowest border-surface-container text-on-surface-variant'}`}>
                        <span className={`font-label-mono-sm text-[10px] w-4 shrink-0 flex items-center justify-center pt-0.5 ${optIdx === q.correctAnswer ? 'text-tertiary' : 'text-secondary'}`}>
                          {String.fromCharCode(65 + optIdx)}
                        </span>
                        <span>{opt}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
