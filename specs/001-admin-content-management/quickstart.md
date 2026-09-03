# Quickstart: Admin Content Management

## Prerequisites

- Node.js and npm installed.
- Dependencies installed with `npm install`.
- Firebase CLI installed and authenticated for the project owner.
- Firebase Emulator Suite available for local Auth, Firestore, Storage, and Functions validation.
- A provisioned administrator account and `admin` authorization claim in the emulator/test environment.

## Start local validation

1. Start the local web application with `npm run dev`.
2. Start Firebase emulators using the project configuration once Auth, Firestore, Storage, and Functions configuration is added.
3. Open the local application and navigate to the admin sign-in route.

## Scenario A: authorization

1. Open the dashboard while signed out.
2. Confirm the app redirects to admin sign-in and exposes no management data.
3. Sign in with an authorized administrator account.
4. Confirm the dashboard shows Results and Past Papers management areas.
5. Sign out and confirm the dashboard is inaccessible again.
6. Attempt a direct mutation using an unprivileged emulator identity and confirm it is denied.

## Scenario B: student result lifecycle

1. Create a valid result with student name, score, subjects, school, and publication enabled.
2. Confirm the record appears in the dashboard and public Results view within 10 seconds.
3. Edit the score or subject summary and confirm both views show the new values.
4. Open the record in two sessions, save one session, then save the stale second session; confirm a conflict is shown and the newer record remains intact.
5. Delete the result and confirm it disappears from the dashboard active list and public Results view.
6. Submit an incomplete result and confirm field-level validation prevents saving.

## Scenario C: past-paper PDF lifecycle

1. Upload a valid PDF with each supported pathway: IGCSE, AS & A Level, SAT / ACT, IBDP, and MYP.
2. Confirm each published resource appears under the correct pathway in Premium Sources and Past Papers.
3. Search by title and filter by first letter; confirm the list narrows correctly and shows a no-results state when appropriate.
4. Replace one PDF and update its title or subject; confirm the new metadata and file are publicly available only after finalization.
5. Try a non-PDF and a file larger than 25 MB; confirm both are rejected and no public record is created.
6. Delete a resource and confirm it is no longer listed and its previous download reference is inaccessible.

## Scenario D: failure and audit behavior

1. Force a metadata or file mutation failure in the emulator.
2. Confirm no pending or failed resource appears publicly and no broken download link is exposed.
3. Confirm every successful create, update, replace, and delete operation creates an audit record containing actor, entity, action, version, and server timestamp.
4. Confirm a client cannot modify or delete an audit record.

## Production checks

- Run `npm run lint` and `npm run build`.
- Review Firestore and Storage rules with an unauthenticated, authenticated non-admin, and authenticated admin identity.
- Back up existing hardcoded results and paper metadata before migration.
- Run migration in a test environment, compare public output, then enable production readers.
- Verify Firebase Functions, Auth, Firestore, Storage, and Hosting deployments independently before publishing the feature.

See [data-model.md](data-model.md) for fields and lifecycle rules and [contracts/admin-content-contract.md](contracts/admin-content-contract.md) for input, output, and security behavior.
