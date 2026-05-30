// ==========================================
// 1. SUPABASE KONFIGURACIJA & INICIJALIZACIJA
// ==========================================
const SUPABASE_URL = "https://fbvwvkjurcbdnbrfknig.supabase.co";
const SUPABASE_KEY = "sb_publishable_eV8H-_ck4SgcNZDqdV_6iA__-Fy-Mmi";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
console.log("Supabase je uspješno inicijalizovan!");

// ==========================================
// 2. SELEKTORI ELEMENATA
// ==========================================
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const messageInput = document.getElementById("message");
const responseDiv = document.getElementById("response");
const statusDiv = document.getElementById("status");
const sendBtn = document.getElementById("sendBtn"); 
const groqKeyInput = document.getElementById("groqKeyInput");

let recognition;
let isSpeakingAI = false;
let currentSpeechUtterance = null;

// AUTOMATSKO UCITAVANJE KLJUCA
if (groqKeyInput && localStorage.getItem("saved_groq_key")) {
    groqKeyInput.value = localStorage.getItem("saved_groq_key");
}

// ==========================================
// 3. SPEECH-TO-TEXT (STT) LOGIKA
// ==========================================
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (!SpeechRecognition) {
    alert("Tvoj pretraživač ne podržava besplatni Speech-to-Text. Pokušaj u Google Chrome.");
} else {
    recognition = new SpeechRecognition();
    recognition.continuous = true; 
    recognition.interimResults = false; 
    recognition.lang = "en-US"; 

    recognition.onresult = async (event) => {
        const lastResultIndex = event.results.length - 1;
        const transcript = event.results[lastResultIndex][0].transcript.trim();
        
        if (transcript.length > 0) {
            if (messageInput) messageInput.value = transcript;
            provjeriIPrekiniAI();
            await sendToBackend(transcript);
        }
    };

    recognition.onstart = () => {
        if (statusDiv) {
            statusDiv.innerText = "🎙️ AI te sluša uživo... Pričaj slobodno";
            statusDiv.className = "status-listening";
        }
    };

    recognition.onerror = (event) => {
        console.error("STT Greška:", event.error);
        if(event.error === 'not-allowed' && statusDiv) {
            statusDiv.innerText = "❌ Nema dozvole za mikrofon!";
        }
    };

    recognition.onend = () => {
        if (stopBtn && !stopBtn.disabled) {
            recognition.start();
        }
    };
}

function provjeriIPrekiniAI() {
    if (isSpeakingAI && speechSynthesis.speaking) {
        console.log("Korisnik je prekinuo AI. Zaustavljam audio...");
        speechSynthesis.cancel(); 
        isSpeakingAI = false;
        if (statusDiv) {
            statusDiv.innerText = "Prekinuo si AI. Slušam te...";
            statusDiv.className = "status-listening";
        }
    }
}

// ==========================================
// 4. SLANJE NA GROQ API & SPAŠAVANJE U BAZU
// ==========================================
async function sendToBackend(textMessage) {
    const GROQ_API_KEY = groqKeyInput ? groqKeyInput.value.trim() : "";

    if (!GROQ_API_KEY) {
        if (statusDiv) {
            statusDiv.innerText = "❌ Greška: Nedostaje API ključ!";
            statusDiv.className = "status-idle";
        }
        if (responseDiv) responseDiv.innerHTML = "Molimo unesite vaš Groq API ključ u polje na vrhu stranice.";
        return;
    }

    localStorage.setItem("saved_groq_key", GROQ_API_KEY);

    if (statusDiv) {
        statusDiv.innerText = "🤔 AI razmišlja...";
        statusDiv.className = "status-thinking";
    }
    if (responseDiv) responseDiv.innerHTML = "Generišem odgovor...";

    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${GROQ_API_KEY}`
            },
            body: JSON.stringify({
                model: "llama3-8b-8192", 
                messages: [
                    { role: "system", content: "Ti si koristan AI glasovni asistent." },
                    { role: "user", content: textMessage }
                ]
            })
        });

        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error.message);
        }

        const aiReply = data.choices[0].message.content;
        
        if (responseDiv) responseDiv.innerHTML = aiReply;
        speakAI(aiReply);

        await spasiRazgovorUBazu(textMessage, aiReply);

    } catch (error) {
        console.error("Greška:", error);
        if (statusDiv) {
            statusDiv.innerText = "❌ Greška pri komunikaciji sa AI!";
            statusDiv.className = "status-idle";
        }
        if (responseDiv) responseDiv.innerHTML = "Došlo je do greške: " + error.message;
    }
}

async function spasiRazgovorUBazu(korisnikTekst, aiTekst) {
    try {
        const { data, error } = await supabase
            .from('pozivi') 
            .insert([
                { 
                    user_message: korisnikTekst, 
                    ai_response: aiTekst, 
                    created_at: new Date() 
                }
            ]);

        if (error) {
            console.error("Supabase greška pri upisu:", error.message);
        } else {
            console.log("Razgovor uspješno sačuvan u Supabase bazi!");
        }
    } catch (err) {
        console.error("Sistemska greška pri slanju u bazu:", err);
    }
}

// ==========================================
// 5. TEXT-TO-SPEECH (TTS) LOGIKA
// ==========================================
function speakAI(text) {
    speechSynthesis.cancel(); 

    currentSpeechUtterance = new SpeechSynthesisUtterance(text);
    currentSpeechUtterance.lang = "en-US"; 

    currentSpeechUtterance.onstart = () => {
        isSpeakingAI = true;
        if (statusDiv) {
            statusDiv.innerText = "🔊 AI priča... (Slobodno upadni u riječ)";
            statusDiv.className = "status-speaking";
        }
    };

    currentSpeechUtterance.onend = () => {
        isSpeakingAI = false;
        if (statusDiv) {
            statusDiv.innerText = "🎙️ AI je završio. Slušam te...";
            statusDiv.className = "status-listening";
        }
    };

    speechSynthesis.speak(currentSpeechUtterance);
}

// ==========================================
// 6. LOGIKA ZA KLIK NA DUGME "POŠALJI PORUKU"
// ==========================================
if (sendBtn) {
    sendBtn.addEventListener("click", async () => {
        if (!messageInput) return;
        const typedText = messageInput.value.trim();
        
        if (typedText !== "") {
            provjeriIPrekiniAI(); 
            messageInput.value = ""; 
            await sendToBackend(typedText); 
        }
    });
}

if (messageInput) {
    messageInput.addEventListener("keydown", async (event) => {
        if (event.key === "Enter") {
            event.preventDefault(); 
            if (sendBtn) sendBtn.click(); 
        }
    });
}

// ==========================================
// 7. KONTROLE OSTALIH DUGMIĆA
// ==========================================
if (startBtn) {
    startBtn.addEventListener("click", () => {
        startBtn.disabled = true;
        if (stopBtn) stopBtn.disabled = false;
        if (recognition) recognition.start();
    });
}

if (stopBtn) {
    stopBtn.addEventListener("click", () => {
        if (startBtn) startBtn.disabled = false;
        stopBtn.disabled = true;
        if (recognition) recognition.stop();
        speechSynthesis.cancel();
        isSpeakingAI = false;
        if (statusDiv) {
            statusDiv.innerText = "Razgovor zaustavljen.";
            statusDiv.className = "status-idle";
        }
    });
}
