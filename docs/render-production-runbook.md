# Render Production Runbook

## Before Deploying
- Confirm `DB_URI` points to the production Render Postgres instance.
- Build the frontend shell from `frontend/` with `npm install` and `npm run build`, or configure Render to do that during the build step.
- Confirm `FLASK_KEY` is set in the web service.
- Set `ADMIN_EMAIL` to the Google or password-login email that should have admin access in production.
- Decide whether public signups stay open by setting `PUBLIC_REGISTRATION_ENABLED=true` or `false`.
- Configure `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` if Google OAuth should be available in production.
- Configure `RESEND_API_KEY`, `CONTACT_FROM_EMAIL`, and `CONTACT_RECIPIENT_EMAIL` if the live contact form should deliver emails in production.
- Configure `VITE_CLOUDINARY_CLOUD_NAME` and `VITE_CLOUDINARY_UPLOAD_PRESET` if fragment images should upload directly from the browser in production.
- Create a logical backup from Render Postgres.
- Record the available PITR retention window in Render.

## Safe Deploy Sequence
1. Merge the branch after tests pass.
2. Run the frontend build from `frontend/` so `frontend/dist` is ready for Flask to serve.
3. Deploy the web service without changing the database instance.
4. Run `flask db upgrade` against the production database.
5. Run `flask sync-admin-from-env` once if the admin flag has not been persisted yet.
6. If you need to recover an account, open a Render shell for the web service and run `flask --app main reset-password --email you@example.com`.
7. Verify login, Google login, admin access, existing posts, comments, create/edit/delete flows, direct image uploads, and contact form delivery.

## Rollback
1. If the deploy is bad, stop applying new migrations.
2. Restore the database to a new Render Postgres instance using PITR or the logical backup.
3. Point `DB_URI` to the restored instance.
4. Redeploy the previous known-good application revision.
5. Verify the preserved historical post before reopening traffic.

## Required Smoke Checks
- Existing production post still renders.
- A normal user cannot access admin routes.
- `/create-fragment` redirects unauthenticated users to `/login` and non-admin users to `/`.
- Logout and delete actions only work via POST.
- Login failures return the generic error message.
- Registration behavior matches `PUBLIC_REGISTRATION_ENABLED`.
- Google OAuth only appears when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are configured.
- A Google account matching `ADMIN_EMAIL` receives admin capabilities after login.
- Password reset through the Render shell updates the intended account and nothing else.
- Rate limiting still works after an app restart once the `rate_limit_events` migration is applied.
- Contact form succeeds with valid configuration and fails cleanly when delivery config is missing.
- Direct image upload succeeds only when the Cloudinary build vars are configured; otherwise the fragment form still accepts image URLs manually.
