import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { Eye, MoreVertical } from 'lucide-react';

// Use this Font Awesome CDN link to access social media icons like TikTok, YouTube, etc.
// This is placed outside the component to simulate a link tag in the head.
const FontAwesomeCDN = "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css";

// Global variables for Firebase configuration (provided by the Canvas environment)
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
const API_KEY = ""; // For fetch calls

// --- Data for Social Links ---
const socialLinks = [
    { title: "YouTube", tagline: "Support my Channel", url: "https://youtube.com/@siraw_edit?si=07fUM1T9E32G36PY", iconClass: "fab fa-youtube", color: "bg-red-600", iconColor: "text-white" },
    { title: "Discord", tagline: "DM for paid edits", url: "https://discord.gg/hQegert8", iconClass: "fab fa-discord", color: "bg-[#5865F2]", iconColor: "text-white" },
    { title: "Snapchat", tagline: "DM for paid edits", url: "https://snapchat.com/t/Obou4lAc", iconClass: "fab fa-snapchat", color: "bg-yellow-300", iconColor: "text-black" },
    { title: "Instagram", tagline: "Stay updated", url: "https://www.instagram.com/siraw._?igsh=cXo3ZTQ4dno1YW1i&utm_source=qr", iconClass: "fab fa-instagram", gradient: "bg-gradient-to-br from-[#833AB4] via-[#C13584] to-[#FD1D1D]", iconColor: "text-white" },
    { title: "NODNARB'S WHATSAPP GC", tagline: "WhatsApp Community • Free to join", url: "https://chat.whatsapp.com/HfIjTFyCLBbHVwRJhGw7Kc", isWhatsapp: true, color: "bg-[#25D366]", iconClass: "fab fa-whatsapp" },
];

// Top Bar Icons (TikTok, YouTube, Snapchat)
const topIcons = [
    { url: "https://www.tiktok.com/@siraw._?_r=1&_t=ZT-91Wa264mQCz", iconClass: "fab fa-tiktok", color: "text-white" },
    { url: "https://youtube.com/@siraw_edit?si=07fUM1T9E32G36PY", iconClass: "fab fa-youtube", color: "text-red-600" },
    { url: "https://snapchat.com/t/SGPDe1Rk", iconClass: "fab fa-snapchat", color: "text-yellow-300", shadow: "shadow-[0_0_10px_rgba(255,255,0,0.5)]" },
];

// Helper to get a unique visitor ID
function getUniqueVisitorId() {
    let visitorId = localStorage.getItem('siraw_unique_visitor_id');
    if (!visitorId) {
        visitorId = 'visitor_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
        localStorage.setItem('siraw_unique_visitor_id', visitorId);
    }
    return visitorId;
}

