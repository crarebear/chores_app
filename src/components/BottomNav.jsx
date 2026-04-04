import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const BottomNav = () => {
    const navigate = useNavigate();
    const location = useLocation();
    
    // Map paths to activeTab logic
    const getActiveTab = () => {
        const path = location.pathname;
        if (path === '/chores' || path === '/') return 'chores';
        if (path === '/rewards') return 'rewards';
        if (path === '/leaderboard') return 'leaderboard';
        if (path === '/activity') return 'activity';
        if (path === '/profile') return 'profile';
        return '';
    };
    
    const activeTab = getActiveTab();

    const handleNavClick = (tab) => {
        if (tab === 'chores') navigate('/chores');
        else if (tab === 'rewards') navigate('/rewards');
        else if (tab === 'leaderboard') navigate('/leaderboard');
        else if (tab === 'activity') navigate('/activity');
        else if (tab === 'profile') navigate('/profile');
    };

    return (
        <div className="bottom-nav">
            <a href="#" className={`bottom-nav-item ${activeTab === 'chores' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); handleNavClick('chores'); }}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                Chores
            </a>
            <a href="#" className={`bottom-nav-item ${activeTab === 'rewards' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); handleNavClick('rewards'); }}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 12 20 22 4 22 4 12"></polyline><rect x="2" y="7" width="20" height="5"></rect><line x1="12" y1="22" x2="12" y2="7"></line><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"></path><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"></path></svg>
                Rewards
            </a>
            <a href="#" className={`bottom-nav-item ${activeTab === 'leaderboard' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); handleNavClick('leaderboard'); }}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline></svg>
                Leaders
            </a>
            <a href="#" className={`bottom-nav-item ${activeTab === 'activity' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); handleNavClick('activity'); }}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                Activity
            </a>
            <a href="#" className={`bottom-nav-item ${activeTab === 'profile' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); handleNavClick('profile'); }}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                Profile
            </a>
        </div>
    );
};

export default BottomNav;
