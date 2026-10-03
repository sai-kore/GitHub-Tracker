# GitHub Contribution API

A Node.js/Express service that synchronizes GitHub repository data into MongoDB and exposes it through a REST API for contributors, pull requests, issues, reviews, and raw GitHub activity data.

This project is designed to collect and query contribution history from GitHub at scale, while also supporting real-time webhook updates and scheduled background sync jobs.

## Features

- GitHub repository and organization sync
- Real-time GitHub webhook ingestion
- Scheduled background synchronization
- Contributor, repository, PR, issue, and review analytics APIs
- MongoDB-backed persistence for normalized GitHub entities
- Optional GitHub OAuth login flow
- Input validation for date filters and sync secrets
- Security headers, CORS, and rate limiting

## Tech Stack

- Node.js
- Express.js
- MongoDB + Mongoose
- GitHub REST API
- GitHub webhooks
- dotenv for configuration
- nodemon for development

## Project Structure

```text
.
├── .env.example
├── .gitignore
├── package.json
├── src/
│   ├── app.js
│   ├── server.js
│   ├── config/
│   │   ├── db.js
│   │   ├── env.js
│   │   └── github.js
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── commitController.js
│   │   ├── contributorController.js
│   │   ├── githubController.js
│   │   ├── pullRequestController.js
│   │   ├── rawDataController.js
│   │   ├── repositoryController.js
│   │   └── ...
│   ├── middleware/
│   │   ├── githubWebhook.js
│   │   └── syncAuth.js
│   ├── models/
│   │   ├── Commit.js
│   │   ├── ContributionEvent.js
│   │   ├── Issue.js
│   │   ├── IssueComment.js
│   │   ├── PRLabelEvent.js
│   │   ├── PullRequest.js
│   │   ├── Repository.js
│   │   ├── RepositoryMember.js
│   │   ├── Review.js
│   │   ├── ReviewComment.js
│   │   ├── User.js
│   │   └── WebhookEvent.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── contributors.js
│   │   ├── data.js
│   │   ├── github.js
│   │   ├── issues.js
│   │   ├── pullRequests.js
│   │   ├── repositories.js
│   │   └── users.js
│   ├── services/
│   │   ├── githubService.js
│   │   ├── pullRequestSyncService.js
│   │   ├── repoService.js
│   │   ├── repoSyncService.js
│   │   ├── scheduler.js
│   │   └── webhookIngestionService.js
│   ├── utils/
│   │   ├── dates.js
│   │   ├── pool.js
│   │   └── signature.js
│   └── ...
└── package-lock.json
```

## Runtime Flow

1. The server starts in `src/server.js`.
2. Environment variables are validated in `src/config/env.js`.
3. MongoDB is connected in `src/config/db.js`.
4. The Express app is created in `src/app.js`.
5. Routes are mounted under `/api` and `/api/github`.
6. GitHub webhooks and scheduled sync jobs ingest repository state into MongoDB.
7. The API serves aggregated and raw GitHub metadata from the database.

## Required Environment Variables

Copy `.env.example` to `.env` and fill in the values before starting the application.

| Variable | Required | Description |
| --- | --- | --- |
| `PORT` | No | Port for the HTTP server. Defaults to `5000`. |
| `MONGODB_URI` | Yes | MongoDB connection string. |
| `GITHUB_WEBHOOK_SECRET` | Yes | Secret used to verify GitHub webhook payload signatures. |
| `GITHUB_TOKEN` | Yes | GitHub personal access token used to query repository data. |
| `GITHUB_OWNER` | Yes | GitHub user or organization whose repositories should be tracked. |
| `SYNC_SECRET` | Yes | Shared secret required for sync endpoints. |
| `GITHUB_REPOS` | No | Comma-delimited repo list, or `*` to auto-discover every repo in the owner account. Default: `*`. |
| `GITHUB_EXCLUDE_REPOS` | No | Repositories to skip during sync. |
| `GITHUB_INCLUDE_FORKS` | No | Whether forked repositories should be included. Default: `false`. |
| `GITHUB_INCLUDE_ARCHIVED` | No | Whether archived repositories should be included. Default: `false`. |
| `SYNC_INTERVAL_MINUTES` | No | Background sync interval in minutes. Set to `0` to disable. Default: `10`. |
| `GITHUB_CLIENT_ID` | No | OAuth app client ID for GitHub login. |
| `GITHUB_CLIENT_SECRET` | No | OAuth app client secret for GitHub login. |
| `GITHUB_OAUTH_REDIRECT_URI` | No | OAuth redirect URL. |
| `AUTH_SUCCESS_REDIRECT` | No | Frontend redirect target after a successful auth callback. Default: `/`. |

### Notes

- `GITHUB_REPO` is no longer used; the project now expects `GITHUB_REPOS`.
- `GITHUB_REPOS=*` is the default behavior for discovering repositories in the configured owner account.
- Date query parameters are validated and rejected with HTTP 400 if they are malformed.

## Installation and Setup

### 1) Install dependencies

```bash
npm install
```

### 2) Configure environment

```bash
cp .env.example .env
```

Then update values in `.env` for your MongoDB, GitHub token, repo owner, and sync secret.

### 3) Start the app

Development mode:

```bash
npm run dev
```

Production mode:

```bash
npm start
```

### 4) Health check

```bash
curl http://localhost:5000/health
```

Expected response:

