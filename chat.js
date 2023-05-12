const chatContainer = document.getElementById("chatContainer");
const chatMessages = document.getElementById("chatMessages");
const userInput = document.getElementById("userInput");
const sendButton = document.getElementById("sendButton");

/*

const colors = {
        dark0="#0d0e0f",
        dark="#202020",
        background_dark="#1d2021",
        background="#282828",
        background_light="#32302f",
        foreground="#ebdbb2",
        gray="#dedede",
        medium_gray="#504945",
        comment="#665c54",
        milk="#e7d7ad",
        error_red="#cc241d",
        red="#fb4934",
        orange="#d65d0e",
        bright_yellow="#fabd2f",
        soft_yellow="#eebd35",
        pink="#d4879c",
        magenta="#b16286",
        soft_green="#98971a",
        forest_green="#689d6a",
        clean_green="#8ec07c",
        blue_gray="#458588",
        dark_gray="#83a598",
        light_blue="#7fa2ac",
    };

*/

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

        const codeBlock = `<pre class="code-block${langClass}"><code>${highlightedCode}</code></pre>`;
        const copyButton = `<button class="copy-button" data-code="${escapedContent}">Copy</button>`;
        return `<div class="code-container"><div class="code-header">${token.info || ''}${copyButton}</div>${codeBlock}</div>`;
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
    
    // Setup copy code functionality
    messageElement.querySelectorAll('.copy-button').forEach(btn => {
        btn.addEventListener('click', (event) => {
            const code = event.target.getAttribute('data-code');
            navigator.clipboard.writeText(code);
        });
    });
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
  
