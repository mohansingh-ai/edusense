import React, { useState, useEffect } from "react";
import { db, handleFirestoreError, OperationType } from "../firebase";
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  serverTimestamp,
  query,
  where
} from "firebase/firestore";
import { UserProfile, StudentLearningProfile } from "../types";
import {
  Plus,
  Trash2,
  BookOpen,
  UserPlus,
  Users,
  Award,
  CircleCheck,
  Activity,
  UserCheck,
  Mail,
  Shield,
  BookMarked,
  Search,
  ExternalLink,
  GraduationCap,
  TrendingUp,
  BarChart2
} from "lucide-react";

interface Course {
  id: string;
  code: string;
  title: string;
  description?: string;
  teacherId?: string;
  teacherName?: string;
  teacherEmail?: string;
  createdAt: any;
}

interface EnrolledStudent {
  studentId: string;
  studentName: string;
  studentEmail?: string;
  assignedAt: any;
}

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

const DEFAULT_MOCK_COURSES: Course[] = [
  {
    id: "csc401_mock",
    code: "CSC-401",
    title: "Multimodal AI and Speech Processing",
    description: "Analyzing physiological cues, facial postures, and audio stress parameters in teaching environments.",
    teacherId: "instructor_1",
    teacherName: "Dr. Tariq Mahmood",
    createdAt: new Date()
  },
  {
    id: "sen302_mock",
    code: "SEN-302",
    title: "Software Engineering Essentials",
    description: "Architectural designs, refactoring patterns, and deployment configurations for scalable enterprise computing.",
    teacherId: "instructor_2",
    teacherName: "Prof. Sarah Qureshi",
    createdAt: new Date()
  },
  {
    id: "csc102_mock",
    code: "CSC-102",
    title: "Introduction to Smart Computing",
    description: "Foundational coursework exploring interactive systems, ambient smart sensor arrays, and user pacing analysis.",
    createdAt: new Date()
  }
];

