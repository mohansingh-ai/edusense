import React, { useState, useEffect, useCallback } from "react";
import { auth, db, handleFirestoreError, OperationType, isFirestoreOffline } from "./firebase";
import { collection, onSnapshot, doc, getDocs, updateDoc } from "firebase/firestore";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { UserProfile, ClassroomSession, StudentLearningProfile } from "./types";
import Header from "./components/Header";
import SessionDashboard from "./components/SessionDashboard";
import StudentClient from "./components/StudentClient";
import HomeStats from "./components/HomeStats";
import AboutView from "./components/AboutView";
import AdminWorkspace from "./components/AdminWorkspace";
import { Brain, Activity, Compass, Video, AlertCircle, RefreshCw, LogIn, ShieldAlert, ShieldCheck, UserCheck } from "lucide-react";

const DEFAULT_MOCK_USERS: UserProfile[] = [
  {
    uid: "student_1",
    name: "Amina Khan",
    email: "amina.khan@szabist.pk",
    role: "student",
    createdAt: new Date(),
  },
  {
    uid: "student_2",
    name: "Bilal Ahmed",
    email: "bilal.ahmed@szabist.pk",
    role: "student",
    createdAt: new Date(),
  },
  {
    uid: "student_3",
    name: "Zainab Ali",
    email: "zainab.ali@szabist.pk",
    role: "student",
    createdAt: new Date(),
  },
  {
    uid: "instructor_1",
    name: "Dr. Tariq Mahmood",
    email: "tariq.mahmood@szabist.pk",
    role: "instructor",
    createdAt: new Date(),
  },
  {
    uid: "instructor_2",
    name: "Prof. Sarah Qureshi",
    email: "sarah.qureshi@szabist.pk",
    role: "instructor",
    createdAt: new Date(),
  }
];

const DEFAULT_MOCK_ACTIVE_SESSIONS: ClassroomSession[] = [
  {
    id: "session_nlp_mock",
    title: "Intro to Multimodal Speech and Vision Processing Lecture",
    instructorId: "instructor_1",
    instructorName: "Dr. Tariq Mahmood",
    status: "active",
    createdAt: new Date(),
    courseId: "csc401_mock",
    courseCode: "CSC-401",
    teachingStrategy: "Lecture Style with Dynamic Slides",
    currentPacing: "normal",
    feedback: "Attention levels are good. Engagement is average."
  },
  {
    id: "session_se_mock",
    title: "Software Evolution & Refactoring Lab Exercise",
    instructorId: "instructor_2",
    instructorName: "Prof. Sarah Qureshi",
    status: "active",
    createdAt: new Date(),
    courseId: "sen302_mock",
    courseCode: "SEN-302",
    teachingStrategy: "Hands-on Programming Exercise",
    currentPacing: "normal",
    feedback: "High engagement from participants."
  }
];

