import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";
import { Brain, Users, Award, BookOpen, ChevronRight, Video, ShieldAlert } from "lucide-react";
import { UserProfile, ClassroomSession } from "../types";

interface Course {
  id: string;
  code: string;
  title: string;
  description?: string;
  teacherId?: string;
  teacherName?: string;
}

interface HomeStatsProps {
  currentProfile: UserProfile | null;
  onNavigateToDashboard: () => void;
  onNavigateToLogin: () => void;
  onStartSession: (courseId: string) => void;
  onJoinSession: (room: ClassroomSession) => void;
  activeRooms: ClassroomSession[];
  enrolledCourseIds: string[];
}

const DEFAULT_MOCK_COURSES: Course[] = [
  {
    id: "csc401_mock",
    code: "CSC-401",
    title: "Multimodal AI and Speech Processing",
    description: "Analyzing physiological cues, facial postures, and audio stress parameters in teaching environments.",
    teacherId: "instructor_1",
    teacherName: "Dr. Tariq Mahmood"
  },
  {
    id: "sen302_mock",
    code: "SEN-302",
    title: "Software Engineering Essentials",
    description: "Architectural designs, refactoring patterns, and deployment configurations for scalable enterprise computing.",
    teacherId: "instructor_2",
    teacherName: "Prof. Sarah Qureshi"
  },
  {
    id: "csc102_mock",
    code: "CSC-102",
    title: "Introduction to Smart Computing",
    description: "Foundational coursework exploring interactive systems, ambient smart sensor arrays, and user pacing analysis.",
    teacherId: "instructor_1",
    teacherName: "Dr. Tariq Mahmood"
  }
];

// Gradients array to styled course cards beautifully
const CARD_GRADIENTS = [
  "from-blue-600 to-indigo-650",
  "from-emerald-600 to-teal-650",
  "from-purple-600 to-indigo-600",
  "from-pink-650 to-rose-600",
  "from-amber-600 to-orange-650"
];

