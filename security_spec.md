# Firebase Security Specification for EduSense

This document outlines the attribute-based access control (ABAC), relationship mapping, and data invariants designed to harden the Firestore security rules.

## 1. Data Invariants
1. **User Profile Invariant**: A user record can only be created by the authenticated user whose `uid` matches the document ID. The role must be chosen from set `['instructor', 'student']`.
2. **Session Ownership Invariant**: Only authenticated users with the role `instructor` can create a Classroom Session. They are automatically set as the `instructorId` of the session.
3. **Sub-resource Integrity**: Access to sub-collections (`attendance`, `timeline`, `alerts`) of a session is bound by the status of the parent `/sessions/{sessionId}` document. If the user is the instructor of the session, they have read/write access. If the user is a student, they can only write/update their own attendance record within that session.
4. **Temporal Integrity**: `createdAt` and `joinedAt` timestamps must strictly equal the server-side `request.time`.

## 2. The "Dirty Dozen" Threat Vectors (Payloads)

The following payloads must be rejected by the security rules:

1. **Self-Assigned Identity Spoofing**: Attempting to write a `/users/{invalidUserId}` document with credentials of a different authenticated user.
2. **Privilege Escalation**: A student trying to update their role to `'instructor'` in `/users/{userId}`.
3. **Session Hijacking**: User B attempting to modify or end a classroom session created by User A.
4. **Ghost Alert Injection**: A student writing fake critical alerts (e.g. `sleeping`) on behalf of other students to `/sessions/{sessionId}/alerts/{alertId}`.
5. **PII Exposure / Gaze Leak**: A student attempting to query or fetch private gaze logs or emotional metrics of a different student in `/sessions/{sessionId}/attendance/{attendanceId}`.
6. **Shadow Field Injection**: Injecting unregistered properties (e.g. `isSystemAdmin: true` or `bountyPoints: 9999`) during session creation.
7. **Temporal Falsification**: Creating an attendance record with a hardcoded, fake `joinedAt` timestamp from 3 days ago.
8. **Poison ID Injection**: Posting a sub-collection resource with a 50KB malicious string containing SQL/JS fragments as the Document ID.
9. **Unbounded Data Flooding**: Forcing huge arrays into the `teachingStrategy` field to trigger high resource reads.
10. **State Shortcutting**: Skipping the `'active'` state of a session and directly updating it to `'completed'` before the session actually started, or editing a completed session.
11. **Orphaned Write Attack**: Submitting a timeline log for a classroom session ID that does not exist in the root `/sessions/` collection.
12. **Blanket Query Scraping**: Sending a search statement to scrape all attendance records across the entire university database without specifying a single `sessionId` verification.

## 3. Conflict Evaluation Matrix

| Vector | Mitigating Rule Logic Gates | Status |
| :--- | :--- | :--- |
| **Identity Spoofing** | `request.auth.uid == userId` / Verification against session owner | **SECURED** |
| **State Shortcutting** | `existing().status != 'completed'` (Terminal state locking) | **SECURED** |
| **Resource Poisoning** | `isValidId(id)` pattern checking, max string length `.size() < 128` | **SECURED** |
| **Value Poisoning** | Explicit type assertions (`data.field is string`/`number`/`boolean`/`timestamp`) | **SECURED** |
