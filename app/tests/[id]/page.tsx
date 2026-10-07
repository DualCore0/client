"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function TakeAssessment() {
  const router = useRouter();
  const params = useParams();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(25 * 60); // 25 minutes
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMsg, setToastMsg] = useState("");

  const [testData, setTestData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    import('../../../lib/api').then(({ getTestDetails }) => {
      getTestDetails(params.id as string).then(data => {
        setTestData(data);
        setLoading(false);
      }).catch(err => {
        console.error(err);
        setLoading(false);
      });
    });
  }, [params.id]);

  const currentQuestion = testData?.questions[currentQuestionIndex];

  useEffect(() => {
    // Exact end time based on real clock to prevent drift
    const endTime = Date.now() + 25 * 60 * 1000;
    
    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
      setTimeLeft(remaining);
      
      if (remaining <= 0) {
        clearInterval(timer);
      }
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const handleOptionSelect = (questionId: string, optionId: string) => {
    setSelectedOptions((prev) => ({ ...prev, [questionId]: optionId }));
  };

  if (loading || !testData) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-surface">
        <span className="material-symbols-outlined animate-spin text-[32px] text-primary">progress_activity</span>
      </div>
    );
  }

  const handleNext = () => {
    if (currentQuestionIndex < testData.questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
    }
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3200);
  };

  const handleSubmit = async () => {
    if (!confirm("Are you sure you want to submit your assessment?")) return;
    setIsSubmitting(true);
    showToast("Evaluating your answers...");
    
    try {
      const { submitTest } = await import('../../../lib/api');
      const formattedAnswers = Object.entries(selectedOptions).map(([qId, oId]) => ({
        questionId: qId,
        selectedOptionId: oId
      }));
      await submitTest(testData.id, formattedAnswers);
      showToast("Assessment Submitted Successfully!");
      setTimeout(() => {
        router.push("/dashboard");
      }, 1000);
    } catch (e) {
      console.error(e);
      alert("Failed to submit assessment.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col relative w-full min-h-screen bg-surface">
      {/* Fixed Header */}
      <header className="fixed top-0 w-full z-50 pt-safe bg-surface/95 backdrop-blur-md shadow-[0_1px_8px_rgba(15,23,42,0.04)] border-b border-surface-container-high/50">
        <div className="h-16 px-gutter-mobile flex items-center justify-between">
          <div className="flex flex-col min-w-0 pr-4">
            <span className="font-label-mono-sm text-[10px] uppercase text-primary font-semibold tracking-wide truncate">
              {testData.title}
            </span>
            <h1 className="font-headline-sm text-[15px] text-on-surface leading-tight truncate">
              Student Assessment
            </h1>
          </div>
          <div className="flex items-center gap-2 bg-surface-container-low px-3 py-1.5 rounded-lg shrink-0">
            <span className="material-symbols-outlined text-[16px] text-error">timer</span>
            <span className={`font-stat-mono-lg text-[15px] font-bold ${timeLeft < 300 ? 'text-error animate-pulse' : 'text-on-surface'}`}>
              {formatTime(timeLeft)}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full pt-24 pb-32 px-gutter-mobile max-w-3xl mx-auto flex flex-col gap-6">
        
        {/* Progress Bar */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="font-label-mono-sm text-[12px] text-secondary font-medium">
              Question {currentQuestionIndex + 1} of {testData.questions.length}
            </span>
            <span className="font-label-mono-sm text-[12px] text-primary font-medium">
              {Math.round(((currentQuestionIndex + 1) / testData.questions.length) * 100)}% Completed
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-surface-container-high overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${((currentQuestionIndex + 1) / testData.questions.length) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Question Card */}
        <article className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-surface-container flex flex-col gap-6 animate-in slide-in-from-right-4 duration-300">
          <div className="flex items-start justify-between gap-4">
            <span className="font-label-mono-sm text-[13px] font-bold bg-primary/10 text-primary px-3 py-1 rounded-lg shrink-0">
              {currentQuestion.number}
            </span>
            <span className="font-label-mono-sm text-[12px] font-medium text-secondary bg-surface-container-low px-2 py-1 rounded">
              {currentQuestion.points} points
            </span>
          </div>
          
          <h2 className="font-body-lg text-[17px] text-on-surface font-semibold leading-snug">
            {currentQuestion.text}
          </h2>

          <div className="flex flex-col gap-3 mt-2">
            {currentQuestion.options.map((opt) => {
              const isSelected = selectedOptions[currentQuestion.id] === opt.id;
              return (
                <label 
                  key={opt.id} 
                  className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all active:scale-[0.99] ${
                    isSelected 
                      ? 'border-primary bg-primary/5 shadow-sm' 
                      : 'border-surface-container bg-surface-container-low hover:border-outline-variant hover:bg-surface-container'
                  }`}
                >
                  <input 
                    type="radio" 
                    name={currentQuestion.id} 
                    className="sr-only"
                    checked={isSelected}
                    onChange={() => handleOptionSelect(currentQuestion.id, opt.id)}
                  />
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center font-label-mono-sm text-[12px] font-bold shrink-0 mt-0.5 ${
                    isSelected ? 'bg-primary text-on-primary' : 'bg-surface-container-highest text-on-surface'
                  }`}>
                    {opt.label}
                  </span>
                  <span className={`font-body-md text-[15px] pt-0.5 ${isSelected ? 'text-on-surface font-medium' : 'text-on-surface-variant'}`}>
                    {opt.text}
                  </span>
                </label>
              );
            })}
          </div>
        </article>

      </main>
      
      {/* Fixed Bottom Action Bar */}
      <div className="fixed bottom-0 inset-x-0 z-40 bg-surface/95 backdrop-blur-md pt-3 pb-6 px-gutter-mobile border-t border-surface-container-high/50">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <button 
            onClick={handlePrev}
            disabled={currentQuestionIndex === 0}
            className="flex-1 h-12 bg-surface-container-low hover:bg-surface-container disabled:opacity-50 text-on-surface rounded-xl font-headline-sm text-[15px] font-medium flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Previous
          </button>
          
          {currentQuestionIndex < testData.questions.length - 1 ? (
            <button 
              onClick={handleNext}
              className="flex-1 h-12 bg-primary hover:bg-primary-container text-on-primary rounded-xl font-headline-sm text-[15px] font-medium flex items-center justify-center gap-2 transition-all shadow-sm active:scale-[0.98]"
            >
              Next
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          ) : (
            <button 
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 h-12 bg-tertiary hover:bg-tertiary/90 text-on-tertiary rounded-xl font-headline-sm text-[15px] font-semibold flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.98] disabled:opacity-70"
            >
              {isSubmitting ? 'Evaluating...' : 'Submit Assessment'}
              {!isSubmitting && <span className="material-symbols-outlined text-[18px]">send</span>}
            </button>
          )}
        </div>
      </div>

      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] bg-inverse-surface text-inverse-on-surface rounded-lg p-3 shadow-xl flex items-center justify-center gap-2 animate-in fade-in zoom-in-95 duration-200">
          <span className="material-symbols-outlined text-tertiary-fixed text-[20px] animate-spin">sync</span>
          <span className="font-body-sm text-[14px] font-medium pr-2">{toastMsg}</span>
        </div>
      )}

    </div>
  );
}
