# Render Production Runbook

## Before Deploying
- Confirm `DB_URI` points to the production Render Postgres instance.
- Confirm `FLASK_KEY` is set in the web service.
- Set `ADMIN_EMAIL` to the real production admin email before the first deploy of this branch.
- Decide whether public signups stay open by setting `PUBLIC_REGISTRATION_ENABLED=true` or `false`.
- Create a logical backup from Render Postgres.
- Record the available PITR retention window in Render.

## Safe Deploy Sequence
1. Merge the branch after tests pass.
2. Deploy the web service without changing the database instance.
3. Run `flask db upgrade` against the production database.
4. Run `flask sync-admin-from-env` once if the admin flag has not been persisted yet.
5. If you need to recover an account, open a Render shell for the web service and run `flask --app main reset-password --email you@example.com`.
6. Verify login, admin access, existing posts, comments, and create/edit/delete flows.

## Rollback
1. If the deploy is bad, stop applying new migrations.
2. Restore the database to a new Render Postgres instance using PITR or the logical backup.
3. Point `DB_URI` to the restored instance.
4. Redeploy the previous known-good application revision.
5. Verify the preserved historical post before reopening traffic.

## Required Smoke Checks
- Existing production post still renders.
- A normal user cannot access admin routes.
- Logout and delete actions only work via POST.
- Login failures return the generic error message.
- Registration behavior matches `PUBLIC_REGISTRATION_ENABLED`.
- Password reset through the Render shell updates the intended account and nothing else.
- Rate limiting still works after an app restart once the `rate_limit_events` migration is applied.
