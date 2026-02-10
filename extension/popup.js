document.addEventListener("DOMContentLoaded", () => {

  let sendBtn = document.getElementById("sendBtn");
  const inputEl = document.getElementById("userInput");
  const chat = document.getElementById("chat");

  console.log('popup.js loaded', { sendBtnExists: !!sendBtn, inputExists: !!inputEl, chatExists: !!chat });

  if (!sendBtn) {
    // fallback selector in case id was removed or altered
    sendBtn = document.querySelector('.send-btn');
    console.log('fallback sendBtn found', !!sendBtn);
  }

  function timeNow(){
    return new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function appendUserBubble(text){
    const bubble = document.createElement("div");
    bubble.className = "bubble user";
    bubble.textContent = text;

    const meta = document.createElement("span");
    meta.className = "meta";
    meta.textContent = timeNow();

    bubble.appendChild(meta);
    chat.appendChild(bubble);
    chat.scrollTop = chat.scrollHeight;
  }

  function appendBotBubble(){
    const bubble = document.createElement("div");
    bubble.className = "bubble bot";

    const answer = document.createElement("div");
    answer.textContent = "Thinking...";

    const bar = document.createElement("div");
    bar.className = "progress-bar";

    const inner = document.createElement("div");
    inner.className = "progress-bar-inner";

    const message = document.createElement("div");
    message.className = "dependency-message";

    bar.appendChild(inner);
    bubble.appendChild(answer);
    bubble.appendChild(bar);
    bubble.appendChild(message);

    chat.appendChild(bubble);
    chat.scrollTop = chat.scrollHeight;

    return { bubble, answer, inner, message };
  }

  /* ---------- Local dependency logic ---------- */

  const conceptualWords = ["why","how","explain","derive","reason","prove"];
  
  const learningSignals = ["beginner", "learner", "new to", "new at", "learning", "first time", "trying to learn"];
  
  // Stop words to ignore when extracting topic
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
  
  let isLearnerMode = false;
  let totalPrompts = 0;
  
  function isConceptual(text){
    return conceptualWords.some(w => text.toLowerCase().includes(w));
  }

  function extractTopic(prompt) {
    const keywords = prompt
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.has(w));

    if (keywords.length === 0) return "general";

    // pick the longest substantive word as the topic (e.g., 'galaxy', 'blu')
    keywords.sort((a, b) => b.length - a.length);
    return keywords[0];
  }

  function getHumanMessage(dep) {
    if (dep <= 2) return "";
    if (dep <= 4) return "You've revisited this a few times. Try writing your own approach first 🙂";
    if (dep <= 6) return "You may be leaning on AI here. A short pause to think independently could help.";
    if (dep <= 8) return "This reliance pattern often reduces confidence during exams or interviews.";
    return "High dependency detected. Attempt this independently before continuing.";
  }

  function computeDependency(prompt){
    // Check for learning signals
    const hasLearningSignal = learningSignals.some(signal => prompt.toLowerCase().includes(signal));
    if (hasLearningSignal) {
      isLearnerMode = true;
    }

    const key = extractTopic(prompt);
    const map = JSON.parse(localStorage.getItem("topicMap") || "{}");

    // Migrate/merge legacy keys (e.g., first-20-slice keys) that contain the topic
    // so prompts like "how galaxy" and "how that galaxy" map to the same topic.
    if (!map[key]) {
      let merged = 0;
      const toDelete = [];
      for (const existingKey of Object.keys(map)) {
        if (existingKey === key) continue;
        // if existing key contains the topic word or vice-versa, merge it
        if (existingKey.includes(key) || key.includes(existingKey) || existingKey.split('_').includes(key)) {
          merged += map[existingKey] || 0;
          toDelete.push(existingKey);
        }
      }
      if (toDelete.length) {
        for (const d of toDelete) delete map[d];
        map[key] = (map[key] || 0) + merged;
      }
    }

    // Increment for this use
    map[key] = (map[key] || 0) + 1;
    localStorage.setItem("topicMap", JSON.stringify(map));
    totalPrompts++;

    // Calculate dependency
    let score = 0;

    // If learner mode is on, always return 0 dependency
    if (isLearnerMode) {
      score = 0;
    } 
    // If first 2 prompts (totalPrompts <= 2), give grace period
    else if (totalPrompts <= 2) {
      score = 0;
    } 
    // After 2 prompts, start counting
    else {
      score = map[key];
      const isConceptQ = isConceptual(prompt);
      if(isConceptQ) score += 2;
    }

    const finalScore = Math.min(score, 10);
    
    // DEBUG: Log the calculation
    console.log(`computeDependency("${prompt}") -> topic="${key}", totalPrompts=${totalPrompts}, isLearnerMode=${isLearnerMode}, isConceptual=${isConceptual(prompt)}, finalScore=${finalScore}`);
    
    return finalScore;
  }
  let sessionStart = null;

  function formatDuration(ms) {
    if (!ms || ms < 0) return "0s";
    const s = Math.floor(ms / 1000);
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  }

  function showConfirmationModal(durationText, onContinue, onTry) {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';

    const modal = document.createElement('div');
    modal.className = 'confirm-modal';

    const p = document.createElement('div');
    p.className = 'time';
    p.textContent = `You've used the chatbot for ${durationText}. Continue to receive the result?`;

    const controls = document.createElement('div');
    controls.className = 'controls';

    const yes = document.createElement('button');
    yes.className = 'confirm-continue';
    yes.textContent = 'Continue';

    const no = document.createElement('button');
    no.className = 'confirm-stop';
    no.textContent = "I'll try myself";

    controls.appendChild(yes);
    controls.appendChild(no);
    modal.appendChild(p);
    modal.appendChild(controls);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // blur the popup
    const rootPopup = document.querySelector('.popup');
    if (rootPopup) rootPopup.classList.add('blurred');

    function cleanup() {
      if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
      if (rootPopup) rootPopup.classList.remove('blurred');
    }

    yes.addEventListener('click', () => {
      cleanup();
      onContinue && onContinue();
    });

    no.addEventListener('click', () => {
      cleanup();
      onTry && onTry();
    });
  }

  function sendPrompt(prompt){
    if (!sessionStart) sessionStart = Date.now();
    appendUserBubble(prompt);
    const { bubble, answer, inner, message } = appendBotBubble();

    chrome.runtime.sendMessage(
      { action: "ASK_AI", prompt },
      (response) => {

        let score;
        let resultAnswer = "";

        if (chrome.runtime.lastError || !response) {
          console.log('Backend call failed, using local computeDependency');
          score = computeDependency(prompt);
          resultAnswer = "Simulated response for: " + prompt;
        } else {
          console.log('Backend response received:', response);
          resultAnswer = response.answer || "No reply";
          score = Number(response.dependency) || computeDependency(prompt);
        }

        const percent = Math.min(score * 10, 100);
        const msg = getHumanMessage(score);
        
        console.log(`Final score=${score}, percent=${percent}, msg="${msg}"`);

        function applyResult() {
          inner.style.width = percent + "%";
          message.textContent = msg;
          answer.textContent = resultAnswer;
          
          let colorApplied = "none";
          if (score >= 7) {
            inner.style.background = "#ff4d4d";
            bubble.classList.add("high-risk");
            colorApplied = "RED (high-risk)";
          } else if (score > 4) {
            inner.style.background = "#ffd54f";
            bubble.classList.add("medium-risk");
            colorApplied = "YELLOW (medium-risk)";
          } else {
            colorApplied = "DEFAULT (no color added)";
          }
          
          console.log(`Color applied: ${colorApplied}`);
        }

        if (score >= 7) {
          // show modal and wait for user choice
          const durationText = formatDuration(Date.now() - (sessionStart || Date.now()));
          showConfirmationModal(durationText,
            // onContinue
            () => {
              applyResult();
            },
            // onTry (start new conversation)
            async () => {
              // reset topic on backend and client map
              const topic = extractTopic(prompt);
              try {
                await fetch('http://localhost:3000/ask-ai/reset', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ topic })
                });
                // Also reset session on backend
                await fetch('http://localhost:3000/ask-ai/reset-session', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' }
                });
              } catch (e) {
                // ignore network errors
              }

              // clear client topic count for this topic
              const map = JSON.parse(localStorage.getItem('topicMap') || '{}');
              if (map[topic]) delete map[topic];
              localStorage.setItem('topicMap', JSON.stringify(map));

              // Reset learner mode and prompts for new conversation
              isLearnerMode = false;
              totalPrompts = 0;

              // start a new conversation: clear chat and show greeting
              chat.innerHTML = '';
              const startBubble = document.createElement('div');
              startBubble.className = 'bubble bot';
              startBubble.textContent = 'Hey there! 👋 How can I help you today?';
              chat.appendChild(startBubble);
            }
          );
        } else {
          applyResult();
        }
      }
    );
  }

  sendBtn.addEventListener("click", () => {
    console.log('sendBtn clicked');
    const text = inputEl.value.trim();
    console.log('input text:', text);
    if (text) {
      sendPrompt(text);
      inputEl.value = "";
    }
  });

  inputEl.addEventListener("keydown", e => {
    if (e.key === "Enter") sendBtn.click();
  });

});
