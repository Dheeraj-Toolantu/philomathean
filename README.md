# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Admin dashboard

Open `/admin/login` locally. Administrator accounts must be provisioned in Firebase Authentication and granted the `admin` custom claim by a trusted operator. Public registration is not provided.

The dashboard manages student results shown on the public Results section and PDF past papers for IGCSE, AS & A Level, SAT / ACT, IBDP, and MYP. PDF uploads must be valid PDF files no larger than 25 MB.

## Firebase setup

Copy `.env.example` to `.env.local` when using a separate Firebase web configuration. Never place service-account credentials in Vite environment variables. Configure Authentication, Firestore, Storage, and Functions for the project. Public records are protected by `firestore.rules` and `storage.rules`.

For local service validation, run the Firebase Emulator Suite using the ports defined in `firebase.json`. Review the migration input and take a backup before seeding existing content.

## Provision the first administrator

After authenticating the Firebase CLI or configuring Application Default Credentials, install the Functions dependencies and run the one-time provisioning script from the repository root:

```powershell
cd functions
npm install
$env:ADMIN_EMAIL = "admin@philomathean.in"
$env:ADMIN_PASSWORD = "use-a-strong-password"
node scripts/provision-admin.cjs
```

The script creates or updates the administrator custom claim and seeds the existing student results only when the `results` collection is empty. It does not create placeholder past-paper documents; upload PDFs from the dashboard after signing in. Do not commit the password or service-account credentials.

See [specs/001-admin-content-management/quickstart.md](specs/001-admin-content-management/quickstart.md) for end-to-end validation scenarios.
