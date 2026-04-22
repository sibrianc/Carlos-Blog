# Blog + Portfolio Integration Plan

## Summary

Merge Carlos Dev into Personal Blog while keeping the Blog as the canonical Flask + React/Vite/Tailwind app. The current phase focuses on visual scenes, `/contact`, `/about`, `/projects`, and admin-managed portfolio projects/messages.

Branch: `integration/blog-portfolio-carlos-dev`

## Implemented Scope

- Port Carlos Dev scene systems into the Blog frontend as controlled modules:
  - `SkySystem`, `CitySystem`, `CubeSystem`, `CipitioSystem`, `AssetLoader`
  - `UrbanScene`, `RuralScene`, `MayaScene`
- Copy Carlos Dev image assets into Vite public assets under `frontend/public/portfolio-assets`.
- Add route-aware `PortfolioSceneBackground`:
  - `/` uses home scene/cube.
  - `/about` uses rural scene and white Cadejo.
  - `/projects` uses urban portfolio scene and black Cadejo.
  - `/contact` uses Maya scene and Cipitio.
- Replace `/contact` with Carlos Dev-inspired UI and Cipitio validation.
- Remove phone number from the contact UI, TypeScript payload, Flask form, and tests.
- Persist contact messages in `contact_messages` while keeping current Resend delivery.
- Add `Project` and `ContactMessage` models plus Alembic migration.
- Add public project APIs and React routes:
  - `GET /api/projects`
  - `GET /api/projects/<slug>`
  - `/projects`
  - `/projects/:slug`
- Add Jinja admin management using the existing Blog admin/auth:
  - `/admin/projects`
  - `/admin/projects/new`
  - `/admin/projects/<id>/edit`
  - `/admin/messages`
- Exclude appointments, client dashboard, Stripe, `Appointment`, `Payment`, and payment services.

## Verification

Commands run:

```powershell
python -m pytest
cd frontend
npm run lint
npm run build
```

Results:

- Backend tests: `40 passed`.
- TypeScript lint: passed.
- Vite build: passed.
- Build warning remains for large chunks.
- CSS references to `/app/portfolio-assets/*.png` are intentionally runtime-resolved after Vite copies public assets.

## Review URLs

- Backend used for updated code: `http://127.0.0.1:5004/`
- `http://127.0.0.1:5004/contact`
- `http://127.0.0.1:5004/about`
- `http://127.0.0.1:5004/projects`
- `http://127.0.0.1:5004/admin/projects`

Note: `5003` was still occupied by an older Python process that could not be stopped from this session, so the updated backend was started on `5004`.

## Remaining Follow-Up

- Add real portfolio project entries through `/admin/projects`.
- Decide later whether to add richer seed data or import existing Carlos Dev project rows.
- Favicon still returns 404; unrelated to this merge.
