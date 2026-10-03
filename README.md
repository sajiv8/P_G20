# 🏫 CampusRSO — Multi-Tenant Campus Resource Sharing & Optimization Platform

A full-stack, microservices-based platform for managing shared university resources (lecture halls, laboratories, equipment) across multiple faculties. Features multi-tenant isolation, booking conflict prevention via PostgreSQL exclusion constraints, a student token economy, peer-to-peer resource sharing, real-time notifications, and an optimization engine.

---

## Architecture

```
┌──────────────────────── Client ────────────────────────┐
│             React SPA (Vite + TypeScript)               │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│              Nginx API Gateway (:80 / :443)             │
│         Rate Limiting · TLS Termination · CORS          │
├─────────┬──────────┬───────────┬──────────┬────────────┤
│ Tenant  │  User    │ Resource  │ Booking  │ Notification│
│ Service │ Service  │ Service   │ & Optim. │  Service    │
│  :3001  │  :3002   │  :3003    │  :3004   │  :3005     │
├─────────┴──────────┴───────────┴──────────┴────────────┤
│                @rso/shared (common library)             │
│   Auth Middleware · Supabase Client · Redis Client      │
│   Role Guard · Error Handler · Logger · Types           │
├────────────────────────┬───────────────────────────────┤
│  Supabase (PostgreSQL) │       Redis (Streams)          │
│  RLS · Exclusion GiST  │  Event-Driven Pub/Sub          │
└────────────────────────┴───────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, Vite 8, TypeScript, React Router 7, Recharts, Lucide Icons |
| **Backend** | Node.js 22, Fastify, TypeScript, NPM Workspaces (monorepo) |
| **Database** | PostgreSQL (Supabase) — RLS, GiST exclusion constraints, `pgcrypto` |
| **Authentication** | Firebase Authentication + Custom Claims (JWT) |
| **Message Broker** | Redis Streams (async event-driven pub/sub) |
| **Email** | Nodemailer (Gmail SMTP with App Password) |
| **API Gateway** | Nginx — reverse proxy, rate limiting (3 zones), TLS termination |
| **Containers** | Docker, Docker Compose |
| **CI/CD** | GitHub Actions (CI + E2E pipelines) |
| **Orchestration** | Kubernetes (Kustomize) + ArgoCD (GitOps) |
| **DNS / TLS** | Cloudflare (Origin Certificate, Full Strict mode) |
| **Testing** | Cypress (E2E/GUI), Jest (Unit), Postman/Newman (API), Selenium (Cross-browser), JMeter (Load), axe-core (Accessibility), OWASP ZAP (Security) |

---

## Services

| Service | Port | Responsibility |
|---------|------|----------------|
| **Tenant Service** | 3001 | Faculty/department CRUD, tenant onboarding |
| **User Service** | 3002 | Profile sync, signup, role management, Firebase custom claims, avatar upload |
| **Resource Service** | 3003 | Resource catalog, availability checks, student P2P shared resources (`st-resources`), P2P borrowing (`st-bookings`) |
| **Booking & Optimization** | 3004 | Booking CRUD, approve/reject workflow, overlap prevention, optimization engine, student token deduction |
| **Notification Service** | 3005 | In-app notifications, email dispatch via Gmail SMTP, Redis Streams event consumer |
| **Nginx Gateway** | 80/443 | Reverse proxy, rate limiting, TLS, security headers |
| **Redis** | 6379 | Event streaming between services (`booking-events`, `system-events`) |

---

## RBAC (Role-Based Access Control)

| Role | Permissions |
|------|-------------|
| `student` | Browse all resources, create bookings (token-gated), manage own P2P shared items, borrow from peers |
| `junior_lecturer` | Browse all resources across tenants, create bookings (no tenant isolation) |
| `lecturer` | Same as junior_lecturer — full cross-tenant resource visibility |
| `staff` | Browse tenant resources, create bookings |
| `tenant_admin` | Manage resources, approve/reject bookings within own tenant, manage tenant users |
| `main_admin` | Full access across all tenants, system-wide administration |

---

## Prerequisites

- [Node.js](https://nodejs.org/) ≥ 22
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for Docker mode)
- A [Supabase](https://supabase.com/) project (PostgreSQL database)
- A [Firebase](https://firebase.google.com/) project with Email/Password authentication enabled
- A Gmail account with an [App Password](https://myaccount.google.com/apppasswords) for email notifications

---

## Quick Start

### 1. Clone and Install

```bash
git clone <repo-url>
cd P_G20
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your actual secrets
```

Required secrets in `.env`:

| Variable | Description |
|----------|-------------|
| `FIREBASE_PROJECT_ID` | Firebase project ID |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Path to service account JSON (default: `./firebase-service-account.json`) |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (bypasses RLS) |
| `SUPABASE_ANON_KEY` | Supabase anonymous/public key |
| `MAIL_USER` | Gmail address for notifications |
| `MAIL_APP_PASSWORD` | Gmail App Password |
| `REDIS_URL` | Redis connection string (default: `redis://localhost:6379`) |

