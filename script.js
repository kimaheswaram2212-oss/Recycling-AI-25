const chatBox = document.getElementById("chat-box");
const userText = document.getElementById("user-text");
const imageUpload = document.getElementById("image-upload");

function addMessage(sender, message) {
  const div = document.createElement("div");
  div.innerHTML = `<strong>${sender}:</strong> ${message}`;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

async function sendInput() {
  const text = userText.value.trim();
  const file = imageUpload.files[0];

  if (!text && !file) return;

  addMessage("You", text || "(Image uploaded)");

  const formData = new FormData();
  formData.append("text", text);
  if (file) formData.append("image", file);

  try {
    const res = await fetch("/api/analyze", {
      method: "POST",
      body: formData
    });

    if (!res.ok) throw new Error(`Server responded with ${res.status}`);

    const data = await res.json();
    addMessage("AI", data.reply);

  } catch (err) {
    console.error("Fetch error:", err);
    addMessage("AI", "Unable to reach server. Check console.");
  }

  userText.value = "";
  imageUpload.value = "";
}

