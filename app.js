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

let recognition;
let isSpeakingAI = false;
let currentSpeechUtterance = null;

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
            messageInput.value = transcript;
            provjeriIPrekiniAI();
            await sendToBackend(transcript);
        }
    };

    recognition.onstart = () => {
        statusDiv.innerText = "🎙️ AI te sluša uživo... Pričaj slobodno";
        statusDiv.className = "status-listening";
    };

    recognition.onerror = (event) => {
        console.error("STT Greška:", event.error);
        if(event.error === 'not-allowed') {
            statusDiv.innerText = "❌ Nema dozvole za mikrofon!";
        }
    };

    recognition.onend = () => {
        if (!stopBtn.disabled) {
            recognition.start();
        }
    };
}

function provjeriIPrekiniAI() {
    if (isSpeakingAI && speechSynthesis.speaking) {
        console.log("Korisnik je prekinuo AI. Zaustavljam audio...");
        speechSynthesis.cancel(); 
        isSpeakingAI = false;
        statusDiv.innerText = "Prekinuo si AI. Slušam te...";
        statusDiv.className = "status-listening";
    }
}

// ==========================================
// 4. SLANJE NA BACKEND & SPAŠAVANJE U BAZU
// ==========================================
async function sendToBackend(textMessage) {
    statusDiv.innerText = "🤔 AI razmišlja...";
    statusDiv.className = "status-thinking";
    responseDiv.innerHTML = "Generišem odgovor...";

    // ⚠️ OVDJE UBACI SVOJ PRAVI KLJUČ IZ GROQ KONSOLE (gsk_...)
    const GROQ_API_KEY = "TVOJ_PRAVI_GROQ_KLJUČ_OVDJE"; 

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
        const aiReply = data.choices[0].message.content;
        
        responseDiv.innerHTML = aiReply;
        speakAI(aiReply);

        await spasiRazgovorUBazu(textMessage, aiReply);

    } catch (error) {
        console.error("Greška pri spajanju na Groq API:", error);
        statusDiv.innerText = "❌ Greška pri preuzimanju odgovora sa Groq-a!";
        statusDiv.className = "status-idle";
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
        statusDiv.innerText = "🔊 AI priča... (Slobodno upadni u riječ)";
        statusDiv.className = "status-speaking";
    };

    currentSpeechUtterance.onend = () => {
        isSpeakingAI = false;
        statusDiv.innerText = "🎙️ AI je završio. Slušam te...";
        statusDiv.className = "status-listening";
    };

    speechSynthesis.speak(currentSpeechUtterance);
}

// ==========================================
// 6. LOGIKA ZA KLIK NA DUGME "POŠALJI"
// ==========================================
if (sendBtn) {
    sendBtn.addEventListener("click", async () => {
        const typedText = messageInput.value.trim();
        
        if (typedText !== "") {
            provjeriIPrekiniAI(); 
            messageInput.value = ""; // Odmah isprazni box čim klikneš
            await sendToBackend(typedText); 
        }
    });
}

// Ako pritisne Enter unutar polja, simulira klik na dugme Pošalji
messageInput.addEventListener("keydown", async (event) => {
    if (event.key === "Enter") {
        event.preventDefault(); 
        if (sendBtn) sendBtn.click(); 
    }
});

// ==========================================
// 7. KONTROLE OSTAHA DUGMIĆA
// ==========================================
startBtn.addEventListener("click", () => {
    startBtn.disabled = true;
    stopBtn.disabled = false;
    if (recognition) recognition.start();
});

stopBtn.addEventListener("click", () => {
    startBtn.disabled = false;
    stopBtn.disabled = true;
    if (recognition) recognition.stop();
    speechSynthesis.cancel();
    isSpeakingAI = false;
    statusDiv.innerText = "Razgovor zaustavljen.";
    statusDiv.className = "status-idle";
});