export default function App() {
  const [currentProfile, setCurrentProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [rolePreference, setRolePreference] = useState<'student' | 'instructor'>('student');
  const [currentTab, setCurrentTab] = useState<'home' | 'about' | 'login' | 'dashboard' | 'admin'>('home');
  
  // Real-time active classes registry list (for students to join)
  const [activeRooms, setActiveRooms] = useState<ClassroomSession[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<ClassroomSession | null>(null);

  // Administrative sandboxed quick logins state
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [selectedImpersonateId, setSelectedImpersonateId] = useState("");
  const [adminPasscode, setAdminPasscode] = useState("");

  // Student specific registered courses matching lists
  const [enrolledCourseIds, setEnrolledCourseIds] = useState<string[]>([]);
  const [enrolledCoursesLoading, setEnrolledCoursesLoading] = useState<boolean>(true);

  // Real-time student profile
  const [myProfile, setMyProfile] = useState<StudentLearningProfile | null>(null);

  useEffect(() => {
    if (!currentProfile || currentProfile.role !== "student") {
      setMyProfile(null);
      return;
    }
    const profileRef = doc(db, "studentProfiles", currentProfile.uid);
    const unsub = onSnapshot(profileRef, (snap) => {
      if (snap.exists()) {
        setMyProfile(snap.data() as StudentLearningProfile);
      } else {
        setMyProfile(null);
      }
    }, (err) => {
      console.warn("Could not load student profile for dashboard:", err);
      setMyProfile(null);
    });
    return () => unsub();
  }, [currentProfile]);

  // Sync registered users in the database for fast sandboxed impersonation
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      const list: UserProfile[] = [];
      snap.forEach(d => {
        list.push({ ...d.data(), uid: d.id } as UserProfile);
      });
      if (list.length > 0) {
        setAllUsers(list);
      } else {
        setAllUsers([]);
      }
    }, (err) => {
      console.warn("Pre-login user load skipped:", err);
      setAllUsers([]);
    });
    return () => unsub();
  }, []);

  // Filter student registered course list in real-time
  useEffect(() => {
    if (!currentProfile || currentProfile.role !== "student") {
      setEnrolledCourseIds([]);
      setEnrolledCoursesLoading(false);
      return;
    }

    const loadMyRegisteredCourses = async () => {
      setEnrolledCoursesLoading(true);
      try {
        const coursesSnap = await getDocs(collection(db, "courses"));
        const list: string[] = [];
        for (const courseDoc of coursesSnap.docs) {
          const snap = await getDocs(collection(db, "courses", courseDoc.id, "students"));
          const matchesMe = snap.docs.some(d => {
            const data = d.data();
            return (data.studentId === currentProfile.uid) ||
                   (data.studentEmail && currentProfile.email && data.studentEmail.toLowerCase() === currentProfile.email.toLowerCase());
          });
          if (matchesMe) {
            list.push(courseDoc.id);
          }
        }
        if (list.length > 0) {
          setEnrolledCourseIds(list);
        } else {
          setEnrolledCourseIds([]);
        }
      } catch (err) {
        console.warn("Student room restrictions map loading error:", err);
        setEnrolledCourseIds([]);
      } finally {
        setEnrolledCoursesLoading(false);
      }
    };

    loadMyRegisteredCourses();
  }, [currentProfile, activeRooms]);

  // Invitation parameter state if they click direct shares
  const [urlRoomId, setUrlRoomId] = useState<string | null>(null);

  // Intercept and load direct classroom parameters on initialization
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get("room") || params.get("roomId");
    if (roomParam) {
      setUrlRoomId(roomParam);
      localStorage.setItem("user_role_preference", "student");
      setRolePreference("student");
    } else {
      const savedPref = localStorage.getItem("user_role_preference") as "student" | "instructor" | null;
      if (savedPref) {
        setRolePreference(savedPref);
      } else {
        localStorage.setItem("user_role_preference", "student");
      }
    }
  }, []);

  // If an instructor is logged in, clear any urlRoomId and remove query params from the browser address bar
  useEffect(() => {
    if (currentProfile && currentProfile.role === "instructor" && urlRoomId) {
      setUrlRoomId(null);
      if (window.history.replaceState) {
        const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
        window.history.replaceState({ path: cleanUrl }, "", cleanUrl);
      }
    }
  }, [currentProfile, urlRoomId]);

  const handleSaveRolePreference = (role: 'student' | 'instructor') => {
    setRolePreference(role);
    localStorage.setItem("user_role_preference", role);
  };

  const handleSignInDirect = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (e) {
      console.error("Direct google authorization failed:", e);
    }
  };

  const handleExitRoomList = () => {
    if (selectedRoom && currentProfile) {
      const attendanceId = `${selectedRoom.id}_${currentProfile.uid}`;
      updateDoc(doc(db, "sessions", selectedRoom.id, "attendance", attendanceId), {
        status: "absent" as const
      }).catch((err) => console.warn("Could not check-out cleanly:", err));
    }
    setSelectedRoom(null);
    setUrlRoomId(null);
    if (window.history.replaceState) {
      const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
      window.history.replaceState({ path: cleanUrl }, "", cleanUrl);
    }
  };

  const handleImpersonateUser = () => {
    const target = allUsers.find(u => u.uid === selectedImpersonateId);
    if (!target) return;
    setCurrentProfile(target);
    setCurrentTab('dashboard');
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPasscode === "admin123") {
      const adminProf: UserProfile = {
        uid: "admin_root",
        name: "Campus Administrator",
        email: "admin@edusense.internal",
        role: "admin",
        createdAt: new Date()
      };
      setCurrentProfile(adminProf);
      setCurrentTab('admin');
      setAdminPasscode("");
    } else {
      alert("Invalid administrator passcode. Try entering: admin123");
    }
  };

  // Sync active classrooms list in the background
  useEffect(() => {
    if (!currentProfile || currentProfile.role !== "student") return;

    const roomsRef = collection(db, "sessions");
    const unsubscribeRooms = onSnapshot(roomsRef, (snap) => {
      const liveRooms: ClassroomSession[] = [];
      snap.forEach((doc) => {
        const item = doc.data() as ClassroomSession;
        if (item.status === "active") {
          liveRooms.push(item);
        }
      });
      if (liveRooms.length > 0) {
        setActiveRooms(liveRooms);
      } else {
        setActiveRooms([]);
      }
      
      // Auto deselect selectedRoom if it becomes completed/inactive
      if (selectedRoom && !liveRooms.some((r) => r.id === selectedRoom.id)) {
        if (!selectedRoom.id.endsWith("_mock")) {
          setSelectedRoom(null);
        }
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, "sessions");
      setActiveRooms([]);
    });

    return () => unsubscribeRooms();
  }, [currentProfile, selectedRoom]);

  // Active student auto-redirect effect with strict course enrollment check
  useEffect(() => {
    if (!currentProfile || currentProfile.role !== "student" || !urlRoomId || enrolledCoursesLoading) return;

    if (activeRooms.length > 0) {
      const matchedRoom = activeRooms.find((r) => r.id === urlRoomId);
      if (matchedRoom) {
        if (matchedRoom.courseId && enrolledCourseIds.includes(matchedRoom.courseId)) {
          setSelectedRoom(matchedRoom);
        } else {
          alert(`Access Restricted: You are not enrolled in the course for this classroom session.\n\nDiagnostics:\n- Your Student UID: ${currentProfile.uid}\n- Session Course ID: ${matchedRoom.courseId || 'None'}\n- Your Enrolled Course IDs: ${enrolledCourseIds.length > 0 ? enrolledCourseIds.join(', ') : 'None'}`);
          setUrlRoomId(null);
        }
      }
    }
  }, [activeRooms, currentProfile, urlRoomId, enrolledCourseIds, enrolledCoursesLoading]);

  const handleProfileLoaded = useCallback((profile: UserProfile | null) => {
    setCurrentProfile(profile);
    setAuthLoading(false);
    if (profile) {
      setCurrentTab('dashboard');
    } else {
      setSelectedRoom(null);
      setCurrentTab('home');
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 flex flex-col justify-between font-sans">
      {/* Universal Header */}
      <Header onProfileLoaded={handleProfileLoaded} currentProfile={currentProfile} currentTab={currentTab} setCurrentTab={setCurrentTab} />

      {/* Primary Workspace Panel */}
      <main className="flex-1 w-full flex flex-col justify-center py-6">
        {authLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center space-y-4 py-24">
            <div className="bg-white border border-gray-205 p-8 rounded-2xl flex flex-col items-center gap-4 shadow-sm max-w-sm text-center">
              <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-gray-850">Verifying Classroom Session</h3>
                <p className="text-[10px] text-gray-500 mt-2 uppercase leading-relaxed font-mono">Synchronizing keys with SZABIST Smart Classroom...</p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {currentTab === 'home' && (
              <HomeStats
                currentProfile={currentProfile}
                onNavigateToDashboard={() => setCurrentTab('dashboard')}
                onNavigateToLogin={() => setCurrentTab('login')}
                onStartSession={(courseId) => {
                  localStorage.setItem("selected_course_id", courseId);
                  setCurrentTab('dashboard');
                }}
                onJoinSession={(room) => {
                  setSelectedRoom(room);
                  setCurrentTab('dashboard');
                }}
                activeRooms={activeRooms}
                enrolledCourseIds={enrolledCourseIds}
              />
            )}

            {currentTab === 'admin' && currentProfile && currentProfile.role === 'admin' && (
              <AdminWorkspace />
            )}

            {currentTab === 'about' && (
              <AboutView />
            )}

            {currentTab === 'login' && !currentProfile && (
              <div className="max-w-4xl mx-auto px-6 py-6 text-center space-y-8">
                {urlRoomId && (
                  <div className="bg-blue-50 border border-blue-200 p-5 rounded-2xl max-w-md mx-auto text-center space-y-2.5 relative overflow-hidden shadow-sm animate-pulse">
                    <span className="bg-blue-100 border border-blue-200 text-blue-600 font-mono text-[9px] uppercase tracking-widest px-2.5 py-0.5 rounded font-bold">
                      📬 INVITATION DETECTED
                    </span>
                    <p className="text-xs text-gray-800 font-semibold">
                      You have been invited to check-in to active class session!
                    </p>
                    <p className="text-[10px] text-blue-600 font-mono uppercase tracking-wider">
                      Select "Student" role and choose a login approach to enter.
                    </p>
                  </div>
                )}

                <div className="max-w-2xl mx-auto space-y-3">
                  <div className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-full px-4 py-1.5 text-blue-600 text-xs font-mono font-bold uppercase tracking-wider">
                    <Brain className="w-3.5 h-3.5" />
                    <span>Multimodal Real-Time Adaptive Feedback</span>
                  </div>
                  <h2 className="text-3xl font-extrabold font-sans tracking-tight text-gray-900 leading-tight uppercase">
                    Connect to <span className="text-blue-600">EduSense</span>
                  </h2>
                  <p className="text-xs text-gray-500 font-mono tracking-widest uppercase">SZABIST SMART CLASSROOM INITIATIVE ISLAMABAD</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto items-stretch text-left">
                  {/* Standard Sign-In Card */}
                  <div id="login-form-box" className="bg-white border border-gray-200 p-8 rounded-2xl space-y-6 shadow-sm relative flex flex-col justify-between">
                    <span className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-blue-50 border border-blue-200 text-blue-600 font-mono text-[9px] uppercase tracking-widest px-3 py-1 rounded font-bold">
                      SECURE ACCESS PORTAL
                    </span>

                    <div className="space-y-2 text-center mt-2">
                      <h3 className="text-xs font-bold text-gray-800 uppercase tracking-widest font-mono">Select Your Learning Role</h3>
                      <p className="text-[10px] text-gray-500 leading-relaxed font-sans mt-1">
                        Choose your role before connecting. The platform will adapt to your needs.
                      </p>
                    </div>

                    {/* Selection Switches */}
                    <div className="grid grid-cols-2 gap-3 p-1 bg-gray-50 rounded-xl border border-gray-200">
                      <button
                        type="button"
                        onClick={() => handleSaveRolePreference("student")}
                        className={`py-2.5 px-3 rounded-lg font-sans text-xs uppercase font-bold transition-all cursor-pointer ${
                          rolePreference === "student"
                            ? "bg-blue-600 text-white shadow-sm"
                            : "text-gray-500 hover:text-gray-800 hover:bg-gray-200"
                        }`}
                      >
                        Student
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveRolePreference("instructor")}
                        className={`py-2.5 px-3 rounded-lg font-sans text-xs uppercase font-bold transition-all cursor-pointer ${
                          rolePreference === "instructor"
                            ? "bg-blue-600 text-white shadow-sm"
                            : "text-gray-500 hover:text-gray-800 hover:bg-gray-200"
                        }`}
                      >
                        Instructor
                      </button>
                    </div>

                    {/* Google LogIn click trigger */}
                    <button
                      type="button"
                      onClick={handleSignInDirect}
                      className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-755 text-white font-sans text-xs font-semibold py-3.5 px-6 rounded-xl shadow-sm transition-all cursor-pointer uppercase tracking-wider"
                    >
                      <LogIn className="w-4 h-4" />
                      <span>Connect with Google</span>
                    </button>

                    <div className="text-[9px] text-gray-400 font-mono text-center uppercase tracking-wider leading-relaxed pt-2 border-t border-gray-100">
                      Registered profiles will persist in SZABIST Firestore clusters.
                    </div>
                  </div>

                  {/* Administrative Control Access Card */}
                  <div className="bg-white border border-gray-200 p-8 rounded-2xl shadow-sm flex flex-col justify-center">
                    <form onSubmit={handleAdminLogin} className="space-y-4">
                      <div className="space-y-1 text-center">
                        <h4 className="text-[10px] font-mono text-gray-700 uppercase tracking-widest font-bold">Administrative Control Access</h4>
                        <p className="text-[9px] text-gray-500 font-sans uppercase tracking-wider font-semibold">Enter Campus Passcode</p>
                      </div>

                      <div className="flex gap-2">
                        <input
                          type="password"
                          value={adminPasscode}
                          onChange={(e) => setAdminPasscode(e.target.value)}
                          placeholder="Passcode..."
                          className="bg-white border border-gray-250 px-3 py-2 rounded-xl text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-500 flex-1 min-w-0 shadow-inner"
                        />
                        <button
                          type="submit"
                          className="bg-blue-50 hover:bg-blue-105 border border-blue-200 text-blue-650 text-[10px] font-mono font-bold uppercase px-3.5 py-2 rounded-xl transition-all cursor-pointer shrink-0"
                        >
                          Admin Access
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            )}

            {currentTab === 'login' && currentProfile && (
              <div className="max-w-md mx-auto p-8 bg-white border border-gray-200 rounded-2xl text-center space-y-4 shadow-sm">
                <Brain className="w-8 h-8 text-blue-600 mx-auto" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-gray-850">Already Connected</h3>
                <p className="text-xs text-gray-500">You are currently logged in as a {currentProfile.role}. Go to your classroom workspace dashboard.</p>
                <button
                  onClick={() => setCurrentTab('dashboard')}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-mono text-[10px] uppercase font-bold rounded-lg transition-all cursor-pointer shadow-sm"
                >
                  Enter Dashboard
                </button>
              </div>
            )}

            {currentTab === 'dashboard' && currentProfile && (
              <>
                {currentProfile.role === "instructor" ? (
                  // Instructor View
                  <SessionDashboard
                    instructorId={currentProfile.uid}
                    instructorName={currentProfile.name}
                    instructorEmail={currentProfile.email}
                  />
                ) : (
                  // Student View: Select active classroom or join
                  <div className="max-w-6xl mx-auto px-6 w-full dev-portal-container">
                    {selectedRoom ? (
                      <div className="space-y-4 max-w-4xl mx-auto">
                        <button
                          onClick={handleExitRoomList}
                          className="text-[10px] font-sans uppercase bg-white border border-gray-200 text-blue-600 px-4 py-2 rounded-lg font-semibold hover:bg-gray-100 transition-all cursor-pointer shadow-sm mb-2 flex items-center gap-1"
                        >
                          &larr; Exit Room List
                        </button>

                        <StudentClient
                          sessionId={selectedRoom.id}
                          sessionTitle={selectedRoom.title}
                          studentId={currentProfile.uid}
                          studentName={currentProfile.name}
                        />
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                        <div className="lg:col-span-1 bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center space-y-6">
                        <span className="bg-blue-50 border border-blue-200 text-blue-600 px-3 py-1 rounded-full text-xs font-semibold tracking-wider uppercase">
                          Student Portal
                        </span>
                        <div>
                          <h2 className="text-lg font-bold text-gray-850 uppercase tracking-tight">Available Classrooms</h2>
                          <p className="text-xs text-gray-500 mt-1">Choose any active lecture room to join and sync camera signals</p>
                        </div>

                        {/* Restricted classes helper notice display */}
                        {(() => {
                          const allowedRooms = activeRooms.filter(room => {
                            return room.courseId && enrolledCourseIds.includes(room.courseId);
                          });
                          const hiddenCount = activeRooms.length - allowedRooms.length;
                          if (hiddenCount > 0) {
                            return (
                              <div className="bg-red-50 border border-red-200 p-3.5 rounded-xl text-left space-y-2">
                                <p className="text-[10px] font-mono text-red-700 font-bold uppercase flex items-center gap-1.5">
                                  <ShieldAlert className="w-4 h-4 text-red-600 animate-pulse" />
                                  <span>{hiddenCount} COURSE SESSIONS HIDDEN</span>
                                </p>
                                <p className="text-[9.5px] text-gray-500 leading-relaxed">
                                  There are live classroom sessions active, but you are not enrolled in those courses. Access is reserved strictly to enrolled students.
                                </p>
                                <div className="mt-2 pt-2 border-t border-red-150 text-[9px] font-mono text-red-700/80 space-y-1">
                                  <p><strong>Your Student UID:</strong> {currentProfile.uid}</p>
                                  <p><strong>Enrolled Course IDs:</strong> {enrolledCourseIds.length > 0 ? enrolledCourseIds.join(', ') : 'None'}</p>
                                  <p><strong>Active Session Course IDs:</strong> {activeRooms.map(r => r.courseId || 'None').join(', ')}</p>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        })()}

                        {urlRoomId && !activeRooms.some((r) => r.id === urlRoomId) ? (
                          <div className="py-8 border border-gray-200 bg-gray-50 rounded-xl space-y-4 p-6">
                            <RefreshCw className="w-6 h-6 text-blue-600 animate-spin mx-auto" />
                            <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">Verifying Shared invite Link...</p>
                            <p className="text-[10px] text-gray-500 leading-relaxed">
                              Connecting to secure lecture session <span className="text-blue-600 font-mono font-bold">{urlRoomId}</span>. Please verify that the instructor has started the session.
                            </p>
                          </div>
                        ) : enrolledCoursesLoading ? (
                          <div className="py-8 border border-gray-200 bg-gray-50 rounded-xl space-y-4 p-6 text-center">
                            <RefreshCw className="w-6 h-6 text-blue-650 animate-spin mx-auto" />
                            <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">Verifying Course Enrollments...</p>
                          </div>
                        ) : activeRooms.filter(r => r.courseId && enrolledCourseIds.includes(r.courseId)).length === 0 ? (
                          <div className="py-12 border border-gray-200 rounded-xl space-y-4 flex flex-col items-center justify-center bg-gray-50 shadow-inner">
                            <AlertCircle className="w-8 h-8 text-amber-500 animate-pulse" />
                            <p className="text-xs text-gray-400 font-mono uppercase">No Allocated Classrooms Active</p>
                            <div className="flex items-center gap-1.5 text-[9px] text-blue-600 font-semibold uppercase tracking-widest">
                              <RefreshCw className="w-3 h-3 animate-spin" /> Autodetecting active sessions
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-60 overflow-y-auto">
                            {activeRooms.filter(r => r.courseId && enrolledCourseIds.includes(r.courseId)).map((room) => (
                              <button
                                key={room.id}
                                onClick={() => setSelectedRoom(room)}
                                id={`join-room-card-${room.id}`}
                                className="w-full text-left p-4 bg-gray-50 hover:bg-white border border-gray-200 rounded-xl flex items-center justify-between hover:border-blue-500/60 group transition-all shadow-sm"
                              >
                                <div>
                                  <p className="text-xs font-bold text-gray-850 group-hover:text-blue-600 transition-colors uppercase tracking-tight">{room.title}</p>
                                  <p className="text-[9px] text-gray-450 font-mono mt-0.5 uppercase">Educator: {room.instructorName}</p>
                                  {room.courseCode && (
                                    <span className="mt-1 inline-block px-2 py-0.5 bg-blue-50 border border-blue-150 font-mono text-[8px] uppercase text-blue-600 font-bold rounded">
                                      COURSE: {room.courseCode}
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] font-sans font-bold uppercase text-blue-600 group-hover:translate-x-1 transition-transform">
                                  Enter &rarr;
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                        {/* Cumulative Profile Column */}
                        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6 text-left">
                          <div className="border-b border-gray-150 pb-4">
                            <h3 className="font-sans font-semibold text-gray-900 text-sm uppercase tracking-tight">My Cumulative Engagement Profile</h3>
                            <p className="text-[10px] text-gray-400 font-mono uppercase tracking-wider">Overall Performance Stats</p>
                          </div>

                          {myProfile ? (() => {
                            const avgAtt = myProfile.totalSessionsAttended > 0
                              ? Math.round(myProfile.totalAttentionSum / myProfile.totalSessionsAttended)
                              : 0;
                            const avgEng = myProfile.totalSessionsAttended > 0
                              ? Math.round(myProfile.totalEngagementSum / myProfile.totalSessionsAttended)
                              : 0;
                            const avgConf = myProfile.totalSessionsAttended > 0
                              ? Math.round(myProfile.totalConfusionSum / myProfile.totalSessionsAttended)
                              : 0;

                            const getRiskBadge = (attn: number) => {
                              if (attn >= 75) return { label: 'Excellent Focus', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' };
                              if (attn >= 50) return { label: 'Moderate Focus', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' };
                              return { label: 'Struggling Focus', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' };
                            };
                            const badge = getRiskBadge(avgAtt);

                            return (
                              <div className="space-y-6">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                  <div>
                                    <p className="text-xs font-semibold text-gray-500 uppercase">Risk Level</p>
                                    <span className={`inline-block mt-1 text-xs font-mono font-bold px-3 py-1 rounded-full border uppercase ${badge.bg} ${badge.text} ${badge.border}`}>
                                      {badge.label}
                                    </span>
                                  </div>
                                  <div className="text-left sm:text-right">
                                    <p className="text-xs font-semibold text-gray-550 uppercase">Sessions Attended</p>
                                    <p className="text-2xl font-bold text-gray-800">{myProfile.totalSessionsAttended}</p>
                                  </div>
                                </div>

                                <div className="space-y-4">
                                  <div className="space-y-1">
                                    <div className="flex justify-between items-baseline text-xs uppercase font-mono font-bold">
                                      <span className="text-gray-500">Average Attention</span>
                                      <span className="text-blue-600">{avgAtt}%</span>
                                    </div>
                                    <div className="w-full bg-gray-100 rounded-full h-2 border border-gray-200 shadow-inner">
                                      <div className="bg-blue-600 h-1.5 rounded-full transition-all duration-500" style={{ width: `${avgAtt}%` }} />
                                    </div>
                                  </div>

                                  <div className="space-y-1">
                                    <div className="flex justify-between items-baseline text-xs uppercase font-mono font-bold">
                                      <span className="text-gray-500">Average Engagement</span>
                                      <span className="text-emerald-600">{avgEng}%</span>
                                    </div>
                                    <div className="w-full bg-gray-100 rounded-full h-2 border border-gray-200 shadow-inner">
                                      <div className="bg-emerald-600 h-1.5 rounded-full transition-all duration-500" style={{ width: `${avgEng}%` }} />
                                    </div>
                                  </div>

                                  <div className="space-y-1">
                                    <div className="flex justify-between items-baseline text-xs uppercase font-mono font-bold">
                                      <span className="text-gray-500">Average Confusion</span>
                                      <span className="text-purple-600">{avgConf}%</span>
                                    </div>
                                    <div className="w-full bg-gray-100 rounded-full h-2 border border-gray-200 shadow-inner">
                                      <div className="bg-purple-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${avgConf}%` }} />
                                    </div>
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100 text-center text-xs font-mono">
                                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                                    <p className="text-lg font-bold text-amber-600">{myProfile.totalAlertsTriggered}</p>
                                    <p className="text-[8px] uppercase text-gray-500">Alerts Flagged</p>
                                  </div>
                                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                                    <p className="text-lg font-bold text-emerald-600">{myProfile.totalAlertsResolved}</p>
                                    <p className="text-[8px] uppercase text-gray-500">Alerts Resolved</p>
                                  </div>
                                </div>
                              </div>
                            );
                          })() : (
                            <div className="py-8 text-center space-y-2 border border-dashed border-gray-200 rounded-xl bg-gray-50 p-6">
                              <p className="text-xs font-mono uppercase text-gray-400">No telemetry recorded yet</p>
                              <p className="text-[10px] text-gray-500 leading-relaxed font-sans max-w-sm mx-auto">
                                You do not have an active cumulative profile on record. Join an active classroom session and sync gaze telemetry to start collecting statistics.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {currentTab === 'dashboard' && !currentProfile && (
              <div className="max-w-md mx-auto p-8 bg-white border border-gray-200 rounded-2xl text-center space-y-4 shadow-sm">
                <AlertCircle className="w-8 h-8 text-blue-600 mx-auto" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-gray-850">Authentication Required</h3>
                <p className="text-xs text-gray-500">Please connect your Google Account to view your student or instructor dashboard.</p>
                <div className="pt-2">
                  <button
                    onClick={() => setCurrentTab('login')}
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-mono text-[10px] uppercase font-bold rounded-lg transition-all cursor-pointer shadow-sm"
                  >
                    Go to Secure Portal
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Sticky footer credits */}
      <footer className="w-full text-center py-4 text-[9px] uppercase tracking-wider text-gray-400 border-t border-gray-200 font-mono bg-white shadow-sm">
        EduSense OS &copy; {new Date().getFullYear()} &bull; SZABIST Smart Classroom Islamabad &bull; Platform Build Active
      </footer>
    </div>
  );
}