Frontend environment (in `frontend/.env`):

| Variable | Description |
|----------|-------------|
| `VITE_FIREBASE_API_KEY` | Firebase client API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID |
| `VITE_API_URL` | API base path (default: `/api/v1`) |

### 3. Run Database Migrations

Apply the combined migration script to your Supabase project via the [SQL Editor](https://supabase.com/dashboard/project/_/sql):

```bash
# Run the single combined migration file:
backend/supabase/combined_migration.sql
```

Or apply individual migrations in order from `backend/supabase/migrations/` (files `00001` through `00015`).

### 4. Configure Firebase

1. Enable **Email/Password** sign-in in Firebase Console → Authentication → Sign-in method
2. Download the Admin SDK service account key and save as `firebase-service-account.json` in the project root

---

## Running the Platform

### Option 1: Local Development (without Docker)

Uses Vite's dev proxy to route API requests directly to microservice ports.

```bash
# Start all services + frontend in watch mode
npm run dev

# Or use the batch script (Windows)
start_platform.cmd
```

Access at: **http://localhost:5173**

### Option 2: Docker Compose (Local)

Spins up all containers including Redis, with Nginx reverse proxy routing.

```bash
# Build and start all containers
docker compose -f docker-compose.local.yml up --build -d

# View logs
docker compose -f docker-compose.local.yml logs -f

# Stop everything
docker compose -f docker-compose.local.yml down
```

Access at: **http://localhost:5173**

### Option 3: Production (Cloud / Kubernetes)

Uses the full infrastructure stack with Nginx gateway, TLS, and rate limiting.

```bash
# Production Docker Compose (with Nginx gateway)
cd backend/infra
docker compose up -d
```

Or deploy via Kubernetes + ArgoCD using the manifests in `k8s/`.

---

## Project Structure

```
P_G20/
├── .github/workflows/           # CI/CD pipelines (ci.yml, e2e.yml)
├── backend/
│   ├── infra/                   # Production Docker Compose + Nginx Gateway
│   │   ├── docker-compose.yml
│   │   └── gateway/
│   │       ├── nginx.conf       # Rate limiting, TLS, reverse proxy
│   │       └── ssl/             # Cloudflare Origin Certificates
│   ├── services/
│   │   ├── shared/              # @rso/shared — common library
│   │   │   └── src/
│   │   │       ├── auth-middleware.ts   # Firebase JWT verification
│   │   │       ├── supabase-client.ts   # DB client (service role)
│   │   │       ├── redis-client.ts      # Redis Streams pub/sub
│   │   │       ├── role-guard.ts        # RBAC enforcement
│   │   │       ├── error-handler.ts     # Centralized error handling
│   │   │       ├── cors-config.ts       # CORS configuration
│   │   │       ├── logger.ts            # Pino structured logging
│   │   │       └── types.ts             # Shared TypeScript types
│   │   ├── tenant-service/      # Faculty/department management
│   │   ├── user-service/        # Profile sync, roles, avatars
│   │   ├── resource-service/    # Resources + ST Resources + ST Bookings
│   │   ├── booking-service/     # Bookings, optimization, tokens
│   │   └── notification-service/# Email dispatch, Redis event consumer
│   └── supabase/
│       ├── combined_migration.sql   # Single-file DB setup
│       └── migrations/              # 18 ordered SQL migration files
├── frontend/
│   ├── src/
│   │   ├── contexts/            # AuthContext (Firebase + claims)
│   │   ├── lib/                 # API client (auto JWT injection)
│   │   ├── pages/               # Dashboard, Resources, Bookings,
│   │   │                        # ST-Resources, Admin, Profile,
│   │   │                        # Auth, Notifications
│   │   ├── components/          # Reusable UI components
│   │   ├── layouts/             # App layout shell
│   │   └── styles/              # CSS modules
│   ├── vite.config.ts           # Dev proxy → microservice ports
│   ├── nginx.conf               # Production SPA serving
│   ├── nginx.local.conf         # Docker local reverse proxy
│   └── Dockerfile               # Multi-stage (build → Nginx)
├── tests/
│   ├── cypress/                 # E2E / GUI tests (5 spec files)
│   ├── unit/                    # Jest unit tests
│   ├── postman/                 # API integration tests (Newman)
│   ├── selenium/                # Cross-browser tests
│   ├── jmeter/                  # Load/performance tests
│   ├── security/                # OWASP ZAP security scan
│   ├── usability/               # SUS score calculation
│   ├── traceability/            # Requirements traceability matrix
│   └── manual/                  # Manual test cases
├── k8s/                         # Kubernetes manifests (Kustomize)
│   ├── base/                    # Base deployments and services
│   ├── overlays/                # Environment-specific patches
│   └── argocd/                  # ArgoCD application manifest
├── docker-compose.local.yml     # Local Docker development
├── cypress.config.ts            # Cypress E2E configuration
├── package.json                 # NPM Workspaces root
├── start_platform.cmd           # Windows batch script launcher
└── .env                         # Environment variables
```

---

## API Reference

All endpoints require a Firebase ID token: `Authorization: Bearer <token>`

### Tenants — `/api/v1/tenants`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | Any | List tenants (paginated) |
| GET | `/:id` | Any | Get tenant by ID |
| POST | `/` | main_admin | Create tenant |
| PUT | `/:id` | tenant_admin+ | Update tenant |
| DELETE | `/:id` | main_admin | Deactivate tenant |
| GET | `/:id/stats` | tenant_admin+ | Tenant statistics |

### Users — `/api/v1/users`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/signup` | Any (Firebase token) | Create profile + set custom claims |
| GET | `/me` | Any | Get own profile |
| GET | `/` | tenant_admin+ | List users (paginated) |
| GET | `/:uid` | Any | Get user by UID |
| PUT | `/:uid` | Self or admin | Update profile |
| PUT | `/:uid/role` | tenant_admin+ | Change user role |
| DELETE | `/:uid` | tenant_admin+ | Deactivate user |

### Resources — `/api/v1/resources`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | Any | List resources (paginated, filterable) |
| GET | `/:id` | Any | Get resource details |
| POST | `/` | tenant_admin+ | Create resource |
| PUT | `/:id` | tenant_admin+ | Update resource |
| DELETE | `/:id` | tenant_admin+ | Retire resource |
| GET | `/:id/availability` | Any | Check availability by date |

### ST Resources (Student P2P) — `/api/v1/st-resources`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | Any | List shared student items |
| POST | `/` | Any | List an item for sharing |
| PUT | `/:id` | Owner or admin | Update item |
| DELETE | `/:id` | Owner or admin | Remove item |
| POST | `/:id/bookings` | Any | Borrow an item |
| GET | `/:id/bookings` | Any | View bookings for item |

### Bookings — `/api/v1/bookings`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | Any | List bookings (filterable) |
| GET | `/:id` | Any | Get booking details |
| POST | `/` | Any | Create booking (token-gated for students) |
| PUT | `/:id/approve` | tenant_admin+ | Approve booking |
| PUT | `/:id/reject` | tenant_admin+ | Reject booking |
| PUT | `/:id/cancel` | Owner or admin | Cancel booking |
| GET | `/optimization/stats` | tenant_admin+ | Optimization logs |

### Notifications — `/api/v1/notifications`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | Any | Get own notifications |
| PUT | `/:id/read` | Any | Mark as read |
| PUT | `/read-all` | Any | Mark all as read |
| GET | `/unread-count` | Any | Get unread count |

---

## Testing

The platform includes a comprehensive multi-layer testing strategy:

```bash
# Unit tests (Jest)
npm test

# GUI / E2E tests (Cypress)
npx cypress run                    # Headless
npx cypress open                   # Interactive

# API integration tests (Postman/Newman)
npm run test:api

# Cross-browser tests (Selenium)
npm run test:crossbrowser

# Load/performance tests (JMeter)
npm run test:load
npm run test:load:smoke

# Accessibility tests (axe-core via Cypress)
npm run test:a11y

# Security scan (OWASP ZAP)
npm run test:security

# Usability score (SUS)
npm run test:sus

# Traceability matrix
npm run test:matrix
npm run test:matrix:md
```

> **Note:** For Cypress GUI tests, copy `cypress.env.example.json` to `cypress.env.json` and fill in test account credentials.

---

## Database Schema

The platform uses 8 core tables with Row Level Security (RLS):

| Table | Purpose |
|-------|---------|
| `tenants` | Faculties/departments (multi-tenancy root) |
| `user_profiles` | Firebase UID mapping, roles, tenant association |
| `resources` | Official faculty resources (halls, labs, equipment) |
| `bookings` | Reservations with GiST exclusion constraint (no overlaps) |
| `notifications` | In-app notification inbox |
| `optimization_logs` | Resource utilization analytics |
| `student_token_balances` | Monthly token wallet (100 tokens/month) |
| `token_transactions` | Double-entry ledger for token movements |
| `st_resources` | Student peer-to-peer shared items |
| `st_bookings` | P2P borrowing records |

---

## Rate Limiting

Enforced at the Nginx API Gateway level with three zones:

| Zone | Rate | Applied To |
|------|------|-----------|
| `api_auth` | 3 req/s per IP | `/api/v1/users/signup` |
| `api_booking_write` | 5 req/s per IP | `/api/v1/bookings` (POST) |
| `api_general` | 10 req/s per IP | All other API routes |

Exceeding the limit returns HTTP `429 Too Many Requests`.

---

## Cloudflare DNS Setup

1. Add an **A record** pointing your domain to the server IP
2. Set SSL/TLS mode to **Full (Strict)**
3. Generate an **Origin Certificate** in Cloudflare dashboard
4. Save the certificate and key to `backend/infra/gateway/ssl/origin.pem` and `origin-key.pem`

---

## License

Private — University of Moratuwa
