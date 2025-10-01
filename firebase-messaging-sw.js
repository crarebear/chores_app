// Scripts for firebase and firebase messaging
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyC_DpYvpxImZ9EYp1Gfeh7Mi2E7SSZnhPE",
    authDomain: "mandel-chores.firebaseapp.com",
    projectId: "mandel-chores",
    storageBucket: "mandel-chores.appspot.com",
    messagingSenderId: "14121550108",
    appId: "1:14121550108:web:95bd14610e8032ce57fad9",
    measurementId: "G-BC16YJ8DGJ"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: 'https://placehold.co/192x192/6a0dad/ffffff?text=Chores' // Using an icon from your manifest
  };
});


// --- PWA Caching Logic (Corrected) ---
const CACHE_NAME = 'chore-tracker-cache-v2.99.38'; // <-- Increment this version on each deployment
const urlsToCache = [
  '/',
  '/index.html' 
];

// Install event: fires when the service worker is first installed.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache and caching essential files');
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting(); // Force the new service worker to become active
});

// Activate event: fires when the new service worker activates.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // If the cache name is not our current one, delete it.
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim(); // Take control of open clients
});


// Fetch event: fires for every network request.
self.addEventListener('fetch', event => {
  // Use a "Network First" strategy for the main HTML file
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // Use "Cache First" for other static assets (if any)
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request);
      }
    )
  );
});
