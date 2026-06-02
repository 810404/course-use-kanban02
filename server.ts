import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Body parser middleware
  app.use(express.json());

  // Express API Route for Gemini Consultation
  app.post("/api/ai/consult", async (req, res) => {
    try {
      const { prompt, kanbanState } = req.body;
      const userApiKey = req.headers['x-api-key'] || req.headers['x-user-api-key'];

      if (!prompt) {
        return res.status(400).json({ error: "任務提示詞或問題不可為空" });
      }

      if (!userApiKey || typeof userApiKey !== 'string' || !userApiKey.trim()) {
        return res.status(401).json({ 
          error: "未偵測到個人的 Gemini API Key。為了保障安全性與隱私，此功能已改為「使用者自備 Key」模式（儲存於您瀏覽器本機的 localStorage，不儲存於伺服器）。請先在最上方的 AI 智慧教練區輸入您個人的 API 金鑰。" 
        });
      }

      const activeApiKey = userApiKey.trim();
      const userAi = new GoogleGenAI({
        apiKey: activeApiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build-userkey',
          }
        }
      });

      // Build system prompt with context from the user's current kanban board
      let stateSummary = "";
      if (kanbanState) {
        const todoStr = kanbanState.todo && kanbanState.todo.length > 0 
          ? kanbanState.todo.map((t: string, i: number) => `${i + 1}. ${t}`).join("\n") 
          : "【無】";
        const doingStr = kanbanState.doing && kanbanState.doing.length > 0 
          ? kanbanState.doing.map((t: string, i: number) => `${i + 1}. ${t}`).join("\n") 
          : "【無】";
        const doneStr = kanbanState.done && kanbanState.done.length > 0 
          ? kanbanState.done.map((t: string, i: number) => `${i + 1}. ${t}`).join("\n") 
          : "【無】";

        stateSummary = `目前使用者的任務看板狀態：\n* 待辦事項：\n${todoStr}\n* 進行中任務：\n${doingStr}\n* 已完成事項：\n${doneStr}\n`;
      } else {
        stateSummary = `目前看板為空。`;
      }

      const systemInstruction = 
        `你是一位專業、敏捷的高效能生產力教練與專案管理專家。\n` +
        `使用者正在使用他們「不用安裝、打開就能用」的極簡 Kanban 任務看板。\n` +
        `${stateSummary}\n` +
        `請針對使用者的提問或請求提供精簡、具體、富洞察力且容易執行的建議（不超過 300 字）。\n` +
        `你可以幫助使用者：\n` +
        `1. 分析現有的看板狀態與瓶頸，優化任務流程。\n` +
        `2. 協助拆解、具體化新任務，並可提供「可直接複製貼上新增到看板」的子任務清單（使用簡單的文字項目符號，不要太長）。\n` +
        `3. 回答排程與專案管理的實務策略。\n\n` +
        `回覆時請用親切、專業、富有鼓勵感的繁體中文 (zh-TW)，排版清晰，善用項目符號與粗體，避開冷冰冰的教條或贅詞。`;

      const modelsToTry = ["gemini-3.5-flash", "gemini-3.1-flash-lite"];
      let response;
      let lastError: any = null;

      modelLoop: for (const currentModel of modelsToTry) {
        const maxAttempts = 3;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            console.log(`[Gemini] Attempting consultation with ${currentModel} (attempt ${attempt}/${maxAttempts})...`);
            response = await userAi.models.generateContent({
              model: currentModel,
              contents: prompt,
              config: {
                systemInstruction: systemInstruction,
                temperature: 0.7,
              },
            });
            // If we got a successful response, clear lastError and break out of loops
            if (response && response.text) {
              lastError = null;
              break modelLoop;
            }
          } catch (err: any) {
            lastError = err;
            const status = err?.status || err?.code || "UNKNOWN";
            const message = err?.message || String(err);
            console.log(`[Gemini Info] Model ${currentModel} returned status ${status} on attempt ${attempt}.`);
            
            // If we have more attempts, wait with exponential backoff and retry
            if (attempt < maxAttempts) {
              const backoffMs = attempt * 800;
              console.log(`[Gemini] Temporary high load. Retrying in ${backoffMs}ms...`);
              await new Promise(resolve => setTimeout(resolve, backoffMs));
            }
          }
        }
      }

      if (lastError) {
        // If all fallbacks failed, throw a clean, human-readable error
        console.error("[Gemini Error] All models in the fallback chain have failed.");
        throw new Error(
          `Google Gemini API 伺服器目前負載較高或金鑰無效（錯誤資訊：${lastError?.message || lastError}）。我們已嘗試多個極速模型與自動重試，請檢查您的金鑰是否正確，或稍候 3-5 秒再試一次！`
        );
      }

      const responseText = response.text || "無法生成回應，請稍後再試。";
      res.json({ responseText });
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      res.status(500).json({ error: error.message || "呼叫 Gemini API 時發生了錯誤。" });
    }
  });

  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
