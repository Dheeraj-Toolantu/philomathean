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

## Student portal

Students sign up at `/login` with email and password, Google or Facebook and land on `/dashboard`, which has six sections: Overview, My courses, Progress, Exams & attempts, Profile (details and a photo, cropped to a square in the browser) and Subscription.

- **Practice**: `/courses` lists every course. `/courses/<id>` is a course's practice page with Topic Quizzes, a Revision Ladder (by difficulty), Mock Exam Papers, a Prediction Exam and “Build my Exam”. `/quiz` runs a quiz in Study mode (instant feedback) or Exam mode (timed). Courses and questions live in `src/student/catalog.js` and `src/student/questionBank.js`.
- **Progress**: every finished quiz is saved to `students/{uid}/attempts`. The dashboard works out questions attempted, accuracy, exams taken, study streak, topic mastery and achievements from these attempts (`src/student/progress.js`).
- **Sharing**: “Share my progress” publishes a read-only card at `/progress/<id>`. It shows no email or phone number, and the student can stop sharing at any time.
- **Plans**: every account starts on Free. Gold unlocks the premium courses, prediction exams and custom papers on premium courses. Students can only *request* Gold. An administrator activates it from the **Students** tab at `/admin`; nobody pays online.
- **Firebase setup**: in Firebase Authentication → Sign-in method, turn on **Email/Password**, **Google** and **Facebook**. Add your website's domain under Authorized domains.
- **Facebook setup**: create an app at [developers.facebook.com](https://developers.facebook.com) and add the **Facebook Login** product. Paste its App ID and App secret into Firebase's Facebook provider. Copy the OAuth redirect URI that Firebase shows (`https://philomathean-a2c93.firebaseapp.com/__/auth/handler`) into Facebook Login → Settings → Valid OAuth Redirect URIs. Switch the app to **Live** mode so students other than the app's admins can sign in.
- **One account per email**: if a student signs in with Facebook using an email that already has an account (password or Google), the login page asks them to log in the original way once. Facebook is then linked to that account, so either method signs them in from then on. Then run `firebase deploy --only firestore:rules,storage` to deploy the updated rules.
- **Note**: practice questions are bundled with the website, so Gold controls access in the app but does not hide question content. To protect paid questions, store them in Firestore behind rules.
