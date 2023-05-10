const chatContainer = document.getElementById("chatContainer");
const chatMessages = document.getElementById("chatMessages");
const userInput = document.getElementById("userInput");
const sendButton = document.getElementById("sendButton");


function escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }  


function addMessage(sender, message) {
const md = new markdownit();

// Custom renderer for code blocks
md.renderer.rules.fence = (tokens, idx, options, env, slf) => {
    const token = tokens[idx];
    const langClass = token.info ? ` language-${token.info}` : "";
    const escapedContent = escapeHtml(token.content);

    let highlightedCode = escapedContent;
    if (token.info) {
    // Try to highlight the code using the specified language
    try {
        highlightedCode = hljs.highlight(token.info, token.content).value;
    } catch (error) {
        console.error("Error highlighting code:", error);
    }
    }

    return `<pre class="code-block${langClass}"><code>${highlightedCode}</code></pre>`;
};



const renderedMessage = md.render(message);

const messageElement = document.createElement("div");
messageElement.classList.add("message");
messageElement.innerHTML = `
    <div class="message-wrapper ${sender === "You" ? "user-message" : "assistant-message"}">
    ${renderedMessage}
    </div>`;
chatMessages.appendChild(messageElement);
setTimeout(() => {
    messageElement.scrollIntoView({ behavior: 'smooth' });
  }, 0);
}

const group1 = "nlu";
const hash1 = "y8ABUHC";
const hash2 = "eVNCVqP"; 
const group2 = "ycPkEgaayXCawkuv94";

let conversationHistory = [];

async function getResponse(message) {
    // Update the conversation history
    conversationHistory.push({role: "user", content: message});

    console.log(conversationHistory)

    const response = await fetch("https://gpt.ai.se/v1/engines/gpt-sw3/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: "gpt-sw3-20b-instruct",
            messages: conversationHistory,
            max_tokens: 1000,
            n: 1,
            temperature: 0.6,
            user: group1,
            token: hash1 + hash2 + group2
        }),
    });

    const responseData = await response.json();
    console.log(responseData)
    const assistantMessage = responseData.choices[0].message;

    // Update the conversation history with the assistant's response
    conversationHistory.push(assistantMessage);

    addMessage("Assistant", assistantMessage.content);
}

/*** User input ***/
userInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        event.preventDefault();
        const userMessage = userInput.value;
        if (userMessage.trim() !== "") {
            addMessage("You", userMessage);
            getResponse(userMessage);
            userInput.value = "";
        }
    }
});

sendButton.addEventListener("click", () => {
    const userMessage = userInput.value;
    if (userMessage.trim() !== "") {
        addMessage("You", userMessage);
        getResponse(userMessage);
        userInput.value = "";
    }
});
  
