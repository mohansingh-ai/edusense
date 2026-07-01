import React, { useState, useEffect, useRef } from "react";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { doc, getDoc, setDoc, addDoc, collection, updateDoc, serverTimestamp, onSnapshot } from "firebase/firestore";
import { Video, Shield, ShieldOff, Send, CheckCircle2, UserCheck, AlertTriangle, AlertCircle, RefreshCw } from "lucide-react";
import { StudentLearningProfile } from "../types";

interface StudentClientProps {
  sessionId: string;
  sessionTitle: string;
  studentId: string;
  studentName: string;
}

export default function StudentClient({ sessionId, sessionTitle, studentId, studentName }: StudentClientProps) {
  const [cameraActive, setCameraActive] = useState(false);
  const [privacyBlur, setPrivacyBlur] = useState(false);
  const [joined, setJoined] = useState(false);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [checkInError, setCheckInError] = useState<string | null>(null);
  const [editableName, setEditableName] = useState(studentName);

  // Heartbeat tracking for instructor online check
  const [instructorActive, setInstructorActive] = useState(true);
  const [exitCountdown, setExitCountdown] = useState<number | null>(null);

  useEffect(() => {
    setEditableName(studentName);
  }, [studentName]);

  // Real physical FaceMesh tracking properties
  const [isFaceDetected, setIsFaceDetected] = useState<boolean | null>(null);
  const lastLandmarksRef = useRef<any[] | null>(null);

  // Simulation controls to test different states inside the sandbox frame
  const [mockState, setMockState] = useState<'focused' | 'distracted' | 'confused' | 'drowsy'>('focused');
  const [intendedState, setIntendedState] = useState<'focused' | 'distracted' | 'confused' | 'drowsy'>('focused');
  
  // Real-time calculated telemetry values
  const [liveAttention, setLiveAttention] = useState(90);
  const [liveEngagement, setLiveEngagement] = useState(85);
  const [liveConfusion, setLiveConfusion] = useState(10);
  const [currentGaze, setCurrentGaze] = useState("Center Gaze");
  const [currentEmotion, setCurrentEmotion] = useState("Engaged");

  const [sessionEnded, setSessionEnded] = useState(false);
  const [myProfile, setMyProfile] = useState<StudentLearningProfile | null>(null);

  // Listen to cumulative student profile
  useEffect(() => {
    if (!studentId) return;
    const profileRef = doc(db, "studentProfiles", studentId);
    const unsub = onSnapshot(profileRef, (snap) => {
      if (snap.exists()) {
        setMyProfile(snap.data() as StudentLearningProfile);
      } else {
        setMyProfile(null);
      }
    }, (err) => {
      console.warn("Could not load student profile:", err);
      setMyProfile(null);
    });
    return () => unsub();
  }, [studentId, sessionId]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Sync real-time attendance telemetry to Firestore
  useEffect(() => {
    let interval: any;
    if (joined && instructorActive) {
      interval = setInterval(() => {
        let attention = 90;
        let engagement = 85;
        let confusion = 10;
        let gaze = "Center Gaze";
        let emotion = "Engaged";

        if (cameraActive && isFaceDetected === false) {
          attention = 0;
          engagement = 0;
          confusion = 0;
          gaze = "No Face Present";
          emotion = "Absent / Camera Empty";
        } else {
          switch (mockState) {
            case 'focused':
              attention = 92 + Math.random() * 8;
              engagement = 85 + Math.random() * 12;
              confusion = Math.max(0, 2 + Math.random() * 8);
              gaze = "Primary Gaze";
              emotion = "Attentive";
              break;
            case 'distracted':
              attention = 12 + Math.random() * 12;
              engagement = 15 + Math.random() * 15;
              confusion = Math.max(0, 5 + Math.random() * 10);
              gaze = "Left Distracted";
              emotion = "Disengaged";
              break;
            case 'confused':
              attention = 75 + Math.random() * 15;
              engagement = 65 + Math.random() * 15;
              confusion = 75 + Math.random() * 20;
              gaze = "Squinting / Screen Gaze";
              emotion = "Puzzled";
              break;
            case 'drowsy':
              attention = Math.max(0, 3 + Math.random() * 8);
              engagement = 5 + Math.random() * 10;
              confusion = Math.max(0, 2 + Math.random() * 6);
              gaze = "Closed Eyes / Head Slumped";
              emotion = "Drowsy";
              break;
          }
        }

        setLiveAttention(Math.round(attention));
        setLiveEngagement(Math.round(engagement));
        setLiveConfusion(Math.round(confusion));
        setCurrentGaze(gaze);
        setCurrentEmotion(emotion);

        const attendanceId = `${sessionId}_${studentId}`;
        const attendancePath = `sessions/${sessionId}/attendance/${attendanceId}`;
        const dataPayload = {
          activeParticipationScore: Math.round(engagement),
          averageAttention: Math.round(attention),
          confusion: Math.round(liveConfusion),
          lastActiveAt: serverTimestamp(),
          studentName: editableName,
          status: "present" as const,
        };

        updateDoc(doc(db, "sessions", sessionId, "attendance", attendanceId), dataPayload)
          .catch((err) => handleFirestoreError(err, OperationType.WRITE, attendancePath));

        const activeState = (cameraActive && isFaceDetected === false) ? 'distracted' : mockState;
        if (activeState === 'distracted' || activeState === 'drowsy' || activeState === 'confused') {
          const type = activeState === 'drowsy' ? 'sleeping' : (activeState === 'distracted' ? 'distracted' : 'low_attention');
          if (Math.random() > 0.60) {
            const alertsRef = collection(db, "sessions", sessionId, "alerts");
            addDoc(alertsRef, {
              sessionId,
              studentId,
              studentName: editableName,
              type,
              timestamp: serverTimestamp(),
              resolved: false
            }).catch((err) => handleFirestoreError(err, OperationType.WRITE, `sessions/${sessionId}/alerts`));
          }
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [joined, mockState, cameraActive, isFaceDetected, sessionId, studentId, editableName, instructorActive]);

  // Tab-focus / Window visibility detector
  useEffect(() => {
    if (!joined) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        setMockState("distracted");
      } else {
        setMockState(intendedState);
      }
    };

    const handleWindowBlur = () => {
      setMockState("distracted");
    };

    const handleWindowFocus = () => {
      setMockState(intendedState);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("focus", handleWindowFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [joined, intendedState]);

  // Handle active camera permission streaming and face mesh
  useEffect(() => {
    let activeCamera: any = null;
    let faceMeshInstance: any = null;

    if (cameraActive) {
      const FaceMeshLib = (window as any).FaceMesh;
      const CameraLib = (window as any).Camera;

      if (FaceMeshLib && CameraLib) {
        try {
          faceMeshInstance = new FaceMeshLib({
            locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
          });

          faceMeshInstance.setOptions({
            maxNumFaces: 1,
            refineLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5,
          });

          faceMeshInstance.onResults((results: any) => {
            if (results && results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
              setIsFaceDetected(true);
              const landmarks = results.multiFaceLandmarks[0];
              lastLandmarksRef.current = landmarks;

              const leftTop = landmarks[159];
              const leftBottom = landmarks[145];
              const leftInner = landmarks[133];
              const leftOuter = landmarks[33];

              const rightTop = landmarks[386];
              const rightBottom = landmarks[374];
              const rightInner = landmarks[362];
              const rightOuter = landmarks[263];

              if (leftTop && leftBottom && leftInner && leftOuter && rightTop && rightBottom && rightInner && rightOuter) {
                const leftVertical = Math.hypot(leftTop.x - leftBottom.x, leftTop.y - leftBottom.y);
                const leftHorizontal = Math.hypot(leftInner.x - leftOuter.x, leftInner.y - leftOuter.y);
                const leftEAR = leftVertical / (leftHorizontal || 0.001);

                const rightVertical = Math.hypot(rightTop.x - rightBottom.x, rightTop.y - rightBottom.y);
                const rightHorizontal = Math.hypot(rightInner.x - rightOuter.x, rightInner.y - rightOuter.y);
                const rightEAR = rightVertical / (rightHorizontal || 0.001);

                const averageEAR = (leftEAR + rightEAR) / 2;

                const nose = landmarks[1];
                const chin = landmarks[152];
                if (nose && chin) {
                  const leftEyeDist = Math.hypot(nose.x - leftOuter.x, nose.y - leftOuter.y);
                  const rightEyeDist = Math.hypot(nose.x - rightOuter.x, nose.y - rightOuter.y);
                  const yawRatio = leftEyeDist / (rightEyeDist || 0.001);

                  const centerEyeY = (leftOuter.y + rightOuter.y) / 2;
                  const noseVertical = nose.y - centerEyeY;
                  const chinVertical = chin.y - nose.y;
                  const pitchRatio = noseVertical / (chinVertical || 0.001);

                  const leftIris = landmarks[468];
                  let irisOffset = 0;
                  if (leftIris) {
                    const midpointEyeX = (leftInner.x + leftOuter.x) / 2;
                    irisOffset = (leftIris.x - midpointEyeX) / (leftHorizontal || 0.001);
                  }

                  let stateDecision: 'focused' | 'distracted' | 'confused' | 'drowsy' = 'focused';

                  if (averageEAR < 0.15) {
                    stateDecision = 'drowsy';
                  } else if (yawRatio < 0.65 || yawRatio > 1.55 || Math.abs(irisOffset) > 0.35 || pitchRatio < 0.15 || pitchRatio > 0.85) {
                    stateDecision = 'distracted';
                  } else if (averageEAR < 0.22) {
                    stateDecision = 'confused';
                  }

                  setMockState(stateDecision);
                }
              }
            } else {
              setIsFaceDetected(false);
              lastLandmarksRef.current = null;
            }
          });

          if (videoRef.current) {
            activeCamera = new CameraLib(videoRef.current, {
              onFrame: async () => {
                if (videoRef.current && faceMeshInstance) {
                  try {
                    await faceMeshInstance.send({ image: videoRef.current });
                  } catch (e) {
                    // Frame error ignored
                  }
                }
              },
              width: 440,
              height: 330,
            });
            activeCamera.start();
          }
        } catch (err) {
          console.error("Camera utilities load failure, trying standard fallback:", err);
          setupFallbackWebcam();
        }
      } else {
        setupFallbackWebcam();
      }
    } else {
      setIsFaceDetected(null);
      lastLandmarksRef.current = null;
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
      }
    }

    function setupFallbackWebcam() {
      navigator.mediaDevices.getUserMedia({ video: { width: 440, height: 330 } })
        .then((stream) => {
          mediaStreamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play();
          }
          setIsFaceDetected(true);
        })
        .catch((err) => {
          console.warn("Could not initiate target webcam stream:", err);
          setCameraActive(false);
        });
    }

    return () => {
      if (activeCamera) {
        try { activeCamera.stop(); } catch (e) {}
      }
      if (faceMeshInstance) {
        try { faceMeshInstance.close(); } catch (e) {}
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
      }
    };
  }, [cameraActive]);

  // Frame processing using OpenCV
  useEffect(() => {
    let animationFrameId: number;
    const canvas = canvasRef.current;
    const video = videoRef.current;

    const render = () => {
      if (canvas && video && video.readyState === video.HAVE_ENOUGH_DATA) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          const cv = (window as any).cv;
          let cvSuccess = false;

          if (cv && cv.Mat) {
            try {
              let src = cv.imread(video);
              if (privacyBlur) {
                let gray = new cv.Mat();
                cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
                cv.imshow(canvas, gray);
                gray.delete();
              } else {
                cv.imshow(canvas, src);
              }
              src.delete();
              cvSuccess = true;
            } catch (cvError) {
              console.warn("OpenCV framework processing error:", cvError);
            }
          }

          if (!cvSuccess) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            if (privacyBlur) {
              ctx.save();
              ctx.filter = "blur(18px)";
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              ctx.restore();
            }
          }

          if (cameraActive && isFaceDetected === false) {
            ctx.fillStyle = "rgba(239, 68, 68, 0.4)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.fillStyle = "#ef4444";
            ctx.strokeStyle = "#ef4444";
            ctx.lineWidth = 3;
            ctx.strokeRect(40, 40, canvas.width - 80, canvas.height - 80);

            ctx.font = "bold 14px monospace";
            ctx.textAlign = "center";
            ctx.fillText("🚫 SCANNER EMPTY: NO FACE DETECTED", canvas.width / 2, canvas.height / 2);
            ctx.font = "10px sans-serif";
            ctx.fillText("Please position face within active frame context.", canvas.width / 2, canvas.height / 2 + 25);
            ctx.textAlign = "left";
          } else if (lastLandmarksRef.current && !privacyBlur) {
            const landmarks = lastLandmarksRef.current;
            
            ctx.fillStyle = "rgba(139, 92, 246, 0.55)";
            landmarks.forEach((pt: any) => {
              ctx.beginPath();
              ctx.arc(pt.x * canvas.width, pt.y * canvas.height, 1.2, 0, Math.PI * 2);
              ctx.fill();
            });

            ctx.fillStyle = "#10b981";
            const leftIris = landmarks[468];
            const rightIris = landmarks[473];
            if (leftIris) {
              ctx.beginPath();
              ctx.arc(leftIris.x * canvas.width, leftIris.y * canvas.height, 3.5, 0, Math.PI * 2);
              ctx.fill();
            }
            if (rightIris) {
              ctx.beginPath();
              ctx.arc(rightIris.x * canvas.width, rightIris.y * canvas.height, 3.5, 0, Math.PI * 2);
              ctx.fill();
            }

            let minX = canvas.width, maxX = 0, minY = canvas.height, maxY = 0;
            landmarks.forEach((pt: any) => {
              const px = pt.x * canvas.width;
              const py = pt.y * canvas.height;
              if (px < minX) minX = px;
              if (px > maxX) maxX = px;
              if (py < minY) minY = py;
              if (py > maxY) maxY = py;
            });

            minX = Math.max(0, minX - 12);
            maxX = Math.min(canvas.width, maxX + 12);
            minY = Math.max(0, minY - 15);
            maxY = Math.min(canvas.height, maxY + 10);

            const displayColor = mockState === 'focused' ? '#10b981' : (mockState === 'distracted' ? '#f59e0b' : (mockState === 'confused' ? '#3b82f6' : '#ef4444'));
            ctx.strokeStyle = displayColor;
            ctx.lineWidth = 2.5;
            ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);

            ctx.fillStyle = displayColor;
            ctx.font = "bold 9.5px monospace";
            ctx.fillText(`AI LANDMARKS ACTIVE: ${mockState.toUpperCase()}`, minX + 6, minY - 8);

          } else if (!privacyBlur) {
            ctx.strokeStyle = "#6366f1";
            ctx.lineWidth = 2.5;

            const time = Date.now() * 0.001;
            let boxX = 130, boxY = 80, boxW = 180, boxH = 180;

            if (mockState === 'focused') {
              boxX = 130 + Math.sin(time * 0.8) * 3;
              boxY = 80 + Math.cos(time * 0.4) * 2;
              
              ctx.strokeRect(boxX, boxY, boxW, boxH);

              ctx.beginPath();
              ctx.strokeStyle = "#10b981";
              ctx.moveTo(boxX + boxW / 2, boxY + boxH / 2);
              ctx.lineTo(boxX + boxW / 2 - 35, boxY + boxH / 2);
              ctx.stroke();

              ctx.fillStyle = "#10b981";
              ctx.beginPath();
              ctx.arc(boxX + 60, boxY + 70, 4, 0, Math.PI * 2);
              ctx.arc(boxX + 120, boxY + 70, 4, 0, Math.PI * 2);
              ctx.fill();

              ctx.fillStyle = "#10b981";
              ctx.font = "bold 9px monospace";
              ctx.fillText("ATTENTION COMPLIANT (SIMULATED)", boxX + 6, boxY - 8);
            } else if (mockState === 'distracted') {
              boxX = 250 + Math.sin(time * 0.5) * 5;
              boxY = 110 + Math.cos(time * 0.5) * 3;
              
              ctx.strokeRect(boxX, boxY, boxW, boxH);

              ctx.beginPath();
              ctx.strokeStyle = "#f59e0b";
              ctx.moveTo(boxX + boxW / 2, boxY + boxH / 2);
              ctx.lineTo(boxX + boxW / 2 + 55, boxY + boxH / 2 + 12);
              ctx.stroke();

              ctx.fillStyle = "#f59e0b";
              ctx.font = "bold 9px monospace";
              ctx.fillText("GAZE DRIFT WARNING (SIMULATED)", boxX + 6, boxY - 8);
            } else if (mockState === 'confused') {
              boxX = 130 + Math.sin(time) * 1.5;
              boxY = 85 + Math.cos(time) * 1.5;
              
              ctx.strokeRect(boxX, boxY, boxW, boxH);

              ctx.strokeStyle = "#ef4444";
              ctx.beginPath();
              ctx.arc(boxX + 90, boxY + 135, 18, Math.PI, 0, false);
              ctx.stroke();

              ctx.fillStyle = "#3b82f6";
              ctx.font = "bold 9px monospace";
              ctx.fillText("EXPRESSION: PUZZLED (SIMULATED)", boxX + 6, boxY - 8);
            } else if (mockState === 'drowsy') {
              boxX = 130 + Math.sin(time * 0.3) * 2;
              boxY = 140 + Math.sin(time) * 3;
              boxH = 170;
              
              ctx.strokeRect(boxX, boxY, boxW, boxH);

              ctx.fillStyle = "#ef4444";
              ctx.font = "bold 9px monospace";
              ctx.fillText("CRITICAL: SLEEPING / SLEEPY (SIMULATED)", boxX + 6, boxY - 8);

              ctx.strokeStyle = "#ef4444";
              ctx.beginPath();
              ctx.moveTo(boxX + 50, boxY + 70); ctx.lineTo(boxX + 70, boxY + 70);
              ctx.moveTo(boxX + 110, boxY + 70); ctx.lineTo(boxX + 130, boxY + 70);
              ctx.stroke();
            }

            ctx.fillStyle = "rgba(139, 92, 246, 0.45)";
            const facialNodes = [
              { x: 50, y: 60 }, { x: 70, y: 60 }, { x: 110, y: 60 }, { x: 130, y: 60 },
              { x: 60, y: 70 }, { x: 120, y: 70 },
              { x: 90, y: 95 }, { x: 90, y: 105 },
              { x: 65, y: 130 }, { x: 90, y: 135 }, { x: 115, y: 130 }
            ];
            facialNodes.forEach(node => {
              ctx.beginPath();
              const jitterX = mockState !== 'drowsy' ? (Math.random() - 0.5) * 0.8 : 0;
              const jitterY = mockState !== 'drowsy' ? (Math.random() - 0.5) * 0.8 : 0;
              ctx.arc(boxX + node.x + jitterX, boxY + node.y + jitterY, 2.5, 0, Math.PI * 2);
              ctx.fill();
            });
          }
        }
      }
      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [cameraActive, privacyBlur, mockState, isFaceDetected]);

  // Active heartbeat listener on the session document
  useEffect(() => {
    if (!joined) return;
    const docRef = doc(db, "sessions", sessionId);
    const unsub = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.status === "completed") {
          setCameraActive(false);
          setSessionEnded(true);
          setExitCountdown(null);
        } else {
          // Verify instructor present
          const present = data.instructorPresent;
          const lastActive = data.instructorLastActive;
          let active = true;

          if (present === false) {
            active = false;
          } else if (lastActive) {
            const lastMs = typeof lastActive.toDate === "function"
              ? lastActive.toDate().getTime()
              : new Date(lastActive).getTime();
            const diff = Date.now() - lastMs;
            if (diff > 15000) {
              active = false; // instructor timed out (> 15 seconds)
            }
          }
          setInstructorActive(active);

          if (active) {
            setExitCountdown(null);
          } else {
            setExitCountdown(prev => prev === null ? 15 : prev); // start 15 seconds countdown
          }
        }
      } else {
        setCameraActive(false);
        setSessionEnded(true);
        setExitCountdown(null);
      }
    }, (err) => console.error("Error listening to session heartbeat:", err));

    return () => unsub();
  }, [joined, sessionId]);

  // Countdown timer effect
  useEffect(() => {
    let timer: any;
    if (exitCountdown !== null) {
      timer = setInterval(() => {
        setExitCountdown(prev => {
          if (prev !== null && prev <= 1) {
            clearInterval(timer);
            // Trigger auto check-out exit
            const attendanceId = `${sessionId}_${studentId}`;
            updateDoc(doc(db, "sessions", sessionId, "attendance", attendanceId), {
              status: "absent"
            }).catch(() => {});
            setCameraActive(false);
            setSessionEnded(true);
            setExitCountdown(null);
            return 0;
          }
          return prev !== null ? prev - 1 : null;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [exitCountdown, sessionId, studentId]);



  // Clean up attendance status on window close or component unmount
  useEffect(() => {
    return () => {
      const attendanceId = `${sessionId}_${studentId}`;
      updateDoc(doc(db, "sessions", sessionId, "attendance", attendanceId), {
        status: "absent"
      }).catch((err) => console.warn("Checkout cleanup on unmount failed:", err));
    };
  }, [sessionId, studentId]);

  const handleJoinSession = async () => {
    setIsCheckingIn(true);
    setCheckInError(null);
    const attendanceId = `${sessionId}_${studentId}`;
    const attendancePath = `sessions/${sessionId}/attendance/${attendanceId}`;
    try {
      await setDoc(doc(db, "sessions", sessionId, "attendance", attendanceId), {
        sessionId,
        studentId,
        studentName: editableName,
        joinedAt: serverTimestamp(),
        lastActiveAt: serverTimestamp(),
        status: "present",
        activeParticipationScore: 90,
        averageAttention: 90
      });

      if (!studentId.startsWith("guest_")) {
        try {
          await setDoc(doc(db, "users", studentId), {
            name: editableName
          }, { merge: true });
        } catch (uErr) {
          console.warn("Could not sync name to user profile:", uErr);
        }
      }

      setJoined(true);
    } catch (error: any) {
      console.error("Attendance check-in failed:", error);
      let errMsg = "";
      if (error?.message) {
        try {
          const parsed = JSON.parse(error.message);
          errMsg = parsed.error || error.message;
        } catch (e) {
          errMsg = error.message;
        }
      } else {
        errMsg = String(error);
      }
      setCheckInError(errMsg);
    } finally {
      setIsCheckingIn(false);
    }
  };



  if (sessionEnded) {
    const avgAtt = myProfile && myProfile.totalSessionsAttended > 0
      ? Math.round(myProfile.totalAttentionSum / myProfile.totalSessionsAttended)
      : 0;
    const avgEng = myProfile && myProfile.totalSessionsAttended > 0
      ? Math.round(myProfile.totalEngagementSum / myProfile.totalSessionsAttended)
      : 0;

    const getRiskBadge = (attn: number) => {
      if (attn >= 75) return { label: 'Excellent Focus', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' };
      if (attn >= 50) return { label: 'Moderate Focus', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' };
      return { label: 'Struggling Focus', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' };
    };

    const badge = getRiskBadge(avgAtt);

    return (
      <div className="max-w-4xl mx-auto p-4 bg-gray-50 min-h-screen text-left font-sans text-gray-800 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-md p-8 max-w-lg w-full border border-gray-200 space-y-6">
          <div className="text-center space-y-2">
            <span className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-[10px] font-semibold border border-emerald-200 uppercase tracking-widest">
              Session Completed
            </span>
            <h2 className="text-xl font-bold text-gray-900 uppercase tracking-tight mt-3">
              {sessionTitle}
            </h2>
            <p className="text-xs text-gray-500 font-semibold uppercase">Your learning feedback is updated</p>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-3">
            <h3 className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest text-left">Session Telemetry</h3>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-white p-2.5 rounded-lg border border-gray-200 shadow-sm">
                <p className="text-xs font-mono font-bold text-blue-600">{liveAttention}%</p>
                <p className="text-[8px] font-mono uppercase text-gray-500">Attention</p>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-gray-200 shadow-sm">
                <p className="text-xs font-mono font-bold text-emerald-600">{liveEngagement}%</p>
                <p className="text-[8px] font-mono uppercase text-gray-500">Engagement</p>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-gray-200 shadow-sm">
                <p className="text-xs font-mono font-bold text-purple-600">{liveConfusion}%</p>
                <p className="text-[8px] font-mono uppercase text-gray-500">Confusion</p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <h3 className="font-semibold text-gray-800 text-xs font-mono uppercase tracking-widest flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-indigo-600" />
                Cumulative Engagement Profile
              </h3>
              {myProfile && (
                <span className={`text-[8.5px] font-mono font-bold px-2 py-0.5 rounded border uppercase ${badge.bg} ${badge.text} ${badge.border}`}>
                  {badge.label}
                </span>
              )}
            </div>

            {myProfile ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="flex justify-between text-[9px] font-mono">
                    <span className="text-gray-550">Average Attention</span>
                    <span className="text-gray-800 font-bold">{avgAtt}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5 border border-gray-200">
                    <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${avgAtt}%` }} />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[9px] font-mono">
                    <span className="text-gray-550">Average Engagement</span>
                    <span className="text-gray-800 font-bold">{avgEng}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5 border border-gray-200">
                    <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${avgEng}%` }} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2 text-center text-xs font-mono border-t border-gray-50">
                  <div>
                    <p className="text-sm font-bold text-gray-800">{myProfile.totalSessionsAttended}</p>
                    <p className="text-[8px] uppercase text-gray-500">Sessions Attended</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-red-500">{myProfile.totalAlertsTriggered - myProfile.totalAlertsResolved}</p>
                    <p className="text-[8px] uppercase text-gray-500">Unresolved Alerts</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-4 text-center space-y-1">
                <p className="text-[10px] text-gray-400 font-mono uppercase">No cumulative profile stored</p>
                <p className="text-[9px] text-gray-500 leading-relaxed font-sans max-w-xs mx-auto">This appears to be your first session. A cumulative profile will be created once your session updates sync.</p>
              </div>
            )}
          </div>

          <button
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-mono text-xs font-bold uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer text-center"
          >
            Close & Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 bg-gray-50 min-h-screen text-left font-sans text-gray-800">
      <div className="bg-white rounded-2xl shadow-sm p-6 max-w-2xl mx-auto border border-gray-200 space-y-6">
        <div className="text-center mb-4">
          <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-[10px] font-semibold border border-blue-150 uppercase tracking-wide">
            Student Classroom View
          </span>
          <h2 className="text-xl font-bold text-gray-900 mt-3 uppercase tracking-tight">
            {sessionTitle}
          </h2>
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mt-1">Live Gaze Telemetry Sync</p>
        </div>

        {/* Heartbeat Alert Banner */}
        {exitCountdown !== null && (
          <div className="bg-amber-50 border border-amber-250 p-4 rounded-xl text-xs space-y-1 animate-pulse">
            <p className="font-bold text-amber-800 uppercase flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>TEACHER HAS LEFT CLASSROOM</span>
            </p>
            <p className="text-amber-700 leading-relaxed font-sans">
              The educator ended the session or went offline. Automatically checking out and returning to course list in <strong className="font-mono text-sm">{exitCountdown}</strong> seconds...
            </p>
          </div>
        )}

        {!joined ? (
          <div className="py-12 text-center bg-gray-50 border border-gray-200 rounded-xl p-6 space-y-6">
            <p className="text-gray-600 text-sm leading-relaxed max-w-md mx-auto">You are registered as a participant. Click below to verify attendance and sync live engagement signals.</p>

            <div className="bg-white border border-gray-250 p-4 rounded-xl max-w-sm mx-auto space-y-2 shadow-inner">
              <label htmlFor="student-name-input" className="text-[10px] font-mono text-gray-400 uppercase tracking-widest block text-center font-bold">Your Attendance Display Name</label>
              <input
                type="text"
                id="student-name-input"
                value={editableName}
                onChange={(e) => {
                  const val = e.target.value.substring(0, 40);
                  setEditableName(val);
                  if (studentId.startsWith("guest_")) {
                    localStorage.setItem("guest_student_name", val);
                  }
                }}
                className="w-full text-center bg-white border border-gray-200 hover:border-blue-500/50 focus:border-blue-500 rounded-lg px-4 py-2 text-xs text-gray-800 focus:outline-none transition-all shadow-sm"
                placeholder="Enter display name"
              />
            </div>
            
            {checkInError && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-xs font-mono space-y-2 max-w-md mx-auto text-left leading-relaxed">
                <p className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-red-800">
                  <AlertCircle className="w-4 h-4" /> Connection Sync Error
                </p>
                <p className="opacity-95 font-sans break-words">{checkInError}</p>
              </div>
            )}

            <button
              onClick={handleJoinSession}
              disabled={isCheckingIn}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-750 text-white font-mono text-xs font-bold uppercase tracking-widest rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 mx-auto disabled:opacity-50"
            >
              {isCheckingIn ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Checking Attendance...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm Check-In Attendance</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Webcam / Simulator Split Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
              {/* Webcam block */}
              <div className="bg-gray-50 border border-gray-250 rounded-xl overflow-hidden shadow-sm relative flex flex-col justify-between p-4 h-[280px]">
                <div className="absolute inset-0 z-0">
                  <video
                    ref={videoRef}
                    className="hidden"
                    playsInline
                    muted
                  />
                  <canvas
                    ref={canvasRef}
                    width={440}
                    height={330}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Gaze Vector overlays */}
                <div className="relative z-10 flex items-center justify-between pointer-events-none">
                  <span className="bg-white/90 text-gray-800 text-[10px] px-2.5 py-1 rounded-full font-mono flex items-center gap-1.5 shadow-sm border border-gray-200">
                    <span className={`w-1.5 h-1.5 rounded-full animate-ping ${mockState === 'focused' ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                    {currentEmotion} (gaze: {currentGaze})
                  </span>
                </div>

                {/* Video controls */}
                <div className="relative z-10 flex items-center justify-end gap-2 mt-auto">
                  <button
                    onClick={() => setPrivacyBlur(!privacyBlur)}
                    className={`p-1.5 rounded-lg text-xs backdrop-blur-sm shadow border transition-colors cursor-pointer ${
                      privacyBlur 
                        ? "bg-blue-600 text-white border-blue-500 hover:bg-blue-700" 
                        : "bg-white/95 text-gray-700 border-gray-200 hover:bg-gray-100"
                    }`}
                    title={privacyBlur ? "Privacy filter active (Blurred)" : "Blur Webcam"}
                  >
                    {privacyBlur ? <Shield className="w-4 h-4" /> : <ShieldOff className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => setCameraActive(!cameraActive)}
                    className={`p-1.5 px-3 rounded-lg text-[10px] font-mono uppercase tracking-wider border transition-all cursor-pointer ${
                      cameraActive 
                        ? "bg-red-600 text-white border-red-500 hover:bg-red-700" 
                        : "bg-emerald-600 text-white border-emerald-500 hover:bg-emerald-700"
                    }`}
                  >
                    {cameraActive ? "Disable Cam" : "Launch Cam"}
                  </button>
                </div>
              </div>

              {/* Simulated Gaze controller */}
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex flex-col justify-between">
                <div>
                  <p className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest">Attendance Simulator</p>
                  <p className="text-xs text-gray-500 leading-relaxed mt-1 mb-3">Simulate different facial landmark behaviors to test the AI strategy advisor</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'focused', name: 'Focused Study', color: 'border-emerald-500/20 hover:border-emerald-500/60 active-emerald' },
                    { id: 'distracted', name: 'Look Away', color: 'border-amber-500/20 hover:border-amber-500/60 active-amber' },
                    { id: 'confused', name: 'Confused Expression', color: 'border-sky-500/20 hover:border-sky-500/60 active-sky' },
                    { id: 'drowsy', name: 'Sleeping / Sleepy', color: 'border-rose-500/20 hover:border-rose-500/60 active-rose' }
                  ].map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setMockState(item.id as any);
                        setIntendedState(item.id as any);
                      }}
                      className={`p-2.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer uppercase ${
                        mockState === item.id 
                          ? `bg-white shadow-sm ${item.id === 'focused' ? 'border-emerald-500 text-emerald-600' : (item.id === 'distracted' ? 'border-amber-500 text-amber-600' : (item.id === 'confused' ? 'border-blue-500 text-blue-600' : 'border-red-500 text-red-600'))}`
                          : "bg-white border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                      }`}
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>


          </div>
        )}
      </div>
    </div>
  );
}
