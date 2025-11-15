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

  const res = await fetch("https://recycling-ai-25.vercel.app/api/analyze", {
    method: "POST",
    body: formData
  });

  const data = await res.json();
  addMessage("AI", data.reply);

  userText.value = "";
  imageUpload.value = "";
}
