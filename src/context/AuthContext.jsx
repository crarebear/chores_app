import React, { useState, useEffect, useContext, createContext, useRef } from 'react';
import firebase, { db, auth, functions, initMessaging } from '../firebase';

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


        const getStartOfDay = (date) => { const d = new Date(date); d.setHours(0, 0, 0, 0); return d; };
        
        const generateRecurringChores = async (firestoreDb, familyId) => {
            if(!familyId) return;
            const now = new Date();
            const today = getStartOfDay(now);
            const lastCheckKey = `lastRecurringGenerationCheck_${familyId}`;
            const lastGenerationCheck = localStorage.getItem(lastCheckKey);
            if (lastGenerationCheck && getStartOfDay(new Date(lastGenerationCheck)).getTime() === today.getTime()) { return; }
            if (now.getHours() < 8) { return; }
            
            const recurringChoresRef = firestoreDb.collection("recurring_chores")
              .where("familyId", "==", familyId);
            const choresRef = firestoreDb.collection("chores");
            try {
                const snapshot = await recurringChoresRef.get();
                const batch = firestoreDb.batch();
                let choresGeneratedCount = 0;

                for (const doc of snapshot.docs) {
                    const recurringChore = { id: doc.id, ...doc.data() };
                    let shouldGenerate = false;
                    const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
                    const currentDayName = daysOfWeek[now.getDay()];

                    switch (recurringChore.frequency) {
                        case "daily": shouldGenerate = true; break;
                        case "weekly": if (currentDayName === recurringChore.dayOfWeek) { shouldGenerate = true; } break;
                        case "monthly": if (now.getDate() === recurringChore.dayOfMonth) { shouldGenerate = true; } break;
                        case "pickDays": if (recurringChore.pickedDays && recurringChore.pickedDays.includes(currentDayName)) { shouldGenerate = true; } break;
                    }

                    if (shouldGenerate) {
                        const dateString = now.toISOString().slice(0, 10);
                        const newChoreId = `${recurringChore.id}_${dateString}`;
                        
                        const choreDoc = await choresRef.doc(newChoreId).get();
                        if (choreDoc.exists) {
                            console.log(`Skipping generation for "${recurringChore.title}" because it has already been generated today.`);
                            continue;
                        }
                        
                        const newChore = {
                            ...recurringChore,
                            isComplete: false,
                            isRecurring: true,
                            recurringTemplateId: recurringChore.id,
                            createdAt: firebase.firestore.FieldValue.serverTimestamp()
                        };
                        delete newChore.id;
                        batch.set(choresRef.doc(newChoreId), newChore);
                        choresGeneratedCount++;
                    }
                }
                if (choresGeneratedCount > 0) { 
                    await batch.commit(); 
                    console.log(`${choresGeneratedCount} recurring chores generated for family ${familyId}.`);
                }
                localStorage.setItem(lastCheckKey, now.toISOString());
            } catch (error) { console.error("Error generating recurring chores:", error); }
        };

        const AuthContext = createContext(null);

        const AuthProvider = ({ children }) => {
            const [user, setUser] = useState(null);
            const [userData, setUserData] = useState(null);
            const [loading, setLoading] = useState(true);
            const [familyMembers, setFamilyMembers] = useState([]);
            const [familyData, setFamilyData] = useState(null);
            const notificationsInitialized = useRef(false);

            useEffect(() => {
                const unsubscribeAuth = auth.onAuthStateChanged(firebaseUser => {
                    setUser(firebaseUser);
                    notificationsInitialized.current = false;
                    if (firebaseUser) {
                        const userRef = db.collection("users").doc(firebaseUser.uid);
                        const unsubscribeUserDoc = userRef.onSnapshot(docSnap => {
                            if (docSnap.exists) {
                                const data = docSnap.data();
                                setUserData(data);
                                if(data.familyId){
                                    generateRecurringChores(db, data.familyId);
                                }
                                if (!notificationsInitialized.current) {
                                    setupNotifications(firebaseUser);
                                    notificationsInitialized.current = true;
                                }
                            } else {
                                userRef.set({ 
                                    points: 0, 
                                    email: firebaseUser.email, 
                                    displayName: (firebaseUser.displayName || firebaseUser.email.split("@")[0]),
                                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                                    notificationPreferences: {
                                        newUnassignedChore: true,
                                        choreAssignedToMe: true,
                                        rewardRedeemed: true,
                                        rewardFulfilled: true,
                                    },
                                    onboardingComplete: false,
                                }, { merge: true }); // *** THIS IS THE FIX ***
                            }
                            setLoading(false);
                        });
                        return () => unsubscribeUserDoc();
                    } else { 
                        setUserData(null);
                        setLoading(false);
                    }
                });
                return () => unsubscribeAuth();
            }, []);

            useEffect(() => {
                if(userData && userData.familyId){
                     const unsubscribe = db.collection("users").where("familyId", "==", userData.familyId).onSnapshot(snapshot => {
                        const members = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() })); 
                        setFamilyMembers(members);
                    });
                    return () => unsubscribe();
                } else {
                    setFamilyMembers([]);
                }
            }, [userData]);

            useEffect(() => {
                if (userData && userData.familyId) {
                    const familyRef = db.collection("families").doc(userData.familyId);
                    const unsubscribe = familyRef.onSnapshot(doc => {
                        if (doc.exists) {
                            setFamilyData({ id: doc.id, ...doc.data() });
                        } else {
                            setFamilyData(null);
                        }
                    });
                    return () => unsubscribe();
                } else {
                    setFamilyData(null);
                }
            }, [userData]);


            if (loading) { return <div className="auth-container"><div className="auth-box">Loading...</div></div>; }
            
            if (user && !userData) { return <div className="auth-container"><div className="auth-box">Loading user data...</div></div>; }
            
            if (user && userData && !userData.onboardingComplete && userData.role !== 'child') {
                return <OnboardingWizard user={user} />;
            }

            return ( <AuthContext.Provider value={{ user, userData, familyMembers, familyData }}>{children}</AuthContext.Provider> );
        };
        
        const OnboardingWizard = ({ user }) => {
            const [step, setStep] = useState(1);
            const [familyName, setFamilyName] = useState("");
            const [inviteEmail, setInviteEmail] = useState("");
            const [pendingInvites, setPendingInvites] = useState([]);
            const [choreTitle, setChoreTitle] = useState("");
            const [chorePoints, setChorePoints] = useState(10);
            const [familyId, setFamilyId] = useState(null);
            const [isSubmitting, setIsSubmitting] = useState(false);

            const handleCreateFamily = async () => {
                if (!familyName.trim()) return;
                setIsSubmitting(true);
                 try {
                    const createFamily = functions.httpsCallable("createFamily");
                    const result = await createFamily({ familyName: familyName.trim() });
                    if(result.data.familyId) {
                        setFamilyId(result.data.familyId);
                        setStep(2);
                    }
                } catch (error) {
                    console.error("Error creating family:", error);
                    alert("Error creating family. Please try again.");
                } finally {
                    setIsSubmitting(false);
                }
            };
            
            const handleSendInvite = async () => {
                if (!inviteEmail.trim() || !familyId) return;
                try {
                    await db.collection("invites").add({ 
                        email: inviteEmail.toLowerCase(), 
                        familyId, 
                        invitedBy: user.uid, 
                        invitedByEmail: user.email, 
                        createdAt: firebase.firestore.FieldValue.serverTimestamp() 
                    });
                    setPendingInvites([...pendingInvites, inviteEmail]);
                    setInviteEmail("");
                } catch (error) {
                    console.error("Error sending invite:", error);
                }
            };

            const handleCreateChore = async () => {
                if (!choreTitle.trim() || !familyId) return;
                try {
                    await db.collection("chores").add({
                        title: choreTitle,
                        points: parseInt(chorePoints),
                        familyId,
                        isComplete: false,
                        addedBy: user.uid,
                        addedByEmail: user.email,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    setStep(4);
                } catch (error) {
                    console.error("Error creating chore:", error);
                }
            };
            
            const handleFinish = async () => {
                 await db.collection("users").doc(user.uid).update({ onboardingComplete: true });
            };

            const renderStep = () => {
                switch(step) {
                    case 1:
                        return (
                            <div>
                                <h2>Welcome to Chore Tracker!</h2>
                                <p>Let's get your family set up. First, what's your family's name?</p>
                                <div className="input-group">
                                    <input type="text" placeholder="e.g., The Simpsons" value={familyName} onChange={(e) => setFamilyName(e.target.value)} disabled={isSubmitting} />
                                    <button onClick={handleCreateFamily} disabled={isSubmitting}>{isSubmitting ? "Creating..." : "Create Family"}</button>
                                </div>
                            </div>
                        );
                    case 2:
                        return (
                             <div>
                                <h2>Invite Your Family</h2>
                                <p>Send invites to family members so they can join in.</p>
                                <div className="input-group">
                                    <input type="email" placeholder="family.member@email.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
                                    <button onClick={handleSendInvite}>Send Invite</button>
                                </div>
                                {pendingInvites.length > 0 && <div><p>Invites sent to:</p><ul>{pendingInvites.map((email, i) => <li key={i}>{email}</li>)}</ul></div>}
                                <button className="full-width-button" onClick={() => setStep(3)}>Next</button>
                            </div>
                        );
                    case 3:
                        return (
                             <div>
                                <h2>Create Your First Chore</h2>
                                <p>Chores are tasks your family can complete to earn points.</p>
                                <div className="input-group"><label>Chore Title:</label><input type="text" value={choreTitle} onChange={e => setChoreTitle(e.target.value)} placeholder="e.g., Take out the trash" /></div>
                                <div className="input-group"><label>Points Value:</label><input type="number" value={chorePoints} onChange={e => setChorePoints(e.target.value)} /></div>
                                <button className="full-width-button" onClick={handleCreateChore}>Create Chore & Finish</button>
                                <p style={{textAlign: 'center', marginTop: '10px', fontSize: '0.9rem', color: '#666', cursor: 'pointer', textDecoration: 'underline'}} onClick={() => setStep(4)}>Skip for now</p>
                            </div>
                        );
                     case 4:
                        return (
                            <div>
                                <h2>You're All Set!</h2>
                                <p>Your family is ready to start tracking chores and earning rewards.</p>
                                <p><strong>Tip:</strong> You can add Rewards, customize Rooms, and set Cash Values later in your Profile settings.</p>
                                <button className="full-width-button" onClick={handleFinish}>Let's Go!</button>
                            </div>
                        );
                    default: return null;
                }
            };

            return (
                <div className="auth-container">
                    <div className="auth-box" style={{textAlign: 'left'}}>
                        {renderStep()}
                    </div>
                </div>
            )
        };



export { AuthContext, AuthProvider };
