# Tasks: Admin Content Management

**Input**: Design documents from `/specs/001-admin-content-management/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Organization**: Tasks are grouped by user story so each story can be implemented and validated as an independent increment.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish Firebase service configuration and the feature-oriented source structure.

- [X] T001 [P] Add Firebase Functions package configuration and local emulator scripts in functions/package.json
- [X] T002 [P] Add Firebase Firestore, Storage, indexes, and emulator configuration in firebase.json, firestore.indexes.json, and .firebaserc
- [X] T003 [P] Create feature source directories and test directories in src/components/admin, src/components/public, src/pages, tests/integration, and tests/browser

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Implement shared identity, data access, validation, storage, security, and migration foundations required by every user story.

**CRITICAL**: No user story work can begin until this phase is complete.

- [X] T004 Initialize Firebase Authentication, Firestore, and Storage clients without exposing privileged credentials in src/firebase/config.js
- [X] T005 Implement administrator session and custom-claim helpers in src/firebase/auth.js
- [X] T006 Define shared result, past-paper, and audit validation constants in src/firebase/validation.js
- [X] T007 Configure administrator-only Firestore and Storage rules plus public published-read rules in firestore.rules and storage.rules
- [X] T008 [P] Create trusted Functions entry points for authorized content mutations and server-generated audit records in functions/src/index.js and functions/src/contentMutations.js
- [X] T009 [P] Implement public and dashboard content read services with pathway, subject, search, and publication filters in src/firebase/content.js
- [X] T010 Create a one-time migration/seeding utility for existing hardcoded results and past-paper metadata in scripts/migrate-content.js
- [X] T011 Document administrator claim provisioning, environment variables, emulator configuration, and the 25 MB PDF limit in README.md and .env.example

**Checkpoint**: Firebase clients, security boundaries, shared validation, content readers, and migration prerequisites are ready for story implementation.

---

## Phase 3: User Story 1 - Secure Admin Access (Priority: P1) MVP

**Goal**: Allow provisioned administrators to sign in, reach a protected dashboard, and sign out while denying unauthenticated access.

**Independent Test**: In the emulator environment, an authorized administrator reaches the dashboard after valid sign-in, invalid credentials remain on the login screen, signed-out visitors are redirected to login, and protected mutations are denied for non-admin identities.

- [X] T012 [P] [US1] Build the administrator sign-in form with generic credential errors in src/pages/AdminLogin.jsx
- [X] T013 [US1] Implement auth-state subscription and protected-route redirect behavior in src/components/admin/AdminGuard.jsx and src/firebase/auth.js
- [X] T014 [US1] Build the authenticated dashboard shell with navigation and sign-out action in src/pages/AdminDashboard.jsx
- [X] T015 [US1] Add /admin/login and /admin route handling without changing existing public routes in src/App.jsx
- [ ] T016 [US1] Verify authorized, invalid, signed-out, expired-session, and non-admin access behavior with Firebase Emulator scenarios in tests/integration/admin-auth.test.js

**Checkpoint**: User Story 1 is independently usable as a secure admin entry point and MVP foundation.

---

## Phase 4: User Story 2 - Manage Student Results (Priority: P1)

**Goal**: Let an authenticated administrator add, view, edit, and delete student results and reflect published changes in the public Results area.

**Independent Test**: Create a valid result, confirm it in the dashboard and public Results view, edit it, confirm the update, delete it with confirmation, and verify invalid or stale submissions do not overwrite or publish data.

- [ ] T017 [P] [US2] Implement validated result create, update, delete, version-check, and audit mutations in functions/src/contentMutations.js
- [X] T018 [P] [US2] Build the result entry and edit form with score, subject, school, publication, and field-level validation in src/components/admin/ResultForm.jsx
- [X] T019 [US2] Build the results management list with view, edit, delete confirmation, conflict, loading, and empty states in src/components/admin/ResultsManager.jsx
- [X] T020 [US2] Connect result form and list actions to content services and the protected dashboard in src/firebase/content.js and src/pages/AdminDashboard.jsx
- [X] T021 [US2] Replace hardcoded public result data with published content reads while preserving the existing Results layout in src/App.jsx
- [X] T022 [US2] Add public result empty-state and long-name/score rendering behavior in src/App.jsx and src/App.css
- [ ] T023 [US2] Verify result CRUD, validation, stale-update conflict, deletion, and public reflection in tests/integration/results-content.test.js

**Checkpoint**: User Stories 1 and 2 work independently; administrators can securely maintain public student results.

---

## Phase 5: User Story 3 - Manage Past-Paper PDFs (Priority: P1)

**Goal**: Let an authenticated administrator upload, view, replace, and delete valid PDF past papers for IGCSE, AS & A Level, SAT / ACT, IBDP, and MYP.

**Independent Test**: Upload a valid PDF with each supported pathway, confirm it appears in the dashboard and public library, update metadata or replace the file, delete it with confirmation, and verify invalid files never become public.

- [X] T024 [P] [US3] Implement PDF type, signature, size, filename, and staged-upload validation in src/firebase/storage.js and functions/src/contentMutations.js
- [X] T025 [P] [US3] Implement past-paper create, replace, delete, publication-state, and audit mutations in functions/src/contentMutations.js
- [X] T026 [P] [US3] Build the past-paper upload and edit form with all five supported pathways in src/components/admin/PastPaperForm.jsx
- [X] T027 [US3] Build the past-paper management list with file status, preview, replacement, delete confirmation, and failure states in src/components/admin/PastPapersManager.jsx
- [X] T028 [US3] Connect PDF upload progress and metadata mutations to the protected dashboard in src/firebase/storage.js, src/firebase/content.js, and src/pages/AdminDashboard.jsx
- [X] T029 [US3] Replace hardcoded past-paper subjects with published resource reads and downloadable references in src/pages/PastPapersPage.jsx and src/App.jsx
- [X] T030 [US3] Update Premium Sources navigation and cards to use managed pathways without changing existing public styling in src/App.jsx and src/App.css
- [ ] T031 [US3] Add PDF validation, failed-upload cleanup, pathway filtering, search, no-results, and deleted-download scenarios in tests/integration/past-papers-content.test.js

**Checkpoint**: User Stories 1 through 3 work independently; administrators can securely manage the public past-paper library.

---

## Phase 6: User Story 4 - Review Public Reflection (Priority: P2)

**Goal**: Give administrators a reliable way to open the public result or past-paper view and confirm saved content is what visitors see.

**Independent Test**: Save or update each content type, open its public location from the dashboard, compare display fields and availability, then delete it and verify public access is removed.

- [ ] T032 [P] [US4] Add public preview links and saved-content confirmation states to src/components/admin/ResultsManager.jsx and src/components/admin/PastPapersManager.jsx
- [ ] T033 [US4] Add stable public result and past-paper detail/list references for preview and deleted-resource handling in src/components/public/ContentPreview.jsx and src/pages/PastPapersPage.jsx
- [ ] T034 [US4] Verify dashboard-to-public preview, publish timing, deleted access, and no-partial-record behavior in tests/browser/public-reflection.spec.js

**Checkpoint**: All requested management workflows have independently verifiable public outcomes.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Harden security, migration, accessibility, responsiveness, and release validation across all stories.

- [ ] T035 [P] Add Firestore and Storage rule tests for unauthenticated, authenticated non-admin, and administrator identities in tests/integration/firebase-rules.test.js
- [ ] T036 [P] Add browser smoke coverage for responsive login, dashboard forms, confirmation dialogs, search, and empty states in tests/browser/admin-content.spec.js
- [X] T037 [P] Add accessible labels, keyboard focus states, upload progress, and user-safe error messaging in src/components/admin/*.jsx and src/App.css
- [X] T038 Review and optimize public content queries and indexes for the 10-second reflection goal in src/firebase/content.js and firestore.indexes.json
- [X] T039 Document migration, deployment, rollback, and administrator operations in README.md and specs/001-admin-content-management/quickstart.md
- [ ] T040 Run the complete validation guide, npm run lint, npm run build, emulator tests, and browser tests and record results in specs/001-admin-content-management/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; T001-T003 can run in parallel.
- **Foundational (Phase 2)**: Depends on Setup; T004-T011 block all user stories.
- **User Story 1 (Phase 3)**: Depends on T004-T008; establishes the protected dashboard used by later stories.
- **User Story 2 (Phase 4)**: Depends on Foundational and the protected dashboard shell from T014-T015; its content service and mutation work can begin in parallel with parts of US3 after the shared foundation.
- **User Story 3 (Phase 5)**: Depends on Foundational and the protected dashboard shell from T014-T015; PDF/storage work can proceed in parallel with US2 after the shared foundation.
- **User Story 4 (Phase 6)**: Depends on the completed public readers and management flows from US2 and US3.
- **Polish (Phase 7)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **US1**: No dependency on another user story; MVP scope.
- **US2**: Depends on shared foundation and US1 dashboard access, but result CRUD is independent of past-paper work.
- **US3**: Depends on shared foundation and US1 dashboard access, but PDF CRUD is independent of result work.
- **US4**: Depends on US2 and US3 because it verifies both public content types.

### Parallel Opportunities

- Setup tasks T001-T003 can run in parallel.
- Foundational tasks T008-T010 can run in parallel after client/rules decisions are agreed.
- After US1 dashboard access is available, US2 and US3 can be assigned to separate developers in parallel.
- Within US2, T017-T019 can be developed in parallel across Functions, form UI, and list UI before T020 integration.
- Within US3, T024-T027 can be developed in parallel across storage validation, mutation logic, upload UI, and management UI before T028 integration.
- Final rule tests, browser tests, and accessibility work T035-T037 can run in parallel.

## Parallel Example: User Story 2

```text
Task T017: Implement result mutations in functions/src/contentMutations.js
Task T018: Build ResultForm in src/components/admin/ResultForm.jsx
Task T019: Build ResultsManager in src/components/admin/ResultsManager.jsx
```

## Parallel Example: User Story 3

```text
Task T024: Implement PDF validation in src/firebase/storage.js and functions/src/contentMutations.js
Task T026: Build PastPaperForm in src/components/admin/PastPaperForm.jsx
Task T027: Build PastPapersManager in src/components/admin/PastPapersManager.jsx
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 Setup.
2. Complete Phase 2 Foundational infrastructure.
3. Complete Phase 3 User Story 1.
4. Validate admin sign-in, authorization denial, session expiry, and sign-out independently.
5. Deploy or demo the protected dashboard shell before adding content mutations.

### Incremental Delivery

1. Add US1 secure access and validate it.
2. Add US2 result management and public reflection, then validate independently.
3. Add US3 past-paper management and public reflection, then validate independently.
4. Add US4 preview and deleted-content verification.
5. Complete cross-cutting security, accessibility, migration, and release checks.

## Notes

- Every task begins with `- [ ]`, includes a sequential task ID, and includes a concrete file path.
- `[P]` marks only tasks that can be performed in parallel without depending on incomplete work in the same file.
- Story tasks include exactly one `[US#]` label mapped to the specification’s user stories.
- Tests are included because the plan and quickstart require emulator and browser validation for security and cross-service behavior.
