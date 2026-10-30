# Security Specification: Banca Geek Cloud Database

## 1. Data Invariants
1. **User Identity Isolation**: All documents under `/users/{userId}` and its subcollections (`readingProgress`, `favorites`, `collection`, `bookmarks`, `reviews`, `activities`, `customComics`) must only be accessible and mutable by the authenticated owner where `request.auth.uid == userId`.
2. **Owner Field Match**: Any `userId` field stored inside the document payload must strictly match `request.auth.uid`.
3. **No Unauthenticated Writes**: Anonymous or unauthenticated requests are strictly denied write operations across all collections.
4. **Document ID Sanitization**: All path variables (`userId`, `comicId`, `bookmarkId`, `activityId`) must satisfy `isValidId()` (string, length <= 128, matching `^[a-zA-Z0-9_\-]+$`).
5. **Bounded Content Lengths**: All strings and collections must have upper bounds on lengths (e.g. titles <= 200, notes <= 500, reviews <= 2000, synopses <= 5000) to protect against DoS attacks.
6. **Immutable Identity on Update**: Updating a profile or record cannot transfer ownership (`incoming().userId == existing().userId`).
7. **Read Access to Synopses and System Test**: `/synopses/{comicId}` can be read by authenticated users, but can only be modified by the admin.
8. **Test Connection Safety**: `/test/{testId}` is read-only for connectivity health checks.

---

## 2. The "Dirty Dozen" Payloads (Designed to Break Identity, Integrity, or State)

1. **Payload 1 (Identity Spoofing - Profile Takeover)**:
   - Target: `/users/victim_user_123`
   - Action: create
   - Auth: `attacker_456`
   - Body: `{"userId": "victim_user_123", "name": "Hacked", "readBadge": "Lenda", "readingMilestone": "100", "avatarUrl": "https://...", "createdAt": "2026-01-01"}`
   - Expected: PERMISSION_DENIED (User cannot create a profile for another user ID).

2. **Payload 2 (Ghost Field Attack - Shadow Injection)**:
   - Target: `/users/attacker_456`
   - Action: create
   - Auth: `attacker_456`
   - Body: `{"userId": "attacker_456", "name": "Attacker", "readBadge": "Badge", "readingMilestone": "1", "avatarUrl": "https://...", "isAdmin": true, "createdAt": "2026-01-01"}`
   - Expected: PERMISSION_DENIED (Shadow field `isAdmin` is not allowed by strict schema keys).

3. **Payload 3 (Path Traversal / Junk ID Resource Poisoning)**:
   - Target: `/users/attacker_456/readingProgress/../../malicious` or ID of 2,000 characters
   - Action: create
   - Auth: `attacker_456`
   - Body: `{"comicId": "invalid", "userId": "attacker_456", "currentPage": 1, "totalPages": 30, "progressPercent": 3, "isCompleted": false, "updatedAt": "2026-01-01"}`
   - Expected: PERMISSION_DENIED (ID does not match regex / length boundary).

4. **Payload 4 (Progress Tampering for Another User)**:
   - Target: `/users/victim_user_123/readingProgress/comic_99`
   - Action: update
   - Auth: `attacker_456`
   - Body: `{"comicId": "comic_99", "userId": "victim_user_123", "currentPage": 999, "totalPages": 30, "progressPercent": 100, "isCompleted": true, "updatedAt": "2026-01-01"}`
   - Expected: PERMISSION_DENIED (Cannot modify another user's subcollection).

5. **Payload 5 (Cross-User Bookmark Snooping - List Query Leak)**:
   - Target: `/users/victim_user_123/bookmarks`
   - Action: list
   - Auth: `attacker_456`
   - Expected: PERMISSION_DENIED (Cannot read victim's private bookmarks).

6. **Payload 6 (Massive String Buffer Overflow - Review Bombing)**:
   - Target: `/users/attacker_456/reviews/comic_1`
   - Action: create
   - Auth: `attacker_456`
   - Body: `{"comicId": "comic_1", "userId": "attacker_456", "rating": 5, "reviewText": "...1MB of garbage...", "updatedAt": "2026-01-01"}`
   - Expected: PERMISSION_DENIED (`reviewText` exceeds maxLength 2000).

7. **Payload 7 (Negative Page / Integer Underflow Attack)**:
   - Target: `/users/attacker_456/readingProgress/comic_1`
   - Action: create
   - Auth: `attacker_456`
   - Body: `{"comicId": "comic_1", "userId": "attacker_456", "currentPage": -50, "totalPages": -10, "progressPercent": -500, "isCompleted": false, "updatedAt": "2026-01-01"}`
   - Expected: PERMISSION_DENIED (Must satisfy positive integer boundaries).

8. **Payload 8 (Rating Scale Exploit - Out of bounds 1..5)**:
   - Target: `/users/attacker_456/reviews/comic_1`
   - Action: create
   - Auth: `attacker_456`
   - Body: `{"comicId": "comic_1", "userId": "attacker_456", "rating": 9999, "reviewText": "Great", "updatedAt": "2026-01-01"}`
   - Expected: PERMISSION_DENIED (`rating` must be between 1 and 5).

9. **Payload 9 (Unauthenticated Public Reading State Query)**:
   - Target: `/users/victim_user_123/readingProgress/comic_1`
   - Action: get
   - Auth: null (anonymous/unauthenticated)
   - Expected: PERMISSION_DENIED (Must be signed in as the owner).

10. **Payload 10 (Unauthorized Synopsis Tampering)**:
    - Target: `/synopses/comic_batman_year_one`
    - Action: update
    - Auth: `attacker_456` (regular non-admin user)
    - Body: `{"comicId": "comic_batman_year_one", "synopsis": "Defaced by attacker", "logline": "Hacked", "generatedAt": "2026-01-01"}`
    - Expected: PERMISSION_DENIED (Only admin or server can update official catalog synopses).

11. **Payload 11 (Favorite Hijack - Modifying Owner ID on Update)**:
    - Target: `/users/attacker_456/favorites/comic_1`
    - Action: update
    - Auth: `attacker_456`
    - Body: `{"comicId": "comic_1", "userId": "victim_user_123", "addedAt": "2026-01-01"}`
    - Expected: PERMISSION_DENIED (`userId` cannot be mutated away from `request.auth.uid`).

12. **Payload 12 (Write to Catch-All Unmapped Collection)**:
    - Target: `/internal_system_secrets/keys`
    - Action: create
    - Auth: `attacker_456`
    - Body: `{"leak": "password"}`
    - Expected: PERMISSION_DENIED (Global default deny catch-all `match /{document=**}`).
