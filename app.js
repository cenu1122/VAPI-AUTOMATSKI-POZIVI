Evo kompletnog i izmijenjenog koda za app.js.

Ovaj kod sada povlači ključ iz onog novog polja što smo dodali u index.html. Da ti ne bi morao ukucavati ključ svaki put kada osvježiš stranicu, dodao sam i automatsko spašavanje ključa u memoriju pretraživača (localStorage). Čim ga uneseš prvi put, stranica će ga zapamtiti!

Samo kopiraj ovaj cijeli tekst i zamijeni sve unutar svog app.js fajla na GitHubu:
JavaScript

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
const groqKeyInput = document.getElementById("groqKeyInput"); // Novo polje za ključ!

let recognition;
let isSpeakingAI = false;
let currentSpeechUtterance = null;

// AUTOMATSKO UCITAVANJE KLJUCA: Ako si vec nekad unio kljuc, povuci ga iz memorije
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
// 4. SLANJE NA GROQ API & SPAŠAVANJE U BAZU
// ==========================================
async function sendToBackend(textMessage) {
    // Uzmi ključ iz polja na stranici
    const GROQ_API_KEY = groqKeyInput ? groqKeyInput.value.trim() : "";

    // Provjera da li je korisnik uopšte unio ključ
    if (!GROQ_API_KEY) {
        statusDiv.innerText = "❌ Greška: Nedostaje API ključ!";
        statusDiv.className = "status-idle";
        responseDiv.innerHTML = "Molimo unesite vaš Groq API ključ u polje na vrhu stranice.";
        return;
    }

    // Spasi ključ u memoriju pretraživača da se ne mora kucati ponovo
    localStorage.setItem("saved_groq_key", GROQ_API_KEY);

    statusDiv.innerText = "🤔 AI razmišlja...";
    statusDiv.className = "status-thinking";
    responseDiv.innerHTML = "Generišem odgovor...";

    try {
        // Šaljemo direktan zahtjev na službeni Groq API server
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
        
        // Provjera da li je Groq vratio grešku zbog nevažećeg ključa
        if (data.error) {
            throw new Error(data.error.message);
        }

        const aiReply = data.choices[0].message.content;
        
        responseDiv.innerHTML = aiReply;
        speakAI(aiReply);

        // Zapiši podatke u Supabase
        await spasiRazgovorUBazu(textMessage, aiReply);

    } catch (error) {
        console.error("Greška:", error);
        statusDiv.innerText = "❌ Greška pri komunikaciji sa AI!";
        responseDiv.innerHTML = "Došlo je do greške: " + error.message;
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
// 6. LOGIKA ZA KLIK NA DUGME "POŠALJI PORUKU"
// ==========================================
if (sendBtn) {
    sendBtn.addEventListener("click", async () => {
        const typedText = messageInput.value.trim();
        
        if (typedText !== "") {
            provjeriIPrekiniAI(); 
            messageInput.value = ""; // Odmah isprazni box čim klikneš dugme
            await sendToBackend(typedText); 
        }
    });
}

// Slušalac za pritisak tipke Enter unutar tekstualnog polja
messageInput.addEventListener("keydown", async (event) => {
    if (event.key === "Enter") {
        event.preventDefault(); // Zaustavi prelazak u novi red
        if (sendBtn) sendBtn.click(); // Okini klik na dugme za slanje
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
