export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: 'instructor' | 'student' | 'admin';
  createdAt: any; // Firestore Timestamp
}

export interface ClassroomSession {
  id: string;
  title: string;
  instructorId: string;
  instructorName: string;
  status: 'active' | 'completed';
  createdAt: any; // Firestore Timestamp
  completedAt?: any; // Firestore Timestamp
  teachingStrategy?: string;
  currentPacing?: 'slow' | 'normal' | 'fast';
  feedback?: string;
  courseId?: string;
  courseCode?: string;
}

export interface StudentAttendance {
  id: string; // usually {sessionId}_{studentId}
  sessionId: string;
  studentId: string;
  studentName: string;
  joinedAt: any; // Firestore Timestamp
  lastActiveAt?: any; // Firestore Timestamp
  status: 'present' | 'absent';
  activeParticipationScore?: number; // 0 to 100
  averageAttention?: number; // 0 to 100
}

export interface TimelineMetric {
  id: string;
  sessionId: string;
  attention: number; // 0 to 100
  engagement: number; // 0 to 100
  confusion: number; // 0 to 100
  strategy?: string;
  recommendation?: string;
  timestamp: any; // Firestore Timestamp
}

export interface StudentAlert {
  id: string;
  sessionId: string;
  studentId: string;
  studentName: string;
  type: 'low_attention' | 'sleeping' | 'distracted';
  timestamp: any; // Firestore Timestamp
  resolved: boolean;
}

export interface AIFeedbackRequest {
  sessionTitle: string;
  timelineLogs: {
    time: string;
    attention: number;
    engagement: number;
    confusion: number;
    strategy: string;
    recommendation: string;
  }[];
  attendanceCount: number;
  averageAttention: number;
  averageEngagement: number;
  averageConfusion: number;
}

export interface AITeachingRecommendationRequest {
  sessionId: string;
  title: string;
  latestAttention: number;
  latestEngagement: number;
  latestConfusion: number;
  currentStrategy: string;
  alertCount: number;
  studentComments: string[];
}

export interface AIRecommendationResponse {
  recommendedStrategy: string;
  explanation: string;
  suggestedAction: string;
  optimalPacing: 'slow' | 'normal' | 'fast';
  reasoningKeys: string[];
}

export interface StudentLearningProfile {
  studentId: string;
  studentName: string;
  totalSessionsAttended: number;
  totalAttentionSum: number;
  totalEngagementSum: number;
  totalConfusionSum: number;
  totalAlertsTriggered: number;
  totalAlertsResolved: number;
  lastUpdatedAt: any; // Firestore Timestamp
  lastSessionId: string;
  courseIds: string[];
  instructorIds: string[];
}
