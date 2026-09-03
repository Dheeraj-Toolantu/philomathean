# Implementation Plan: Admin Content Management

**Branch**: `001-admin-content-management` | **Date**: 2026-09-03 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from [spec.md](spec.md)

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Deliver a protected administrator dashboard that manages student results and past-paper PDF resources, with changes reflected on the existing public website. Use the existing Firebase project with email/password Authentication, an administrator custom claim, Firestore for structured content and audit metadata, Cloud Storage for PDF files, and trusted server-side mutation handling for cross-service consistency.

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: JavaScript/JSX, React 19, Node.js runtime for trusted server operations

**Primary Dependencies**: Vite, Firebase Authentication, Cloud Firestore, Cloud Storage, Firebase Functions, lucide-react

**Storage**: Firestore collections for results, pastPaperResources, and auditLogs; Cloud Storage for PDF objects

**Testing**: Firebase Emulator Suite security/integration tests, focused JavaScript tests, ESLint, Vite production build, and browser-level smoke scenarios

**Target Platform**: Modern desktop and mobile browsers hosted by Firebase Hosting; Firebase managed services for data and trusted mutations

**Project Type**: Single web application with public website and protected admin dashboard

**Performance Goals**: Dashboard sign-in under 60 seconds; valid content changes visible publicly within 10 seconds; normal public pages remain responsive on mobile

**Constraints**: Admin-only mutations; no privileged credentials in the browser; PDF-only uploads with a configured size limit; no broken or partial public records; preserve existing public routes and visual behavior

**Scale/Scope**: One administrator role in v1; existing public site plus one admin login/dashboard flow; low-volume institute content with hundreds of results and past papers

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The constitution file contains only uncustomized placeholders and establishes no additional project-specific gates. The design still follows the feature constraints: keep the public experience stable, protect all mutations, validate files and fields, and test cross-service publish and delete paths. **Gate: PASS**.

## Project Structure

### Documentation (this feature)

```text
specs/001-admin-content-management/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── App.jsx                         # Existing public routes and shared public surfaces
├── App.css                         # Existing visual system plus admin/resource styles
├── firebase/
│   ├── config.js                   # Firebase client initialization
│   ├── auth.js                     # Admin session helpers
│   ├── content.js                  # Public/admin content reads and mutations
│   └── storage.js                  # PDF upload and replacement helpers
├── components/
│   ├── admin/                       # Login, dashboard, result and past-paper forms
│   └── public/                      # Data-backed public result and paper views
└── pages/
    ├── AdminLogin.jsx
    ├── AdminDashboard.jsx
    └── PastPapersPage.jsx
functions/
└── src/
    ├── contentMutations.js          # Trusted publish, replace, delete, and audit operations
    └── index.js
firestore.rules
firestore.indexes.json
storage.rules
tests/
├── integration/
└── browser/
```

**Structure Decision**: Keep the existing Vite React application as the public frontend, introduce feature-oriented `src/firebase`, `src/components`, and `src/pages` modules instead of expanding the monolithic `App.jsx`, and add a Firebase Functions boundary for privileged multi-step mutations and audit records. Add emulator-oriented tests under `tests/` and Firebase rules at the repository root.

## Complexity Tracking

No constitution violations. The trusted mutation boundary is required to avoid partially published PDFs and to generate non-forgeable audit records across Firestore and Storage.

## Implementation Phases

### Phase 0 - Research and decisions

- Confirmed the current project has Firebase Hosting and Analytics initialization only.
- Selected Firebase Authentication, Firestore, Storage, and Functions based on the existing project and the need for protected, auditable cross-service mutations.
- Resolved the PDF publication consistency, admin authorization, public privacy, migration, and stale-edit decisions in [research.md](research.md).

### Phase 1 - Design outputs

- Define Firestore entities, Storage paths, validation, publication states, and relationships in [data-model.md](data-model.md).
- Define the browser-facing admin and public content contracts in [contracts/admin-content-contract.md](contracts/admin-content-contract.md).
- Define emulator and browser validation scenarios in [quickstart.md](quickstart.md).

### Phase 2 - Implementation sequencing

1. Add Firebase client initialization and environment-safe Auth, Firestore, and Storage helpers.
2. Add admin claim checks, Firestore/Storage rules, and trusted Functions for result and PDF mutations plus audit records.
3. Migrate hardcoded results and past-paper data behind public content readers with a fallback or one-time migration path.
4. Add protected admin login, session guard, dashboard navigation, result CRUD, and past-paper upload/update/delete workflows.
5. Update public Results, Premium Sources, and Past Papers views to consume published data while preserving current layouts and empty states.
6. Add focused tests, emulator validation, browser smoke coverage, and deployment documentation.
