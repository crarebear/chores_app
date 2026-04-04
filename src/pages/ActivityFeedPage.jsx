import React, { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import firebase, { db, functions } from '../firebase';
import { AuthContext } from '../context/AuthContext';

        const ActivityFeedPage = () => {
            const { userData, familyMembers } = useContext(AuthContext);
            const [activities, setActivities] = useState([]);
            const [feedback, setFeedback] = useState({ type: "", message: "" });
            const [undoneActivityIds, setUndoneActivityIds] = useState([]);

            const showFeedback = (type, message) => {
                setFeedback({ type, message });
                setTimeout(() => setFeedback({ type: "", message: "" }), 3000);
            };

            useEffect(() => {
                if (!userData || !familyMembers || familyMembers.length === 0) return;
                
                const fetchActivityFeed = async () => {
                    try {
                        const getActivityFeed = functions.httpsCallable("getActivityFeed");
                        const result = await getActivityFeed();
                        const feedItems = result.data.activities.map(item => {
                            const member = familyMembers.find(m => m.uid === item.userId);
                            return {
                                ...item,
                                userDisplayName: member ? member.displayName : item.userDisplayName,
                                timestamp: item.timestamp ? new Date(item.timestamp) : null,
                            };
                        });
                        setActivities(feedItems);
                    } catch (error) {
                        console.error("Error fetching activity feed:", error);
                        showFeedback("error", "Could not load activity feed.");
                    }
                };

                fetchActivityFeed();
            }, [userData, familyMembers]);

            const handleUndoComplete = async (activity) => {
                if (undoneActivityIds.includes(activity.id) || userData.role !== "parent") return;

                try {
                    const undoChoreCompletion = functions.httpsCallable("undoChoreCompletion");
                    const result = await undoChoreCompletion({ 
                        choreId: activity.details.choreId,
                        completedByUid: activity.userId,
                        points: activity.details.points,
                        activityId: activity.id,
                     });

                    if (result.data.success) {
                        showFeedback("success", "Chore completion successfully undone!");
                        setUndoneActivityIds(prev => [...prev, activity.id]);
                    } else {
                        throw new Error(result.data.error || "Failed to undo chore.");
                    }
                } catch (error) {
                    console.error("Error calling undoChoreCompletion function:", error);
                    showFeedback("error", error.message || "An unknown error occurred.");
                }
            };
            
            const handleUndoPurchase = async (activity) => {
                if (userData.role !== "parent") return;

                try {
                    const undoRewardPurchase = functions.httpsCallable("undoRewardPurchase");
                    const result = await undoRewardPurchase({
                        rewardId: activity.details.rewardId,
                        redeemedByUid: activity.userId,
                        cost: activity.details.itemCost,
                        activityId: activity.id,
                    });

                    if (result.data.success) {
                        showFeedback("success", "Reward redemption successfully undone!");
                    } else {
                        throw new Error(result.data.error || "Failed to undo purchase.");
                    }
                } catch (error) {
                    console.error("Error calling undoRewardPurchase function:", error);
                    showFeedback("error", error.message || "An unknown error occurred.");
                }
            };

            const getIconForEvent = (eventType) => {
                switch (eventType) {
                    case "CHORE_COMPLETED": return "🏆";
                    case "CHORE_ADDED": return "📝";
                    case "REWARD_REDEEMED": return "🎁";
                    case "REWARD_FULFILLED": return "🤝";
                    case "REWARD_ADDED": return "🛍️";
                    case "USER_JOINED": return "🎉";
                    default: return "🔔";
                }
            };

            const renderActivityItem = (activity) => {
                const { userDisplayName, eventType, details, timestamp } = activity;
                const name = <strong>{userDisplayName}</strong>;
                let text = null;
                let undoAction = null;

                switch (eventType) {
                    case "CHORE_COMPLETED": 
                        text = <>{name} completed <strong>{details.title}</strong> for {details.points} pts.</>;
                        if (userData.role === "parent") {
                            const isUndone = undoneActivityIds.includes(activity.id);
                            undoAction = <button className="inline-undo-btn" onClick={() => handleUndoComplete(activity)} disabled={isUndone}>{isUndone ? "↻" : "Undo"}</button>;
                        }
                        break;
                    case "CHORE_ADDED": text = <>{name} added chore: {details.title}</>; break;
                    case "REWARD_REDEEMED": 
                        text = <>{name} bought <strong>{details.itemName}</strong> for {details.itemCost} pts.</>;
                        if (userData.role === "parent") {
                            undoAction = <button className="inline-undo-btn" onClick={() => handleUndoPurchase(activity)}>Undo</button>;
                        }
                        break;
                    case "REWARD_FULFILLED": text = <>{name} fulfilled {details.itemName} for {details.purchasedBy}.</>; break;
                    case "REWARD_ADDED": text = <>{name} added reward: {details.name}</>; break;
                    case "USER_JOINED": text = <>{name} joined the family!</>; break;
                    default: text = <>New event occurred.</>; break;
                }

                return (
                    <li key={activity.id} className="activity-item-compact">
                        <div className="activity-icon-compact">{getIconForEvent(eventType)}</div>
                        <div className="activity-content-compact">
                            <p className="activity-text">{text}</p>
                            <span className="activity-time">{timestamp ? new Date(timestamp).toLocaleString([], {month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'}) : "Just now"}</span>
                        </div>
                        {undoAction && <div className="activity-action-compact">{undoAction}</div>}
                    </li>
                );
            };
            
            return (
                <div>
                    <h2 className="section-title">Family Activity Feed</h2>
                     {feedback.message && ( <div className={`feedback-message ${feedback.type}`}>{feedback.message}</div> )}
                    <ul className="activity-feed-compact">
                        {activities.length > 0 ? activities.map((activity) => renderActivityItem(activity)) : <p className="no-tasks">No activity yet. Go complete a chore! 😴</p>}
                    </ul>
                </div>
            );
        };

export default ActivityFeedPage;
