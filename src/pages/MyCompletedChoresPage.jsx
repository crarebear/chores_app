import React, { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import firebase, { db, functions } from '../firebase';
import { AuthContext } from '../context/AuthContext';

        const MyCompletedChoresPage = () => {
            const { user, userData } = useContext(AuthContext);
            const [completedChores, setCompletedChores] = useState([]);
            const [loading, setLoading] = useState(true);

            useEffect(() => {
                if (!user || !userData?.familyId) {
                    setLoading(false);
                    return;
                };
                setLoading(true);
                const unsubscribe = db.collection("chores")
                    .where("familyId", "==", userData.familyId)
                    .where("isComplete", "==", true)
                    .where("completedBy", "==", user.uid)
                    .orderBy("completedAt", "desc")
                    .onSnapshot(snapshot => {
                        setCompletedChores(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                        setLoading(false);
                    }, error => {
                        console.error("Error fetching completed chores:", error);
                        setLoading(false);
                    });

                return () => unsubscribe();
            }, [user, userData]);

            if (loading) return <p>Loading your completed chores...</p>;

            return (
                <div>
                    <h2 className="section-title">My Completed Chores</h2>
                    {completedChores.length > 0 ? (
                        <ul className="list-group">
                            {completedChores.map(chore => (
                                <li key={chore.id} className="list-item">
                                    <div className="item-details">
                                        <h4>{chore.title}</h4>
                                        <p>{chore.points} points earned</p>
                                        {chore.completedAt && (<p>Completed on: {new Date(chore.completedAt.toDate()).toLocaleString()}</p>)}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : ( <p className="no-tasks">You haven't completed any chores yet. Get to it!</p> )}
                </div>
            );
        };


export default MyCompletedChoresPage;
