import firebase from "firebase/compat/app";
import "firebase/compat/firestore";
import "firebase/compat/auth";
import "firebase/compat/messaging";
import "firebase/compat/functions";

const firebaseConfig = {
    apiKey: "AIzaSyC_DpYvpxImZ9EYp1Gfeh7Mi2E7SSZnhPE",
    authDomain: "mandel-chores.firebaseapp.com",
    projectId: "mandel-chores",
    storageBucket: "mandel-chores.appspot.com",
    messagingSenderId: "14121550108",
    appId: "1:14121550108:web:95bd14610e8032ce57fad9",
    measurementId: "G-BC16YJ8DGJ"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

export const db = firebase.firestore();
export const auth = firebase.auth();
export const functions = firebase.functions();
export default firebase; // Export the default firebase namespace for compat usage

export const initMessaging = () => {
    try {
        if (typeof window !== "undefined" && "serviceWorker" in navigator) {
            return firebase.messaging();
        }
    } catch (e) {
        console.log("Messaging initialization failed", e);
    }
    return null;
};
