const CONFIG = {
    APP_NAME: "ΔChat",
    VERSION: "3.0.0",
    MAX_MESSAGE_LENGTH: 1000,
    DEFAULT_THEME: "midnight", 
    
    // Formatting
    DateFormat: { hour: 'numeric', minute: 'numeric', hour12: true },
    
    // Regex for link detection
    URL_REGEX: /(https?:\/\/[^\s]+)/g,

    // Firebase Configuration Object
    firebase: {
        apiKey: "AIzaSyBJGttWJwNx5JlW1knKY9Hr8wVXeuLcEsg",
        authDomain: "deltachat-a97e7.firebaseapp.com",
        projectId: "deltachat-a97e7",
        storageBucket: "deltachat-a97e7.firebasestorage.app",
        messagingSenderId: "315980620955",
        appId: "1:315980620955:web:c06a57f924ebf344dcd23e",
        measurementId: "G-6MGVSF60P3"
    }
};

// Initialize Firebase SDKs
firebase.initializeApp(CONFIG.firebase);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

Object.freeze(CONFIG);
console.log("ΔChat: Firebase Initialized");
