import React, { useState, useEffect, useContext, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import firebase, { db } from './firebase';

import { AuthProvider, AuthContext } from './context/AuthContext';
import LoginSignup from './pages/LoginSignup';
import ChoresPage from './pages/ChoresPage';
import MyCompletedChoresPage from './pages/MyCompletedChoresPage';
import RewardsPage from './pages/RewardsPage';
import LeaderboardPage from './pages/LeaderboardPage';
import ActivityFeedPage from './pages/ActivityFeedPage';
import NotificationSettingsPage from './pages/NotificationSettingsPage';
import FeedbackPage from './pages/FeedbackPage';
import ProfilePage from './pages/ProfilePage';
import BottomNav from './components/BottomNav';

import FeedbackModal from './components/FeedbackModal';
import RewardModal from './components/RewardModal';
import ChoreModal from './components/ChoreModal';
import FabContainer from './components/FabContainer';

const MainLayout = () => {
    const { user, userData } = useContext(AuthContext);
    const [notifications, setNotifications] = useState([]);
    const [showNotifications, setShowNotifications] = useState(false);
    
    // Toast and Modals
    const [toast, setToast] = useState({ message: "", type: "", onUndo: null });
    const [isChoreModalOpen, setChoreModalOpen] = useState(false);
    const [editingChore, setEditingChore] = useState(null);
    const [isRewardModalOpen, setRewardModalOpen] = useState(false);
    const [editingReward, setEditingReward] = useState(null);
    const [isFeedbackModalOpen, setFeedbackModalOpen] = useState(false);

    const notificationPanelRef = useRef(null);
    const notificationBellRef = useRef(null);
    
    const isParent = userData?.role === "parent";

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showNotifications && notificationPanelRef.current && !notificationPanelRef.current.contains(event.target) && notificationBellRef.current && !notificationBellRef.current.contains(event.target)) {
                setShowNotifications(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [showNotifications]);

    useEffect(() => {
        if (!user) return;
        const unsubscribe = db.collection("notifications").where("recipientUid", "==", user.uid).orderBy("createdAt", "desc").limit(20)
            .onSnapshot(snapshot => { setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))); });
        
        return () => unsubscribe();
    }, [user]);

    const unreadCount = notifications.filter(n => !n.isRead).length;

    const handleBellClick = async () => {
        const currentlyShowing = showNotifications;
        setShowNotifications(!currentlyShowing);
        if (!currentlyShowing && unreadCount > 0) {
            const batch = db.batch();
            notifications.forEach(notif => {
                if (!notif.isRead) {
                    const notifRef = db.collection("notifications").doc(notif.id);
                    batch.update(notifRef, { isRead: true });
                }
            });
            await batch.commit();
        }
    };

    const handleClearNotifications = async () => {
        if (notifications.length === 0) return;
        const batch = db.batch();
        notifications.forEach(notif => { batch.delete(db.collection("notifications").doc(notif.id)); });
        try { await batch.commit(); } catch (error) { console.error("Error clearing notifications:", error); }
    };

    const showToast = (type, message, onUndo = null) => {
        setToast({ type, message, onUndo });
        setTimeout(() => setToast({ message: "", type: "", onUndo: null }), 5000);
    };

    const openChoreModal = (choreToEdit = null) => {
        setEditingChore(choreToEdit);
        setChoreModalOpen(true);
    };

    const openRewardModal = (rewardToEdit = null) => {
        setEditingReward(rewardToEdit);
        setRewardModalOpen(true);
    };

    return (
        <div className="app-container">
            <header className="header">
                <h1>Chore Tracker</h1>
                <div className="notification-bell" onClick={handleBellClick} ref={notificationBellRef}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z"/></svg>
                    {unreadCount > 0 && <span className="notification-count">{unreadCount}</span>}
                </div>
                <div className="header-points-box" onClick={() => window.location.href='/rewards'}><p>Points</p><h2>{userData?.points || 0}</h2></div>
            </header>

            {showNotifications && (
                <div className="notification-panel" ref={notificationPanelRef}>
                    <div className="notification-list">
                        {notifications.length > 0 ? notifications.map(notif => ( <div key={notif.id} className="notification-item"><p>{notif.message}</p>{notif.createdAt && <small>{new Date(notif.createdAt.toDate()).toLocaleString()}</small>}</div> )) : <p className="no-notifications">No new notifications.</p>}
                    </div>
                    {notifications.length > 0 && ( <div className="notification-footer"><button className="clear-notifications-btn" onClick={handleClearNotifications}>Clear All</button></div> )}
                </div>
            )}

            <main className="content">
                <Routes>
                    <Route path="/chores" element={<ChoresPage openChoreModal={openChoreModal} showToast={showToast} />} />
                    <Route path="/rewards" element={<RewardsPage openRewardModal={openRewardModal} showToast={showToast} />} />
                    <Route path="/leaderboard" element={<LeaderboardPage />} />
                    <Route path="/activity" element={<ActivityFeedPage />} />
                    <Route path="/profile" element={<ProfilePage showToast={showToast} />} />
                    <Route path="/settings" element={<NotificationSettingsPage />} />
                    <Route path="/feedback" element={<FeedbackPage />} />
                    <Route path="/my-completed" element={<MyCompletedChoresPage />} />
                    <Route path="/" element={<Navigate to="/chores" replace />} />
                </Routes>
            </main>
            
            <FabContainer 
                setFeedbackModalOpen={setFeedbackModalOpen} 
                openRewardModal={openRewardModal} 
                openChoreModal={openChoreModal} 
            />

            <ChoreModal isOpen={isChoreModalOpen} setIsOpen={setChoreModalOpen} editingChore={editingChore} showToast={showToast} />
            {isFeedbackModalOpen && <FeedbackModal setIsOpen={setFeedbackModalOpen} />}
            {isParent && <RewardModal isOpen={isRewardModalOpen} setIsOpen={setRewardModalOpen} editingReward={editingReward} showToast={showToast} />}

            {toast.message && (
                <div style={{ position: "fixed", bottom: "80px", left: "50%", transform: "translateX(-50%)", zIndex: "2000", display: "flex", alignItems: "center", gap: "15px" }} className={`feedback-message ${toast.type === "success" ? "success" : "error"}`} >
                    <span>{toast.message}</span>
                    {toast.onUndo && (
                        <button onClick={() => { toast.onUndo(); setToast({ message: "", type: "", onUndo: null }); }} style={{ background: "transparent", border: "1px solid currentColor", color: "currentColor", padding: "4px 8px", borderRadius: "4px", cursor: "pointer", fontSize: "0.8rem" }}>Undo</button>
                    )}
                </div>
            )}
            
            <BottomNav />
        </div>
    );
};

const AppContent = () => {
    const { user, userData } = useContext(AuthContext);
    
    if (!user || !userData || !userData.onboardingComplete) {
        return <LoginSignup />;
    }

    return (
        <BrowserRouter>
            <MainLayout />
        </BrowserRouter>
    );
};

const App = () => {
    return (
        <AuthProvider>
            <AppContent />
        </AuthProvider>
    );
};

export default App;