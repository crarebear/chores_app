const fs = require('fs');

const html = fs.readFileSync('index.backup.html', 'utf8');
const scriptStartToken = '<script type="text/babel">';
const scriptEndToken = '</script>';

const startIndex = html.indexOf(scriptStartToken);
if (startIndex === -1) process.exit(1);

const start = startIndex + scriptStartToken.length;
const end = html.indexOf(scriptEndToken, start);
const reactCode = html.substring(start, end);

let newCode = `import React, { useState, useEffect, useContext, createContext, useRef } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { db, auth, functions, initMessaging } from './firebase';

// Mock firebase namespace for legacy code that directly uses firebase.*
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
// Note: Some code uses firebase.firestore.FieldValue.serverTimestamp()
// We might need to handle this. Let's create a proxy for what's needed.
import { serverTimestamp } from 'firebase/firestore';

const firebaseMock = {
    firestore: {
        FieldValue: {
            serverTimestamp: () => serverTimestamp()
        }
    }
};
window.firebase = firebaseMock;

`;

// Remove the inline react extraction
let processedCode = reactCode.replace('const { useState, useEffect, useContext, createContext, useRef } = React;', '');

// Remove firebase config
processedCode = processedCode.replace(/const firebaseConfig = {[\s\S]*?measurementId: "G-BC16YJ8DGJ"\n        };/, '');
processedCode = processedCode.replace(/firebase\.initializeApp\(firebaseConfig\);/g, '');
processedCode = processedCode.replace(/const db = firebase\.firestore\(\);/g, '');
processedCode = processedCode.replace(/const auth = firebase\.auth\(\);/g, '');
processedCode = processedCode.replace(/const messaging = firebase\.messaging\(\);/g, '');
processedCode = processedCode.replace(/const functions = firebase\.functions\(\);/g, '');

// Replace setupNotifications since messaging is different
processedCode = processedCode.replace(/const setupNotifications = async \(user\) => {[\s\S]*?};/, `
const setupNotifications = async (user) => {
    const msg = initMessaging();
    if (!msg) return;
    try {
        if ('serviceWorker' in navigator) { 
            await navigator.serviceWorker.register("/firebase-messaging-sw.js");
        }
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
            const { getToken } = await import("firebase/messaging");
            const token = await getToken(msg);
            import("firebase/firestore").then(({ doc, updateDoc }) => updateDoc(doc(db, "users", user.uid), { fcmToken: token }));
        }
    } catch (error) { console.error("An error occurred while setting up notifications.", error); }
};
`);

// The last line of the script might be rendering the app:
// const root = ReactDOM.createRoot(document.getElementById('root'));
// root.render(<App />);
processedCode = processedCode.replace(/const root = ReactDOM\.createRoot\([\s\S]*?\([\s\S]*?<App \/>\n\s*\);/, 'export default App;');

newCode += processedCode;

fs.writeFileSync('src/App.jsx', newCode);
console.log('App.jsx created');
