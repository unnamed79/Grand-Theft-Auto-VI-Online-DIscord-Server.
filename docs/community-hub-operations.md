# Community hub operations

Released 31 October 2026. Data resides in the existing Frankfurt Supabase project.

## Permissions
- Public read access is provided by bounded community_hub RPC actions, not direct table access.
- Private tables have RLS enabled without browser table policies and no browser grants. The private security-definer RPC deliberately validates each action. The public wrapper is security-invoker.
- Signed-in Discord members need the current account agreement for publishing, editing, commenting, uploading and casting votes. Withdrawal still permits deletion and vote removal.
- Staff identity uses verified auth.identities, never editable user metadata. Staff may edit/delete content; no voter list is exposed.
- Voting is unique per member and post. Database locks serialize changes. Replies must point into the same post.

## Files and deletion
Private bucket community-files accepts PNG/JPEG/WebP/PDF/TXT/ZIP, max 8 MiB each. Four attachments per post, twelve reserved/stored slots per member. The slot quota is conservative: even false declared sizes cannot create unbounded uploads. No HTML/SVG/executable preview; PDFs and ZIPs download only. MIME/extension restrictions are NOT malware scanning; do not claim otherwise.

Deleted posts immediately lose public attachment permission. Existing signed image links last up to five minutes. The client calls cleanup, removes objects through the Storage API, then cleanup_done. Failed attempts retain a private file manifest for retry. Signed-in staff visits also clean queued files belonging to deleted accounts. Drafts over one day old are discarded on the owner's next visit.

Operator maintenance: review unlinked hub_files and old unpublished hub_posts regularly and after account deletion. Remove only the listed unlinked paths through the Supabase Storage dashboard/API, then delete their manifests after verifying the objects no longer exist. Do NOT delete storage.objects rows with SQL; that does not remove stored bytes. There is no scheduled cleanup job or malware scanner in this release. Do not promise instantaneous removal from caches/backups. Review moderation metadata on privacy requests.

## Moderation
Open the post/comment and use Edit or Delete. Staff edits receive a label. To remove unsafe attachments, delete the parent post. Replies survive parent-comment removal; post removal cascades comments and votes. Reports use the existing Discord support server plus the displayed reference. Investigate reports promptly; public content is not pre-approved.

## Consent release
Version 2026-10-31.2 adds posts, comments, attachments and votes. Archive copies are in legal/2026-10-31.2. Existing members must renew agreement; guardian approvals must cover the new version. Never transfer old guardian approvals silently. The previous self-declared-age/direct-OAuth limitations remain.

## Validation
Transactional tests in community-hub-tests.sql create synthetic identities and roll back all test data. They cover agreement gating, private drafts, ownership, vote replacement, same-post replies, withdrawal, upload reservations and delete cascades. Check browser behavior and storage upload/download after deployment. No formal WCAG conformance audit has been performed.
