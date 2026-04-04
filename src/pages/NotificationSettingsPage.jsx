import React, { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import firebase, { db, functions } from '../firebase';
import { AuthContext } from '../context/AuthContext';

        const NotificationSettingsPage = () => {
            const { user, userData } = useContext(AuthContext);
            const [settings, setSettings] = useState(userData.notificationPreferences || {});
            const [feedback, setFeedback] = useState("");

            const handlePreferenceChange = async (key, value) => {
                const newSettings = { ...settings, [key]: value };
                setSettings(newSettings);

                try {
                    const userRef = db.collection("users").doc(user.uid);
                    await userRef.update({ [`notificationPreferences.${key}`]: value });
                    setFeedback("Settings saved!");
                    setTimeout(() => setFeedback(""), 2000);
                } catch (error) {
                    console.error("Error updating notification settings:", error);
                    setFeedback("Failed to save settings.");
                }
            };

            return (
                <div>
                    <h2 className="section-title">Notification Settings</h2>
                    <div className="form-section">
                        <ul className="settings-list">
                            <li className="settings-item">
                                <div className="settings-item-label"><strong>New Chores</strong><span>When a new, unassigned chore is added.</span></div>
                                <label className="toggle-switch"><input type="checkbox" checked={settings.newUnassignedChore} onChange={(e) => handlePreferenceChange("newUnassignedChore", e.target.checked)} /><span className="slider"></span></label>
                            </li>
                            <li className="settings-item">
                                <div className="settings-item-label"><strong>Chore Assignments</strong><span>When a chore is assigned to you.</span></div>
                                <label className="toggle-switch"><input type="checkbox" checked={settings.choreAssignedToMe} onChange={(e) => handlePreferenceChange("choreAssignedToMe", e.target.checked)} /><span className="slider"></span></label>
                            </li>
                            <li className="settings-item">
                                <div className="settings-item-label"><strong>My Rewards Redeemed</strong><span>When someone redeems a reward you provided.</span></div>
                                <label className="toggle-switch"><input type="checkbox" checked={settings.rewardRedeemed} onChange={(e) => handlePreferenceChange("rewardRedeemed", e.target.checked)} /><span className="slider"></span></label>
                            </li>
                            <li className="settings-item">
                                <div className="settings-item-label"><strong>My Rewards Fulfilled</strong><span>When a reward you redeemed is fulfilled.</span></div>
                                <label className="toggle-switch"><input type="checkbox" checked={settings.rewardFulfilled} onChange={(e) => handlePreferenceChange("rewardFulfilled", e.target.checked)} /><span className="slider"></span></label>
                            </li>
                        </ul>
                    </div>
                    {feedback && <p style={{textAlign: "center", color: "#6a0dad"}}>{feedback}</p>}
                </div>
            );
        };


export default NotificationSettingsPage;
