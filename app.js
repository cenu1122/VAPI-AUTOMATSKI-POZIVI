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
const sendBtn = document.getElementById("sendBtn"); // Novo dugme!

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

    try {
        const response = await fetch("http://localhost:3000/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: textMessage })
        });

        const data = await response.json();
        const aiReply = data.reply;
        
        responseDiv.innerHTML = aiReply;
        speakAI(aiReply);

        // Spremanje u Supabase bazu
        await spasiRazgovorUBazu(textMessage, aiReply);

    } catch (error) {
        console.error("Greška pri spajanju na backend:", error);
        statusDiv.innerText = "❌ Greška: Provjeri da li ti je pokrenut backend server!";
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
// 6. LOGIKA ZA KLIK NA DUGME "POŠALJI" (Novo & Sigurno!)
// ==========================================
if (sendBtn) {
    sendBtn.addEventListener("click", async () => {
        const typedText = messageInput.value.trim();
        
        if (typedText !== "") {
            provjeriIPrekiniAI(); // Utišaj AI ako trenutno brblja
            await sendToBackend(typedText); // Pošalji poruku backendu
            messageInput.value = ""; // Isprazni prozor za kucanje
        }
    });
}

// Rezervna opcija: Ako ipak pritisneš Enter unutar polja, da odradi isto što i dugme
messageInput.addEventListener("keydown", async (event) => {
    if (event.key === "Enter") {
        event.preventDefault(); // Zaustavi fabričko ponašanje (novi red ili refresh)
        if (sendBtn) sendBtn.click(); // Automatski "klikni" na naše novo dugme
    }
});

// ==========================================
// 7. KONTROLE OSTALIH DUGMIĆA
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
