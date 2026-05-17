# Security Spec for AsuraScans Clone

## Data Invariants
1. A user profile (`users/{userId}`) can only be modified by the user who owns it.
2. Only an admin can write/update/delete `series` and `chapters`.
3. An admin can be identified by the existence of a document in `admins/{userId}`.
4. Comments (`comments/{commentId}`) must refer to a valid `seriesId` and `chapterId`.
5. Only the author of a comment (or an admin) can modify or delete it.

## The "Dirty Dozen" Payloads

1. **Identity Spoofing**: User A attempts to update User B's profile document.
2. **Missing Author Match**: Creating a comment where `authorId` does not match `request.auth.uid`.
3. **Ghost Field Update**: Updating a comment with a non-existent field (e.g. `isVerified: true`).
4. **Invalid Type Update**: Setting a comment `content` to a number instead of a string.
5. **Unauthorized Series Modification**: Normal user attempting to create a new `series` or `chapter`.
6. **Orphaned Record Creation**: Creating a comment for a `seriesId` or `chapterId` that does not exist. (We will use exists() check for the series/chapter).
7. **Type Mismatch on Required Fields**: Providing a boolean for `title` in a series creation (by admin).
8. **Bypassing Immutable Fields**: Editing `createdAt` or `authorId` in a comment during update.
9. **Role Escalation**: User attempting to set their `role` field to `admin` in their user profile (though we use `admins/{uid}` collection, protecting fields in profile).
10. **ID Poisoning**: Creating a comment with a massive string as ID (handled by valid ID check).
11. **Malicious Schema Size**: Storing a comment larger than the maximum allowed string size (e.g.,> 1000 chars).
12. **PII Leakage**: Fetching private information. `users` collection has public profiles, but emails should not be stored there, or isolated. In this app, users display names and avatars. Email is from Auth.

## Master Source of Truth
- Users belong to the Authentication list; their public display data lives in `users/{userId}`.
- Series live in `series/{seriesId}`.
- Chapters live in `series/{seriesId}/chapters/{chapterId}`.
- Comments live in `comments/{commentId}` and reference `seriesId` and `chapterId`.