export default function HomeStats({
  currentProfile,
  onNavigateToDashboard,
  onNavigateToLogin,
  onStartSession,
  onJoinSession,
  activeRooms,
  enrolledCourseIds
}: HomeStatsProps) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [totalSessions, setTotalSessions] = useState<number>(0);
  const [totalStudents, setTotalStudents] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        // Fetch courses
        const coursesSnap = await getDocs(collection(db, "courses"));
        const list: Course[] = [];
        coursesSnap.forEach((doc) => {
          list.push({ ...doc.data(), id: doc.id } as Course);
        });

        if (list.length > 0) {
          setCourses(list);
        } else {
          setCourses([]);
        }

        // Fetch general stats
        const sessionsSnap = await getDocs(collection(db, "sessions"));
        setTotalSessions(sessionsSnap.size);

        const usersSnap = await getDocs(collection(db, "users"));
        const studentCount = usersSnap.docs.filter(d => d.data().role === "student").length;
        setTotalStudents(studentCount || 0);
      } catch (err) {
        console.warn("Using local course templates due to Firebase config:", err);
        setCourses([]);
        setTotalSessions(0);
        setTotalStudents(0);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  return (
    <div id="home-stats-root" className="max-w-6xl mx-auto px-6 py-6 space-y-8 font-sans">
      {/* Sleek Header Banner */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
        <div className="space-y-2 text-left max-w-2xl">
          <div className="inline-flex items-center gap-1 bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-xs font-semibold border border-blue-150">
            <Brain className="w-3.5 h-3.5" />
            <span>EduSense Intelligent Telemetry Network</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight leading-tight uppercase">
            Smart Adaptive <span className="text-blue-600">Classroom Space</span>
          </h2>
          <p className="text-xs text-gray-550 font-mono uppercase tracking-wider">SZABIST SMART CLASSROOM INITIATIVE ISLAMABAD</p>
          <p className="text-xs text-gray-500 leading-relaxed pt-1">
            EduSense utilizes modern computer vision, gaze synchronization, and temporal focus metrics to analyze attention and engagement dynamically. Welcome to the Smart Classroom Initiative at SZABIST Islamabad.
          </p>
        </div>

        <div className="shrink-0">
          {currentProfile ? (
            <button
              onClick={onNavigateToDashboard}
              id="cta-dashboard-btn"
              className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs uppercase font-bold tracking-wider rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>Go to Dashboard</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={onNavigateToLogin}
              id="cta-login-btn"
              className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs uppercase font-bold tracking-wider rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>Connect with Google</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Classroom Bento Stats summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm text-left">
          <p className="text-[10px] font-mono uppercase text-gray-450">Total Sessions</p>
          <p className="text-2xl font-bold text-gray-800">{totalSessions}</p>
        </div>
        <div className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm text-left">
          <p className="text-[10px] font-mono uppercase text-gray-455">Registered Students</p>
          <p className="text-2xl font-bold text-gray-800">{totalStudents}</p>
        </div>
        <div className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm text-left">
          <p className="text-[10px] font-mono uppercase text-gray-455">Live Active Classes</p>
          <p className="text-2xl font-bold text-blue-600">{activeRooms.length}</p>
        </div>
        <div className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm text-left">
          <p className="text-[10px] font-mono uppercase text-gray-455">Node Location</p>
          <p className="text-xs font-bold text-gray-800 uppercase mt-2">SZABIST Islamabad</p>
        </div>
      </div>

      {/* Google Classroom Course Cards Layout */}
      <div className="space-y-4 text-left">
        <h3 className="text-xs font-bold text-gray-550 uppercase tracking-widest">Your Course Workspaces</h3>

        {loading ? (
          <div className="text-center py-12 text-gray-450">
            <span className="animate-pulse">Loading class workspaces...</span>
          </div>
        ) : (() => {
          const visibleCourses = courses.filter((course) => {
            if (!currentProfile) return true;
            if (currentProfile.role === "instructor") {
              return course.teacherId === currentProfile.uid;
            }
            if (currentProfile.role === "student") {
              return enrolledCourseIds.includes(course.id);
            }
            return true;
          });

          if (visibleCourses.length === 0) {
            return (
              <div className="text-center py-12 border border-dashed border-gray-200 bg-white rounded-2xl p-8 max-w-md mx-auto space-y-2.5">
                <BookOpen className="w-8 h-8 text-gray-300 mx-auto" />
                <p className="text-xs font-mono uppercase text-gray-450 font-bold">No Course Workspaces Active</p>
                <p className="text-[10px] text-gray-500 font-sans leading-relaxed">
                  {currentProfile?.role === "instructor"
                    ? "You have not been assigned as an instructor to any active courses. Please contact the Campus Administrator."
                    : "You are not currently enrolled in any active course workspaces."}
                </p>
              </div>
            );
          }

          return (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {visibleCourses.map((course, index) => {
                const gradient = CARD_GRADIENTS[index % CARD_GRADIENTS.length];
                const activeSession = activeRooms.find(room => room.courseId === course.id);

                return (
                  <div
                    key={course.id}
                    className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm flex flex-col justify-between hover:shadow-md transition-all border-b-4 hover:border-b-blue-500"
                  >
                    {/* Card Banner */}
                    <div className={`bg-gradient-to-r ${gradient} p-5 text-white relative`}>
                      <div className="absolute top-4 right-4 bg-white/20 backdrop-blur-sm p-1.5 rounded-lg border border-white/10 text-white">
                        <BookOpen className="w-4 h-4" />
                      </div>
                      <span className="font-mono text-[9px] bg-white/25 border border-white/20 px-2 py-0.5 rounded uppercase font-bold tracking-widest">
                        {course.code}
                      </span>
                      <h4 className="text-sm font-bold mt-2 leading-tight line-clamp-1 uppercase">
                        {course.title}
                      </h4>
                      <p className="text-[10px] text-white/80 mt-1 uppercase font-semibold">
                        Educator: {course.teacherName || "Unassigned"}
                      </p>
                    </div>

                    {/* Card Content */}
                    <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                      <p className="text-xs text-gray-505 leading-relaxed line-clamp-2">
                        {course.description || "No course syllabus descriptions published yet for this SZABIST workspace."}
                      </p>

                      {/* Card Actions */}
                      <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                        {/* Live Badge */}
                        {activeSession ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[9px] uppercase font-bold text-red-655 bg-red-50 border border-red-200 tracking-wider animate-pulse">
                            <span className="w-1.5 h-1.5 bg-red-600 rounded-full"></span> Live
                          </span>
                        ) : (
                          <span className="text-[9px] uppercase font-bold text-gray-400 tracking-wide font-mono">
                            Offline
                          </span>
                        )}

                        {/* CTA Button */}
                        {!currentProfile ? (
                          <button
                            onClick={onNavigateToLogin}
                            className="px-3 py-1.5 bg-gray-105 hover:bg-gray-200 text-gray-700 text-[10px] uppercase font-bold rounded-lg border border-gray-200 transition-all cursor-pointer"
                          >
                            Sign In
                          </button>
                        ) : currentProfile.role === "instructor" ? (
                          <button
                            onClick={() => onStartSession(course.id)}
                            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] uppercase font-bold rounded-lg shadow-sm transition-all cursor-pointer flex items-center gap-1"
                          >
                            <Video className="w-3 h-3" />
                            <span>Start Class</span>
                          </button>
                        ) : (
                          // Student Role (Since filtered, they must have access)
                          activeSession ? (
                            <button
                              onClick={() => onJoinSession(activeSession)}
                              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] uppercase font-bold rounded-lg shadow-sm transition-all cursor-pointer flex items-center gap-1 animate-bounce"
                            >
                              <Video className="w-3 h-3" />
                              <span>Join Live</span>
                            </button>
                          ) : (
                            <span className="text-[9.5px] uppercase font-semibold text-gray-400 font-sans">
                              Not Active
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
