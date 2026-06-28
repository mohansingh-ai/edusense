import express, { Request, Response } from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

// Lazy initialize Gemini SDK client to prevent crash on startup if key is missing
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required to access advanced pedagogical summaries.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json());

  // API Route 1: Post-session Analytical Summary via Gemini AI
  app.post("/api/session-summary", async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        sessionTitle,
        timelineLogs,
        attendanceCount,
        averageAttention,
        averageEngagement,
        averageConfusion
      } = req.body;

      if (!sessionTitle || !timelineLogs) {
        res.status(400).json({ error: "Missing required session summary context." });
        return;
      }

      const client = getGeminiClient();
      const logsSnippet = JSON.stringify(timelineLogs.slice(-20)); // Limit payload to last 20 ticks for safety

      const prompt = `
        You are an expert Educational Specialist. Prepare a professional post-class clinical analysis for the lecture: "${sessionTitle}".
        
        Class Metrics Summary:
        - Total Students Attended: ${attendanceCount}
        - Average Attention Score: ${averageAttention}%
        - Average Engagement Score: ${averageEngagement}%
        - Average Student Confusion level: ${averageConfusion}%
        
        Recent Timeline Logs (Attention, Engagement, Confusion levels over time):
        ${logsSnippet}
        
        Please produce a professional feedback report detailing:
        1. **Class Dynamics Analysis**: What went well (attention spikes) and what went wrong (confusion spikes).
        2. **Core Learning Gaps**: Highlight where instruction was likely lost based on high confusion metrics.
        3. **Tactical Action Plan**: 3 concrete, evidence-based pedagogical adjustments/actions the instructor should put in place for the next lecture to maximize learner attention and resolve confusion.
        
        Format the output using modern, clear Markdown with bullet points, brief sections, and a warm, encouraging tone.
      `;

      const aiResponse = await client.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
      });

      res.json({ feedback: aiResponse.text || "Could not generate session summary." });
    } catch (error) {
      console.error("Gemini Session Summary Error:", error);
      res.status(500).json({
        error: "Failed to generate AI session summary.",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // API Route 2: Reinforcement Learning (RL) Adaptive Teaching Strategy Policy Evaluation
  app.post("/api/teaching-strategy", async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        sessionId,
        title,
        latestAttention,
        latestEngagement,
        latestConfusion,
        currentStrategy,
        alertCount,
        studentComments,
        attendanceCount,
        lowAttentionCount,
        ratioLowAttention,
        attentionCrisis
      } = req.body;

      const client = getGeminiClient();

      // Implement an AI-driven policy helper inside Gemini schema.
      // High Confusion/Low Attention triggers different optimal action policies.
      // Explicitly instruct the model to suggest stopping the class if attention crisis is true.
      const prompt = `
        You are a Reinforcement Learning Policy Evaluator for EduSense. The system adapts teaching strategies dynamically in real-time.
        
        Current Classroom State:
        - Topic: "${title || 'General Lesson'}"
        - Checked-In Students: ${attendanceCount || 0}
        - Students with attention below 50%: ${lowAttentionCount || 0} (${Math.round((ratioLowAttention || 0) * 100)}%)
        - Attention Crisis Status: ${attentionCrisis ? "CRITICAL (At least 25% of students have attention below 50%)" : "NORMAL"}
        - Current Metrics:
          * Attention Level: ${latestAttention}%
          * Engagement Index: ${latestEngagement}%
          * Confusion Index: ${latestConfusion}%
        - Number of active system alerts (sleeping / distracted): ${alertCount}
        - Recent strategy deployed: "${currentStrategy || 'Direct Lecture'}"
        - Recent students real-time feedback comments: ${JSON.stringify(studentComments || [])}
        
        Pedagogical Reinforcement Learning Action Instructions:
        1. If Attention Crisis status is CRITICAL (meaning 25% or more of students have attention below 50%):
           - Select recommendedStrategy as "CRITICAL: STOP LECTURE".
           - State clearly in "explanation" that the students are not giving attention.
           - In "suggestedAction", suggest concrete, creative ways to attract attention back (such as physical stretch breaks, micro interactive quizzes, deep breathing circles, or voice pitch modulations).
           - Choose optimalPacing as "slow".
        2. Otherwise, select the absolute best next ACTION from the set based on metrics standard flow (e.g. REINFORCE_CONCEPTS, ADJUST_SPEED_DOWN, ADJUST_SPEED_UP, ACTIVE_BREAK, SHOW_MEDIA).
      `;

      const aiResponse = await client.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              recommendedStrategy: {
                type: Type.STRING,
                description: "Name of the chosen active action from the RL action set or 'CRITICAL: STOP LECTURE'."
              },
              explanation: {
                type: Type.STRING,
                description: "Explain why this transition was recommended (e.g. detailing that students are not giving attention)."
              },
              suggestedAction: {
                type: Type.STRING,
                description: "A highly actionable, exact script or activity the teacher should do right now to attract attention."
              },
              optimalPacing: {
                type: Type.STRING,
                enum: ["slow", "normal", "fast"],
                description: "Chosen delivery pacing."
              },
              reasoningKeys: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Factors that influenced this choice (e.g. ['attention_crisis', 'students_distracted_majority'])."
              }
            },
            required: ["recommendedStrategy", "explanation", "suggestedAction", "optimalPacing", "reasoningKeys"]
          }
        }
      });

      const responseText = aiResponse.text || "{}";
      const result = JSON.parse(responseText.trim());
      res.json(result);
    } catch (error) {
      console.warn("Gemini Reinforcement Learning Strategy Error using local fallback rules:", error);
      
      const { ratioLowAttention, attendanceCount } = req.body;
      const isCrisis = attendanceCount > 0 && ratioLowAttention >= 0.25;

      if (isCrisis) {
        res.json({
          recommendedStrategy: "CRITICAL: STOP LECTURE",
          explanation: `System Red Alert: ${Math.round((ratioLowAttention || 0) * 100)}% of checked-in students have attention levels below 50%. The students are not giving attention!`,
          suggestedAction: "⚠️ STUDENTS ARE NOT GIVING ATTENTION! Stop teaching and cease slide delivery immediately. Try these creative methods to attract their attention back:\n\n1. 🧘 Conduct a prompt 60-second mindfulness breathing cycle or a physical stretch.\n2. ❓ Fire up a rapid interactive multiple-choice check-in question or a funny trivia poll.\n3. 🗣️ Modulate your voice pitch, use rich screen examples, or ask a specific group a simple real-world riddle to re-mobilize the room.",
          optimalPacing: "slow",
          reasoningKeys: ["attention_crisis", "stop_teaching", "restore_focus"]
        });
      } else {
        const fallbackPacing = (req.body.latestConfusion > 50) ? 'slow' : 'normal';
        const fallbackStrategy = (req.body.latestConfusion > 55) ? 'REINFORCE_CONCEPTS' : 'ADJUST_SPEED_UP';
        res.json({
          recommendedStrategy: fallbackStrategy,
          explanation: "Running offline rules engine fallback due to API key status.",
          suggestedAction: req.body.latestConfusion > 55 
            ? "The class confusion rate is high! Instruct them to complete a quick whiteboard exercise."
            : "Maintain classroom pacing. Complete normal chapter examples.",
          optimalPacing: fallbackPacing,
          reasoningKeys: ["local_heuristics_fallback"]
        });
      }
    }
  });

  // Serve static assets or use Vite's development middleware
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in development mode with HMR disabled...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in production mode...");
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`EduSense full-stack server running on http://localhost:${PORT}`);
  });
}

startServer();
