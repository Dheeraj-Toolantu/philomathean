# Research: Admin Content Management

## Decision: Use Firebase Authentication with an administrator custom claim

- **Rationale**: The project already targets Firebase Hosting and has a Firebase configuration module. Email/password sign-in is appropriate for a provisioned internal administrator account, while a custom `admin` claim lets data rules enforce authorization independently of the UI.
- **Alternatives considered**: Public registration was rejected because the dashboard is an internal tool. Checking only whether a user is signed in was rejected because any authenticated user would otherwise be able to mutate public content. A third-party identity system was rejected because it adds unnecessary infrastructure for the existing Firebase project.

## Decision: Store structured content in Firestore

- **Rationale**: Results and past-paper metadata are document-shaped, need filtered public reads, and benefit from timestamps, update versions, and indexed pathway/subject queries. Separate collections keep result and resource lifecycles clear.
- **Alternatives considered**: Realtime Database is viable for simple CRUD but less natural for indexed document queries and audit records. Browser-only local state or static files cannot support shared administration or public reflection.

## Decision: Store PDFs in Cloud Storage and metadata in Firestore

- **Rationale**: Storage is designed for binary files, while Firestore stores searchable title, pathway, subject, publication, and file-status metadata. A resource is public only after its file and metadata are complete.
- **Alternatives considered**: Storing PDFs inside Firestore is unsuitable for file size, delivery, and cost. Hosting files manually would require code or deployment changes for each paper and would not support dashboard deletion.

## Decision: Use a trusted mutation boundary for publish, replace, delete, and audit operations

- **Rationale**: A browser can upload a file successfully while a metadata write fails, or delete metadata while leaving a file behind. Trusted server-side operations can validate the admin claim, finalize only complete records, remove replaced/deleted objects, and append an audit entry that clients cannot forge.
- **Alternatives considered**: Direct browser writes are simpler but leave partial-failure and orphan-file risks. A full separate backend provides similar guarantees but duplicates Firebase infrastructure already available through Functions.

## Decision: Publish immediately after successful save

- **Rationale**: The specification asks for changes to reflect on the website and does not request editorial approval. Immediate publication keeps the v1 workflow short; the dashboard should still offer a public preview link.
- **Alternatives considered**: Draft and approval states were deferred because they add an additional role and workflow not requested by the institute.

## Decision: Use optimistic version checks for stale edits

- **Rationale**: Each editable record carries an update version or timestamp. A mutation must compare the submitted version with the current version and return a conflict instead of silently overwriting another administrator's newer change.
- **Alternatives considered**: Last-write-wins is simpler but can discard a valid edit without warning. Record locking is harder to recover from when a browser closes unexpectedly.

## Decision: Preserve current hardcoded content through a controlled migration

- **Rationale**: Existing public results and paper subjects must not disappear when readers switch to Firestore. Seed the current result records and current supported pathways before enabling the data-backed public views, then retain an empty-state/fallback only during migration testing.
- **Alternatives considered**: Replacing arrays immediately risks data loss. Maintaining permanent dual sources risks divergent public content and unclear ownership.

## Decision: Use a configured PDF size limit and strict content validation

- **Rationale**: The specification requires rejection of invalid or oversized files but does not define a number. Set a documented v1 limit of 25 MB, validate both browser metadata and trusted upload state, and require `application/pdf` plus a PDF signature check where available.
- **Alternatives considered**: A much larger limit increases delivery and abuse risk. Relying on the filename extension alone does not establish that the file is a PDF.

## Decision: Keep public student result data intentionally limited

- **Rationale**: The existing public results surface already displays student names, scores, subjects, and schools. The data model should publish only those approved display fields and keep admin/audit metadata private; the implementation should confirm institute permission for public display during migration.
- **Alternatives considered**: Publishing full administrative records would expose unnecessary identity and operational data. Hiding all names would change the existing public experience and was not requested.

## Decision: Validate with Firebase emulators and browser smoke scenarios

- **Rationale**: There is no current test runner or test directory. Emulator tests can exercise Auth, Firestore rules, Storage rules, and mutation consistency without production data, while browser scenarios verify the dashboard and public reflection.
- **Alternatives considered**: Build-only validation cannot prove authorization or cross-service behavior. Manual production testing is slower and risks modifying live content.

## Risks to carry into implementation

- Firebase Functions deployment and billing availability must be confirmed before production rollout.
- The admin claim provisioning procedure must be documented and kept outside the public client.
- Public download URLs must not outlive a deleted or unpublished resource.
- Migration must be run once against a backup or emulator snapshot before production data changes.
