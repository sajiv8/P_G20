# RSO Campus Platform — Commands Reference

> All commands run from the project root: `c:\Users\isuru\Desktop\Python\GIT\P_G20\`

---

## 🚀 Development

| Command | Description |
|---------|-------------|
| `npm run dev` | **Start everything** — builds shared lib, then runs all 5 backend services + frontend in parallel (hot-reload) |
| `npm run dev:backend` | Start only the 5 backend services (no frontend) |
| `npm run dev:frontend` | Start only the Vite frontend dev server (port 5173) |
| `npm run dev:tenant` | Start only the Tenant Service (port 3001) |
| `npm run dev:user` | Start only the User Service (port 3002) |
| `npm run dev:resource` | Start only the Resource Service (port 3003) |
| `npm run dev:booking` | Start only the Booking Service (port 3004) |
| `npm run dev:notification` | Start only the Notification Service (port 3005) |

> **TIP:** `npm run dev` is the **recommended way** to develop. It auto-builds the shared library first, then starts everything with hot-reload. Press `Ctrl+C` to stop all services.

---

## 🔨 Build

| Command | Description |
|---------|-------------|
| `npm run build` | Build all workspaces (shared → services → frontend) |
| `npm run build:backend` | Build all backend services + shared lib + frontend |
| `npm run build:frontend` | Build only the frontend (production bundle) |
| `npm run clean` | Delete all `dist/` folders across all workspaces |

---

## 🧪 Testing

### Unit & Integration Tests

| Command | Description |
|---------|-------------|
| `npm run test` | Run all tests across all workspaces |
| `npm run test:coverage` | Run all tests with coverage reports |

### API Tests (Postman/Newman)

| Command | Description |
|---------|-------------|
| `npm run test:api` | Run Postman collection via Newman CLI |

### E2E / GUI Tests (Cypress)

| Command | Description |
|---------|-------------|
| `npm run test:gui` | Run Cypress E2E tests headlessly |
| `npm run test:gui:open` | Open Cypress interactive runner |
| `npm run test:a11y` | Run accessibility tests only (axe-core) |

### Cross-Browser Tests (Selenium)

| Command | Description |
|---------|-------------|
| `npm run test:crossbrowser` | Run Selenium cross-browser tests |

### Performance Tests (JMeter)

| Command | Description |
|---------|-------------|
| `npm run test:load` | Run full JMeter load test |
| `npm run test:load:smoke` | Run quick smoke load test |

### Security Tests (OWASP ZAP)

| Command | Description |
|---------|-------------|
| `npm run test:security` | Run OWASP ZAP security scan |

### Usability

| Command | Description |
|---------|-------------|
| `npm run test:sus` | Calculate SUS (System Usability Scale) score |

### Traceability Matrix

| Command | Description |
|---------|-------------|
| `npm run test:matrix` | Build test traceability matrix (JSON) |
| `npm run test:matrix:md` | Build test traceability matrix (Markdown) |

---

## 🐳 Docker Commands

### Local Development (No Nginx/SSL)

```bash
# Start all services (builds images first)
docker compose -f docker-compose.local.yml up --build -d

# View live logs
docker compose -f docker-compose.local.yml logs -f

# View logs for a specific service
docker compose -f docker-compose.local.yml logs -f booking-service

# Stop all services
docker compose -f docker-compose.local.yml down

# Stop and remove volumes (clean slate)
docker compose -f docker-compose.local.yml down -v

# Rebuild a single service
docker compose -f docker-compose.local.yml up --build -d booking-service

# Restart a single service
docker compose -f docker-compose.local.yml restart booking-service
```

### Production (With Nginx + SSL Gateway)

```bash
# Start full production stack (from backend/infra/)
docker compose -f backend/infra/docker-compose.yml up --build -d

# View logs
docker compose -f backend/infra/docker-compose.yml logs -f

# Stop
docker compose -f backend/infra/docker-compose.yml down
```

### Docker Utility Commands

```bash
# List running containers
docker ps

# Check container resource usage
docker stats

# Enter a running container shell
docker exec -it rso-booking-service sh

# Check container logs (last 100 lines)
docker logs --tail 100 rso-booking-service

# Prune unused images/containers
docker system prune -f

# Prune everything (including volumes — DESTRUCTIVE)
docker system prune -a --volumes
```

---

## 🏗️ Service Architecture

| Service | Port | Container Name | Description |
|---------|------|----------------|-------------|
| Frontend | 5173 | `rso-frontend` | React SPA (Vite dev / Nginx prod) |
| Tenant Service | 3001 | `rso-tenant-service` | Faculty onboarding, tenant CRUD |
| User Service | 3002 | `rso-user-service` | Signup, profiles, role management |
| Resource Service | 3003 | `rso-resource-service` | Resource CRUD, ST Resources, availability |
| Booking Service | 3004 | `rso-booking-service` | Bookings, conflict detection, optimization |
| Notification Service | 3005 | `rso-notification-service` | Email dispatch, in-app notifications |
| Redis | 6379 | `rso-redis` | Caching, rate limiting, message broker |
| Nginx Gateway | 80/443 | `rso-gateway` | API gateway (production only) |

---

## 📦 Workspace Structure

```
P_G20/
├── frontend/                     # React + Vite SPA
├── backend/
│   ├── services/
│   │   ├── shared/               # Shared lib (auth, supabase, logger, errors)
│   │   ├── tenant-service/       # Port 3001
│   │   ├── user-service/         # Port 3002
│   │   ├── resource-service/     # Port 3003
│   │   ├── booking-service/      # Port 3004
│   │   └── notification-service/ # Port 3005
│   ├── infra/                    # Production Docker Compose + Nginx
│   └── supabase/
│       └── migrations/           # Database schema (SQL)
├── tests/
│   ├── postman/                  # API tests (Newman)
│   ├── cypress/                  # E2E GUI tests
│   ├── selenium/                 # Cross-browser tests
│   ├── jmeter/                   # Load/performance tests
│   ├── security/                 # OWASP ZAP scan
│   ├── usability/                # SUS scoring
│   └── traceability/             # Requirements matrix
├── k8s/                          # Kubernetes manifests
├── nginx/                        # Nginx configs
├── docker-compose.local.yml      # Local dev Docker Compose
└── package.json                  # Root workspace config
```

---

## 🔑 Environment Setup

1. Copy `.env.example` to `.env` and fill in:
   - `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`
   - `FIREBASE_PROJECT_ID`
   - `MAIL_USER` / `MAIL_APP_PASSWORD` (for email notifications)

2. Place `firebase-service-account.json` in project root (for local dev) or `backend/config/` (for Docker)

3. Run `npm install` from project root

4. Run `npm run dev` to start developing!
