import React, { useState, useContext } from 'react';
import firebase, { db } from '../firebase';
import { AuthContext } from '../context/AuthContext';

        const RewardModal = ({ isOpen, setIsOpen, showToast }) => {
            const { user, userData } = useContext(AuthContext);
            const [newItemName, setNewItemName] = useState("");
            const [newItemDesc, setNewItemDesc] = useState("");
            const [newItemCost, setNewItemCost] = useState(25);

            const handleAddItem = async (e) => {
                e.preventDefault();
                if (!newItemName.trim() || !user || userData.role !== "parent") return;
                try {
                    const docRef = await db.collection("marketplace_items").add({
                        name: newItemName,
                        description: newItemDesc,
                        cost: parseInt(newItemCost),
                        providerId: user.uid,
                        providerDisplayName: userData.displayName,
                        familyId: userData.familyId,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    setNewItemName("");
                    setNewItemDesc("");
                    setNewItemCost(25);
                    setIsOpen(false);
                    showToast("success", "New reward added!", () => {
                        db.collection("marketplace_items").doc(docRef.id).delete();
                    });
                } catch (error) {
                    console.error("Error adding reward:", error);
                    showToast("error", "Could not add reward.");
                }
            };

            if (!isOpen) return null;

            return (
                <div className="modal-overlay" onClick={() => setIsOpen(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header"><h3>Add New Reward</h3><button className="close-btn" onClick={() => setIsOpen(false)}>&times;</button></div>
                        <form onSubmit={handleAddItem}>
                            <div className="input-group"><label>Name:</label><input type="text" value={newItemName} onChange={e => setNewItemName(e.target.value)} required /></div>
                            <div className="input-group"><label>Description:</label><textarea value={newItemDesc} onChange={e => setNewItemDesc(e.target.value)} rows="2"></textarea></div>
                            <div className="input-group"><label>Cost:</label><input type="number" min="1" value={newItemCost} onChange={e => setNewItemCost(e.target.value)} required /></div>
                            <button type="submit" className="full-width-button">Add Reward</button>
                        </form>
                    </div>
                </div>
            );
        };

export default RewardModal;
