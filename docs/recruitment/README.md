# Staff recruitment — operator guide

The page is applications.html. Recruitment starts closed.

Sign in with the configured website staff account (Discord ID 1372803707426701365). Open the profile menu → Staff applications · Manage. Use Published options to open/close applications and edit the closed message. Copy responder link shares the stable application URL. Visitors without website staff permission never receive management access.

Close recruitment before selecting Start a new recruitment round. Previous applications remain private and retain their original expiry. A new round lets previous applicants apply again. View responses is staff-only; it supports pagination and deleting applications. Do not copy answers to public channels or retain separate exports beyond the stated retention.

Applicants must be 16+. Age is declared, not independently verified by Discord. Existing account eligibility rules still apply. Required questions and the optional coding/markup grids are validated on the server. No browser drafts are stored.

For applicants aged 16–17 or other guardian-managed accounts:
1. Complete the existing account guardian process first.
2. Independently verify guardian authority and get explicit approval for the separate recruitment notice, including age, timezone/availability, experience answers and storage in Germany.
3. In Published options → Guardian recruitment approval, enter the member’s numeric Discord ID, confirm completed verification, and record approval. Do not put identity documents in the form.
4. Approval lasts 90 days. Revoke and delete application removes recruitment approval and that member’s applications. Never record approval solely on the child’s statement.

Private applications become inaccessible at 90 days. The recruitment-retention cron job runs every minute, deleting expired applications/approvals. It also prunes its own run logs after seven days. Check Supabase → Cron if the project is paused/restored; run expiry cleanup before restoring application access. Provider backups are separate from live-row deletion.

Application consent is separate version recruitment-2026-11-01; existing account agreement stays version 2026-10-31.3. No advertising/analytics storage was introduced.

Tests: database authorization, closed forms, required fields, age/guardian gate, matrix choices, duplicate prevention, retention timestamps and ownership. Synthetic test rows/settings run in a rolled-back transaction.

Technical source: docs/recruitment/schema.sql, tests/recruitment.sql.

Local browser checks passed: form submission with synthetic data, one duration per language, close/open controls, and mobile layout at 375px without page overflow. No live applicant data was submitted during UI testing.
