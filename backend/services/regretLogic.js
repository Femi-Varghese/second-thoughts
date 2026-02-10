// regretLogic.js
import { OpenAI } from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const topicStats = {};
let isLearnerMode = false;  // Global flag: once set to true, no dependency scoring
let totalPrompts = 0;  // Total prompts in this session

const conceptualWords = [
  "why", "how", "explain", "derive",
  "reason", "prove", "difference"
];

const learningSignals = [
  "i am new",
  "beginner",
  "learning",
  "first time",
  "trying to learn",
  "learner",
  "new to",
  "new at"
];

const stopWords = new Set([
  "what", "why", "how", "when", "where", "who", "which", "whom", "whose",
  "is", "are", "am", "was", "were", "be", "been", "being",
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by",
  "that", "this", "these", "those", "there", "here", "it", "its", "they", "them", "their",
  "can", "could", "will", "would", "should", "may", "might", "must", "do", "does", "did",
  "have", "has", "had", "need", "make", "know", "think", "want", "like", "give", "find",
  "from", "up", "about", "into", "through", "during", "including", "use", "as", "per", "so", "then",
  "such", "if", "then", "some", "any", "all", "each", "every", "both", "few", "more", "most", "other",
  "just", "only", "very", "too", "much", "many", "well", "also", "not", "no", "yes"
]);

function extractTopic(prompt) {
  const keywords = prompt
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(" ")
    .filter(w => w.length > 2 && !stopWords.has(w));

  if (keywords.length === 0) return "general";
  
  // pick the longest substantive word as the topic
  keywords.sort((a, b) => b.length - a.length);
  return keywords[0];
}

function contains(words, prompt) {
  return words.some(w => prompt.toLowerCase().includes(w));
}

function getHumanMessage(dep) {
  if (dep <= 2) return "";

  if (dep <= 4)
    return "You’ve revisited this a few times. Try writing your own approach first 🙂";

  if (dep <= 6)
    return "You may be leaning on AI here. A short pause to think independently could help.";

  if (dep <= 8)
    return "This reliance pattern often reduces confidence during exams or interviews.";

  return "High dependency detected. Attempt this independently before continuing.";
}

export async function getResponse(prompt) {
  const topic = extractTopic(prompt);

  // Check for learning signals
  const hasLearningSignal = contains(learningSignals, prompt);
  if (hasLearningSignal) {
    isLearnerMode = true;
  }

  if (!topicStats[topic]) {
    topicStats[topic] = {
      usage: 0,
      dependency: 0
    };
  }

  const stats = topicStats[topic];
  stats.usage++;
  totalPrompts++;

  const isConceptual = contains(conceptualWords, prompt);

  // Calculate dependency based on grace period and learner mode
  let dependency = 0;

  // If learner mode is on, always return 0 dependency
  if (isLearnerMode) {
    dependency = 0;
  } 
  // If first 2 prompts (totalPrompts <= 2), give grace period
  else if (totalPrompts <= 2) {
    dependency = 0;
  } 
  // After 2 prompts, start counting
  else {
    dependency = stats.usage;
    // Bonus for conceptual questions
    if (isConceptual) {
      dependency += 2;
    }
  }

  // Cap at 10
  dependency = Math.min(dependency, 10);
  stats.dependency = dependency;

  let aiAnswer = "";
  try {
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-3.5-turbo",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: 500,
    });
    aiAnswer = completion.choices[0]?.message?.content || "No response from OpenAI";
  } catch (error) {
    console.error("OpenAI error:", error.message);
    aiAnswer = `Error getting response: ${error.message}`;
  }

  return {
    answer: aiAnswer,
    dependency: dependency,
    regret: dependency >= 6,
    message: getHumanMessage(dependency)
  };
}

export function resetTopic(topic) {
  if (!topic) return false;
  if (topicStats[topic]) {
    delete topicStats[topic];
    return true;
  }
  return false;
}

export function resetSession() {
  // Reset for a new conversation
  isLearnerMode = false;
  totalPrompts = 0;
  return true;
}
