import express from "express";
import { getResponse } from "../services/regretLogic.js";
import { resetTopic, resetSession } from "../services/regretLogic.js";

const router = express.Router();

router.post("/", async (req, res) => {
  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ message: "Prompt required" });
  }

  const result = await getResponse(prompt);
  res.json(result);
});

router.post("/reset", async (req, res) => {
  const { topic } = req.body;
  if (!topic) return res.status(400).json({ message: "Topic required" });

  const ok = resetTopic(topic);
  if (ok) return res.json({ ok: true });
  return res.status(404).json({ ok: false, message: "Topic not found" });
});

router.post("/reset-session", async (req, res) => {
  const ok = resetSession();
  res.json({ ok });
});

export default router;