// --- Main App Component ---
const App = () => {
    // State for Firebase and Data
    const [viewCount, setViewCount] = useState(0);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [isPulsing, setIsPulsing] = useState(false);

    // Memoized Firestore Document Reference path
    const getCountDocRef = useCallback((firestoreDb) => {
        if (!firestoreDb) return null;
        return doc(firestoreDb, 'artifacts', appId, 'public', 'data', 'viewCounts', 'profile');
    }, []);

    // Memoized Visitor Reference path
    const getVisitorDocRef = useCallback((firestoreDb, visitorId) => {
        if (!firestoreDb) return null;
        return doc(firestoreDb, 'artifacts', appId, 'public', 'data', 'uniqueVisitors', visitorId);
    }, []);

    // 1. Firebase Initialization and Authentication
    useEffect(() => {
        try {
            const app = initializeApp(firebaseConfig);
            const firestoreDb = getFirestore(app);
            const firebaseAuth = getAuth(app);

            setDb(firestoreDb);
            setAuth(firebaseAuth);

            // Authentication listener
            const unsubscribeAuth = onAuthStateChanged(firebaseAuth, async (user) => {
                if (user) {
                    setIsAuthReady(true);
                } else if (initialAuthToken) {
                    await signInWithCustomToken(firebaseAuth, initialAuthToken);
                } else {
                    await signInAnonymously(firebaseAuth);
                }
            });

            return () => unsubscribeAuth();
        } catch (error) {
            console.error("Firebase Initialization Error:", error);
        }
    }, []);

    // 2. View Tracking Logic (Only runs once for new visitors)
    useEffect(() => {
        const trackPageView = async () => {
            if (!isAuthReady || !db) return;

            const visitorId = getUniqueVisitorId();
            const visitorsRef = getVisitorDocRef(db, visitorId);
            const countDocRef = getCountDocRef(db);

            try {
                const visitorSnap = await getDoc(visitorsRef);

                if (!visitorSnap.exists()) {
                    // New unique visitor: record and increment global count
                    const countSnap = await getDoc(countDocRef);
                    const currentCount = countSnap.exists() ? countSnap.data().count : 0;

                    // Atomically update the main count
                    await setDoc(countDocRef, { 
                        count: currentCount + 1,
                        lastUpdate: new Date().toISOString()
                    }, { merge: true });

                    // Record the unique visitor
                    await setDoc(visitorsRef, {
                        firstVisit: new Date().toISOString(),
                        userAgent: navigator.userAgent
                    });
                }
            } catch (error) {
                console.error("Error tracking view:", error);
            }
        };

        trackPageView();
    }, [isAuthReady, db, getCountDocRef, getVisitorDocRef]);

    // 3. Real-time View Count Listener
    useEffect(() => {
        if (!db || !isAuthReady) return;

        const docRef = getCountDocRef(db);

        // Set up real-time listener
        const unsubscribeSnapshot = onSnapshot(docRef, (doc) => {
            if (doc.exists()) {
                const newCount = doc.data().count || 0;
                
                // Only trigger pulse if the count actually changed
                if (newCount !== viewCount && viewCount !== 0) {
                    setIsPulsing(true);
                    setTimeout(() => setIsPulsing(false), 500);
                }

                setViewCount(newCount);
            } else {
                setViewCount(0);
            }
        }, (error) => {
            console.error("Error listening to view count:", error);
        });

        // Cleanup the listener on component unmount
        return () => unsubscribeSnapshot();
    }, [db, isAuthReady, getCountDocRef, viewCount]);
    
    // Custom style for the profile name gradient text effect
    const gradientTextStyles = useMemo(() => ({
        background: 'linear-gradient(90deg, #aaa, #fff, #aaa)',
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        color: 'transparent',
        textShadow: '0 0 10px rgba(255, 255, 255, 0.2)',
    }), []);

    // Fallback for video background loading
    useEffect(() => {
        const video = document.getElementById('background-video');
        if (video) {
            video.onerror = () => {
                document.body.style.background = 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, #0a0a0a 100%)';
            };
        }
    }, []);

    return (
        <div className="min-h-screen relative overflow-hidden font-inter text-white">
            {/* Load Font Awesome CSS for social icons */}
            <link rel="stylesheet" href={FontAwesomeCDN} />

            {/* Background Video (Using a generic placeholder URL) */}
            <video id="background-video" autoPlay muted loop className="fixed top-0 left-0 w-full h-full object-cover z-[-2] opacity-40">
                {/* Note: Local files like 'images/background.mp4' are not accessible. Using a placeholder description. */}
                <source src="https://example.com/placeholder-video.mp4" type="video/mp4" onError={(e) => { e.target.parentElement.style.display = 'none'; }} />
                Your browser does not support the video tag.
            </video>
            
            {/* Glow effects - Converted to Tailwind */}
            <div className="absolute w-[300px] h-[300px] bg-neutral-600/30 rounded-full blur-[80px] opacity-10 top-10 left-10 z-[-1]"></div>
            <div className="absolute w-[400px] h-[400px] bg-neutral-700/30 rounded-full blur-[80px] opacity-10 bottom-10 right-10 z-[-1]"></div>
            <div className="absolute w-[200px] h-[200px] bg-neutral-500/30 rounded-full blur-[80px] opacity-10 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[-1]"></div>
            
            {/* Overlay for better text readability */}
            <div className="fixed top-0 left-0 w-full h-full bg-gradient-to-br from-neutral-900/90 to-neutral-800/80 z-[-1]"></div>

            {/* Compact Eye Counter in Top Left Corner */}
            <div className="fixed top-4 left-4 flex items-center gap-2 bg-neutral-800/80 p-2 pl-3 pr-4 rounded-full backdrop-blur-md border border-neutral-700/50 shadow-lg z-50">
                <div className="p-1 rounded-full bg-neutral-700/50">
                    <Eye className="w-5 h-5 text-neutral-400" />
                </div>
                <div className={`font-semibold text-lg text-neutral-300 transition-transform duration-500 ${isPulsing ? 'animate-pulse' : ''}`} id="viewCount">
                    {viewCount.toLocaleString()}
                </div>
            </div>
            
            {/* Main Content Container */}
            <div className="container max-w-2xl mx-auto p-4 md:p-8 flex flex-col items-center min-h-screen">
                
                {/* Profile Header */}
                <header className="profile-header text-center w-full mt-12 mb-8 flex flex-col items-center">
                    <img 
                        src="https://placehold.co/180x180/444444/FFFFFF?text=Siraw+PFP" 
                        alt="Siraw Profile" 
                        className="w-[180px] h-[180px] rounded-full object-cover border-4 border-neutral-700 shadow-xl transition-transform duration-300 hover:scale-[1.02] mb-6"
                    />
                    <h1 className="text-5xl md:text-6xl font-extrabold mb-2 relative inline-block" style={gradientTextStyles}>
                        siraw
                        <span className="absolute bottom-[-5px] left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-neutral-400 to-transparent rounded-full"></span>
                    </h1>
                    <p className="text-lg md:text-xl text-neutral-400 mb-6">siraw a.k.a waris</p>
                </header>
                
                {/* Social Media Icons (Top Bar) */}
                <div className="flex justify-center gap-4 mb-10">
                    {topIcons.map((item, index) => (
                        <a 
                            key={index}
                            href={item.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className={`w-12 h-12 flex items-center justify-center rounded-full bg-neutral-800/80 backdrop-blur-sm border border-neutral-700/50 text-2xl transition-all duration-300 hover:scale-105 hover:shadow-xl ${item.color} ${item.shadow || ''}`}
                        >
                            <i className={item.iconClass}></i>
                        </a>
                    ))}
                </div>
                
                {/* Call to Action */}
                <div className="text-xl md:text-2xl font-bold text-white mb-8 text-center">
                    DM AND GET AN EDIT BELOW!
                </div>

                {/* Social Link Cards Section */}
                <div className="w-full flex flex-col gap-6 mb-12">
                    {socialLinks.map((link, index) => (
                        <a 
                            key={index}
                            href={link.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="w-full flex items-center p-3 md:p-4 rounded-[50px] bg-neutral-800/80 backdrop-blur-lg border-2 border-neutral-700/50 shadow-xl transition-all duration-300 hover:scale-[1.01] hover:shadow-2xl hover:border-neutral-500/50"
                        >
                            {/* Icon/Image Section */}
                            <div className={`w-12 h-12 md:w-14 md:h-14 flex items-center justify-center rounded-xl text-2xl font-bold flex-shrink-0 mr-4 ${link.gradient || link.color} ${link.iconColor || 'text-white'}`}>
                                {link.isWhatsapp ? (
                                    <img 
                                        src={link.imagePlaceholder || "https://placehold.co/50x50/25D366/FFFFFF?text=WA"} 
                                        alt={link.title} 
                                        className="w-full h-full rounded-xl object-cover" 
                                    />
                                ) : (
                                    <i className={link.iconClass}></i>
                                )}
                            </div>

                            {/* Info Section */}
                            <div className="flex flex-col flex-grow text-left truncate">
                                <h3 className="text-lg md:text-xl font-semibold text-white truncate">{link.title}</h3>
                                <p className="text-sm text-neutral-400 truncate">{link.tagline}</p>
                            </div>

                            {/* Options Icon (right side) */}
                            <div className="text-neutral-500 hover:text-white transition-colors duration-300 ml-4 hidden sm:block">
                                <MoreVertical className="w-6 h-6" />
                            </div>
                        </a>
                    ))}
                </div>
                
                {/* Footer */}
                <footer className="mt-auto pt-8 pb-4 w-full text-center">
                    <p className="text-neutral-400 mb-2 text-base">
                        MADE BY <a href="https://www.tiktok.com/@moonlight_kunn?_r=1&_t=ZT-91SbXXNovSB" target="_blank" rel="noopener noreferrer" className="text-neutral-300 hover:text-white transition-colors duration-300 font-medium">MOONLIGHT</a>
                    </p>
                    <p className="text-neutral-500 text-sm">
                        Contact dev if you want a link page like this: <a href="https://t.me/ECLIPSIATECHS_BOT" target="_blank" rel="noopener noreferrer" className="text-neutral-400 hover:text-white transition-colors duration-300">Telegram</a>
                    </p>
                </footer>
            </div>
        </div>
    );
};

export default App;