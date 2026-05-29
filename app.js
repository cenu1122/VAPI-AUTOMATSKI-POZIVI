const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const messageInput = document.getElementById("message");
const responseDiv = document.getElementById("response");
const statusDiv = document.getElementById("status");

let recognition;
let isSpeakingAI = false;
let currentSpeechUtterance = null;

// Provjera podrške za ugrađeni besplatni Speech-to-Text
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (!SpeechRecognition) {
    alert("Tvoj pretraživač ne podržava besplatni Speech-to-Text. Pokušaj u Google Chrome.");
} else {
    recognition = new SpeechRecognition();
    recognition.continuous = true; // Drži mikrofon stalno upaljenim
    recognition.interimResults = false; 
    recognition.lang = "en-US"; // Postavi na "bs-BA" ako tvoj AI model na backendu prihvata bosanski

    // Kada pretraživač završi procesuiranje tvog glasa u tekst
    recognition.onresult = async (event) => {
        const lastResultIndex = event.results.length - 1;
        const transcript = event.results[lastResultIndex][0].transcript.trim();
        
        if (transcript.length > 0) {
            messageInput.value = transcript;
            
            // LOGIKA PREKIDANJA (Vapi Style): Ako ti progovoriš dok AI još priča -> UGASI GOVOR ODMAH
            if (isSpeakingAI && speechSynthesis.speaking) {
                console.log("Korisnik je prekinuo AI. Zaustavljam audio...");
                speechSynthesis.cancel(); 
                isSpeakingAI = false;
                statusDiv.innerText = "Prekinuo si AI. Slušam te...";
                statusDiv.className = "status-listening";
            }

            // Šalji tekst na lokalni backend
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
        // Ako se mikrofon ugasi sam od sebe, ponovo ga pokreni da održiš živu vezu
        if (!stopBtn.disabled) {
            recognition.start();
        }
    };
}

// Slanje teksta na backend server
async function sendToBackend(textMessage) {
    statusDiv.innerText = "🤔 AI razmišlja...";
    statusDiv.className = "status-thinking";
    responseDiv.innerHTML = "Generišem odgovor...";

    try {
        // Dok testiraš lokalno, tvoj backend radi na localhost:3000
        const response = await fetch("http://localhost:3000/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: textMessage })
        });

        const data = await response.json();
        
        responseDiv.innerHTML = data.reply;
        
        // Pokreni glasovni odgovor
        speakAI(data.reply);

    } catch (error) {
        console.error("Greška pri spajanju na backend:", error);
        statusDiv.innerText = "❌ Greška: Provjeri da li ti je pokrenut backend server!";
        statusDiv.className = "status-idle";
    }
}

// Besplatan Text-to-Speech (Ugrađeni glas u pretraživaču)
function speakAI(text) {
    speechSynthesis.cancel(); // Očisti prethodni govor ako postoji

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

// Kontrole na klik dugmića
startBtn.addEventListener("click", () => {
    startBtn.disabled = true;
    stopBtn.disabled = false;
    recognition.start();
});

stopBtn.addEventListener("click", () => {
    startBtn.disabled = false;
    stopBtn.disabled = true;
    recognition.stop();
    speechSynthesis.cancel();
    isSpeakingAI = false;
    statusDiv.innerText = "Razgovor zaustavljen.";
    statusDiv.className = "status-idle";
});
