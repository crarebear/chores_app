import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { functions } from '../firebase';

const LeaderboardPage = () => {
    const { userData, familyData } = useContext(AuthContext);
    const [leaderboardData, setLeaderboardData] = useState([]);
    const [roomStats, setRoomStats] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if(!userData) return;
        const fetchLeaderboard = async () => {
            setLoading(true);
            try {
                const getLeaderboardData = functions.httpsCallable("getLeaderboardData");
                const result = await getLeaderboardData();
                setLeaderboardData(result.data.leaderboardData);
                setRoomStats(result.data.roomStats);
            } catch (error) {
                console.error("Error fetching leaderboard:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchLeaderboard();
    }, [userData]);
    
    // Fallback colors if user doesn't have an explicit one
    const fallbackColors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6'];
    const hashCode = s => s.split('').reduce((a,b)=>{a=((a<<5)-a)+b.charCodeAt(0);return a&a},0);

    const getRoomCardStyle = (topUserDisplayName) => {
        if (!topUserDisplayName) return { backgroundColor: '#e2e8f0', color: '#64748b' };
        const topUser = leaderboardData.find(u => u.displayName === topUserDisplayName);
        
        let bgColor = '';
        if (topUser && topUser.userColor) {
            bgColor = topUser.userColor;
        } else {
            bgColor = fallbackColors[Math.abs(hashCode(topUserDisplayName)) % fallbackColors.length];
        }
        return { backgroundColor: bgColor, color: "white" };
    };

    if (loading) return <p className="loading-state">Loading leaderboard...</p>;

    return (
        <div className="leaderboard-container">
            <h2 className="section-title">Leaderboard</h2>
            
            <div className="leaderboard-section">
                <h3>Top Performers</h3>
                <div className="leaderboard-list">
                    {leaderboardData.map((user, index) => (
                        <div className={`performer-card ${index === 0 ? "top-rank-card" : ""}`} key={user.uid}>
                            <div className="performer-rank">
                                {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`}
                            </div>
                            <div className="performer-info">
                                <h4>{user.displayName || user.email}</h4>
                                <div className="performer-metrics">
                                    <div className="metric-box"><span className="metric-label">Current</span><strong className="metric-value highlight">{user.currentPoints}</strong></div>
                                    <div className="metric-box"><span className="metric-label">Total</span><strong className="metric-value">{user.totalPoints}</strong></div>
                                    <div className="metric-box"><span className="metric-label">Avg/Chore</span><strong className="metric-value">{typeof user.avgPointsPerChore === 'number' ? user.avgPointsPerChore.toFixed(1) : user.avgPointsPerChore}</strong></div>
                                    <div className="metric-box"><span className="metric-label">Avg/Day</span><strong className="metric-value">{typeof user.avgChoresPerDay === 'number' ? user.avgChoresPerDay.toFixed(1) : user.avgChoresPerDay}</strong></div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                {leaderboardData.length === 0 && <p className="no-data">No performers yet.</p>}
            </div>

            <div className="leaderboard-section">
                <h3>Room Dominance</h3>
                <div className="room-dominance-grid">
                    {familyData?.rooms && Object.entries(roomStats).map(([room, data]) => {
                        const style = getRoomCardStyle(data.topUser);
                        
                        return (
                            <div key={room} className="room-grid-card" style={style}>
                                <h4>{room}</h4>
                                <div className="card-spacer"></div>
                                <p className="room-leader-name">{data.topUser || "Unclaimed"}</p>
                                <span className="room-chore-count">{data.total} chores completed</span>
                            </div>
                        );
                    })}
                </div>
                {(!familyData?.rooms || Object.keys(roomStats).length === 0) && (
                    <p className="no-data">No room stats available.</p>
                )}
            </div>
        </div>
    );
};

export default LeaderboardPage;
