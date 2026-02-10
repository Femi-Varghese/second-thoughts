chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.action === "ASK_AI") {
    fetch("http://localhost:3000/ask-ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: req.prompt })
    })
      .then(r => r.json())
      .then(d => sendResponse(d))
      .catch(() => sendResponse(null));

    return true;
  }
});
