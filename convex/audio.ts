"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";

export const processAudioNote = action({
  args: {
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    try {
      const { storageId } = args;
      
      console.log("Processing audio note for storageId:", storageId);
      
      // 1. Get file URL
      const fileUrl = await ctx.storage.getUrl(storageId);
      if (!fileUrl) {
          console.error("File not found in storage for ID:", storageId);
          throw new Error("File not found in storage");
      }
      console.log("Fetched file URL:", fileUrl);

      // 2. Fetch the audio binary from storage
      const response = await fetch(fileUrl);
      if (!response.ok) {
        console.error("Failed to fetch stored audio. Status:", response.status);
        throw new Error(`Failed to fetch stored audio: ${response.status} ${response.statusText}`);
      }

      const contentType = response.headers.get("content-type") || "audio/webm";
      console.log("Audio content type:", contentType);
      const arrayBuffer = await response.arrayBuffer();
      const base64Audio = Buffer.from(arrayBuffer).toString("base64");
      console.log("Audio converted to base64, size:", base64Audio.length);
      
      const apiKey = process.env.GEMINI_API_KEY; 
      if (!apiKey) {
          console.error("GEMINI_API_KEY is missing");
          throw new Error("GEMINI_API_KEY is missing in Convex environment variables. Please set it in your Convex dashboard.");
      }

      const endpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent";
      console.log("Calling Gemini Flash Latest API...");

      const promptText = `Please listen to the attached audio note.
1. Provide a direct, exact raw transcription of what was said.
2. Provide a clean, structured written version (formatting as markdown, fixing stutters, structuring into paragraphs/bullet points if appropriate).
3. Provide a relevant emoji for the note.
Format your response exactly as JSON:
{
  "rawTranscript": "the exact spoken text...",
  "structuredContent": "the formatted markdown...",
  "title": "A short 2-5 word title for this note",
  "emoji": "a single relevant emoji character (e.g. 📝, 💡, 🏃)"
}`;

      const body = {
        contents: [{
          parts: [
            { text: promptText },
            {
              inline_data: {
                mime_type: contentType,
                data: base64Audio
              }
            }
          ]
        }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-goog-api-key": apiKey,
        },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
          const errText = await res.text();
          console.error("Gemini API Error details:", errText);
          throw new Error(`Gemini API Error (${res.status}): ${errText}`);
      }

      const json = await res.json();
      console.log("Gemini API response received");
      const textRes = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!textRes || typeof textRes !== "string") {
        console.error("Unexpected Gemini response format:", JSON.stringify(json));
        throw new Error("Gemini response did not include text content");
      }

      // 4. Delete the audio file from storage after processing to respect privacy/limits
      console.log("Deleting temporary storage file...");
      await ctx.storage.delete(storageId);

      let parsed: { rawTranscript?: string; structuredContent?: string; title?: string; emoji?: string };
      try {
        parsed = JSON.parse(textRes);
      } catch (e) {
        console.warn("JSON parse failed, attempting regex match:", e);
        const match = textRes.match(/\{[\s\S]*\}/);
        if (!match) {
          console.error("Failed to parse Gemini JSON response. Raw text:", textRes);
          throw new Error("Failed to parse Gemini JSON response");
        }
        parsed = JSON.parse(match[0]);
      }

      return {
        rawTranscript: parsed.rawTranscript || "",
        structuredContent: parsed.structuredContent || "",
        title: parsed.title || "Audio Note",
        emoji: parsed.emoji || "📝",
      };
    } catch (error) {
      console.error("Error in processAudioNote action:", error);
      throw error; // Re-throw so the client sees the failure
    }
  }
});
