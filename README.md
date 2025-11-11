# Server-Side (Express + MongoDB)

A minimal, structured Express server using Mongoose, with CORS enabled and a service/controller pattern.

## Structure

- `src/config`: Environment + database connection
- `src/models`: Mongoose schemas/models
- `src/services`: Business logic (no Express dependency)
- `src/controllers`: Request handlers using services
- `src/routes`: Route definitions grouped by feature
- `src/middlewares`: Error handling, validation helpers
- `src/utils`: Small utilities (logger, error classes)

## Endpoints

- `GET /api/health` — health check
- `POST /api/generate` — body `{ question: string }`, persists and returns a placeholder `answer`

## Getting Started

1. Copy `.env.example` to `.env` and set `MONGO_URI`.
2. Install dependencies:
   - `cd server-side`
   - `npm install`
3. Run in development:
   - `npm run dev`
4. Build and run in production:
   - `npm run build`
   - `npm start`

The server listens on `PORT` (default `8080`).

## Notes

- Replace the placeholder logic in `src/services/generateService.ts` with your actual generation workflow.
- CORS is configured via `CORS_ORIGIN` (set to `*` by default). Adjust for your frontend origin in production.
