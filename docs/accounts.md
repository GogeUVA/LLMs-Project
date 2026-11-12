# Accounts and profile sync

The React interface uses Supabase Auth and the official JavaScript client.
Signed-in profile reads and saves use the student's session. The database
policies restrict access to the student's own row. The application preserves
the existing guest profile separately.

## Configure locally

Set these values in the ignored frontend/.env.local file:

```dotenv
VITE_SUPABASE_URL=https://khyfpjwelksxlgynzxqc.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-project-publishable-key
```

The publishable key is intended for browser applications. Database access is
controlled by the authenticated session and row-level security.
Keep secret/service-role keys out of the frontend.

The profile migration is applied to the configured Supabase project. For a new
project, inspect its schema before applying
backend/migrations/001_student_profiles.sql. The migration creates
student_profiles and its policies. It fails if the table already exists.

In Supabase Auth settings, enable email/password sign-in and email confirmation.
Allow the local frontend origin as an authentication redirect URL, including
the URL patterns for /#profile and /#account. Password-reset links return to
the account page, where a recovery session can set a new password. Use the
actual development port, such as http://localhost:5173.

Restart Vite after changing its environment configuration.

## Data behavior

A student can explicitly import a browser profile into an empty account.
Existing account profiles take precedence. A successful save advances the
row's version. An update must match the version originally loaded, so a
conflict prompts the student to reload before saving again. Unsaved edits
remain visible when a save fails.

Sign-out clears the account interface and returns to the guest workflow.
Account profiles are not copied into guest browser storage.

## Verification

Component tests use mocked account services. Before declaring hosted sync
verified, apply the migration to a test project and check sign-up, email
confirmation, password recovery, persistence in another browser session,
and isolation between two independent users. A second user must not be able
to read or update the first user's row or insert a row under that user's ID.
Use two loaded copies of a profile to verify a stale update fails after the
other copy saves.

Run the database checks on an isolated PostgreSQL database configured with
Supabase-compatible auth roles, or on a Supabase test project:

```sh
psql "$TEST_DATABASE_URL" -f backend/tests/student_profiles.sql
```

The checks create synthetic users inside a transaction and roll them back.
They verified profile ownership, version conflicts, schema validation, and
anonymous-access restrictions on both the local database and the configured
Supabase project. Email confirmation and password-recovery delivery require a
separate browser check with an authorized email address.

Issue #24 adds 21 AI-generated frontend tests. No substantive human refinement
or independent human authorship has been recorded for these tests.

The Supabase MCP login configures development access. The running website
also needs its own project URL, publishable key, and applied migration.
