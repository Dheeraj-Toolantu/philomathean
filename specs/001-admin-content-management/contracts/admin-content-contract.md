# Admin Content Interface Contract

This contract defines the browser-facing behavior between the public site, protected dashboard, and content mutation boundary. It is intentionally implementation-neutral; the eventual callable functions or service methods must preserve these inputs and outcomes.

## Admin session

### Sign in

**Input**: administrator email and password.

**Success**: authenticated session with administrator status; dashboard access is granted.

**Failure**: generic invalid-credentials response; no account-existence details are disclosed.

### Sign out

**Input**: active administrator session.

**Success**: session is invalidated and protected screens redirect to admin sign-in.

## Student results

### Create result

**Input**:

```json
{
  "studentName": "string",
  "score": "string",
  "subjects": "string",
  "school": "string",
  "published": true,
  "sortOrder": 1
}
```

**Success**: returns the created result ID, version, and public availability.

**Failure responses**: `unauthenticated`, `forbidden`, `validation_error`, or `mutation_failed`.

### Update result

**Input**: result ID, editable fields, and the last-known `version`.

**Success**: returns the updated record and incremented version.

**Conflict**: returns `conflict` with the current version; no overwrite occurs.

### Delete result

**Input**: result ID, last-known version, and explicit confirmation.

**Success**: result is removed from public and dashboard active listings; an audit entry is created.

## Past-paper resources

### Create resource

**Input**:

```json
{
  "title": "string",
  "pathway": "IGCSE | AS & A Level | SAT / ACT | IBDP | MYP",
  "subject": "string",
  "file": "PDF up to 25 MB",
  "published": true
}
```

**Success**: returns the resource ID, version, published status, and a public resource reference only after the PDF and metadata are complete.

**Failure responses**: `unauthenticated`, `forbidden`, `validation_error`, `invalid_file`, `file_too_large`, or `mutation_failed`.

### Update resource

**Input**: resource ID, changed metadata and/or replacement PDF, and last-known `version`.

**Success**: returns updated metadata and a valid public download reference after replacement finalization.

**Conflict**: returns `conflict` with the current version; old public content remains unchanged.

### Delete resource

**Input**: resource ID, last-known version, and explicit confirmation.

**Success**: removes the resource from public listings and invalidates public download access after the stored file is removed or made inaccessible.

## Public read contract

### Published results

Returns only display fields for records with `published == true`; private administrator, audit, and mutation fields are excluded.

### Published past papers

Supports pathway, subject, search text, and first-letter filtering. Returns only resources with `published == true` and `status == published`. Empty results are valid and return a normal empty state.

## Security requirements

- Every mutation validates administrator authorization outside the visual dashboard.
- Public reads cannot write, alter, or delete content.
- Clients cannot choose arbitrary Storage paths or forge audit identity/timestamps.
- Failed or pending mutations never appear in public reads.
