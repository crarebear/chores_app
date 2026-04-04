import React, { useState } from 'react';
import firebase, { auth, db } from '../firebase';

        const LoginSignup = () => {
            const [isLogin, setIsLogin] = useState(true);
            const [email, setEmail] = useState("");
            const [password, setPassword] = useState("");
            const [error, setError] = useState("");
            const [pendingCred, setPendingCred] = useState(null);

            const handleSubmit = async (e) => {
                e.preventDefault();
                setError("");
                try {
                    if (isLogin) { 
                        const userCredential = await auth.signInWithEmailAndPassword(email, password);
                        if (pendingCred) {
                           await userCredential.user.linkWithCredential(pendingCred);
                           setPendingCred(null); 
                        }
                    } 
                    else {
                        const { user } = await auth.createUserWithEmailAndPassword(email, password);
                        const inviteQuery = await db.collection("invites").where("email", "==", email.toLowerCase()).limit(1).get();
                        
                        if (!inviteQuery.empty) {
                            // User has an invite, join the family
                            const invite = inviteQuery.docs[0].data();
                            await db.collection("users").doc(user.uid).set({ 
                                points: 0, 
                                email: user.email, 
                                displayName: (user.email.split("@")[0]),
                                familyId: invite.familyId,
                                role: "child",
                                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                                notificationPreferences: {
                                    newUnassignedChore: true,
                                    choreAssignedToMe: true,
                                    rewardRedeemed: true,
                                    rewardFulfilled: true,
                                },
                                onboardingComplete: true // They don't need parent onboarding
                            });
                            await db.collection("invites").doc(inviteQuery.docs[0].id).delete();
                        } else {
                            // No invite, this is a new parent starting a family
                            await db.collection("users").doc(user.uid).set({ 
                                points: 0, 
                                email: user.email, 
                                displayName: (user.email.split("@")[0]),
                                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                                notificationPreferences: {
                                    newUnassignedChore: true,
                                    choreAssignedToMe: true,
                                    rewardRedeemed: true,
                                    rewardFulfilled: true,
                                },
                                onboardingComplete: false // Trigger the onboarding wizard
                            });
                        }
                    }
                } catch (err) { setError(err.message); }
            };

            const handleGoogleSignIn = async () => {
                setError("");
                const provider = new firebase.auth.GoogleAuthProvider();
                try {
                    await auth.signInWithPopup(provider);
                } catch (err) {
                    if (err.code === "auth/account-exists-with-different-credential") {
                        setPendingCred(err.credential);
                        setEmail(err.customData.email);
                        setError("This email is already associated with an account. Please sign in with your password to link your Google Account.");
                    } else {
                        setError(err.message);
                    }
                }
            };

            return (
                <div className="auth-container">
                    <div className="auth-box">
                        <h2>{isLogin ? "Login" : "Sign Up"}</h2>
                        <button onClick={handleGoogleSignIn} className="google-btn">
                            <svg viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path><path fill="none" d="M0 0h48v48H0z"></path></svg>
                            <span>Sign in with Google</span>
                        </button>
                        <div className="auth-divider">OR</div>
                        <form onSubmit={handleSubmit} className="auth-form">
                            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                            <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                            <button type="submit">{isLogin ? "Login" : "Sign Up"}</button>
                            {error && <p style={{ color: "red", fontSize: "0.9rem" }}>{error}</p>}
                            <p className="auth-toggle" onClick={() => setIsLogin(!isLogin)}>{isLogin ? "Need an account? Sign Up" : "Already have an account? Login"}</p>
                        </form>
                    </div>
                </div>
            );
        };
        

export default LoginSignup;
