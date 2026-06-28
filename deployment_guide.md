# EduSense Deployment Guide (Free & Easy)

Since EduSense is a **full-stack application** consisting of a React front-end (Vite) and a Node.js/Express back-end (`server.ts` / `/api/session-summary`) integrated with Firebase Firestore, here are the two best free deployment strategies:

---

## Option 1: Render (Recommended — Simplest & Free)

[Render](https://render.com/) is a cloud platform that offers a free tier for hosting Node.js web services. It will build your React app and run your Express server under a single URL.

### Step 1: Push your code to GitHub
If you haven't already, initialize a Git repository, commit your changes, and push them to a private or public GitHub repository.

### Step 2: Create a Web Service on Render
1. Sign up/log in to [Render](https://render.com/) (using GitHub is easiest).
2. Click **New +** and select **Web Service**.
3. Connect your GitHub repository.

### Step 3: Configure Settings
Set the following configuration on Render:
* **Name:** `edusense` (or any name you prefer)
* **Region:** Choose closest to you
* **Branch:** `main` (or your active branch name)
* **Runtime:** `Node`
* **Build Command:** `npm install && npm run build`
* **Start Command:** `npm start`
* **Instance Type:** Select **Free** ($0/month)

### Step 4: Add Environment Variables
Scroll down to the **Environment Variables** section and add:
* `NODE_ENV` = `production`
* `GEMINI_API_KEY` = `your_gemini_api_key_here` (required for AI pedagogical summaries)

### Step 5: Click Deploy
Click **Create Web Service**. Render will pull your code, install dependencies, compile the Vite app, bundle the server, and start the app. 

> **Note:** Free services on Render spin down after 15 minutes of inactivity. When someone visits the URL, it may take 40-50 seconds to spin back up ("cold start").

---

## Option 2: Firebase Suite (Firebase Hosting + Functions)

If you prefer to keep everything inside the Firebase ecosystem, you can deploy the React front-end to **Firebase Hosting** and the Express API to **Firebase Functions**.

> **Warning:** Google Cloud/Firebase requires you to upgrade your project to the **Blaze Plan** (Pay-as-you-go) to enable Firebase Functions and make outbound network requests (such as talking to Gemini APIs). However, the actual usage charges are typically $0 unless you get massive traffic.

### Step 1: Install Firebase CLI
Install the Firebase command-line tools globally on your computer:
```powershell
npm install -g firebase-tools
```

### Step 2: Log in and Initialize
Run the login command in your terminal and select your project directory:
```powershell
firebase login
```
Then initialize the Firebase project configuration:
```powershell
firebase init
```
* Select **Hosting** and **Functions**.
* Select **Use an existing project** and select your active project.
* Set the public directory for Hosting to `dist` (since Vite outputs the build there).
* Configure Hosting as a single-page app (Rewrite all URLs to `/index.html`) -> **Yes**.

### Step 3: Move Express endpoints to Functions directory
You'll need to move your `server.ts` logic into the generated `functions` directory and export the Express app as a Cloud Function using `functions.https.onRequest(app)`.

### Step 4: Deploy
Once configured, run:
```powershell
npm run build && firebase deploy
```
This will upload the frontend to CDN servers and spin up the serverless backend.
