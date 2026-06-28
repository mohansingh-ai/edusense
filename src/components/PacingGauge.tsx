import { AIRecommendationResponse } from "../types";
import { Gauge, Milestone, Sparkles, Sliders, HelpCircle } from "lucide-react";

interface PacingGaugeProps {
  recommendation: AIRecommendationResponse | null;
  loading: boolean;
  onRefresh: () => void;
  thresholdType: 'percent' | 'count';
  setThresholdType: (type: 'percent' | 'count') => void;
  thresholdValue: number;
  setThresholdValue: (value: number) => void;
  lowAttentionCount: number;
  totalStudents: number;
}

export default function PacingGauge({
  recommendation,
  loading,
  onRefresh,
  thresholdType,
  setThresholdType,
  thresholdValue,
  setThresholdValue,
  lowAttentionCount,
  totalStudents
}: PacingGaugeProps) {
  const isClassInProgress = totalStudents > 0;

  const activeStrategy = isClassInProgress
    ? (recommendation?.recommendedStrategy || "Direct Lecture")
    : "No Class in Progress";

  const activePacing = isClassInProgress
    ? (recommendation?.optimalPacing || "normal")
    : "none";

  const activeExplanation = isClassInProgress
    ? (recommendation?.explanation || "Awaiting sensor telemetry. Standard classroom delivery rules active.")
    : "No active student check-ins detected. Waiting for class commencement.";

  const activeScript = isClassInProgress
    ? (recommendation?.suggestedAction || "Proceed with slides normally. Ensure major outline titles are presented.")
    : "The adaptive strategy engine requires at least one checked-in student to begin evaluation.";

  const activeKeys = isClassInProgress
    ? (recommendation?.reasoningKeys || ["static_baseline"])
    : ["no_active_students", "awaiting_checkins"];

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex flex-col justify-between space-y-6 text-left text-gray-800">
      {/* Block Header */}
      <div className="flex items-center justify-between border-b border-gray-150 pb-4">
        <div className="flex items-center gap-2">
          <div className="bg-blue-50 border border-blue-150 p-2 rounded-lg text-blue-600">
            <Gauge className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-sans font-semibold text-gray-900 text-sm uppercase tracking-tight">Pedagogical AI Advisor</h3>
            <p className="text-[10px] text-gray-400 font-mono uppercase tracking-wider">Reinforcement Learning Loop</p>
          </div>
        </div>

        <button
          onClick={onRefresh}
          disabled={loading}
          className="text-[10px] font-sans font-bold uppercase bg-blue-50 hover:bg-blue-100 text-blue-600 px-3.5 py-2 rounded-lg border border-blue-200 transition-all cursor-pointer disabled:opacity-50"
        >
          {loading ? "Evaluating..." : "Evaluate Policy"}
        </button>
      </div>

      {/* Main Stats Display Split */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
        {/* Visual Gauge */}
        <div className="flex flex-col items-center justify-center p-4 bg-gray-50 rounded-xl border border-gray-200 relative overflow-hidden">
          <div className="w-24 h-24 rounded-full border-8 border-gray-200 flex items-center justify-center relative">
            <div className={`w-20 h-20 rounded-full border-t-8 border-r-8 absolute -top-1 -right-1 transition-all ${
              activePacing === 'slow' 
                ? 'border-amber-500 rotate-0' 
                : activePacing === 'fast' 
                ? 'border-red-500 rotate-90' 
                : activePacing === 'none'
                ? 'border-gray-200 opacity-20 rotate-45'
                : 'border-emerald-500 rotate-45'
            }`} />
            
            <div className="text-center z-10">
              <span className="text-[9px] uppercase font-mono font-bold text-gray-400">Pacing</span>
              <p className={`text-xs font-bold uppercase ${
                activePacing === 'slow' 
                  ? 'text-amber-600' 
                  : activePacing === 'fast' 
                  ? 'text-red-600' 
                  : activePacing === 'none'
                  ? 'text-gray-400'
                  : 'text-emerald-600'
              }`}>
                {activePacing === 'none' ? "--" : activePacing}
              </p>
            </div>
          </div>
          
          <span className="text-[9px] font-mono font-bold text-gray-500 mt-3 uppercase tracking-widest">
            {isClassInProgress ? "Speed Recommendation" : "Awaiting Session"}
          </span>
        </div>

        {/* Action Suggestion */}
        <div className="space-y-3">
          <div>
            <span className={`text-[10px] uppercase font-sans border px-2.5 py-0.5 rounded-full font-bold ${
              isClassInProgress 
                ? "bg-blue-50 border-blue-200 text-blue-650" 
                : "bg-gray-100 border-gray-200 text-gray-400"
            }`}>
              {isClassInProgress ? `Strategy: ${activeStrategy}` : activeStrategy}
            </span>
            <p className="text-xs text-gray-500 mt-2.5 italic leading-relaxed font-sans">
              "{activeExplanation}"
            </p>
          </div>

          <div className="flex flex-wrap gap-1">
            {activeKeys.map((key) => (
              <span
                key={key}
                className="bg-gray-100 text-gray-550 text-[9px] font-mono border border-gray-200 px-2 py-0.5 rounded uppercase"
              >
                #{key.toLowerCase()}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Real-time Distraction Alert Trigger Configuration */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3 shadow-inner">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-[10px] font-mono tracking-wider text-gray-700 font-bold uppercase">Distraction Alert Rules</span>
          </div>
          <span className="text-[9px] font-mono font-semibold text-gray-500 uppercase tracking-widest bg-white px-2 py-0.5 rounded border border-gray-200">
            {lowAttentionCount} of {totalStudents} Distracted
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-baseline sm:items-center justify-between gap-3 pt-1">
          {/* Threshold Type Toggles */}
          <div className="flex items-center bg-gray-200 rounded-lg p-0.5 border border-gray-300">
            <button
              type="button"
              onClick={() => {
                setThresholdType('percent');
                setThresholdValue(25);
              }}
              className={`text-[9px] font-mono uppercase tracking-wider font-bold px-3 py-1 rounded-md transition-all cursor-pointer ${
                thresholdType === 'percent'
                  ? 'bg-white text-blue-600 shadow-sm border border-gray-200'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              % Percent
            </button>
            <button
              type="button"
              onClick={() => {
                setThresholdType('count');
                setThresholdValue(25);
              }}
              className={`text-[9px] font-mono uppercase tracking-wider font-bold px-3 py-1 rounded-md transition-all cursor-pointer ${
                thresholdType === 'count'
                  ? 'bg-white text-blue-600 shadow-sm border border-gray-200'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              # Student Count
            </button>
          </div>

          {/* Quick preset buttons */}
          <div className="flex items-center gap-1.5">
            <span className="text-[8px] font-mono text-gray-400 uppercase">Presets:</span>
            {thresholdType === 'percent' ? (
              [10, 25, 50, 75].map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setThresholdValue(p)}
                  className={`text-[9px] font-mono px-2 py-0.5 rounded border transition-all cursor-pointer ${
                    thresholdValue === p
                      ? 'bg-blue-50 border-blue-300 text-blue-650'
                      : 'bg-white border-gray-200 text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {p}%
                </button>
              ))
            ) : (
              [1, 5, 10, 25].map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setThresholdValue(c)}
                  className={`text-[9px] font-mono px-2 py-0.5 rounded border transition-all cursor-pointer ${
                    thresholdValue === c
                      ? 'bg-blue-50 border-blue-300 text-blue-650'
                      : 'bg-white border-gray-200 text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {c}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Action input slider */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-[10px] font-mono text-gray-500 uppercase">
            <span>Crisis Trigger Level</span>
            <span className="font-bold text-blue-600">
              {thresholdType === 'percent' ? `${thresholdValue}% of class` : `${thresholdValue} student${thresholdValue !== 1 ? 's' : ''}`}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={thresholdType === 'percent' ? 5 : 1}
              max={thresholdType === 'percent' ? 100 : 50}
              step={1}
              value={thresholdValue}
              onChange={(e) => setThresholdValue(Number(e.target.value))}
              className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>
          <p className="text-[8px] text-gray-400 font-sans italic leading-relaxed">
            {thresholdType === 'percent'
              ? `* Flags Attention Crisis when at least ${thresholdValue}% of active checked-in students drop below 50% attention.`
              : `* Flags Attention Crisis when at least ${thresholdValue} active checked-in student${thresholdValue !== 1 ? 's drop' : ' drops'} below 50% attention.`}
          </p>
        </div>
      </div>

      {/* Script Section */}
      <div className="bg-blue-50/50 text-gray-800 rounded-xl p-4 border border-blue-150 space-y-2 relative shadow-inner">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
          <span className="text-[9px] font-mono tracking-wider text-blue-600 font-bold uppercase">Smart Script Guide</span>
        </div>
        <p className="text-xs text-gray-650 font-sans leading-relaxed">
          {activeScript}
        </p>
      </div>
    </div>
  );
}
