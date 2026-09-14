# Data Model: Admin Content Management

## Administrator Account

Represents a provisioned staff identity allowed to manage institute content.

| Field | Type | Required | Rules |
|---|---|---:|---|
| `uid` | string | yes | Matches the identity provider account; immutable |
| `email` | string | yes | Administrator sign-in address; not displayed publicly |
| `displayName` | string | no | Staff-facing label |
| `active` | boolean | yes | Inactive accounts cannot use protected mutations |
| `createdAt` | timestamp | yes | Server-generated |
| `lastSignInAt` | timestamp | no | Updated after successful sign-in |

Authorization is determined by the trusted `admin` claim and account status. Public clients never read the administrator collection.

## Student Result

Represents an academic achievement shown in the public Results area.

| Field | Type | Required | Rules |
|---|---|---:|---|
| `studentName` | string | yes | Trimmed, non-empty, length-limited |
| `score` | string | yes | Supports values such as `45/45` and `44/45`; validated against accepted score format |
| `subjects` | string | yes | Trimmed, non-empty subject/result summary |
| `school` | string | yes | Trimmed, non-empty school name |
| `published` | boolean | yes | Only published records are returned to public readers |
| `sortOrder` | number | no | Stable dashboard/public ordering; defaults to creation order |
| `createdAt` | timestamp | yes | Server-generated |
| `updatedAt` | timestamp | yes | Server-generated on every mutation |
| `createdBy` | string | yes | Administrator UID; private to admin/audit access |
| `updatedBy` | string | yes | Administrator UID; private to admin/audit access |
| `version` | number | yes | Incremented on each successful update |

Lifecycle: `new -> published`; `published -> published` on edit; `published -> deleted` on confirmed deletion. Deleted records are not returned publicly.

## Past Paper Resource

Represents a downloadable PDF and its searchable public metadata.

| Field | Type | Required | Rules |
|---|---|---:|---|
| `title` | string | yes | Trimmed, non-empty, length-limited |
| `pathway` | enum | yes | `IGCSE`, `AS & A Level`, `SAT / ACT`, `IBDP`, or `MYP` |
| `subjectName` | string | yes | Trimmed, non-empty subject name, e.g. `Mathematics` |
| `subjectCode` | string | no | Trimmed syllabus code, e.g. `0580`; combined with `subjectName` for display as `subject` |
| `paperType` | enum | yes | `year-wise` or `topic-wise`; determines the browsing hierarchy under a subject |
| `year` | number | when `paperType` is `year-wise` | Four-digit exam year |
| `session` | enum | when `paperType` is `year-wise` | `Feb-March`, `May-June`, or `Oct-Nov` |
| `topic` | string | when `paperType` is `topic-wise` | Trimmed, non-empty topic label, e.g. `Algebra` |
| `filePath` | string | yes | Server-generated Storage path, never arbitrary client path |
| `fileName` | string | yes | Sanitized display filename |
| `contentType` | string | yes | Must be `application/pdf` |
| `fileSize` | number | yes | Positive and no greater than 25 MB |
| `status` | enum | yes | `pending`, `published`, `replacing`, `failed`, or `deleted` |
| `published` | boolean | yes | Public readers require both `published == true` and `status == published` |
| `createdAt` | timestamp | yes | Server-generated |
| `updatedAt` | timestamp | yes | Server-generated on every mutation |
| `createdBy` | string | yes | Administrator UID; private to admin/audit access |
| `updatedBy` | string | yes | Administrator UID; private to admin/audit access |
| `version` | number | yes | Incremented on each successful update |

Public browsing hierarchy: Pathway -> Subject (`subjectName` + `subjectCode`) -> Year -> Exam session (for `year-wise` papers), or Pathway -> Subject -> Topic-wise (for `topic-wise` papers).

Lifecycle: `pending -> published`; `published -> replacing -> published` on file replacement; any active state can move to `failed` on an incomplete mutation or `deleted` after confirmed deletion. Failed and deleted resources are not publicly listed or downloadable.

Storage path convention: `past-papers/{resourceId}/current.pdf`. Temporary uploads use a non-public staging path and are removed after finalization or cleanup.

## Content Change Record

Append-only audit entry for every successful create, update, replace, and delete operation.

| Field | Type | Required | Rules |
|---|---|---:|---|
| `actorUid` | string | yes | Authenticated administrator UID |
| `action` | enum | yes | `create`, `update`, `replace`, or `delete` |
| `entityType` | enum | yes | `studentResult` or `pastPaperResource` |
| `entityId` | string | yes | Affected document ID |
| `occurredAt` | timestamp | yes | Server-generated |
| `version` | number | yes | Resulting entity version |
| `summary` | object | yes | Sanitized before/after field summary; excludes credentials and unnecessary personal data |

Clients cannot create, modify, or delete audit records.

## Relationships and query rules

- One Administrator Account may create many Student Results and Past Paper Resources.
- Each managed record references its creator and last editor by UID.
- Public result queries filter `published == true` and exclude deleted records.
- Public paper queries filter `published == true` and `status == published`, then filter/index by `pathway` and `subject`.
- Dashboard queries include all non-deleted records and expose status, version, and update metadata only to administrators.
- Every update includes the last-known `version`; a mismatch returns a conflict and does not mutate the record.
