import React, { useState, useContext } from 'react';
import firebase, { db } from '../firebase';
import { AuthContext } from '../context/AuthContext';

        const CashRedemptionModal = ({ isOpen, setIsOpen, showToast }) => {
            const { user, userData, familyData } = useContext(AuthContext);
            const [pointsToRedeem, setPointsToRedeem] = useState("");
            const [error, setError] = useState("");
            const cashMultiplier = familyData?.cashConversionMultiplier || 4;
            
            useEffect(() => {
                const points = parseInt(pointsToRedeem);
                if (pointsToRedeem && (isNaN(points) || points <= 0)) {
                    setError("Please enter a valid number of points.");
                } else if (points > userData.points) {
                    setError("You don't have enough points!");
                } else {
                    setError("");
                }
            }, [pointsToRedeem, userData.points]);


            const handlePurchase = async () => {
                if(error) return;

                const points = parseInt(pointsToRedeem);
                
                const userRef = db.collection("users").doc(user.uid);
                const purchasedRewardRef = db.collection("purchased_rewards").doc();
                const cashValue = (points / cashMultiplier).toFixed(2);

                try {
                    await db.runTransaction(async (transaction) => {
                        const userDoc = await transaction.get(userRef);
                        const newPoints = (userDoc.data()?.points || 0) - points;
                        transaction.update(userRef, { points: newPoints });
                        transaction.set(purchasedRewardRef, {
                            name: `Cash Redemption: $${cashValue}`,
                            description: `${points} points redeemed for cash.`,
                            cost: points,
                            purchasedBy: user.uid,
                            purchasedByDisplayName: userData.displayName,
                            familyId: userData.familyId,
                            purchasedAt: firebase.firestore.FieldValue.serverTimestamp(),
                            isFulfilled: false,
                            fulfilledAt: null,
                            providerId: 'CASH_REDEMPTION',
                            providerDisplayName: 'System'
                        });
                    });
                    showToast("success", `Redeemed ${points} points for $${cashValue}!`, () => {
                         db.runTransaction(async (transaction) => {
                            const userDoc = await transaction.get(userRef);
                            const newPoints = (userDoc.data()?.points || 0) + points;
                            transaction.update(userRef, { points: newPoints });
                            transaction.delete(purchasedRewardRef);
                        });
                    });
                    setPointsToRedeem("");
                    setIsOpen(false);
                } catch (e) {
                    showToast("error", "Failed to redeem points.");
                    console.error("Redemption error:", e);
                }
            };
            
            if (!isOpen) return null;

            const cashValue = pointsToRedeem && !error ? (parseInt(pointsToRedeem) / cashMultiplier).toFixed(2) : "0.00";

            return (
                 <div className="modal-overlay" onClick={() => setIsOpen(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header"><h3>Redeem for Cash</h3><button className="close-btn" onClick={() => setIsOpen(false)}>&times;</button></div>
                        <div>
                            <p>You have {userData.points} points. {cashMultiplier} points = $1.00.</p>
                            <div className="input-group">
                                <label>Points to redeem:</label>
                                <input 
                                    type="number" 
                                    value={pointsToRedeem}
                                    onChange={e => setPointsToRedeem(e.target.value)} 
                                    max={userData.points}
                                    min="1"
                                    placeholder="Enter points"
                                />
                            </div>
                            <p>Cash value: <strong>${cashValue}</strong></p>
                            {error && <div className="feedback-message error" style={{marginTop: '10px'}}>{error}</div>}
                            <button className="full-width-button" onClick={handlePurchase} disabled={!!error || !pointsToRedeem}>Confirm</button>
                        </div>
                    </div>
                </div>
            );
        };


export default CashRedemptionModal;
