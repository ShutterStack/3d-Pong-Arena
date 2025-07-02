# 3D Pong Arena

This is a Next.js project for a 3D Pong game, enhanced with real-time multiplayer functionality and a persistent leaderboard.

## Getting Started

### **Running Locally**

1.  **Backend Server:** Open a terminal and run the backend server.
    ```bash
    # First time setup
    npm install
    npm run build:server

    # Start the server
    npm run start:server
    ```
    This will start your server on `http://localhost:8080`.

2.  **Frontend Development Server:** Open a *second* terminal and run the Next.js frontend.
    ```bash
    npm run dev
    ```
    This starts the frontend on `http://localhost:9002`.

3.  **Environment File:** Before testing, create a file named `.env.local` in the project root and add this line:
    ```
    NEXT_PUBLIC_SERVER_URL=http://localhost:8080
    ```
4.  Open [http://localhost:9002](http://localhost:9002) in your browser to see the result. To test multiplayer locally, open the URL in two separate browser tabs.

---

## Deploying a Live Multiplayer Game

This project is configured for a split deployment: the **frontend on Vercel** and the **backend on Render**.

### **Step 1: Deploy Backend to Render**

1.  **Push to GitHub:** Ensure your latest code is in a GitHub repository.
2.  **Create a New Web Service on Render:**
    *   Go to your [Render dashboard](https://dashboard.render.com/) and create a **New Web Service**.
    *   Connect the Git repository for this project.
    *   Render will read your `render.yaml` file and configure most settings automatically.
3.  **Confirm Settings:**
    *   **Root Directory**: Should be blank (defaults to the repository root).
    *   **Build Command**: `npm install && npm run build:server`
    *   **Start Command**: `npm run start:server`
4.  Click **"Create Web Service"**. Render will build and deploy your backend.
5.  Once it's live, **copy the URL** provided by Render (e.g., `https://your-pong-backend.onrender.com`). You will need this for the next step.

### **Step 2: Deploy Frontend to Vercel**

1.  Go to your [Vercel dashboard](https://vercel.com/dashboard) and add a new project, importing the same Git repository.
2.  **Configure Environment Variable:** Before deploying, go to the **"Environment Variables"** section and add the following:
    *   **Key**: `NEXT_PUBLIC_SERVER_URL`
    *   **Value**: The URL of your live backend on Render (from Step 1).
3.  Click **"Deploy"**. Vercel will deploy your frontend.
4.  Once it's live, **copy the URL** of your Vercel deployment (e.g., `https://your-pong-frontend.vercel.app`).

### **Step 3: Connect Backend to Frontend**

1.  Go back to your backend service on the **Render dashboard**.
2.  Navigate to the **"Environment"** tab.
3.  Add the following environment variable to tell your server which frontend URLs to accept connections from:
    *   **Key**: `FRONTEND_URL`
    *   **Value**: The URL of your live Vercel deployment (from Step 2).
4.  Save the changes. Render will automatically redeploy your server with the new variable.

### **Step 4: You're Live!**

Your game is now fully deployed! You can share your Vercel URL with a friend to play a real-time multiplayer match.
