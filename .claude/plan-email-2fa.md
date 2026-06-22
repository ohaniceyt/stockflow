# Plan: Email-based 2FA + User Creation

## Goal
Transform the PIN into an app-lock / first-factor code. After PIN validation, Supabase sends a magic link to the user's registered email as the second factor. Admins can create users with email addresses.

## Files to change

### Database
- `supabase/migrations/00000000000004_email_auth.sql`
  - Add `email TEXT NOT NULL` to `users`.
  - Add `email_verified BOOLEAN DEFAULT FALSE`.
  - Update RLS policies as needed.

### Edge Functions
- `supabase/functions/login/index.ts`
  - After PIN validation, generate magic link for the user's real email and return a flag telling the UI to check email.
- `supabase/functions/create-user/index.ts` (new)
  - Accept name, email, role, org_id from admin.
  - Create Supabase Auth user with email and random password.
  - Insert into `users` table with `force_pin_change = true` and a random temp PIN.
  - Trigger email verification/magic link.
- `supabase/functions/reset-pin/index.ts`
  - Send email notification when PIN is reset (already drafted; update if needed).
- `supabase/functions/list-users/index.ts`
  - Include `email` and `email_verified` in response.

### Frontend
- `src/types/index.ts`
  - Add `email`, `emailVerified` to `User` interface.
- `src/types/database.ts`
  - Add `email`, `email_verified` to `users` table type.
- `src/features/auth/context/AuthContext.tsx`
  - Update login flow to handle pending magic-link state.
- `src/features/auth/pages/LoginPage.tsx`
  - After PIN submit, show "Check your email" screen if magic link was sent.
- `src/features/team/pages/TeamPage.tsx`
  - Add "Invite user" dialog with name, email, role.
- `src/features/team/services/teamService.ts` / hooks
  - Add `createUser` call.

### Seed
- `supabase/seed.sql`
  - Add placeholder emails for Alice and Bob.

## Steps
1. Database migration.
2. Update types.
3. Update Edge Functions.
4. Update login UI and auth context.
5. Update Team page with user creation.
6. Format, lint, build, test.
7. Push to GitHub.
8. Deploy Supabase migrations and functions.
