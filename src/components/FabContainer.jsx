import React, { useContext, useState, useEffect, useRef } from 'react';
import { AuthContext } from '../context/AuthContext';

const FabContainer = ({ setFeedbackModalOpen, openRewardModal, openChoreModal }) => {
    const { userData } = useContext(AuthContext);
    const isParent = userData?.role === "parent";
    const [isExpanded, setIsExpanded] = useState(false);
    const containerRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsExpanded(false);
            }
        };

        if (isExpanded) {
            document.addEventListener("mousedown", handleClickOutside);
        } else {
            document.removeEventListener("mousedown", handleClickOutside);
        }
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isExpanded]);

    return (
        <div className="fab-container" ref={containerRef}>
            <div className={`fab-options ${isExpanded ? 'expanded' : ''}`}>
                <button className="fab feedback-fab small-fab" onClick={() => { setFeedbackModalOpen(true); setIsExpanded(false); }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
                        <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 12h-2v-2h2v2zm0-4h-2V6h2v4z"/>
                    </svg>
                </button>
                {isParent && (
                    <>
                        <button className="fab add-reward-fab small-fab" onClick={() => { openRewardModal(); setIsExpanded(false); }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                                <path d="M2.5.5A.5.5 0 0 1 3 .5h10a.5.5 0 0 1 .5.5c0 .538-.012 1.05-.034 1.536a3 3 0 1 1-1.133 5.89c-.79 1.865-1.878 2.777-2.833 3.011v2.173l1.425.356c.194.048.377.135.537.255L13.3 15.1a.5.5 0 0 1-.3.9H3a.5.5 0 0 1-.3-.9l1.838-1.379c.16-.12.343-.207.537-.255L6.5 13.11v-2.173c-.955-.234-2.043-1.146-2.833-3.012a3 3 0 1 1-1.132-5.89A33.076 33.076 0 0 1 2.5.5zm.099 2.54a2 2 0 0 0 .72 3.935c-.333-1.05-.588-2.346-.72-3.935zm10.083 3.935a2 2 0 0 0 .72-3.935c-.133 1.59-.388 2.885-.72 3.935z"/>
                            </svg>
                        </button>
                        <button className="fab add-chore-fab small-fab" onClick={() => { openChoreModal(); setIsExpanded(false); }} style={{ fontSize: '1.5rem' }}>+</button>
                    </>
                )}
            </div>
            <button className="fab main-fab" onClick={() => setIsExpanded(!isExpanded)}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg" style={{ transition: 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)', transform: isExpanded ? 'rotate(135deg)' : 'rotate(0)' }}>
                    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                </svg>
            </button>
        </div>
    );
};

export default FabContainer;
