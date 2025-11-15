const chatBox = document.getElementById("chat-box");
const userText = document.getElementById("user-text");

function addMessage(sender, message) {
  const div = document.createElement("div");
  div.innerHTML = `<strong>${sender}:</strong> ${message}`;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

async function sendInput() {
  const text = userText.value.trim();
  if (!text) return;

  addMessage("You", text);

  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: text
      }),
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    const data = await response.json();

    // backend returns: { response: message }
    addMessage("AI", data.response);

  } catch (error) {
    console.error("Fetch error:", error);
    addMessage("AI", "Server unreachable. Check Vercel logs.");
  }

  userText.value = "";
}
