import fs from "fs/promises";
import Anthropic from "@anthropic-ai/sdk";
const client = new Anthropic();
const doc = JSON.parse(await fs.readFile("data/library/odyssey-book-1.json", "utf8"));

// Test 3 lines to gauge quality + cost.
for (let i = 0; i < 3; i++) {
  const line = doc.lines[i];
  const prompt = `You are translating a single line of Ancient Greek poetry from Odyssey, Book 1 into concise, readable English. Match the line's meaning closely. Keep it to one clean English sentence or clause, 5-25 words. No quotation marks, no line numbers, no notes.

Context (Butler's prose for the surrounding paragraph, for reference only — do not repeat it):
${doc.english_paragraphs[0]}

Previous line: ${i > 0 ? doc.lines[i-1].original : "(start)"}
LINE TO TRANSLATE: ${line.original}
Next line: ${doc.lines[i+1]?.original || "(end)"}

Output ONLY the English translation of LINE TO TRANSLATE, nothing else.`;
  const resp = await client.messages.create({ model: "claude-sonnet-4-5", max_tokens: 120, messages: [{role:"user",content:prompt}]});
  console.log(`LINE ${line.n}: ${line.original}`);
  console.log(`ENG   : ${resp.content[0].text}`);
  console.log(`USAGE : in=${resp.usage.input_tokens} out=${resp.usage.output_tokens} cost=$${(resp.usage.input_tokens*3/1e6 + resp.usage.output_tokens*15/1e6).toFixed(4)}`);
  console.log("");
}
