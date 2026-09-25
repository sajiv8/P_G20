# Test Suite — RSO Campus Platform

This directory contains all test cases for the Multi-Tenant Campus Resource Sharing Platform.

## Structure

```
tests/
├── unit/                         # Unit tests (per-service)
│   ├── shared/                   # @rso/shared library tests
│   │   ├── auth-middleware.test.ts
│   │   ├── role-guard.test.ts
│   │   ├── error-handler.test.ts
│   │   ├── redis-client.test.ts
│   │   └── supabase-client.test.ts
│   ├── tenant-service/
│   │   └── routes.test.ts
│   ├── user-service/
│   │   └── routes.test.ts
│   ├── resource-service/
│   │   ├── routes.test.ts
│   │   ├── stRoutes.test.ts
│   │   └── stBookingRoutes.test.ts
│   ├── booking-service/
│   │   └── routes.test.ts
│   └── notification-service/
│       └── routes.test.ts
├── integration/                  # Integration tests (cross-service)
│   └── booking-flow.test.ts
├── helpers/
│   ├── mock-firebase.ts          # Firebase Admin mock
│   ├── mock-supabase.ts          # Supabase client mock
│   ├── mock-redis.ts             # Redis client mock
│   └── test-fixtures.ts          # Shared test data
├── postman/
│   └── RSO_Campus_Platform.postman_collection.json
├── jest.config.ts
└── README.md
```

## Running Tests

```bash
# Install test dependencies (from project root)
npm install --save-dev jest ts-jest @types/jest

# Run all tests
npx jest --config tests/jest.config.ts

# Run specific service tests
npx jest tests/unit/booking-service/
npx jest tests/unit/shared/

# Run with coverage
npx jest --config tests/jest.config.ts --coverage

# Run in watch mode
npx jest --config tests/jest.config.ts --watch
```
