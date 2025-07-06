const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");

dotenv.config();

const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const app = express();

app.use(cors());
app.use(express.json({ limit: '5mb' })); // ✅ allow large text from big PDFs

const HISTORY_FILE = path.join(__dirname, "history.json");

// ✅ Ensure history.json is present and valid
function ensureValidHistoryFile() {
  try {
    if (!fs.existsSync(HISTORY_FILE)) {
      fs.writeFileSync(HISTORY_FILE, "[]", "utf-8");
      console.log("📁 Created history.json");
    } else {
      const content = fs.readFileSync(HISTORY_FILE, "utf-8");
      JSON.parse(content); // validate
    }
  } catch {
    console.warn("⚠️ Corrupted history.json. Recreating...");
    fs.writeFileSync(HISTORY_FILE, "[]", "utf-8");
  }
}

// ✅ Call on server start
ensureValidHistoryFile();

// 🧠 Route: Summarize and save to history
app.post("/summarize", async (req, res) => {
  const inputText = req.body.text;

  if (!inputText || typeof inputText !== "string" || inputText.trim().length === 0) {
    return res.status(400).json({ message: "Text is required for summarization." });
  }

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + process.env.GEMINI_API_KEY,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Summarize this:\n\n${inputText}` }] }]
        }),
      }
    );

    const data = await response.json();
    const summary = data?.candidates?.[0]?.content?.parts?.[0]?.text || "No summary found.";

    // ✅ Save to history
    ensureValidHistoryFile();
    const history = JSON.parse(fs.readFileSync(HISTORY_FILE, "utf-8"));
    history.unshift({ text: inputText, summary, timestamp: new Date().toISOString() });
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), "utf-8");

    res.json({ choices: [{ message: { content: summary } }] });
  } catch (error) {
    console.error("Gemini Error:", error.message);
    res.status(500).json({ message: "Gemini API call failed." });
  }
});

// 🗃️ Route: Get summary history
app.get("/history", (req, res) => {
  try {
    ensureValidHistoryFile();
    const history = JSON.parse(fs.readFileSync(HISTORY_FILE, "utf-8"));
    res.json(history);
  } catch (err) {
    console.error("History Read Error:", err.message);
    res.status(500).json({ message: "Failed to load history." });
  }
});

app.listen(5000, () => {
  console.log("✅ Gemini Backend with history running at http://localhost:5000");
});
