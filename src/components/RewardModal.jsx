import React, { useState, useContext } from 'react';
import firebase, { db } from '../firebase';
import { AuthContext } from '../context/AuthContext';

        const RewardModal = ({ isOpen, setIsOpen, editingReward, showToast }) => {
            const { user, userData } = useContext(AuthContext);
            const [newItemName, setNewItemName] = useState("");
            const [newItemDesc, setNewItemDesc] = useState("");
            const [newItemCost, setNewItemCost] = useState(25);
            const [isReusable, setIsReusable] = useState(false);

            React.useEffect(() => {
                if (isOpen) {
                    if (editingReward) {
                        setNewItemName(editingReward.name || "");
                        setNewItemDesc(editingReward.description || "");
                        setNewItemCost(editingReward.cost || 25);
                        setIsReusable(editingReward.isReusable || false);
                    } else {
                        setNewItemName("");
                        setNewItemDesc("");
                        setNewItemCost(25);
                        setIsReusable(false);
                    }
                }
            }, [isOpen, editingReward]);

            const handleSubmit = async (e) => {
                e.preventDefault();
                if (!newItemName.trim() || !user || userData.role !== "parent") return;
                
                const rewardData = {
                    name: newItemName,
                    description: newItemDesc,
                    cost: parseInt(newItemCost),
                    isReusable: isReusable,
                    providerId: user.uid,
                    providerDisplayName: userData.displayName,
                    familyId: userData.familyId,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                };

                try {
                    if (editingReward) {
                        await db.collection("marketplace_items").doc(editingReward.id).update(rewardData);
                        showToast("success", "Reward updated!");
                    } else {
                        const docRef = await db.collection("marketplace_items").add({
                            ...rewardData,
                            createdAt: firebase.firestore.FieldValue.serverTimestamp()
                        });
                        showToast("success", "New reward added!", () => {
                            db.collection("marketplace_items").doc(docRef.id).delete();
                        });
                    }
                    setIsOpen(false);
                } catch (error) {
                    console.error("Error saving reward:", error);
                    showToast("error", "Could not save reward.");
                }
            };

            if (!isOpen) return null;

            return (
                <div className="modal-overlay" onClick={() => setIsOpen(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>{editingReward ? "Edit Reward" : "Add New Reward"}</h3>
                            <button className="close-btn" onClick={() => setIsOpen(false)}>&times;</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="input-group"><label>Name:</label><input type="text" value={newItemName} onChange={e => setNewItemName(e.target.value)} required /></div>
                            <div className="input-group"><label>Description:</label><textarea value={newItemDesc} onChange={e => setNewItemDesc(e.target.value)} rows="2"></textarea></div>
                            <div className="input-group"><label>Cost:</label><input type="number" min="1" value={newItemCost} onChange={e => setNewItemCost(e.target.value)} required /></div>
                            <div className="toggle-row" onClick={() => setIsReusable(!isReusable)}>
                                <div className="toggle-text">
                                    <span className="toggle-title">Reusable Reward</span>
                                    <span className="toggle-desc">Allow multiple purchases without disappearing</span>
                                </div>
                                <div className={`toggle-switch ${isReusable ? 'active' : ''}`}></div>
                            </div>
                            <button type="submit" className="full-width-button">
                                {editingReward ? "Update Reward" : "Add Reward"}
                            </button>
                        </form>
                    </div>
                </div>
            );
        };

export default RewardModal;
