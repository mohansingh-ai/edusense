import React, { useState, useEffect } from "react";
import { db, handleFirestoreError, OperationType } from "../firebase";
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
  addDoc,
  where,
  getDocs,
  getDoc,
  arrayUnion
} from "firebase/firestore";
import { ClassroomSession, TimelineMetric, StudentAlert, StudentAttendance, AIRecommendationResponse, StudentLearningProfile } from "../types";
import PacingGauge from "./PacingGauge";
import { Play, StopCircle, Users, Activity, Heart, ShieldAlert, Sparkles, CheckCircle2, RefreshCw, Copy, Check, Link, Send, User, BookUser, TrendingUp, BarChart2 } from "lucide-react";

interface SessionDashboardProps {
  instructorId: string;
  instructorName: string;
  instructorEmail: string;
}

export default function SessionDashboard({ instructorId, instructorName, instructorEmail }: SessionDashboardProps) {
  const [activeSession, setActiveSession] = useState<ClassroomSession | null>(null);
  const [sessionTitle, setSessionTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  // Tabs for Google Classroom layout
  const [currentSubTab, setCurrentSubTab] = useState<'stream' | 'metrics' | 'people' | 'profiles'>('metrics');

  // My Students Overview (pre-session) — load from studentProfiles
  const [myStudentsProfiles, setMyStudentsProfiles] = useState<StudentLearningProfile[]>([]);

  const handleCopyLink = () => {
    if (!activeSession) return;
    const shareUrl = `${window.location.origin}?room=${activeSession.id}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch((err) => {
      console.error("Failed to copy link:", err);
    });
  };

  // Live real-time synced records
  const [attendance, setAttendance] = useState<StudentAttendance[]>([]);
  const [timeline, setTimeline] = useState<TimelineMetric[]>([]);
  const [alerts, setAlerts] = useState<StudentAlert[]>([]);

  // Statistics summaries
  const [avgAttention, setAvgAttention] = useState(85);
  const [avgEngagement, setAvgEngagement] = useState(80);
  const [avgConfusion, setAvgConfusion] = useState(15);

  // AI recommendations & feedback
  const [recommendation, setRecommendation] = useState<AIRecommendationResponse | null>(null);
  const [thresholdType, setThresholdType] = useState<'percent' | 'count'>('percent');
  const [thresholdValue, setThresholdValue] = useState<number>(25);
  const [evaluatingPolicy, setEvaluatingPolicy] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [summaryReport, setSummaryReport] = useState<string | null>(null);

  // Assigned courses validation states
  const [assignedCourses, setAssignedCourses] = useState<any[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");

  // Sync instructor's assigned courses from the catalog
  useEffect(() => {
    if (!instructorId) return;
    const q = collection(db, "courses");
    const unsub = onSnapshot(q, (snap) => {
      const list: any[] = [];
      snap.forEach(d => {
        const data = d.data();
        const matchesMe = (data.teacherId === instructorId) || 
                          (data.teacherEmail && instructorEmail && data.teacherEmail.toLowerCase() === instructorEmail.toLowerCase());
        if (matchesMe) {
          list.push({ ...data, id: d.id });
        }
      });
      setAssignedCourses(list);
    }, (err) => {
      console.warn("Instructor courses load failed:", err);
      setAssignedCourses([]);
    });
    return () => unsub();
  }, [instructorId, instructorEmail]);

  // Recover any pre-existing active session for this instructor on mount
  useEffect(() => {
    if (!instructorId || activeSession) return;

    const recoverActiveSession = async () => {
      try {
        const q = query(
          collection(db, "sessions"),
          where("instructorId", "==", instructorId),
          where("status", "==", "active")
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          // Recover the first matched active session
          const matchedSession = { ...snap.docs[0].data(), id: snap.docs[0].id } as ClassroomSession;
          setActiveSession(matchedSession);
          setSessionTitle(matchedSession.title);
          setSelectedCourseId(matchedSession.courseId || "");
          console.log("Automatically recovered active session:", matchedSession.id);
        }
      } catch (err) {
        console.warn("Could not check for active sessions to recover:", err);
      }
    };

    recoverActiveSession();
  }, [instructorId]);

  // Load cumulative student profiles for this instructor (pre-session overview)
  useEffect(() => {
    if (!instructorId) return;
    const q = query(collection(db, "studentProfiles"), where("instructorIds", "array-contains", instructorId));
    const unsub = onSnapshot(q, (snap) => {
      const list: StudentLearningProfile[] = [];
      snap.forEach(d => list.push({ ...d.data() } as StudentLearningProfile));
      list.sort((a, b) => {
        const avgA = a.totalSessionsAttended > 0 ? a.totalAttentionSum / a.totalSessionsAttended : 0;
        const avgB = b.totalSessionsAttended > 0 ? b.totalAttentionSum / b.totalSessionsAttended : 0;
        return avgA - avgB; // lowest attention first
      });
      setMyStudentsProfiles(list);
    }, (err) => {
      console.warn("Could not load student profiles:", err);
      setMyStudentsProfiles([]);
    });
    return () => unsub();
  }, [instructorId]);

  // Restore active course selection if stored in localStorage
  useEffect(() => {
    const savedCourseId = localStorage.getItem("selected_course_id");
    if (savedCourseId) {
      setSelectedCourseId(savedCourseId);
      localStorage.removeItem("selected_course_id");
    }
  }, [assignedCourses]);

  // Stabilize listeners using refs to prevent loops
  const avgAttentionRef = React.useRef(avgAttention);
  const avgEngagementRef = React.useRef(avgEngagement);
  const alertsRef = React.useRef(alerts);

  React.useEffect(() => {
    avgAttentionRef.current = avgAttention;
  }, [avgAttention]);

  React.useEffect(() => {
    avgEngagementRef.current = avgEngagement;
  }, [avgEngagement]);

  React.useEffect(() => {
    alertsRef.current = alerts;
  }, [alerts]);

  // Load and listen to active classroom snapshot when session starts
  useEffect(() => {
    if (!activeSession) return;

    // Listen to attendance snapshot
    const attendRef = collection(db, "sessions", activeSession.id, "attendance");
    const unsubscribeAttendance = onSnapshot(attendRef, (snap) => {
      const records: StudentAttendance[] = [];
      snap.forEach((doc) => {
        const data = doc.data() as StudentAttendance;
        if (data.status === "present") {
          records.push(data);
        }
      });
      setAttendance(records);

      const onlineRecords = records.filter(r => {
        if (!r.lastActiveAt) return true;
        const lastMs = typeof r.lastActiveAt.toDate === "function"
          ? r.lastActiveAt.toDate().getTime()
          : new Date(r.lastActiveAt).getTime();
        const diff = Date.now() - lastMs;
        return diff >= -5000 && diff < 20000;
      });

      if (onlineRecords.length > 0) {
        const sumAtt = onlineRecords.reduce((acc, r) => acc + (r.averageAttention || 0), 0);
        const sumEng = onlineRecords.reduce((acc, r) => acc + (r.activeParticipationScore || 0), 0);
        const sumConf = onlineRecords.reduce((acc, r) => acc + ((r as any).confusion || 0), 0);
        setAvgAttention(Math.round(sumAtt / onlineRecords.length));
        setAvgEngagement(Math.round(sumEng / onlineRecords.length));
        setAvgConfusion(Math.round(sumConf / onlineRecords.length));
      } else {
        setAvgAttention(0);
        setAvgEngagement(0);
        setAvgConfusion(0);
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, `sessions/${activeSession.id}/attendance`));

    // Listen to timeline log collection
    const timelineRef = collection(db, "sessions", activeSession.id, "timeline");
    const unsubscribeTimeline = onSnapshot(timelineRef, (snap) => {
      const records: TimelineMetric[] = [];
      snap.forEach((doc) => records.push({ ...doc.data(), id: doc.id } as TimelineMetric));
      records.sort((a,b) => {
        const aT = a.timestamp?.seconds || (a.id ? Number(a.id.split('_')[1]) / 1000 : 0) || Date.now() / 1000;
        const bT = b.timestamp?.seconds || (b.id ? Number(b.id.split('_')[1]) / 1000 : 0) || Date.now() / 1000;
        return aT - bT;
      });
      setTimeline(records);
    }, (err) => handleFirestoreError(err, OperationType.GET, `sessions/${activeSession.id}/timeline`));

    // Listen to active warnings/alerts
    const alertsRefObj = collection(db, "sessions", activeSession.id, "alerts");
    const unsubscribeAlerts = onSnapshot(alertsRefObj, (snap) => {
      const records: StudentAlert[] = [];
      snap.forEach((doc) => records.push({ ...doc.data(), id: doc.id } as StudentAlert));
      records.sort((a,b) => {
        const aT = a.timestamp?.seconds || 0;
        const bT = b.timestamp?.seconds || 0;
        return bT - aT;
      });
      setAlerts(records);

      const unresolvedCount = records.filter(a => !a.resolved).length;
    }, (err) => handleFirestoreError(err, OperationType.GET, `sessions/${activeSession.id}/alerts`));

    // Heartbeat emitter updates lastActive every 5 seconds
    const heartbeatInterval = setInterval(async () => {
      try {
        await updateDoc(doc(db, "sessions", activeSession.id), {
          instructorLastActive: Date.now(),
          instructorPresent: true
        });
      } catch (err) {
        console.warn("Heartbeat write failed:", err);
      }
    }, 5000);

    // Simulated timeline ticks every 7 seconds
    const cronInterval = setInterval(async () => {
      const currentAvgAttention = avgAttentionRef.current;
      const currentAvgEngagement = avgEngagementRef.current;
      const currentAlerts = alertsRef.current;

      const randAttention = Math.max(20, Math.min(100, currentAvgAttention + Math.round((Math.random() - 0.5) * 10)));
      const randEngagement = Math.max(20, Math.min(100, currentAvgEngagement + Math.round((Math.random() - 0.5) * 10)));
      const activeUnresolvedCount = currentAlerts.filter(a => !a.resolved).length * 12;
      const baseConfusion = Math.min(100, Math.max(0, Math.round(15 + activeUnresolvedCount + (Math.random() - 0.5) * 8)));

      const timelineId = `tick_${Date.now()}`;
      try {
        await setDoc(doc(db, "sessions", activeSession.id, "timeline", timelineId), {
          sessionId: activeSession.id,
          attention: randAttention,
          engagement: randEngagement,
          confusion: baseConfusion,
          timestamp: serverTimestamp()
        });
      } catch (error) {
        // Warning log ignored
      }
    }, 7000);

    return () => {
      unsubscribeAttendance();
      unsubscribeTimeline();
      unsubscribeAlerts();
      clearInterval(cronInterval);
      clearInterval(heartbeatInterval);

      // Mark instructor as absent when leaving the dashboard tab
      updateDoc(doc(db, "sessions", activeSession.id), {
        instructorPresent: false
      }).catch((err) => console.warn("Instructor leave status update failed:", err));
    };
  }, [activeSession]);

  // Auto-restore disabled by user preference to prevent loading stale active sessions on login

  // Create session trigger
  const handleLaunchSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionTitle.trim()) return;
    if (!selectedCourseId) {
      alert("Please select one of your assigned courses to launch this classroom session.");
      return;
    }

    setCreating(true);
    const mockId = `session_${Date.now()}`;
    const matchedCourse = assignedCourses.find(c => c.id === selectedCourseId);

    const isTeacher = matchedCourse && (
      (matchedCourse.teacherId === instructorId) ||
      (matchedCourse.teacherEmail && instructorEmail && matchedCourse.teacherEmail.toLowerCase() === instructorEmail.toLowerCase())
    );

    if (!matchedCourse || !isTeacher) {
      alert("Error: You are not the assigned instructor for this course.");
      setCreating(false);
      return;
    }

    const docPayload: any = {
      id: mockId,
      title: sessionTitle.trim(),
      instructorId,
      instructorName,
      status: "active" as const,
      createdAt: serverTimestamp(),
      instructorPresent: true,
      instructorLastActive: Date.now()
    };

    if (matchedCourse) {
      docPayload.courseId = matchedCourse.id;
      docPayload.courseCode = matchedCourse.code;
    }

    try {
      // Clear all state variables before launching the new session
      setAttendance([]);
      setTimeline([]);
      setAlerts([]);
      setAvgAttention(85);
      setAvgEngagement(80);
      setAvgConfusion(15);
      setRecommendation(null);
      setSummaryReport(null);

      await setDoc(doc(db, "sessions", mockId), docPayload);
      setActiveSession({
        ...docPayload,
        createdAt: new Date()
      } as ClassroomSession);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `sessions/${mockId}`);
    } finally {
      setCreating(false);
    }
  };

  // Resolve Student Alert state in real-time
  const handleResolveAlert = async (alertId: string) => {
    if (!activeSession) return;
    const path = `sessions/${activeSession.id}/alerts/${alertId}`;
    try {
      await updateDoc(doc(db, "sessions", activeSession.id, "alerts", alertId), {
        resolved: true
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };



  // Evaluate optimal instruction strategy using Express server endpoint
  const handleEvaluateRLPolicy = async () => {
    if (!activeSession) return;

    setEvaluatingPolicy(true);
    try {
      const lowAttCount = attendance.filter(r => (r.averageAttention ?? 0) < 50).length;
      const ratioLowAtt = attendance.length > 0 ? (lowAttCount / attendance.length) : 0;
      const isCrisis = thresholdType === 'percent'
        ? (attendance.length > 0 && ratioLowAtt >= (thresholdValue / 100))
        : (lowAttCount >= thresholdValue);

      const studentCommentsList: string[] = [];

      const response = await fetch("/api/teaching-strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: activeSession.id,
          title: activeSession.title,
          latestAttention: avgAttention,
          latestEngagement: avgEngagement,
          latestConfusion: avgConfusion,
          currentStrategy: recommendation?.recommendedStrategy || "Direct Lecture",
          alertCount: alerts.filter(a => !a.resolved).length,
          studentComments: studentCommentsList.length > 0 ? studentCommentsList : ["Pacing is normal."],
          attendanceCount: attendance.length,
          lowAttentionCount: lowAttCount,
          ratioLowAttention: ratioLowAtt,
          attentionCrisis: isCrisis
        })
      });

      if (response.ok) {
        const data = await response.json();
        setRecommendation(data);
        
        await updateDoc(doc(db, "sessions", activeSession.id), {
          teachingStrategy: data.recommendedStrategy,
          currentPacing: data.optimalPacing
        });
      }
    } catch (e) {
      console.warn("Express RL endpoint error, applying local rule evaluation.", e);
    } finally {
      setEvaluatingPolicy(false);
    }
  };

  // Automatically evaluate policy in real-time
  useEffect(() => {
    if (!activeSession) {
      setRecommendation(null);
      return;
    }

    const onlineStudents = attendance.filter(r => {
      if (!r.lastActiveAt) return true;
      const lastMs = typeof r.lastActiveAt.toDate === "function"
        ? r.lastActiveAt.toDate().getTime()
        : new Date(r.lastActiveAt).getTime();
      const diff = Date.now() - lastMs;
      return diff >= -5000 && diff < 20000;
    });

    const lowAttentionStudents = onlineStudents.filter(r => (r.averageAttention ?? 0) < 50);
    const ratioLowAttention = onlineStudents.length > 0 ? (lowAttentionStudents.length / onlineStudents.length) : 0;
    
    let attentionCrisis = false;
    let thresholdLabel = `${thresholdValue}%`;
    if (thresholdType === 'percent') {
      attentionCrisis = onlineStudents.length > 0 && ratioLowAttention >= (thresholdValue / 100);
      thresholdLabel = `${thresholdValue}%`;
    } else {
      attentionCrisis = lowAttentionStudents.length >= thresholdValue;
      thresholdLabel = `${thresholdValue} students`;
    }

    if (attentionCrisis) {
      setRecommendation({
        recommendedStrategy: "CRITICAL: STOP LECTURE",
        explanation: `ATTENTION CRISIS FLAGGED! ${
          thresholdType === 'percent'
            ? `${Math.round(ratioLowAttention * 100)}% of your students (threshold: ${thresholdLabel})`
            : `${lowAttentionStudents.length} of your students (threshold: ${thresholdLabel})`
        } have attention levels below 50%. The students are not giving attention!`,
        suggestedAction: "⚠️ STUDENTS ARE NOT GIVING ATTENTION! Stop teaching and cease slide delivery immediately. Try these creative methods to attract their attention back:\n\n1. 🧘 Conduct a prompt 60-second mindfulness breathing cycle or a physical stretch.\n2. ❓ Fire up a rapid interactive multiple-choice check-in question or a funny trivia poll.\n3. 🗣️ Modulate your voice pitch, use rich screen examples, or ask a specific group a simple real-world riddle to re-mobilize the room.",
        optimalPacing: "slow",
        reasoningKeys: ["attention_crisis", "stop_teaching", "restore_focus"]
      });
    } else if (avgConfusion > 45) {
      setRecommendation({
        recommendedStrategy: "REINFORCE CONCEPTS",
        explanation: `High class confusion index is flagged (${avgConfusion}%). Lecture pacing is too fast or concepts are not landing.`,
        suggestedAction: "Pause your slide presentation. Draw a step-by-step visual diagram on the virtual whiteboard, or ask a student directly to highlight the confusing parts before advancing.",
        optimalPacing: "slow",
        reasoningKeys: ["high_confusion", "re-explain_concepts"]
      });
    } else if (onlineStudents.length > 0) {
      setRecommendation({
        recommendedStrategy: "Direct Lecture (Optimal)",
        explanation: `Interactive signals are completely stable. Average Attention is ${avgAttention}% and Participation is ${avgEngagement}%.`,
        suggestedAction: "Maintain your presenting speed. Major chapter titles are currently highly optimized and fully landing.",
        optimalPacing: "normal",
        reasoningKeys: ["stable_baseline", "keep_moving"]
      });
    } else {
      setRecommendation({
        recommendedStrategy: "Awaiting Students Check-In",
        explanation: "No students have checked in to your session yet.",
        suggestedAction: "Copy the direct share link above and distribute it to your class. Synced gaze tracker metrics will populate instantly.",
        optimalPacing: "normal",
        reasoningKeys: ["empty_classroom"]
      });
    }
  }, [attendance, avgAttention, avgEngagement, avgConfusion, activeSession, thresholdType, thresholdValue]);

  // End Session and generate complete AI Markdown review
  const handleEndSession = async () => {
    if (!activeSession) return;

    setSummarizing(true);
    const finishTimestamp = new Date();
    try {
      await updateDoc(doc(db, "sessions", activeSession.id), {
        status: "completed",
        completedAt: finishTimestamp,
        instructorPresent: false
      });

      // Persist cumulative student learning profiles to Firestore
      try {
        const attSnap2 = await getDocs(collection(db, "sessions", activeSession.id, "attendance"));
        const sessionAlerts = alerts; // capture current alerts state

        for (const attDoc of attSnap2.docs) {
          const attData = attDoc.data() as StudentAttendance;
          if (!attData.studentId) continue;

          const studentAlerts = sessionAlerts.filter(a => a.studentId === attData.studentId);
          const resolvedCount = studentAlerts.filter(a => a.resolved).length;
          const totalCount = studentAlerts.length;

          const profileRef = doc(db, "studentProfiles", attData.studentId);
          const existingSnap = await getDoc(profileRef);

          if (existingSnap.exists()) {
            const existing = existingSnap.data() as StudentLearningProfile;
            const newCourseIds = activeSession.courseId
              ? Array.from(new Set([...(existing.courseIds || []), activeSession.courseId]))
              : existing.courseIds || [];
            const newInstructorIds = Array.from(new Set([...(existing.instructorIds || []), instructorId]));

            await setDoc(profileRef, {
              studentId: attData.studentId,
              studentName: attData.studentName,
              totalSessionsAttended: (existing.totalSessionsAttended || 0) + 1,
              totalAttentionSum: (existing.totalAttentionSum || 0) + (attData.averageAttention || 0),
              totalEngagementSum: (existing.totalEngagementSum || 0) + (attData.activeParticipationScore || 0),
              totalConfusionSum: (existing.totalConfusionSum || 0) + avgConfusion,
              totalAlertsTriggered: (existing.totalAlertsTriggered || 0) + totalCount,
              totalAlertsResolved: (existing.totalAlertsResolved || 0) + resolvedCount,
              lastUpdatedAt: serverTimestamp(),
              lastSessionId: activeSession.id,
              courseIds: newCourseIds,
              instructorIds: newInstructorIds,
            }, { merge: true });
          } else {
            await setDoc(profileRef, {
              studentId: attData.studentId,
              studentName: attData.studentName,
              totalSessionsAttended: 1,
              totalAttentionSum: attData.averageAttention || 0,
              totalEngagementSum: attData.activeParticipationScore || 0,
              totalConfusionSum: avgConfusion,
              totalAlertsTriggered: totalCount,
              totalAlertsResolved: resolvedCount,
              lastUpdatedAt: serverTimestamp(),
              lastSessionId: activeSession.id,
              courseIds: activeSession.courseId ? [activeSession.courseId] : [],
              instructorIds: [instructorId],
            });
          }
        }
      } catch (profileErr) {
        console.warn("Could not persist student learning profiles:", profileErr);
      }

      // Clear student attendance so they don't remain stuck
      const attSnap = await getDocs(collection(db, "sessions", activeSession.id, "attendance"));
      for (const attDoc of attSnap.docs) {
        await updateDoc(doc(db, "sessions", activeSession.id, "attendance", attDoc.id), {
          status: "absent"
        });
      }

      // Submit to Gemini API Summary Route
      let generatedFeedback = "AI Pedagogical summary feedback is currently unavailable (GEMINI_API_KEY is not configured on the server).";
      try {
        const response = await fetch("/api/session-summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionTitle: activeSession.title,
            attendanceCount: attendance.length,
            averageAttention: avgAttention,
            averageEngagement: avgEngagement,
            averageConfusion: avgConfusion,
            timelineLogs: timeline.map(t => ({
              time: t.timestamp ? new Date(t.timestamp.seconds * 1000).toLocaleTimeString() : "",
              attention: t.attention,
              engagement: t.engagement,
              confusion: t.confusion
            }))
          })
        });

        if (response.ok) {
          const data = await response.json();
          generatedFeedback = data.feedback;
          setSummaryReport(data.feedback);
          
          await updateDoc(doc(db, "sessions", activeSession.id), {
            feedback: data.feedback
          });
        } else {
          setSummaryReport(generatedFeedback);
        }
      } catch (fetchErr) {
        console.warn("Could not retrieve AI summary from endpoint:", fetchErr);
        setSummaryReport(generatedFeedback);
      }

      // Always trigger automatic file download of the report on user's PC (whether AI succeeded or fell back!)
      try {
        const reportContent = `
# EduSense Smart Classroom - Session Pedagogical Report
**Lecture Title:** ${activeSession.title}
**Course:** ${activeSession.courseCode || "General"}
**Instructor:** ${activeSession.instructorName}
**Session ID:** ${activeSession.id}
**Completed At:** ${finishTimestamp.toLocaleString()}

---

## Performance Summary Metrics
- **Total Students Checked-In:** ${attendance.length}
- **Average Classroom Attention:** ${avgAttention}%
- **Average Classroom Engagement:** ${avgEngagement}%
- **Average Classroom Confusion Index:** ${avgConfusion}%

---

## AI Pedagogical Summary & Feedback
${generatedFeedback}
        `.trim();

        const blob = new Blob([reportContent], { type: "text/markdown;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `EduSense_Session_Report_${activeSession.id}.md`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (downloadErr) {
        console.warn("Could not automatically download session report:", downloadErr);
      }

      // Clear all state data in the teacher panels
      setAttendance([]);
      setTimeline([]);
      setAlerts([]);
      setAvgAttention(85);
      setAvgEngagement(80);
      setAvgConfusion(15);
      setRecommendation(null);

      setActiveSession(null);
    } catch (e) {
      console.error("Error finalizing session summary:", e);
      setActiveSession(null);
    } finally {
      setSummarizing(false);
    }
  };

  const handleForceCheckout = async (studentId: string) => {
    if (!activeSession) return;
    const attendanceId = `${activeSession.id}_${studentId}`;
    try {
      await updateDoc(doc(db, "sessions", activeSession.id, "attendance", attendanceId), {
        status: "absent" as const
      });
    } catch (err) {
      console.error("Could not run instructor-authored force check-out:", err);
    }
  };

  const renderSVGPathPoints = (key: 'attention' | 'engagement' | 'confusion', stroke: string) => {
    if (timeline.length < 2) return null;
    const width = 500;
    const height = 150;
    const maxVal = 100;

    const points = timeline.map((tick, idx) => {
      const x = (idx / (timeline.length - 1)) * width;
      const val = tick[key] || 0;
      const y = height - (val / maxVal) * height;
      return `${x},${y}`;
    });

    return (
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth="3"
        points={points.join(" ")}
        className="transition-all duration-500"
      />
    );
  };

  const getRiskBadge = (profile: StudentLearningProfile) => {
    if (profile.totalSessionsAttended === 0) return { label: 'No Data', bg: 'bg-gray-50', text: 'text-gray-500', border: 'border-gray-200' };
    const avg = profile.totalAttentionSum / profile.totalSessionsAttended;
    if (avg >= 75) return { label: 'High Performer', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' };
    if (avg >= 50) return { label: 'At Risk', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' };
    return { label: 'Critical', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' };
  };

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-6 font-sans text-left text-gray-800">
      {!activeSession ? (
        // Start Session Form Card
        <div className="space-y-6 max-w-lg mx-auto">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6">
          <div className="text-center space-y-1">
            <span className="bg-blue-55 text-blue-600 px-3 py-1 rounded-full text-xs font-semibold border border-blue-150 uppercase tracking-wide">
              Instructor Dashboard
            </span>
            <h2 className="text-xl font-bold text-gray-900 uppercase tracking-tight mt-3">Launch Smart Classroom</h2>
            <p className="text-xs text-gray-500 leading-relaxed">Spawn a real-time monitor space with Computer Vision feeds</p>
          </div>

          <form onSubmit={handleLaunchSession} className="space-y-4">
            <div>
              <label htmlFor="course-select" className="block text-[10px] font-mono font-bold text-gray-500 uppercase tracking-widest mb-1.5">Select Assigned Course</label>
              {assignedCourses.length === 0 ? (
                <div className="bg-red-50 border border-red-200 p-4 rounded-xl text-[11px] text-red-700 font-mono space-y-1">
                  <p className="font-bold">⚠️ NO COURSES ASSIGNED</p>
                  <p className="leading-relaxed font-sans">You do not have any active courses assigned to your educator ID. Please contact the Campus Administrator.</p>
                </div>
              ) : (
                <select
                  id="course-select"
                  required
                  value={selectedCourseId}
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all font-mono shadow-inner"
                >
                  <option value="">-- Choose Assigned Course --</option>
                  {assignedCourses.map(course => (
                    <option key={course.id} value={course.id}>
                      [{course.code}] {course.title}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label htmlFor="session-title-input" className="block text-[10px] font-mono font-bold text-gray-500 uppercase tracking-widest mb-1.5">Lecture / Seminar Title</label>
              <input
                type="text"
                id="session-title-input"
                required
                value={sessionTitle}
                disabled={assignedCourses.length === 0}
                onChange={(e) => setSessionTitle(e.target.value)}
                placeholder="Artificial Intelligence - Reinforcement Learning Policy"
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all shadow-inner disabled:opacity-40"
              />
            </div>

            <button
              type="submit"
              id="start-session-btn"
              disabled={creating || assignedCourses.length === 0}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 px-4 font-mono font-semibold uppercase text-xs tracking-widest shadow-md cursor-pointer flex items-center justify-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Play className="w-4 h-4 fill-white animate-pulse" />
              {creating ? "Launching Classroom Panel..." : "Initialize lecture Room"}
            </button>
          </form>

          {summaryReport && (
            <div className="border-t border-gray-200 pt-6 space-y-3">
              <div className="flex items-center gap-2 text-emerald-600">
                <CheckCircle2 className="w-4 h-4" />
                <h3 className="font-bold text-xs uppercase tracking-wider">AI Post-Session Feedback Summary</h3>
              </div>
              <div className="bg-gray-55 p-4 border border-gray-200 rounded-xl max-h-60 overflow-y-auto text-xs text-gray-600 whitespace-pre-line leading-relaxed shadow-inner">
                {summaryReport}
              </div>
            </div>
          )}
        </div>

        {/* My Students Overview — cumulative all-time stats from studentProfiles */}
        {myStudentsProfiles.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-600 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  My Students — Learning Overview
                </h3>
                <p className="text-[10px] text-gray-500 mt-0.5">Cumulative attention stats across all completed sessions</p>
              </div>
              <span className="bg-indigo-50 border border-indigo-150 text-indigo-600 text-[9px] font-mono font-bold uppercase px-2.5 py-1 rounded tracking-wider">
                {myStudentsProfiles.length} student{myStudentsProfiles.length !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {myStudentsProfiles.map(profile => {
                const avgAtt = profile.totalSessionsAttended > 0
                  ? Math.round(profile.totalAttentionSum / profile.totalSessionsAttended)
                  : 0;
                const avgEng = profile.totalSessionsAttended > 0
                  ? Math.round(profile.totalEngagementSum / profile.totalSessionsAttended)
                  : 0;
                const badge = getRiskBadge(profile);

                return (
                  <div key={profile.studentId} className="flex items-center gap-4 p-3 bg-gray-50 border border-gray-200 rounded-xl hover:bg-white hover:border-indigo-200 transition-all">
                    <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center text-xs font-bold text-indigo-600 uppercase shrink-0">
                      {profile.studentName.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-gray-800 truncate">{profile.studentName}</p>
                        <span className={`text-[8px] font-mono font-bold px-2 py-0.5 rounded border uppercase whitespace-nowrap ${badge.bg} ${badge.text} ${badge.border}`}>
                          {badge.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-1.5">
                        <div className="flex-1">
                          <div className="flex justify-between text-[8px] font-mono text-gray-400 mb-0.5">
                            <span>Avg Attention</span>
                            <span className={avgAtt >= 75 ? 'text-emerald-600 font-bold' : avgAtt >= 50 ? 'text-amber-600 font-bold' : 'text-red-600 font-bold'}>{avgAtt}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full transition-all ${avgAtt >= 75 ? 'bg-emerald-500' : avgAtt >= 50 ? 'bg-amber-400' : 'bg-red-500'}`}
                              style={{ width: `${avgAtt}%` }}
                            />
                          </div>
                        </div>
                        <div className="text-[8.5px] font-mono text-gray-500 whitespace-nowrap shrink-0">
                          <span className="font-bold text-gray-700">{profile.totalSessionsAttended}</span> session{profile.totalSessionsAttended !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        </div>
      ) : (
        // Active Classroom Panel
        <div className="space-y-6">
          {/* Active Lecture Header Banner */}
          <div className="bg-white text-gray-855 p-5 rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="bg-red-50 text-red-655 text-[10px] uppercase font-mono px-2.5 py-0.5 rounded font-bold tracking-widest animate-pulse inline-flex items-center gap-1 border border-red-205">
                <span className="w-1.5 h-1.5 bg-red-600 rounded-full"></span> LIVE BROADCAST ACTIVE
              </span>
              <h2 className="text-xl font-bold tracking-tight leading-tight uppercase text-gray-900 mt-1">
                {activeSession.courseCode ? `[${activeSession.courseCode}] ` : ""}{activeSession.title}
              </h2>
              <p className="text-xs text-gray-500 font-semibold uppercase font-sans">Facilitated by Educator {activeSession.instructorName}</p>
            </div>

            <button
              onClick={handleEndSession}
              disabled={summarizing}
              id="stop-session-btn"
              className="bg-red-50 hover:bg-red-105 border border-red-200 text-red-655 py-2.5 px-5 rounded-lg cursor-pointer text-xs font-mono font-bold uppercase tracking-widest flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
            >
              <StopCircle className="w-4 h-4" />
              {summarizing ? "Generating AI Metrics Report..." : "Terminate Session"}
            </button>
          </div>

          {/* Quick Share Link Banner */}
          <div className="bg-white border border-gray-200 p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3 self-start sm:self-auto">
              <div className="bg-blue-50 border border-blue-200 p-2 rounded-lg text-blue-600">
                <Link className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-800 uppercase tracking-tight">Direct Classroom Share Link</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-mono">Share this invite link with students to join instantly</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input
                type="text"
                readOnly
                value={`${window.location.origin}?room=${activeSession.id}`}
                id="active-classroom-url-input"
                className="bg-gray-55 border border-gray-200 rounded-lg px-3 py-1 text-xs text-blue-600 font-mono select-all focus:outline-none flex-1 sm:w-80 border-dashed"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <button
                type="button"
                onClick={handleCopyLink}
                id="copy-classroom-url-btn"
                className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white text-[10px] uppercase font-bold py-2.5 px-4 rounded-lg shadow-sm transition-all cursor-pointer shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-white" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Link</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Google Classroom Sub-Tabs */}
          <div className="flex border-b border-gray-200 overflow-x-auto">

            <button
              onClick={() => setCurrentSubTab('metrics')}
              className={`py-3 px-6 text-xs uppercase tracking-wider font-bold transition-all cursor-pointer border-b-2 whitespace-nowrap ${
                currentSubTab === 'metrics'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-100/50'
              }`}
            >
              Classwork & Metrics
            </button>
            <button
              onClick={() => setCurrentSubTab('people')}
              className={`py-3 px-6 text-xs uppercase tracking-wider font-bold transition-all cursor-pointer border-b-2 whitespace-nowrap ${
                currentSubTab === 'people'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-100/50'
              }`}
            >
              People ({attendance.length})
            </button>
            <button
              onClick={() => setCurrentSubTab('profiles')}
              className={`py-3 px-6 text-xs uppercase tracking-wider font-bold transition-all cursor-pointer border-b-2 whitespace-nowrap flex items-center gap-1.5 ${
                currentSubTab === 'profiles'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-100/50'
              }`}
            >
              <BookUser className="w-3.5 h-3.5" />
              Student Profiles
            </button>
          </div>

          {/* TAB 2: CLASSWORK & METRICS */}
          {currentSubTab === 'metrics' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              {/* Metrics sidebar circular progress rings */}
              <div className="lg:col-span-1 space-y-4">
                <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
                  <h4 className="text-[10px] font-mono uppercase tracking-widest text-gray-400 font-bold">Class averages</h4>

                  {/* Stat 1: Attention */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-baseline text-xs uppercase font-mono font-bold">
                      <span className="text-gray-500">Attention</span>
                      <span className="text-blue-600">{avgAttention}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 border border-gray-200 shadow-inner">
                      <div className="bg-blue-600 h-1.5 rounded-full transition-all duration-550" style={{ width: `${avgAttention}%` }} />
                    </div>
                  </div>

                  {/* Stat 2: Engagement */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-baseline text-xs uppercase font-mono font-bold">
                      <span className="text-gray-500">Engagement</span>
                      <span className="text-emerald-600">{avgEngagement}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 border border-gray-200 shadow-inner">
                      <div className="bg-emerald-600 h-1.5 rounded-full transition-all duration-550" style={{ width: `${avgEngagement}%` }} />
                    </div>
                  </div>

                  {/* Stat 3: Confusion */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-baseline text-xs uppercase font-mono font-bold">
                      <span className="text-gray-500">Confusion</span>
                      <span className="text-red-500">{avgConfusion}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 border border-gray-200 shadow-inner">
                      <div className="bg-red-500 h-1.5 rounded-full transition-all duration-550" style={{ width: `${avgConfusion}%` }} />
                    </div>
                  </div>
                </div>

                {/* SVG Visualizer Line Graph Chart */}
                <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex flex-col justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-700 text-xs font-mono uppercase tracking-widest flex items-center gap-1.5">
                      <Activity className="w-4 h-4 text-blue-600" />
                      Live Timeline Logs
                    </h3>
                  </div>

                  {/* Chart Plot area using native SVGs */}
                  <div className="my-4 bg-gray-50 rounded-lg border border-gray-200 p-2 relative h-32 flex items-center justify-center">
                    {timeline.length < 2 ? (
                      <p className="text-[9px] text-gray-400 font-mono uppercase">Gathering ticks. Standby...</p>
                    ) : (
                      <svg className="w-full h-full overflow-visible" viewBox="0 0 500 150">
                         <line x1="0" y1="37.5" x2="500" y2="37.5" stroke="#e5e7eb" strokeDasharray="4 4" />
                         <line x1="0" y1="75" x2="500" y2="75" stroke="#e5e7eb" strokeDasharray="4 4" />
                         <line x1="0" y1="112.5" x2="500" y2="112.5" stroke="#e5e7eb" strokeDasharray="4 4" />
                         {renderSVGPathPoints('attention', '#2563eb')}
                         {renderSVGPathPoints('engagement', '#059669')}
                         {renderSVGPathPoints('confusion', '#dc2626')}
                      </svg>
                    )}
                  </div>

                  <div className="flex justify-center gap-4 text-[8px] font-mono tracking-widest uppercase font-semibold border-t border-gray-100 pt-2.5">
                    <span className="flex items-center gap-1 text-blue-600"><span className="w-2 h-2 bg-blue-600 rounded-full"></span> Att</span>
                    <span className="flex items-center gap-1 text-emerald-600"><span className="w-2 h-2 bg-emerald-600 rounded-full"></span> Eng</span>
                    <span className="flex items-center gap-1 text-red-500"><span className="w-2 h-2 bg-red-500 rounded-full"></span> Conf</span>
                  </div>
                </div>
              </div>

              {/* AI Advisor Panel */}
              <div className="lg:col-span-2">
                <PacingGauge
                  recommendation={recommendation}
                  loading={evaluatingPolicy}
                  onRefresh={handleEvaluateRLPolicy}
                  thresholdType={thresholdType}
                  setThresholdType={setThresholdType}
                  thresholdValue={thresholdValue}
                  setThresholdValue={setThresholdValue}
                  lowAttentionCount={attendance.filter(r => (r.averageAttention ?? 0) < 50).length}
                  totalStudents={attendance.length}
                />
              </div>
            </div>
          )}

          {/* TAB 3: PEOPLE (Roster) */}
          {currentSubTab === 'people' && (
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
              <div>
                <h3 className="font-semibold text-gray-800 text-xs font-mono uppercase tracking-widest flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-blue-600" />
                  Checked-In Student Registrars
                </h3>
                <p className="text-[10px] text-gray-500 mt-0.5">Roster of students currently synced with EduSense</p>
              </div>

              <div className="divide-y divide-gray-150 max-h-[400px] overflow-y-auto pr-1">
                {attendance.length === 0 ? (
                  <p className="text-[10px] text-gray-400 py-10 text-center font-mono uppercase">Awaiting incoming student check-ins.</p>
                ) : (
                  attendance.map((item) => {
                    const isOnline = (() => {
                      if (item.status !== "present") return false;
                      if (!item.lastActiveAt) return true;
                      const nowMs = Date.now();
                      const lastMs = typeof item.lastActiveAt.toDate === "function"
                        ? item.lastActiveAt.toDate().getTime()
                        : new Date(item.lastActiveAt).getTime();
                      return (nowMs - lastMs) < 15000;
                    })();

                    return (
                      <div
                        key={item.studentId}
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-3.5 gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="bg-blue-50 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-blue-600 border border-blue-150 uppercase">
                              {item.studentName ? item.studentName.charAt(0).toUpperCase() : "?"}
                            </div>
                            <span 
                              className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${
                                isOnline ? "bg-emerald-500" : "bg-gray-400"
                              }`} 
                              title={isOnline ? "Active" : "Inactive"}
                            />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-semibold text-gray-800">{item.studentName}</p>
                              <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded tracking-wide uppercase ${
                                isOnline ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-gray-50 text-gray-400 border border-gray-200"
                              }`}>
                                {isOnline ? "Active" : "Offline"}
                              </span>
                            </div>
                            <p className="text-[9px] font-mono text-gray-400">SZABIST Student Node</p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-5 w-full sm:w-auto">
                          <div className="text-left sm:text-right">
                            <p className="text-xs font-bold font-mono text-blue-650">Attention: {item.averageAttention || 0}%</p>
                            <p className="text-[9px] font-mono text-gray-400">Participation: {item.activeParticipationScore || 0}%</p>
                          </div>
                          
                          <button
                            onClick={() => handleForceCheckout(item.studentId)}
                            className="text-[9px] font-mono font-bold uppercase p-1.5 px-3 bg-red-50 hover:bg-red-100 border border-red-200 text-red-650 rounded-lg shadow-sm transition-all cursor-pointer whitespace-nowrap"
                            title="Force checkout student"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 4: STUDENT PROFILES (session-scoped per-student learning cards) */}
          {currentSubTab === 'profiles' && (() => {
            const getSessionBadge = (attn: number) => {
              if (attn >= 75) return { label: 'Excellent', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' };
              if (attn >= 50) return { label: 'Moderate', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' };
              return { label: 'Struggling', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' };
            };

            return (
              <div className="space-y-4">
                <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-semibold text-gray-800 text-xs font-mono uppercase tracking-widest flex items-center gap-1.5">
                      <BookUser className="w-4 h-4 text-indigo-600" />
                      Student Learning Profiles — This Session
                    </h3>
                    <span className="text-[9px] font-mono text-gray-400 uppercase tracking-widest border border-gray-200 px-2 py-0.5 rounded bg-gray-50">
                      {attendance.length} student{attendance.length !== 1 ? 's' : ''} checked in
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-500">Per-student attention, engagement, confusion, and alert breakdown for the current session.</p>
                </div>

                {attendance.length === 0 ? (
                  <div className="bg-white border border-dashed border-gray-200 rounded-xl p-12 text-center space-y-2">
                    <BookUser className="w-8 h-8 text-gray-300 mx-auto" />
                    <p className="text-[10px] font-mono text-gray-400 uppercase">No students checked in yet.</p>
                    <p className="text-[9.5px] text-gray-400">Profiles will populate once students join the session.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {attendance.map((item) => {
                      const attn = item.averageAttention || 0;
                      const eng = item.activeParticipationScore || 0;
                      const studentAlertList = alerts.filter(a => a.studentId === item.studentId);
                      const unresolvedAlerts = studentAlertList.filter(a => !a.resolved).length;
                      const resolvedAlerts = studentAlertList.filter(a => a.resolved).length;
                      const badge = getSessionBadge(attn);

                      const isOnline = (() => {
                        if (item.status !== "present") return false;
                        if (!item.lastActiveAt) return true;
                        const nowMs = Date.now();
                        const lastMs = typeof item.lastActiveAt.toDate === "function"
                          ? item.lastActiveAt.toDate().getTime()
                          : new Date(item.lastActiveAt).getTime();
                        return (nowMs - lastMs) < 15000;
                      })();

                      return (
                        <div key={item.studentId} className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 space-y-4 hover:shadow-md transition-shadow">
                          {/* Student Header */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="relative">
                                <div className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-150 flex items-center justify-center text-sm font-bold text-indigo-600 uppercase">
                                  {item.studentName ? item.studentName.charAt(0) : '?'}
                                </div>
                                <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${isOnline ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-gray-900">{item.studentName}</p>
                                <p className="text-[9px] font-mono text-gray-400 uppercase">{isOnline ? 'Active Now' : 'Offline'}</p>
                              </div>
                            </div>
                            <span className={`text-[8.5px] font-mono font-bold px-2 py-1 rounded border uppercase tracking-wide ${badge.bg} ${badge.text} ${badge.border}`}>
                              {badge.label}
                            </span>
                          </div>

                          {/* Metrics Bars */}
                          <div className="space-y-2.5">
                            <div className="space-y-1">
                              <div className="flex justify-between items-baseline">
                                <span className="text-[9px] font-mono font-bold text-gray-500 uppercase">Attention</span>
                                <span className={`text-[10px] font-mono font-bold ${attn >= 75 ? 'text-emerald-600' : attn >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{attn}%</span>
                              </div>
                              <div className="w-full bg-gray-100 rounded-full h-2 border border-gray-200">
                                <div
                                  className={`h-1.5 rounded-full transition-all duration-700 ${attn >= 75 ? 'bg-emerald-500' : attn >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                                  style={{ width: `${attn}%` }}
                                />
                              </div>
                            </div>

                            <div className="space-y-1">
                              <div className="flex justify-between items-baseline">
                                <span className="text-[9px] font-mono font-bold text-gray-500 uppercase">Engagement</span>
                                <span className="text-[10px] font-mono font-bold text-blue-600">{eng}%</span>
                              </div>
                              <div className="w-full bg-gray-100 rounded-full h-2 border border-gray-200">
                                <div className="bg-blue-500 h-1.5 rounded-full transition-all duration-700" style={{ width: `${eng}%` }} />
                              </div>
                            </div>

                            <div className="space-y-1">
                              <div className="flex justify-between items-baseline">
                                <span className="text-[9px] font-mono font-bold text-gray-500 uppercase">Class Confusion</span>
                                <span className="text-[10px] font-mono font-bold text-purple-600">{avgConfusion}%</span>
                              </div>
                              <div className="w-full bg-gray-100 rounded-full h-2 border border-gray-200">
                                <div className="bg-purple-400 h-1.5 rounded-full transition-all duration-700" style={{ width: `${avgConfusion}%` }} />
                              </div>
                            </div>
                          </div>

                          {/* Alert Summary */}
                          <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                            <div className={`flex-1 text-center py-1.5 rounded-lg border ${
                              unresolvedAlerts > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'
                            }`}>
                              <p className={`text-sm font-bold ${unresolvedAlerts > 0 ? 'text-red-600' : 'text-gray-400'}`}>{unresolvedAlerts}</p>
                              <p className="text-[8px] font-mono uppercase text-gray-500">Unresolved</p>
                            </div>
                            <div className="flex-1 text-center py-1.5 rounded-lg bg-emerald-50 border border-emerald-100">
                              <p className="text-sm font-bold text-emerald-600">{resolvedAlerts}</p>
                              <p className="text-[8px] font-mono uppercase text-gray-500">Resolved</p>
                            </div>
                            <div className="flex-1 text-center py-1.5 rounded-lg bg-gray-50 border border-gray-200">
                              <p className="text-sm font-bold text-gray-700">{studentAlertList.length}</p>
                              <p className="text-[8px] font-mono uppercase text-gray-500">Total Alerts</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

    </div>
  );
}
