import React, { useState, useContext } from 'react';
import firebase, { db } from '../firebase';
import { AuthContext } from '../context/AuthContext';

        const FeedbackModal = ({ setIsOpen }) => {
            const { user, userData } = useContext(AuthContext);
            const [feedbackType, setFeedbackType] = useState("bug");
            const [message, setMessage] = useState("");
            const [isSubmitting, setIsSubmitting] = useState(false);
            const [submitStatus, setSubmitStatus] = useState({ state: "idle", text: "" });

            const handleSubmit = async (e) => {
                e.preventDefault();
                if (!message.trim() || !user || !userData) return;
                setIsSubmitting(true);
                try {
                    await db.collection("feedback").add({
                        type: feedbackType, 
                        message, 
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        userId: user.uid, 
                        email: user.email || "anonymous", 
                        userDisplayName: userData.displayName, 
                        userAgent: navigator.userAgent, 
                        status: "new",
                    });
                    setSubmitStatus({ state: "success", text: "Feedback submitted!" });
                    setTimeout(() => setIsOpen(false), 1500);
                } catch (error) {
                    console.error("Error submitting feedback:", error);
                    setSubmitStatus({ state: "error", text: "Submission failed." });
                } finally {
                    setIsSubmitting(false);
                }
            };
            
            return (
                <div className="modal-overlay" onClick={() => setIsOpen(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header"><h3>Submit Feedback</h3><button className="close-btn" onClick={() => setIsOpen(false)}>&times;</button></div>
                        <form onSubmit={handleSubmit}>
                            <div className="input-group" style={{marginBottom: "20px"}}>
                                <div style={{display: "flex", gap: "10px", width: "100%"}}>
                                    <button type="button" onClick={() => setFeedbackType("bug")} className={`filter-btn ${feedbackType === "bug" ? "active" : ""}`} style={{width: "50%"}}>🐛 Report a Bug</button>
                                    <button type="button" onClick={() => setFeedbackType("suggestion")} className={`filter-btn ${feedbackType === "suggestion" ? "active" : ""}`} style={{width: "50%"}}>💡 Suggest an Idea</button>
                                </div>
                            </div>
                            <div className="input-group"><textarea placeholder={feedbackType === "bug" ? "Please describe the bug..." : "What's your idea?"} value={message} onChange={e => setMessage(e.target.value)} required rows="5"></textarea></div>
                            <button type="submit" className="full-width-button" disabled={isSubmitting}>{isSubmitting ? "Submitting..." : "Submit"}</button>
                            {submitStatus.state !== "idle" && (<p className={`feedback-message ${submitStatus.state}`}>{submitStatus.text}</p>)}
                        </form>
                    </div>
                </div>
            );
        };


export default FeedbackModal;
