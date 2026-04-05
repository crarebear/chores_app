import React, { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import firebase, { db, functions } from '../firebase';
import { AuthContext } from '../context/AuthContext';

        const RewardsPage = ({ openRewardModal, showToast }) => {
            const { userData } = useContext(AuthContext);
            const isParent = userData.role === "parent";
            const [activeSubTab, setActiveSubTab] = useState("marketplace");
            
            const renderRewardsContent = () => {
                const pageProps = { isParent, showToast, openRewardModal };
                switch (activeSubTab) {
                    case "marketplace": return <Marketplace {...pageProps} />;
                    case "unfulfilled": return <UnfulfilledRewards {...pageProps} />;
                    case "fulfilled": return <RedeemedLog />;
                    default: return null;
                }
            };
            return (
                <div>
                    <div className="sub-tab-bar">
                        <div className={`sub-tab ${activeSubTab === "marketplace" ? "active" : ""}`} onClick={() => setActiveSubTab("marketplace")}>Marketplace</div>
                        <div className={`sub-tab ${activeSubTab === "unfulfilled" ? "active" : ""}`} onClick={() => setActiveSubTab("unfulfilled")}>My Rewards</div>
                        <div className={`sub-tab ${activeSubTab === "fulfilled" ? "active" : ""}`} onClick={() => setActiveSubTab("fulfilled")}>History</div>
                    </div>
                    <div>{renderRewardsContent()}</div>
                </div>
            );
        };


        const Marketplace = ({ isParent, showToast, openRewardModal }) => {
            const { user, userData } = useContext(AuthContext); 
            const [items, setItems] = useState([]);
            const [isCashModalOpen, setCashModalOpen] = useState(false);
            
            useEffect(() => {
                if(!userData.familyId) return;
                const unsubscribe = db.collection("marketplace_items").where("familyId", "==", userData.familyId).orderBy("cost", "asc").onSnapshot(snapshot => {
                    setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                });
                return () => unsubscribe();
            }, [userData.familyId]);

            const handlePurchase = async (item) => {
                const userRef = db.collection("users").doc(user.uid); 
                const purchasedRewardRef = db.collection("purchased_rewards").doc();
                await db.runTransaction(async (transaction) => {
                    const userDoc = await transaction.get(userRef);
                    if (!userDoc.exists || (userDoc.data()?.points || 0) < item.cost) { throw new Error("Not enough points!"); }
                    const newPoints = (userDoc.data().points || 0) - item.cost;
                    transaction.update(userRef, { points: newPoints });
                    transaction.set(purchasedRewardRef, { 
                        ...item, // copy all fields
                        purchasedBy: user.uid,
                        purchasedByDisplayName: userData.displayName, 
                        purchasedAt: firebase.firestore.FieldValue.serverTimestamp(), 
                        isFulfilled: false,
                        fulfilledAt: null, 
                    });
                    if (!item.isReusable) {
                        transaction.delete(db.collection("marketplace_items").doc(item.id));
                    }
                });
                showToast("success", "Reward purchased!", () => {
                    db.runTransaction(async (transaction) => {
                        const userDoc = await transaction.get(userRef);
                        const newPoints = (userDoc.data().points || 0) + item.cost;
                        transaction.update(userRef, { points: newPoints });
                        transaction.delete(purchasedRewardRef);
                        if (!item.isReusable) {
                            transaction.set(db.collection("marketplace_items").doc(item.id), item);
                        }
                    });
                });
            };
            
            const handleDelete = async (item) => {
                if (isParent) {
                    await db.collection("marketplace_items").doc(item.id).delete();
                    showToast("success", "Reward deleted!", () => {
                        db.collection("marketplace_items").doc(item.id).set(item);
                    });
                }
            };

            return (
                <div>
                    <h3 className="section-title">Marketplace</h3>
                    <ul className="list-group">
                         <li className="list-item card-special">
                            <div className="item-details">
                                <h4>Redeem for Cash</h4>
                                <p>Convert your points into real money!</p>
                            </div>
                            <div className="action-buttons">
                                <button className="btn-special" onClick={() => setCashModalOpen(true)}>Redeem</button>
                            </div>
                        </li>
                        {items.map(item => (
                            <li key={item.id} className="list-item">
                                <div className="item-details">
                                    <h4>{item.name}</h4>
                                    <p>{item.description}</p>
                                    <p>
                                        <span style={{ fontWeight: 'bold', color: 'var(--primary)' }}>{item.cost} points</span> 
                                        <span className={`tag ${item.isReusable ? 'tag-reusable' : 'tag-onetime'}`}>
                                            {item.isReusable ? "Reusable" : "One-Time"}
                                        </span>
                                    </p>
                                    <p style={{ fontSize: '0.85rem' }}>Provided by: {item.providerDisplayName}</p>
                                </div>
                                <div className="action-buttons">
                                    <button className="redeem-btn" onClick={() => handlePurchase(item)} disabled={userData.points < item.cost}>Redeem</button>
                                    {isParent && user.uid === item.providerId && (
                                        <>
                                            <button className="edit-btn" onClick={() => openRewardModal(item)}>Edit</button>
                                            <button className="delete-btn" onClick={() => handleDelete(item)}>Delete</button>
                                        </>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                    {items.length === 0 && <p className="no-tasks">No items in the marketplace yet.</p>}
                    {isCashModalOpen && <CashRedemptionModal isOpen={isCashModalOpen} setIsOpen={setCashModalOpen} showToast={showToast} />}
                </div>
            );
        };
        

        const UnfulfilledRewards = ({ isParent, showToast }) => {
            const { user, userData } = useContext(AuthContext);
            const [rewards, setRewards] = useState([]);

            useEffect(() => {
                if(!userData.familyId) return;
                const unsubscribe = db.collection("purchased_rewards").where("familyId", "==", userData.familyId).where("isFulfilled", "==", false).orderBy("purchasedAt", "desc")
                    .onSnapshot(snapshot => setRewards(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
                return () => unsubscribe();
            }, [userData.familyId]);

            const handleFulfill = async (rewardId) => {
                await db.collection("purchased_rewards").doc(rewardId).update({ isFulfilled: true, fulfilledAt: firebase.firestore.FieldValue.serverTimestamp() }); 
                 showToast("success", "Reward fulfilled!", () => {
                    db.collection("purchased_rewards").doc(rewardId).update({ isFulfilled: false, fulfilledAt: null });
                });
            };
            
            return (
                <div>
                    <h3 className="section-title" style={{marginTop: "30px"}}>Rewards to Fulfill</h3>
                     <ul className="list-group">
                        {rewards.filter(r => r.providerId === user.uid).map(reward => (
                            <li key={reward.id} className="list-item">
                                <div className="item-details">
                                    <h4>{reward.name}</h4><p>{reward.description}</p><p>{reward.cost} points</p>
                                    <p>Redeemed by: {reward.purchasedByDisplayName}</p>
                                </div>
                                <div className="action-buttons"><button className="fulfill-btn" onClick={() => handleFulfill(reward.id)}>Mark as Fulfilled</button></div>
                            </li>
                        ))}
                    </ul>
                </div>
            );
        };


        const RedeemedLog = () => {
            const { userData } = useContext(AuthContext);
            const [log, setLog] = useState([]);
            useEffect(() => { 
                if(!userData.familyId) return;
                const unsubscribe = db.collection("purchased_rewards").where("familyId", "==", userData.familyId).where("isFulfilled", "==", true).orderBy("fulfilledAt", "desc").onSnapshot(snapshot => { setLog(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))); }); return () => unsubscribe(); 
            }, [userData.familyId]);
            return (
                <div>
                    <h3 className="section-title">Fulfilled Rewards Log</h3>
                    <ul className="list-group">
                        {log.map(entry => (
                            <li key={entry.id} className="list-item">
                                <div className="item-details">
                                    <h4>{entry.name}</h4><p>{entry.description}</p><p>{entry.cost} points</p>
                                    <p>Redeemed by: <strong>{entry.purchasedByDisplayName}</strong></p>
                                    <p>Provided / Fulfilled by: <strong>{entry.providerDisplayName}</strong> on {entry.fulfilledAt?.toDate().toLocaleDateString()}</p>
                                </div>
                            </li>
                        ))}
                    </ul>
                    {log.length === 0 && <p className="no-tasks">No fulfilled rewards yet.</p>}
                </div>
            );
        };


export default RewardsPage;
