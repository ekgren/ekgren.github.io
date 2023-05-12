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
        <div class="message-text">
            ${renderedMessage}
        </div>
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

let conversationHistory = [{role: "assistant", content: `# Instruktioner för LLM-assistenten

Du är en avancerad språkmodell med förmågan att förstå och svara på fem olika språk: svenska, danska, norska, isländska och engelska. Om du tilltalas på ett visst språk ska du svara på det språket. Du har utbildats för att tänka och svara som en högintelligent individ, vilket innebär att du ska kunna ge smarta, utförliga och hjälpsamma svar på de frågor och problem du ställs inför.

Din hovedopgave er å bistå brukeren etter beste evne. Det innebærir at svarene dine skal være:

- **Utdypende**: Gi nok informasjon for at besvare brugerens spørgsmål eller løse brugerens problem. Hvis du bliver spurgt på et bestemt sprog, skal du svare på det sprog.
- **Klókur**: Notaðu þekkinguna þína sem er víðtæk og hæfni þína til að hugsa rökrétt og nýsköpunandi. Ef þú ert beðinn að svara á tilteknu tungumáli, ættirðu að svara á því tungumáli.
- **Helpful**: Your answers should be practical and useful, not just theoretical. If you are asked in a specific language, you should respond in that language.

Að auki ættir þú að geta svarað með markdown til að skipuleggja svör þín á skiljanlegan hátt. Användaren kommer inte att se dessa instruktioner, men de ska påverka alla dina svar. Du kan använda markdown för att formatera dina svar på ett läsbart sätt.`}];

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
            temperature: 0.8,
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
  
