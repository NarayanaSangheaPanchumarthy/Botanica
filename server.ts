import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";

const TASKS_FILE = path.join(process.cwd(), "tasks.json");

// Helper to read tasks
function readTasks() {
  if (!fs.existsSync(TASKS_FILE)) return [];
  try {
    const data = fs.readFileSync(TASKS_FILE, "utf-8");
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

// Helper to write tasks
function writeTasks(tasks: any[]) {
  fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2));
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes
  app.get("/api/tasks", (req, res) => {
    const tasks = readTasks();
    res.json(tasks);
  });

  app.post("/api/tasks", (req, res) => {
    const tasks = readTasks();
    const task = req.body;
    tasks.push(task);
    writeTasks(tasks);
    res.status(201).json(task);
  });

  app.put("/api/tasks/:id", (req, res) => {
    const { id } = req.params;
    const updatedTask = req.body;
    let tasks = readTasks();
    tasks = tasks.map((t: any) => t.id === id ? updatedTask : t);
    writeTasks(tasks);
    res.json(updatedTask);
  });

  app.delete("/api/tasks/:id", (req, res) => {
    const { id } = req.params;
    let tasks = readTasks();
    tasks = tasks.filter((t: any) => t.id !== id);
    writeTasks(tasks);
    res.status(204).send();
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
