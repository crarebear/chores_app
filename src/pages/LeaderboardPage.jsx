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
                <div className="table-responsive">
                    <table className="leaderboard-table">
                        <thead>
                            <tr>
                                <th>Rank</th>
                                <th>Name</th>
                                <th>Current</th>
                                <th>Total</th>
                                <th>Avg/Chore</th>
                                <th>Avg/Day</th>
                            </tr>
                        </thead>
                        <tbody>
                            {leaderboardData.map((user, index) => (
                                <tr key={user.uid} className={index === 0 ? "top-rank" : ""}>
                                    <td className="rank-cell">
                                        {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`}
                                    </td>
                                    <td className="name-cell"><strong>{user.displayName || user.email}</strong></td>
                                    <td className="highlight-points">{user.currentPoints}</td>
                                    <td>{user.totalPoints}</td>
                                    <td>{typeof user.avgPointsPerChore === 'number' ? user.avgPointsPerChore.toFixed(1) : user.avgPointsPerChore}</td>
                                    <td>{typeof user.avgChoresPerDay === 'number' ? user.avgChoresPerDay.toFixed(1) : user.avgChoresPerDay}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
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
