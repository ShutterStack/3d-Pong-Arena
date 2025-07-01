# 3D Pong Arena

This is a Next.js project for a 3D Pong game, enhanced with real-time multiplayer functionality and a persistent leaderboard.

## Getting Started

First, run the development server for the Next.js frontend:

```bash
npm run dev
```

To run the backend server for multiplayer and leaderboard features, you'll need a separate terminal:

```bash
# First time setup
npm install

# Build the server code
npm run build:server

# Start the server
npm run start:server
```

Open [http://localhost:9002](http://localhost:9002) with your browser to see the result.

## Environment Variables

Before running the project, create a `.env.local` file in the root directory and add the following variable. This tells your frontend where to find your backend server.

```
NEXT_PUBLIC_SERVER_URL=http://localhost:8080
```

## Deploying to Vercel & Render

This project is configured for a split deployment: the frontend on Vercel and the backend on Render.

### 1. Backend Deployment (Render)

The backend server is located in the `/server` directory and handles all multiplayer and leaderboard logic.

**Steps:**

1.  Push your project to a new repository on a Git provider (GitHub, GitLab, etc.).
2.  Go to your [Render dashboard](https://dashboard.render.com/) and create a **New Web Service**.
3.  Connect the Git repository you just created.
4.  Configure the service with the following settings:
    *   **Root Directory**: Leave this blank (it defaults to the repository root).
    *   **Build Command**: `npm install && npm run build:server`
    *   **Start Command**: `npm run start:server`
5.  Under the **"Environment"** tab, add an environment variable:
    *   **Key**: `FRONTEND_URL`
    *   **Value**: The URL of your Vercel deployment (e.g., `https://your-project-name.vercel.app`). You can add this after deploying to Vercel.
6.  Click **"Create Web Service"**. Render will build and deploy your backend. Once it's live, copy the URL provided by Render (e.g., `https://your-pong-backend.onrender.com`).

### 2. Frontend Deployment (Vercel)

The frontend is a standard Next.js application.

**Steps:**

1.  Go to your [Vercel dashboard](https://vercel.com/dashboard).
2.  Click **"Add New..."** and select **"Project"**.
3.  Import the same Git repository. Vercel will automatically detect that it's a Next.js project.
4.  Configure the project. Go to the **"Environment Variables"** section and add the following:
    *   **Key**: `NEXT_PUBLIC_SERVER_URL`
    *   **Value**: The URL of your live backend on Render (e.g., `https://your-pong-backend.onrender.com`).
5.  Click the **"Deploy"** button.

That's it! Vercel will build and deploy your application, and you'll have a live URL to share in just a few minutes.
