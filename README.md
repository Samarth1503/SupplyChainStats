# SupplyChainStats

This is a mini project built to demonstrate a full-stack application using **Angular**, **Node.js**, and **Express**.

## Project Structure

The repository is clearly separated into two main directories:
- **`backend/`**: A lightweight Node.js & Express REST API that serves a static logistics dataset.
- **`frontend/`**: An Angular application utilizing Server-Side Rendering (SSR), lazy loading, and modern Angular features (like Signals) for a reactive, fast UI.

## Run Locally

### 1. Start the API Backend
Open a terminal, navigate to the `backend` directory, install the dependencies, and start the server:

```bash
cd backend
npm install
npm start
```
*The backend API will run quietly on `http://localhost:3000`.*

### 2. Start the Angular Frontend
Open a **new, separate terminal window**, navigate to the `frontend` directory, install the dependencies, and start the Angular development server:

```bash
cd frontend
npm install
npm start
```
*You can now view the website in your browser at `http://localhost:4200`.*

---

### (Optional) Testing Server-Side Rendering (SSR)
If you want to run the fully optimized production build of the frontend exactly as it would run on a live server (which enables Server-Side Rendering):

```bash
cd frontend
npm run build
npm run serve:ssr:frontend
```
*The production frontend will run on `http://localhost:4000`. You can view the raw page source in your browser to see the data rendered directly in the HTML!*


# Screenshots of the UI

<img width="1917" height="772" alt="image" src="https://github.com/user-attachments/assets/c1f0a15f-63ed-4f5a-a6c5-f759c579ce8f" />
<img width="1912" height="990" alt="image" src="https://github.com/user-attachments/assets/09844551-fff9-4690-853b-997453a4512d" />
<img width="1918" height="875" alt="image" src="https://github.com/user-attachments/assets/89af1eb1-326f-4a5a-aa5b-c0c2f46f6b32" />