```json
{
  "success": true,
  "message": "GitHub Contribution API is running"
}
```

## API Endpoints

The app exposes traffic through the following route groups.

### Health

- `GET /health`
  - Returns a simple service status response.

### GitHub Sync and Webhooks

- `POST /api/github/webhook`
  - Receives GitHub webhook events.
  - Validates the `X-Hub-Signature-256` header before processing.
- `POST /api/github/sync`
  - Syncs all tracked repositories.
  - Requires `x-sync-secret` header matching `SYNC_SECRET`.
- `POST /api/github/sync/:owner/:repo`
  - Syncs one repository.
- `POST /api/github/sync/:owner/:repo/:number`
  - Syncs one pull request.

### Raw Data Access

These endpoints read stored GitHub data from MongoDB:

- `GET /api/commits`
- `GET /api/commits/:id`
- `GET /api/reviews`
- `GET /api/reviews/:id`
- `GET /api/review-comments`
- `GET /api/review-comments/:id`
- `GET /api/issue-comments`
- `GET /api/issue-comments/:id`
- `GET /api/issues`
- `GET /api/issues/:id`
- `GET /api/contributions`

### Pull Requests

- `GET /api/pull-requests`
- `GET /api/pull-requests/:id`
- `GET /api/pull-requests/:id/labels`
- `GET /api/pull-requests/:id/label-events`
- `GET /api/pull-requests/:id/reviews`
- `GET /api/pull-requests/:id/review-comments`
- `GET /api/pull-requests/:owner/:repo/:number`

### Repositories

- `GET /api/repositories`
- `GET /api/repositories/:id`
- `GET /api/repositories/:id/members`
- `GET /api/repositories/:id/labels`

### Contributors

- `GET /api/contributors`
- `GET /api/contributors/:username`

### Users

- `GET /api/users/:githubId`
- `GET /api/users/:githubId/contributions`
- `GET /api/users/:githubId/pull-requests`
- `GET /api/users/:githubId/reviews`
- `GET /api/users/:githubId/comments`
- `GET /api/users/:githubId/commits`
- `GET /api/users/:githubId/repositories`
- `GET /api/users/:githubId/activity`

### Authentication

- `GET /api/auth/github`
  - Starts GitHub OAuth flow.
- `GET /api/auth/github/callback`
  - Handles the OAuth callback.
- `GET /api/auth/me`
  - Returns the authenticated user profile.
- `POST /api/auth/logout`
  - Logs the current user out.

## Middleware and Security

The application applies the following middlewares:

- `helmet()` to enforce HTTP security headers
- `cors()` to allow cross-origin access if configured
- Express JSON parsing for request bodies
- `express.raw({ type: "application/json" })` for `/api/github/webhook`
- Global rate limiting for `/api` routes, except GitHub webhook and sync endpoints
- Date validation middleware for `since`, `until`, `from`, and `to` query parameters
- Signature verification for GitHub webhooks
- Shared-secret validation for sync endpoints

## Sync Model

The project supports both real-time and scheduled synchronization.

### Webhook-based updates

GitHub webhook payloads are verified before being accepted. This provides near-instant updates when repository activity changes.

### Background sync

`startScheduler()` runs on startup and performs periodic repository syncs after a configured interval. The scheduler is controlled by `SYNC_INTERVAL_MINUTES`.

If `SYNC_INTERVAL_MINUTES` is `0`, the background sync is disabled.

## Data Layer

The application stores entities in MongoDB using Mongoose models. Notable models include:

- `Commit`
- `ContributionEvent`
- `Issue`
- `IssueComment`
- `PRLabelEvent`
- `PullRequest`
- `Repository`
- `RepositoryMember`
- `Review`
- `ReviewComment`
- `User`
- `WebhookEvent`

This normalization makes it easier to query contribution history and organizational activity without repeatedly calling GitHub APIs.

## Typical Workflow

1. Configure the owner and repo filters in `.env`.
2. Start the application.
3. Wait for the initial sync or trigger a manual sync endpoint.
4. Query `/api/...` endpoints for repository, user, and contribution data.
5. Use GitHub webhooks for near-real-time updates.
6. Use the scheduled sync as a safety net for missed events.

## Common Troubleshooting

### Missing environment variables

The app validates required values before startup. If one is missing, the server exits with a message listing the missing variables.

### Invalid webhook signature

The endpoint rejects requests if the payload signature does not match the configured secret.

### Sync endpoints return unauthorized

Make sure the `x-sync-secret` request header matches the value of `SYNC_SECRET` in your environment.

### No data appears after startup

Check that:

- `GITHUB_OWNER` is set correctly
- `GITHUB_TOKEN` has the needed permissions
- `GITHUB_REPOS` matches the intended repositories
- MongoDB is reachable from the configured connection string

### Invalid date filters

This app intentionally rejects malformed date values with an HTTP 400. Ensure `since`, `until`, `from`, and `to` are valid date strings.

## Development Commands

```bash
npm install
npm run dev
npm start
```

## Notes

This project focuses on ingesting and serving GitHub contribution data for analytics and automation use cases. It is best treated as a contribution data backend for dashboards, internal tooling, and reporting workflows.

If you want to extend the project, the most common integration points are:

- add new route controllers under `src/controllers/`
- add new Mongoose schemas under `src/models/`
- add sync logic under `src/services/`
- expose new endpoints in `src/routes/`