export default function AdminWorkspace() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [enrolledStudents, setEnrolledStudents] = useState<EnrolledStudent[]>([]);

  // Form states - Add student/instructor
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState<'student' | 'instructor'>('student');
  const [addingUser, setAddingUser] = useState(false);

  // Form states - Add Course
  const [courseCode, setCourseCode] = useState("");
  const [courseTitle, setCourseTitle] = useState("");
  const [courseDesc, setCourseDesc] = useState("");
  const [addingCourse, setAddingCourse] = useState(false);

  // Search states
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [courseSearchQuery, setCourseSearchQuery] = useState("");

  const [notif, setNotif] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Admin workspace tabs
  const [adminTab, setAdminTab] = useState<'management' | 'profiles'>('management');

  // Student Learning Profiles from Firestore
  const [studentProfiles, setStudentProfiles] = useState<StudentLearningProfile[]>([]);
  const [profileSearchQuery, setProfileSearchQuery] = useState("");

  // Load all student learning profiles
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "studentProfiles"), (snap) => {
      const list: StudentLearningProfile[] = [];
      snap.forEach(d => list.push({ ...d.data() } as StudentLearningProfile));
      list.sort((a, b) => {
        const avgA = a.totalSessionsAttended > 0 ? a.totalAttentionSum / a.totalSessionsAttended : 0;
        const avgB = b.totalSessionsAttended > 0 ? b.totalAttentionSum / b.totalSessionsAttended : 0;
        return avgA - avgB; // lowest attention first
      });
      setStudentProfiles(list);
    }, (err) => {
      console.warn("Could not load student profiles for admin:", err);
      setStudentProfiles([]);
    });
    return () => unsub();
  }, []);

  const showNotif = (message: string, type: "success" | "error" = "success") => {
    setNotif({ message, type });
    setTimeout(() => {
      setNotif(null);
    }, 4500);
  };

  // 1. Sync all users in the system
  useEffect(() => {
    const usersRef = collection(db, "users");
    const unsub = onSnapshot(usersRef, (snap) => {
      const allUsers: UserProfile[] = [];
      snap.forEach((doc) => {
        allUsers.push({ ...doc.data(), uid: doc.id } as UserProfile);
      });
      if (allUsers.length > 0) {
        setUsers(allUsers);
      } else {
        setUsers([]);
      }
    }, (err) => {
      console.warn("User listing limited:", err);
      setUsers([]);
    });
    return () => unsub();
  }, []);

  // 2. Sync all courses in the system
  useEffect(() => {
    const coursesRef = collection(db, "courses");
    const unsub = onSnapshot(coursesRef, (snap) => {
      const allCourses: Course[] = [];
      snap.forEach((doc) => {
        allCourses.push({ ...doc.data(), id: doc.id } as Course);
      });
      if (allCourses.length > 0) {
        setCourses(allCourses);
      } else {
        setCourses([]);
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, "courses");
      setCourses([]);
    });
    return () => unsub();
  }, []);

  // 3. Sync enrolled students for the currently selected course
  useEffect(() => {
    if (!selectedCourse) {
      setEnrolledStudents([]);
      return;
    }

    const studentsRef = collection(db, "courses", selectedCourse.id, "students");
    const unsub = onSnapshot(studentsRef, (snap) => {
      const list: EnrolledStudent[] = [];
      snap.forEach(d => {
        list.push({ ...d.data() } as EnrolledStudent);
      });
      setEnrolledStudents(list);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `courses/${selectedCourse.id}/students`);
    });
    return () => unsub();
  }, [selectedCourse]);

  // Actions: Add Virtual User Profile
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim() || !userEmail.trim()) return;

    setAddingUser(true);
    const targetEmail = userEmail.trim().toLowerCase();

    try {
      // Check for pre-existing email in the system (unique email constraint)
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("email", "==", targetEmail));
      const snap = await getDocs(q);

      if (!snap.empty) {
        const existingUser = snap.docs[0].data() as UserProfile;
        showNotif(`Registration failed: '${targetEmail}' is already registered as a ${existingUser.role}.`, "error");
        setAddingUser(false);
        return;
      }

      const mockUid = `${userRole}_${Date.now()}`;
      const userPayload: UserProfile = {
        uid: mockUid,
        name: userName.trim(),
        email: targetEmail,
        role: userRole,
        createdAt: serverTimestamp()
      };

      await setDoc(doc(db, "users", mockUid), userPayload);
      showNotif(`Successfully registered virtual ${userRole}: ${userName}`);
      setUserName("");
      setUserEmail("");
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/email_check`);
      showNotif("Failed to register user to database.", "error");
    } finally {
      setAddingUser(false);
    }
  };

  // Actions: Add New Course
  const handleAddCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseCode.trim() || !courseTitle.trim()) return;

    setAddingCourse(true);
    const courseId = `course_${Date.now()}`;
    const coursePayload: Course = {
      id: courseId,
      code: courseCode.trim().toUpperCase(),
      title: courseTitle.trim(),
      description: courseDesc.trim(),
      createdAt: serverTimestamp()
    };

    try {
      await setDoc(doc(db, "courses", courseId), coursePayload);
      showNotif(`Successfully registered course: [${coursePayload.code}] ${coursePayload.title}`);
      setCourseCode("");
      setCourseTitle("");
      setCourseDesc("");
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `courses/${courseId}`);
      showNotif("Failed to add course catalog item.", "error");
    } finally {
      setAddingCourse(false);
    }
  };

  // Actions: Delete Course
  const handleDeleteCourse = async (courseId: string) => {
    if (!window.confirm("Are you sure you want to delete this course? All student enrollments will be wiped.")) return;

    try {
      // 1. Wipe enrollments subcollection
      const snap = await getDocs(collection(db, "courses", courseId, "students"));
      for (const d of snap.docs) {
        await deleteDoc(doc(db, "courses", courseId, "students", d.id));
      }
      // 2. Delete root course doc
      await deleteDoc(doc(db, "courses", courseId));
      showNotif("Course successfully deleted.");
      if (selectedCourse?.id === courseId) {
        setSelectedCourse(null);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `courses/${courseId}`);
      showNotif("Failed to complete course deletion.", "error");
    }
  };

  // Actions: Delete Virtual User Profile
  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm("Are you sure you want to delete this user profile? This will permanently remove their credential data and clear course links.")) return;

    try {
      const userToDelete = users.find(u => u.uid === userId);
      
      // Wipe dependencies
      if (userToDelete?.role === "student") {
        const coursesSnap = await getDocs(collection(db, "courses"));
        for (const courseDoc of coursesSnap.docs) {
          await deleteDoc(doc(db, "courses", courseDoc.id, "students", userId));
        }
      } else if (userToDelete?.role === "instructor") {
        const coursesSnap = await getDocs(collection(db, "courses"));
        for (const courseDoc of coursesSnap.docs) {
          const cData = courseDoc.data();
          if (cData.teacherId === userId) {
            await setDoc(doc(db, "courses", courseDoc.id), {
              teacherId: null,
              teacherName: null
            }, { merge: true });
          }
        }
      }

      await deleteDoc(doc(db, "users", userId));
      showNotif("User profile successfully deleted.");
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${userId}`);
      showNotif("Failed to delete user profile.", "error");
    }
  };

  // Actions: Assign Teacher
  const handleAssignTeacher = async (courseId: string, teacherId: string) => {
    const instructor = users.find(u => u.uid === teacherId);
    try {
      await setDoc(doc(db, "courses", courseId), {
        teacherId: teacherId || null,
        teacherName: instructor ? instructor.name : null,
        teacherEmail: instructor ? instructor.email : null
      }, { merge: true });
      showNotif("Instructor allocation updated successfully.");
      if (selectedCourse?.id === courseId) {
        setSelectedCourse(prev => prev ? {
          ...prev,
          teacherId: teacherId || undefined,
          teacherName: instructor ? instructor.name : undefined
        } : null);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `courses/${courseId}`);
      showNotif("Instructor assignment failed.", "error");
    }
  };

  // Actions: Enroll Student
  const handleEnrollStudent = async (courseId: string, studentId: string) => {
    const student = users.find(u => u.uid === studentId);
    if (!student) return;

    try {
      await setDoc(doc(db, "courses", courseId, "students", studentId), {
        studentId,
        studentName: student.name,
        studentEmail: student.email,
        assignedAt: serverTimestamp()
      });
      showNotif(`Enrolled student ${student.name} in course.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `courses/${courseId}/students/${studentId}`);
      showNotif("Enrollment write failed.", "error");
    }
  };

  // Actions: Unenroll Student
  const handleUnenrollStudent = async (courseId: string, studentId: string) => {
    if (!window.confirm("Disenroll student from this course?")) return;

    try {
      await deleteDoc(doc(db, "courses", courseId, "students", studentId));
      showNotif("Student unenrolled successfully.");
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `courses/${courseId}/students/${studentId}`);
      showNotif("Student unenrollment failed.", "error");
    }
  };

  // Filters
  const filteredCourses = courses.filter(c =>
    c.title.toLowerCase().includes(courseSearchQuery.toLowerCase()) ||
    c.code.toLowerCase().includes(courseSearchQuery.toLowerCase())
  );

  const students = users.filter(u => 
    u.role === "student" && 
    (u.uid.toLowerCase().includes(userSearchQuery.toLowerCase()) || 
     u.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
     u.email.toLowerCase().includes(userSearchQuery.toLowerCase()))
  );
  const instructors = users.filter(u => 
    u.role === "instructor" && 
    (u.uid.toLowerCase().includes(userSearchQuery.toLowerCase()) || 
     u.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
     u.email.toLowerCase().includes(userSearchQuery.toLowerCase()))
  );

  // Risk badge helper (used in both tabs)
  const getRiskBadge = (profile: StudentLearningProfile) => {
    if (profile.totalSessionsAttended === 0) return { label: 'No Data', bg: 'bg-gray-50', text: 'text-gray-500', border: 'border-gray-200', dotColor: 'bg-gray-400' };
    const avg = profile.totalAttentionSum / profile.totalSessionsAttended;
    if (avg >= 75) return { label: 'High Performer', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dotColor: 'bg-emerald-500' };
    if (avg >= 50) return { label: 'At Risk', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dotColor: 'bg-amber-400' };
    return { label: 'Critical', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dotColor: 'bg-red-500' };
  };

  const filteredProfiles = studentProfiles.filter(p =>
    p.studentName.toLowerCase().includes(profileSearchQuery.toLowerCase()) ||
    p.studentId.toLowerCase().includes(profileSearchQuery.toLowerCase())
  );

  return (
    <div id="admin-workspace-root" className="max-w-6xl mx-auto px-6 py-6 space-y-8 font-sans text-left text-gray-800">
      {/* Page Header */}
      <div className="space-y-1">
        <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-xs font-semibold border border-blue-150 uppercase tracking-wide">
          Admin Console
        </span>
        <h2 className="text-xl font-bold text-gray-900 uppercase tracking-tight mt-3">SZABIST Node Administrator</h2>
        <p className="text-xs text-gray-500 font-semibold uppercase">Manage Campus Courses, Roster Allocations, and Virtual Logins</p>
      </div>

      {/* Admin Sub-Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setAdminTab('management')}
          className={`py-3 px-6 text-xs uppercase tracking-wider font-bold transition-all cursor-pointer border-b-2 flex items-center gap-1.5 ${
            adminTab === 'management'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-100/50'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          Campus Management
        </button>
        <button
          onClick={() => setAdminTab('profiles')}
          className={`py-3 px-6 text-xs uppercase tracking-wider font-bold transition-all cursor-pointer border-b-2 flex items-center gap-1.5 ${
            adminTab === 'profiles'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-100/50'
          }`}
        >
          <GraduationCap className="w-3.5 h-3.5" />
          Student Learning Profiles
          {studentProfiles.length > 0 && (
            <span className="ml-1 bg-indigo-100 text-indigo-700 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded">
              {studentProfiles.length}
            </span>
          )}
        </button>
      </div>

      {/* Notification Toast */}
      {notif && (
        <div className={`fixed bottom-6 right-6 p-4 rounded-xl shadow-lg flex items-center gap-2 border text-xs z-50 transition-all duration-300 bg-white ${
          notif.type === "error" ? "border-red-200 text-red-700" : "border-emerald-200 text-emerald-700"
        }`}>
          <CircleCheck className={`w-4 h-4 ${notif.type === "error" ? "text-red-650" : "text-emerald-600"}`} />
          <span className="font-semibold">{notif.message}</span>
        </div>
      )}

      {/* ===== CAMPUS MANAGEMENT TAB ===== */}
      {adminTab === 'management' && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* LEFT COLUMN: REGISTRATION AND FORM WORKSPACES */}
            <div className="space-y-6">
              {/* Section: Add Teacher / Student */}
              <div className="bg-white border border-gray-200 p-6 rounded-xl shadow-sm space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-blue-600 flex items-center gap-2">
                  <UserPlus className="w-4 h-4" />
                  <span>Pre-Register Virtual Profile</span>
                </h3>
                
                <form onSubmit={handleAddUser} className="space-y-3.5">
                  <div>
                    <label className="block text-[10px] font-mono font-bold text-gray-400 uppercase mb-1.5">User Full Name</label>
                    <input
                      type="text"
                      required
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      placeholder="e.g. Dr. Arthur Smith"
                      className="w-full bg-white border border-gray-250 rounded-lg px-4 py-2 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-500 shadow-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono font-bold text-gray-400 uppercase mb-1.5">User Email Address</label>
                    <input
                      type="email"
                      required
                      value={userEmail}
                      onChange={(e) => setUserEmail(e.target.value)}
                      placeholder="e.g. arthur.smith@szabist.edu.pk"
                      className="w-full bg-white border border-gray-250 rounded-lg px-4 py-2 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-500 shadow-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono font-bold text-gray-400 uppercase mb-1.5">System Campus Role</label>
                    <div className="grid grid-cols-2 gap-2 bg-gray-150 p-1 rounded-xl border border-gray-200">
                      <button
                        type="button"
                        onClick={() => setUserRole('student')}
                        className={`py-2 px-3 rounded-lg font-sans text-xs uppercase font-bold transition-all cursor-pointer ${
                          userRole === "student"
                            ? "bg-blue-600 text-white shadow-sm"
                            : "text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                        }`}
                      >
                        Student
                      </button>
                      <button
                        type="button"
                        onClick={() => setUserRole('instructor')}
                        className={`py-2 px-3 rounded-lg font-sans text-xs uppercase font-bold transition-all cursor-pointer ${
                          userRole === "instructor"
                            ? "bg-blue-600 text-white shadow-sm"
                            : "text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                        }`}
                      >
                        Instructor
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={addingUser}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-sans text-xs font-bold uppercase py-2.5 px-4 rounded-xl shadow-sm transition-all cursor-pointer"
                  >
                    {addingUser ? "Registering..." : `Register Virtual ${userRole === 'instructor' ? 'Instructor' : 'Student'}`}
                  </button>
                </form>
              </div>

              {/* Section: Register Course */}
              <div className="bg-white border border-gray-200 p-6 rounded-xl shadow-sm space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-blue-600 flex items-center gap-2">
                  <BookMarked className="w-4 h-4" />
                  <span>Register New Course</span>
                </h3>

                <form onSubmit={handleAddCourse} className="space-y-3.5">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-1">
                      <label className="block text-[10px] font-mono font-bold text-gray-400 uppercase mb-1.5">Code</label>
                      <input
                        type="text"
                        required
                        maxLength={15}
                        value={courseCode}
                        onChange={(e) => setCourseCode(e.target.value)}
                        placeholder="CS-101"
                        className="w-full bg-white border border-gray-250 rounded-lg px-3 py-2 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-500 shadow-sm font-mono"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] font-mono font-bold text-gray-400 uppercase mb-1.5">Course Name</label>
                      <input
                        type="text"
                        required
                        value={courseTitle}
                        onChange={(e) => setCourseTitle(e.target.value)}
                        placeholder="e.g. Artificial Intelligence"
                        className="w-full bg-white border border-gray-250 rounded-lg px-3 py-2 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-500 shadow-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono font-bold text-gray-400 uppercase mb-1.5">Brief Syllabus Summary</label>
                    <textarea
                      value={courseDesc}
                      onChange={(e) => setCourseDesc(e.target.value)}
                      placeholder="e.g. Overview of state-space search, reinforcement learning, and neural nets"
                      rows={2}
                      className="w-full bg-white border border-gray-250 rounded-lg px-4 py-2 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-500 shadow-sm font-sans"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={addingCourse}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-sans text-xs font-bold uppercase py-2.5 px-4 rounded-xl shadow-sm transition-all cursor-pointer"
                  >
                    {addingCourse ? "Registering..." : "Add Course to Catalog"}
                  </button>
                </form>
              </div>
            </div>

            {/* MIDDLE COLUMN: COURSE REGISTRY */}
            <div className="space-y-6">
              <div className="bg-white border border-gray-200 p-6 rounded-xl shadow-sm space-y-4 flex flex-col h-[520px]">
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-blue-600 flex items-center gap-2">
                    <BookOpen className="w-4 h-4" />
                    <span>Active Course Catalog ({courses.length})</span>
                  </h3>
                  
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      value={courseSearchQuery}
                      onChange={(e) => setCourseSearchQuery(e.target.value)}
                      placeholder="Search course title or code..."
                      className="w-full bg-gray-50 border border-gray-205 rounded-xl px-9 py-2 text-[11px] text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-500 shadow-inner"
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                  {filteredCourses.length === 0 ? (
                    <div className="text-center py-12 border border-dashed border-gray-200 rounded-xl space-y-2">
                      <BookOpen className="w-6 h-6 text-gray-400 mx-auto" />
                      <p className="text-[10px] font-mono text-gray-400 uppercase">No Courses Found</p>
                    </div>
                  ) : (
                    filteredCourses.map(course => (
                      <div
                        key={course.id}
                        onClick={() => setSelectedCourse(course)}
                        className={`p-4 rounded-xl border text-left transition-all cursor-pointer relative group ${
                          selectedCourse?.id === course.id
                            ? "bg-blue-50 border-blue-200"
                            : "bg-gray-50 border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1">
                            <span className="bg-white border border-gray-200 px-2 py-0.5 rounded font-mono text-[9px] uppercase tracking-wider text-blue-650 font-bold">
                              {course.code}
                            </span>
                            <h4 className="text-xs font-bold text-gray-850 uppercase mt-1 leading-tight">{course.title}</h4>
                          </div>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCourse(course.id);
                            }}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete Course"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <p className="text-[10px] text-gray-500 line-clamp-2 mt-2 leading-relaxed font-sans">
                          {course.description || "No syllabus outline documented."}
                        </p>

                        <div className="mt-3 pt-2.5 border-t border-gray-150 flex flex-col gap-1">
                          <p className="text-[9.5px] font-mono text-gray-450 flex items-center gap-1.5">
                            <Award className="w-3.5 h-3.5 text-gray-400" />
                            <span>Teacher:</span>
                            <span className="text-gray-700 font-sans font-semibold">
                              {course.teacherName || "Unassigned"}
                            </span>
                          </p>
                        </div>

                        {/* Quick Teacher Assign Dropdown */}
                        <div className="mt-2.5">
                          <select
                            value={course.teacherId || ""}
                            onChange={(e) => handleAssignTeacher(course.id, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1 text-[10px] font-sans font-semibold text-gray-600 focus:outline-none shadow-sm"
                          >
                            <option value="">-- Assign Instructor --</option>
                            {instructors.map(tch => (
                              <option key={tch.uid} value={tch.uid}>
                                Assign: {tch.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: ENROLLING */}
            <div className="space-y-6">
              {selectedCourse ? (
                <div className="bg-white border border-gray-200 p-6 rounded-xl shadow-sm h-[520px] flex flex-col justify-between">
                  <div className="space-y-4 flex flex-col flex-1 overflow-hidden">
                    <div className="border-b border-gray-150 pb-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs text-blue-650 font-bold">{selectedCourse.code}</span>
                        <span className="text-[9px] text-gray-400 font-mono">ID: {selectedCourse.id}</span>
                      </div>
                      <h4 className="text-sm font-bold text-gray-900 uppercase mt-1 leading-snug">{selectedCourse.title}</h4>
                      <p className="text-[9px] font-mono text-gray-450 uppercase">
                        Assigned educator: <span className="text-blue-600 font-bold">{selectedCourse.teacherName || "None Assigned"}</span>
                      </p>
                    </div>

                    <div className="flex-1 flex flex-col overflow-hidden space-y-2.5">
                      <h5 className="text-[10px] font-mono uppercase tracking-wider text-gray-500 flex items-center justify-between font-bold">
                        <span>Enrolled Students ({enrolledStudents.length})</span>
                      </h5>

                      <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                        {enrolledStudents.length === 0 ? (
                          <div className="text-center py-10 border border-gray-150 rounded-xl bg-gray-50 text-gray-400">
                            <Users className="w-5 h-5 text-gray-300 mx-auto mb-1" />
                            <p className="text-[9.5px] font-mono uppercase">Roster is empty.</p>
                          </div>
                        ) : (
                          enrolledStudents.map(student => (
                            <div key={student.studentId} className="bg-gray-50 p-2.5 rounded-xl border border-gray-200 flex items-center justify-between text-xs">
                              <div className="text-left">
                                <p className="font-semibold text-gray-800">{student.studentName}</p>
                                {student.studentEmail && (
                                  <p className="text-[8.5px] text-gray-400 font-mono">{student.studentEmail}</p>
                                )}
                              </div>
                              <button
                                onClick={() => handleUnenrollStudent(selectedCourse.id, student.studentId)}
                                className="p-1 text-gray-400 hover:text-red-600"
                                title="Unenroll student"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>

                      <div className="pt-2 border-t border-gray-150 space-y-1.5">
                        <label htmlFor="enroll-student-select" className="text-[9px] font-mono uppercase text-gray-500 font-bold block">Enroll Registered Student</label>
                        <select
                          id="enroll-student-select"
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val) {
                              handleEnrollStudent(selectedCourse.id, val);
                              e.target.value = "";
                            }
                          }}
                          className="w-full bg-white border border-gray-250 rounded-xl px-3 py-2 text-xs text-gray-600 focus:outline-none shadow-sm"
                        >
                          <option value="">-- Choose student --</option>
                          {students.map(std => {
                            const isEnrolled = enrolledStudents.some(es => es.studentId === std.uid);
                            return (
                              <option key={std.uid} value={std.uid} disabled={isEnrolled}>
                                {std.name} {isEnrolled ? "(Enrolled)" : ""}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm h-[520px] flex flex-col items-center justify-center p-8 text-center space-y-3">
                  <BookOpen className="w-8 h-8 text-gray-300 animate-pulse" />
                  <div className="space-y-1">
                    <h4 className="text-xs font-mono uppercase text-gray-550 font-bold">Course Details Pane</h4>
                    <p className="text-[10.5px] text-gray-400 max-w-xs font-sans">
                      Select any course in the middle column to allocate educators, inspect enrollment lists, or enroll students.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* USER LIST REGISTRY */}
          <div className="bg-white border border-gray-200 p-6 rounded-xl shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-blue-600 flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span>Campus Registry ({users.length})</span>
              </h3>

              <div className="relative w-full md:w-72">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  placeholder="Search people by name or email..."
                  className="w-full bg-gray-50 border border-gray-205 rounded-lg px-8 py-1.5 text-xs text-gray-700 placeholder-gray-400 focus:outline-none focus:border-blue-500 shadow-inner"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-60 overflow-y-auto">
              {/* Student Registry List */}
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-2">
                <h4 className="text-[10px] font-mono text-blue-600 uppercase tracking-widest font-bold">Students Database ({students.length})</h4>
                <div className="space-y-1.5">
                  {students.length === 0 ? (
                    <p className="text-[10px] text-gray-400 font-mono">No virtual student accounts registered.</p>
                  ) : (
                    students.map(s => {
                      return (
                        <div key={s.uid} className="bg-white border border-gray-200 p-2.5 rounded-lg flex items-center justify-between text-left shadow-sm">
                          <div className="space-y-0.5">
                            <p className="text-xs font-semibold text-gray-800">{s.name}</p>
                            <p className="text-[9px] text-gray-400 font-mono">{s.email}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[8.5px] bg-blue-50 text-blue-650 border border-blue-150 font-mono px-2 py-0.5 rounded-full font-bold">
                              {s.uid}
                            </span>
                            <button
                              onClick={() => handleDeleteUser(s.uid)}
                              className="p-1 text-gray-400 hover:text-red-655 hover:bg-gray-100 rounded transition-colors cursor-pointer"
                              title="Delete Student Profile"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Instructor Registry List */}
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-2">
                <h4 className="text-[10px] font-mono text-blue-600 uppercase tracking-widest font-bold">Instructors Database ({instructors.length})</h4>
                <div className="space-y-1.5">
                  {instructors.length === 0 ? (
                    <p className="text-[10px] text-gray-400 font-mono">No virtual instructor accounts registered.</p>
                  ) : (
                    instructors.map(i => (
                      <div key={i.uid} className="bg-white border border-gray-200 p-2.5 rounded-lg flex items-center justify-between text-left shadow-sm">
                        <div className="space-y-0.5">
                          <p className="text-xs font-semibold text-gray-800">{i.name}</p>
                          <p className="text-[9px] text-gray-400 font-mono">{i.email}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[8.5px] bg-emerald-50 text-emerald-650 border border-emerald-150 font-mono px-2 py-0.5 rounded-full font-bold">
                            {i.uid}
                          </span>
                          <button
                            onClick={() => handleDeleteUser(i.uid)}
                            className="p-1 text-gray-400 hover:text-red-655 hover:bg-gray-100 rounded transition-colors cursor-pointer"
                            title="Delete Instructor Profile"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ===== STUDENT LEARNING PROFILES TAB ===== */}
      {adminTab === 'profiles' && (
        <div className="space-y-5">
          {/* Summary Stats Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">{studentProfiles.length}</p>
                <p className="text-[9px] font-mono uppercase text-gray-500">Profiled Students</p>
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">
                  {studentProfiles.length > 0
                    ? Math.round(studentProfiles.reduce((sum, p) => sum + (p.totalSessionsAttended > 0 ? p.totalAttentionSum / p.totalSessionsAttended : 0), 0) / studentProfiles.length)
                    : 0}%
                </p>
                <p className="text-[9px] font-mono uppercase text-gray-500">Campus Avg Attention</p>
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center">
                <BarChart2 className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">
                  {studentProfiles.filter(p => {
                    if (p.totalSessionsAttended === 0) return false;
                    return (p.totalAttentionSum / p.totalSessionsAttended) < 50;
                  }).length}
                </p>
                <p className="text-[9px] font-mono uppercase text-gray-500">Critical Attention Students</p>
              </div>
            </div>
          </div>

          {/* Search + Main Table Panel */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
            <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-600 flex items-center gap-2">
                  <GraduationCap className="w-4 h-4" />
                  All Student Learning Profiles
                </h3>
                <p className="text-[10px] text-gray-500 mt-0.5">Cumulative attention data from all completed classroom sessions</p>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={profileSearchQuery}
                  onChange={(e) => setProfileSearchQuery(e.target.value)}
                  placeholder="Search by student name or ID..."
                  className="w-full bg-gray-50 border border-gray-205 rounded-lg px-8 py-1.5 text-xs text-gray-700 placeholder-gray-400 focus:outline-none focus:border-indigo-500 shadow-inner"
                />
              </div>
            </div>

            {filteredProfiles.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <GraduationCap className="w-8 h-8 text-gray-300 mx-auto" />
                <p className="text-[10px] font-mono uppercase text-gray-400">
                  {studentProfiles.length === 0
                    ? 'No student profiles recorded yet. Profiles are saved when a session ends.'
                    : 'No profiles match your search query.'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {/* Table Header */}
                <div className="hidden sm:grid grid-cols-12 gap-4 px-5 py-2.5 bg-gray-50 text-[9px] font-mono uppercase tracking-widest text-gray-400 font-bold">
                  <div className="col-span-3">Student</div>
                  <div className="col-span-2 text-center">Sessions</div>
                  <div className="col-span-3">Avg Attention</div>
                  <div className="col-span-2">Avg Engagement</div>
                  <div className="col-span-2 text-right">Risk Level</div>
                </div>

                {filteredProfiles.map(profile => {
                  const avgAtt = profile.totalSessionsAttended > 0
                    ? Math.round(profile.totalAttentionSum / profile.totalSessionsAttended)
                    : 0;
                  const avgEng = profile.totalSessionsAttended > 0
                    ? Math.round(profile.totalEngagementSum / profile.totalSessionsAttended)
                    : 0;
                  const badge = getRiskBadge(profile);

                  return (
                    <div key={profile.studentId} className="grid grid-cols-1 sm:grid-cols-12 gap-4 px-5 py-4 hover:bg-gray-50 transition-colors items-center">
                      {/* Student name + avatar */}
                      <div className="col-span-3 flex items-center gap-3">
                        <div className="relative shrink-0">
                          <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center text-xs font-bold text-indigo-600 uppercase">
                            {profile.studentName.charAt(0)}
                          </div>
                          <span className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border border-white ${badge.dotColor}`} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-gray-800 truncate">{profile.studentName}</p>
                          <p className="text-[8.5px] font-mono text-gray-400 truncate">{profile.studentId}</p>
                        </div>
                      </div>

                      {/* Sessions count */}
                      <div className="col-span-2 text-center">
                        <p className="text-sm font-bold text-gray-700">{profile.totalSessionsAttended}</p>
                        <p className="text-[8px] font-mono text-gray-400 uppercase">sessions</p>
                      </div>

                      {/* Avg Attention bar */}
                      <div className="col-span-3">
                        <div className="flex justify-between text-[9px] font-mono mb-1">
                          <span className="text-gray-500">Attention</span>
                          <span className={`font-bold ${
                            avgAtt >= 75 ? 'text-emerald-600' : avgAtt >= 50 ? 'text-amber-600' : 'text-red-600'
                          }`}>{avgAtt}%</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2 border border-gray-200">
                          <div
                            className={`h-1.5 rounded-full transition-all duration-700 ${
                              avgAtt >= 75 ? 'bg-emerald-500' : avgAtt >= 50 ? 'bg-amber-400' : 'bg-red-500'
                            }`}
                            style={{ width: `${avgAtt}%` }}
                          />
                        </div>
                      </div>

                      {/* Avg Engagement */}
                      <div className="col-span-2">
                        <p className="text-xs font-bold text-blue-600">{avgEng}%</p>
                        <p className="text-[8px] font-mono text-gray-400 uppercase">engagement</p>
                      </div>

                      {/* Risk badge */}
                      <div className="col-span-2 flex justify-end">
                        <span className={`text-[8.5px] font-mono font-bold px-2.5 py-1 rounded border uppercase tracking-wide ${badge.bg} ${badge.text} ${badge.border}`}>
                          {badge.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
