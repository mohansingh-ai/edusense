import { auth, db } from "../firebase";
import { signInWithPopup, GoogleAuthProvider, signOut, User } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs, updateDoc, deleteDoc } from "firebase/firestore";
import { useState, useEffect, useRef } from "react";
import { UserProfile } from "../types";
import { LogIn, LogOut, Brain, Activity, ShieldCheck, User as UserIcon, Menu } from "lucide-react";

interface HeaderProps {
  onProfileLoaded: (profile: UserProfile | null) => void;
  currentProfile: UserProfile | null;
  currentTab: 'home' | 'about' | 'login' | 'dashboard' | 'admin';
  setCurrentTab: (tab: 'home' | 'about' | 'login' | 'dashboard' | 'admin') => void;
}

export default function Header({ onProfileLoaded, currentProfile, currentTab, setCurrentTab }: HeaderProps) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Guard callback using a mutable ref to ensure onAuthStateChanged never reconstructs or triggers loops
  const onProfileLoadedRef = useRef(onProfileLoaded);
  useEffect(() => {
    onProfileLoadedRef.current = onProfileLoaded;
  }, [onProfileLoaded]);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      setCurrentUser(user);
      if (user) {
        setLoading(true);
        try {
          const userRef = doc(db, "users", user.uid);
          let userSnap = await getDoc(userRef);

          if (!userSnap.exists() && user.email) {
            // Check if there is a pre-registered virtual profile with the same email
            const usersRef = collection(db, "users");
            const q = query(usersRef, where("email", "==", user.email.toLowerCase()));
            const querySnap = await getDocs(q);
            
            let virtualDocId: string | null = null;
            let virtualData: any = null;
            
            querySnap.forEach((d) => {
              if (d.id !== user.uid) {
                virtualDocId = d.id;
                virtualData = d.data();
              }
            });

            if (virtualDocId && virtualData) {
              console.log(`Promoting virtual user ${virtualDocId} to Google UID ${user.uid}`);
              
              // 1. Copy user document to user.uid
              const profileData = {
                ...virtualData,
                uid: user.uid,
                name: user.displayName || virtualData.name,
              } as UserProfile;
              await setDoc(userRef, profileData);
              
              // 2. Delete old virtual user document
              await deleteDoc(doc(db, "users", virtualDocId));

              // 3. Migrate course enrollments & instructor allocations
              const coursesSnap = await getDocs(collection(db, "courses"));
              for (const courseDoc of coursesSnap.docs) {
                const courseData = courseDoc.data();
                
                // Migrate instructor reference if matched
                if (courseData.teacherId === virtualDocId) {
                  await updateDoc(doc(db, "courses", courseDoc.id), {
                    teacherId: user.uid,
                    teacherEmail: user.email ? user.email.toLowerCase() : (courseData.teacherEmail || null)
                  });
                }

                const enrollmentRef = doc(db, "courses", courseDoc.id, "students", virtualDocId);
                const enrollmentSnap = await getDoc(enrollmentRef);
                if (enrollmentSnap.exists()) {
                  const enrollmentData = enrollmentSnap.data();
                  // Write new enrollment with Google UID and email
                  await setDoc(doc(db, "courses", courseDoc.id, "students", user.uid), {
                    ...enrollmentData,
                    studentId: user.uid,
                    studentEmail: user.email ? user.email.toLowerCase() : (enrollmentData.studentEmail || null)
                  });
                  // Delete old enrollment
                  await deleteDoc(enrollmentRef);
                }
              }

              // 4. Migrate student profile if exists
              const profileOldRef = doc(db, "studentProfiles", virtualDocId);
              const profileOldSnap = await getDoc(profileOldRef);
              if (profileOldSnap.exists()) {
                await setDoc(doc(db, "studentProfiles", user.uid), {
                  ...profileOldSnap.data(),
                  studentId: user.uid,
                });
                await deleteDoc(profileOldRef);
              }

              // Update snapshot state
              userSnap = await getDoc(userRef);
            }
          }

          const params = new URLSearchParams(window.location.search);
          const isJoiningRoom = params.has("room") || params.has("roomId");
          const savedPref = localStorage.getItem("user_role_preference") as "student" | "instructor" | null;
          const assignedRole = isJoiningRoom ? "student" as const : (savedPref || "student" as const);

          if (userSnap.exists()) {
            const profileData = userSnap.data() as UserProfile;
            // Database role always takes absolute precedence over localStorage to prevent incorrect role overrides
            localStorage.setItem("user_role_preference", profileData.role);
            onProfileLoadedRef.current(profileData);
          } else {
            // New user registration
            const dbProfile = {
              uid: user.uid,
              name: user.displayName || (isJoiningRoom ? "Smart Student" : "Smart Educator"),
              email: user.email || "",
              role: assignedRole,
              createdAt: serverTimestamp(),
            };
            await setDoc(userRef, dbProfile);
            localStorage.setItem("user_role_preference", assignedRole);
            onProfileLoadedRef.current({
              ...dbProfile,
              createdAt: new Date()
            } as UserProfile);
          }
        } catch (error) {
          console.error("Error creating/fetching user profile:", error);
          const params = new URLSearchParams(window.location.search);
          const isJoiningRoom = params.has("room") || params.has("roomId");
          const savedPref = localStorage.getItem("user_role_preference") as "student" | "instructor" | null;
          const assignedRole = isJoiningRoom ? "student" as const : (savedPref || "student" as const);

          localStorage.setItem("user_role_preference", assignedRole);
          onProfileLoadedRef.current({
            uid: user.uid,
            name: user.displayName || (isJoiningRoom ? "Smart Student" : "Smart Educator"),
            email: user.email || "",
            role: assignedRole,
            createdAt: new Date(),
          });
        }
      } else {
        // Enforce Gmail login - do not auto-login as guest!
        onProfileLoadedRef.current(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const terminateActiveSessions = async (userId: string) => {
    try {
      const q = query(
        collection(db, "sessions"),
        where("instructorId", "==", userId),
        where("status", "==", "active")
      );
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        await updateDoc(doc(db, "sessions", d.id), {
          status: "completed",
          completedAt: serverTimestamp()
        });
        const attSnap = await getDocs(collection(db, "sessions", d.id, "attendance"));
        for (const attDoc of attSnap.docs) {
          if (attDoc.data().status === "present") {
            await updateDoc(doc(db, "sessions", d.id, "attendance", attDoc.id), {
              status: "absent"
            });
          }
        }
      }
    } catch (e) {
      console.warn("Could not auto-terminate active sessions on logout/role switch:", e);
    }
  };

  const handleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleSignOut = async () => {
    try {
      if (currentProfile) {
        if (currentProfile.role === "instructor") {
          await terminateActiveSessions(currentProfile.uid);
        }
        if (currentProfile.uid.startsWith("guest_")) {
          localStorage.removeItem("guest_student_uid");
          localStorage.removeItem("guest_student_name");
        }
      }
      await signOut(auth);
      onProfileLoaded(null);
    } catch (error) {
      console.error("Signout failed:", error);
    }
  };



  return (
    <header className="border-b border-gray-200 bg-white sticky top-0 z-50 px-6 py-3 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
      {/* Brand Logo - Google Classroom Style */}
      <div className="flex items-center gap-3">
        <button className="text-gray-500 hover:text-gray-700 p-1 hover:bg-gray-100 rounded-full transition-colors cursor-pointer hidden md:block">
          <Menu className="w-5 h-5" />
        </button>
        <div className="bg-blue-600 p-2 rounded-lg text-white shadow-sm">
          <Brain className="w-5 h-5" />
        </div>
        <div>
          <h1 className="font-sans text-lg font-bold tracking-tight text-blue-600 flex items-center gap-1.5 uppercase">
            EduSense <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded font-mono font-normal tracking-normal normal-case border border-gray-200">v1.2</span>
          </h1>
          <p className="text-[9px] text-gray-500 font-mono tracking-wider uppercase font-semibold">SZABIST Smart Classroom</p>
        </div>
      </div>

      {/* Central Navigation Tabs */}
      <nav className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl border border-gray-200">
        <button
          onClick={() => setCurrentTab('home')}
          id="nav-home-btn"
          className={`px-4 py-2 rounded-lg font-sans text-xs font-semibold transition-all cursor-pointer ${
            currentTab === 'home'
              ? "bg-white text-blue-600 shadow-sm border border-gray-200"
              : "text-gray-600 hover:text-gray-900 hover:bg-gray-200"
          }`}
        >
          Home
        </button>
        <button
          onClick={() => setCurrentTab('about')}
          id="nav-about-btn"
          className={`px-4 py-2 rounded-lg font-sans text-xs font-semibold transition-all cursor-pointer ${
            currentTab === 'about'
              ? "bg-white text-blue-600 shadow-sm border border-gray-200"
              : "text-gray-600 hover:text-gray-900 hover:bg-gray-200"
          }`}
        >
          About
        </button>
        {currentProfile ? (
          <>
            <button
              onClick={() => setCurrentTab('dashboard')}
              id="nav-dashboard-btn"
              className={`px-4 py-2 rounded-lg font-sans text-xs font-semibold transition-all cursor-pointer ${
                currentTab === 'dashboard'
                  ? "bg-white text-blue-600 shadow-sm border border-gray-200"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-200"
              }`}
            >
              Dashboard
            </button>
            {currentProfile.role === "admin" && (
              <button
                onClick={() => setCurrentTab('admin')}
                id="nav-admin-btn"
                className={`px-4 py-2 rounded-lg font-sans text-xs font-semibold transition-all cursor-pointer ${
                  currentTab === 'admin'
                    ? "bg-red-500 text-white shadow-sm"
                    : "text-red-650 hover:bg-red-50 hover:text-red-700"
                }`}
              >
                Admin Console
              </button>
            )}
          </>
        ) : (
          <button
            onClick={() => setCurrentTab('login')}
            id="nav-login-btn"
            className={`px-4 py-2 rounded-lg font-sans text-xs font-semibold transition-all cursor-pointer ${
              currentTab === 'login'
                ? "bg-white text-blue-600 shadow-sm border border-gray-200"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-200"
            }`}
          >
            Login
          </button>
        )}
      </nav>

      {/* User Information Controls */}
      <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-gray-500 font-mono">
            <Activity className="w-4 h-4 animate-spin text-blue-500" />
            <span>Verifying session...</span>
          </div>
        ) : currentProfile ? (
          <div className="flex items-center gap-2.5 bg-gray-50 p-1.5 pr-3 rounded-full border border-gray-250 shadow-sm">
            {/* Avatar image */}
            {currentUser && currentUser.photoURL ? (
              <img
                src={currentUser.photoURL}
                alt={currentUser.displayName || "User"}
                className="w-7 h-7 rounded-full border border-gray-200"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100">
                <UserIcon className="w-3.5 h-3.5" />
              </div>
            )}

            {/* Profile specifications */}
            <div className="text-left hidden md:block">
              <input
                type="text"
                value={currentProfile.name}
                onChange={async (e) => {
                  const newName = e.target.value.substring(0, 30);
                  if (currentProfile.uid.startsWith("guest_")) {
                    localStorage.setItem("guest_student_name", newName);
                    onProfileLoaded({ ...currentProfile, name: newName });
                  } else {
                    onProfileLoaded({ ...currentProfile, name: newName });
                    try {
                      await setDoc(doc(db, "users", currentProfile.uid), { name: newName }, { merge: true });
                    } catch (err) {
                      console.warn("Could not save profile name update:", err);
                    }
                  }
                }}
                className="bg-white border border-gray-200 focus:border-blue-500 rounded px-2 py-0.5 text-xs text-gray-800 font-sans focus:outline-none w-28 font-semibold shadow-inner"
                placeholder="User Name"
              />
              <p className="text-[9px] font-mono text-gray-500 uppercase tracking-wide">
                {currentProfile.role} {currentProfile.uid.startsWith("guest_") && "(Guest)"}
              </p>
            </div>



            {/* Logout trigger */}
            <button
              onClick={handleSignOut}
              id="signout-btn"
              className="p-1 px-1.5 bg-white hover:bg-red-50 hover:text-red-650 text-gray-400 border border-gray-200 rounded-full transition-all cursor-pointer shadow-sm"
              title={currentProfile.uid.startsWith("guest_") ? "Exit Guest Mode" : "Sign Out"}
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <button
              onClick={handleSignIn}
              id="signin-btn"
              className="flex items-center gap-2 bg-blue-600 text-white font-sans text-xs font-semibold py-2 px-4 rounded-xl shadow-sm hover:bg-blue-700 transition-colors cursor-pointer uppercase tracking-wider"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Connect Account</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
