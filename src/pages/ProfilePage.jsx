import React, { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import firebase, { db, functions } from '../firebase';
import { AuthContext } from '../context/AuthContext';

        const ProfilePage = ({ showToast }) => {
            const navigate = useNavigate();
            const { user, userData, familyMembers, familyData } = useContext(AuthContext); 
            const [displayName, setDisplayName] = useState(userData.displayName || ""); 
            const [newPassword, setNewPassword] = useState(""); 
            const [inviteEmail, setInviteEmail] = useState(""); 
            const [selectedColor, setSelectedColor] = useState(userData.userColor || "");
            const [familyName, setFamilyName] = useState(familyData?.name || "");
            const [cashMultiplier, setCashMultiplier] = useState(familyData?.cashConversionMultiplier || 4);
            const [rooms, setRooms] = useState(familyData?.rooms || []);
            const [newRoomName, setNewRoomName] = useState("");
            const [editingRoom, setEditingRoom] = useState({ index: null, name: '' });
            const isParent = userData.role === "parent";

            useEffect(() => {
                if (familyData) {
                    setFamilyName(familyData.name || "");
                    setCashMultiplier(familyData.cashConversionMultiplier || 4);
                    if (!familyData.rooms) {
                        const initialRooms = ["Kitchen", "Bedroom", "Bathroom", "Dining Room", "Upstairs Bathroom", "Upstairs Bedroom", "Backyard", "Living Room", "Alex's Office", "Back Bathroom", "Front Hallway"];
                        db.collection("families").doc(userData.familyId).update({ rooms: initialRooms });
                        setRooms(initialRooms);
                    } else {
                        setRooms(familyData.rooms);
                    }
                }
            }, [familyData, userData.familyId]);
            
            const handleUpdateProfile = async (e) => {
                e.preventDefault();
                try {
                    await db.collection("users").doc(user.uid).update({ 
                        displayName: displayName.trim(),
                        userColor: selectedColor,
                    }); 
                    showToast("success", "Profile updated!"); 
                } catch (error) { 
                    showToast("error", error.message); 
                }
            };

            const handleChangePassword = async (e) => { 
                e.preventDefault(); 
                if (newPassword.length < 6) { 
                    showToast("error", "Password must be at least 6 characters."); 
                    return; 
                } 
                try { 
                    await user.updatePassword(newPassword); 
                    setNewPassword(""); 
                    showToast("success", "Password changed!"); 
                } catch (error) { 
                    showToast("error", error.message); 
                } 
            };

            const handleSendInvite = async (e) => {
                e.preventDefault(); if (!inviteEmail.trim() || !isParent) return;
                try {
                    await db.collection("invites").add({ email: inviteEmail.toLowerCase(), familyId: userData.familyId, invitedBy: user.uid, invitedByEmail: user.email, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
                    setInviteEmail(""); 
                    showToast("success", `Invitation sent to ${inviteEmail}!`);
                } catch (error) { 
                    showToast("error", error.message); 
                }
            };
            
            const handleRoleChange = async (uid, newRole) => {
                if (isParent && uid !== user.uid) { // Parents can't change their own role
                    await db.collection("users").doc(uid).update({ role: newRole });
                    showToast("success", "Member role updated!");
                }
            };

            const handleUpdateFamilyName = async (e) => {
                e.preventDefault();
                if (!familyName.trim() || !isParent) return;
                try {
                    await db.collection("families").doc(userData.familyId).update({
                        name: familyName.trim()
                    });
                    showToast("success", "Family name updated!");
                } catch (error) {
                    showToast("error", "Could not update family name.");
                    console.error("Error updating family name:", error);
                }
            };
    
            const handleSendReminder = async (memberId) => {
                showToast("success", "Sending reminder...");
                try {
                    const sendChoreReminderToUser = functions.httpsCallable("sendChoreReminderToUser");
                    const result = await sendChoreReminderToUser({ userIdToRemind: memberId });
                    showToast("success", result.data.message);
                } catch (error) {
                    console.error("Error sending reminder:", error);
                    showToast("error", error.message || "Failed to send reminder.");
                }
            };
            
            const handleUpdateMultiplier = async (e) => {
                e.preventDefault();
                if (!isParent) return;
                try {
                    await db.collection("families").doc(userData.familyId).update({
                        cashConversionMultiplier: parseInt(cashMultiplier)
                    });
                    showToast("success", "Cash multiplier updated!");
                } catch (error) {
                    showToast("error", "Could not update multiplier.");
                }
            };

            const handleAddRoom = async () => {
                if (!newRoomName.trim()) return;
                const updatedRooms = [...rooms, newRoomName.trim()];
                await db.collection("families").doc(userData.familyId).update({ rooms: updatedRooms });
                setNewRoomName("");
                showToast("success", "Room added!");
            };

            const handleDeleteRoom = async (index) => {
                const roomToDelete = rooms[index];
                const updatedRooms = rooms.filter((_, i) => i !== index);
                await db.collection("families").doc(userData.familyId).update({ rooms: updatedRooms });
                showToast("success", "Room deleted!", () => {
                     const restoredRooms = [...updatedRooms];
                     restoredRooms.splice(index, 0, roomToDelete);
                     db.collection("families").doc(userData.familyId).update({ rooms: restoredRooms });
                });
            };

            const handleUpdateRoom = async () => {
                const updatedRooms = [...rooms];
                updatedRooms[editingRoom.index] = editingRoom.name;
                await db.collection("families").doc(userData.familyId).update({ rooms: updatedRooms });
                setEditingRoom({ index: null, name: '' });
                showToast("success", "Room updated!");
            };

            const handleMoveRoom = async (index, direction) => {
                const newIndex = direction === 'up' ? index - 1 : index + 1;
                if (newIndex < 0 || newIndex >= rooms.length) return;
                const updatedRooms = [...rooms];
                [updatedRooms[index], updatedRooms[newIndex]] = [updatedRooms[newIndex], updatedRooms[index]]; // Swap
                await db.collection("families").doc(userData.familyId).update({ rooms: updatedRooms });
            };
            
            const colors = ["#006D75", "#E0218A", "#FF6B6B", "#4ECDC4", "#45B7D1", "#F7D16A", "#FFA07A", "#98D8C8", "#8260C2", "#57E2E5"];
            return (
                <div>
                    <h2 className="section-title">My Profile</h2>
                    <button className="full-width-button" onClick={() => navigate('/settings')} style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', backgroundColor: 'var(--primary)', color: 'white', border: 'none' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                        Notification Settings
                    </button>
                    {isParent && (
                        <button className="full-width-button" onClick={() => navigate('/feedback')} style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', backgroundColor: 'var(--primary)', color: 'white', border: 'none' }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                                <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 12h-2v-2h2v2zm0-4h-2V6h2v4z"/>
                            </svg>
                            View User Feedback
                        </button>
                    )}
                    <div className="form-section">
                        <h3>Update Profile</h3>
                        <form onSubmit={handleUpdateProfile}>
                            <div className="input-group">
                                <label>Display Name:</label>
                                <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
                             </div>
                            <div className="input-group">
                                <label>My Color:</label>
                                <li className="list-item">
                                    <div className="color-palette">
                                        {colors.map(color => (
                                            <span
                                                key={color}
                                                className={`color-swatch${selectedColor === color ? " selected" : ""}`}
                                                style={{ backgroundColor: color }}
                                                onClick={() => setSelectedColor(color)}
                                            />
                                        ))}
                                    </div>
                                </li>
                                <li className="list-item">
                                    <input 
                                        type="color" 
                                        value={selectedColor || "#ffffff"} 
                                        onChange={(e) => setSelectedColor(e.target.value)}
                                        style={{ padding: "0", height: "40px", width: "50px", border: "1px solid #ccc", borderRadius: "6px", cursor: "pointer" }}
                                    />
                                    <input 
                                        type="text" 
                                        value={selectedColor} 
                                        onChange={(e) => setSelectedColor(e.target.value)}
                                        placeholder="e.g. #6a0dad"
                                    />
                                </li>
                            </div>
                             <button type="submit" className="full-width-button">Update Profile</button>
                        </form>
                    </div>

                    <div className="form-section"><h3>Change Password</h3><form onSubmit={handleChangePassword}><div className="input-group"><label>New Password:</label><input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required /><button type="submit">Change</button></div></form></div>
                    {isParent && (
                        <div className="form-section">
                            <h3>Family Management</h3>
                             <form onSubmit={handleUpdateFamilyName}>
                                <div className="input-group">
                                    <label>Family Name:</label>
                                    <input type="text" value={familyName} onChange={(e) => setFamilyName(e.target.value)} required />
                                    <button type="submit">Update</button>
                                </div>
                            </form>
                            <form onSubmit={handleUpdateMultiplier}>
                                <div className="input-group">
                                    <label>Cash Conversion (points per $1):</label>
                                    <input type="number" min="1" value={cashMultiplier} onChange={(e) => setCashMultiplier(e.target.value)} required />
                                    <button type="submit">Set</button>
                                </div>
                            </form>
                            
                            <h3 style={{marginTop: '30px'}}>Manage Rooms</h3>
                             <div className="input-group">
                                <input type="text" value={newRoomName} onChange={(e) => setNewRoomName(e.target.value)} placeholder="New room name" />
                                <button onClick={handleAddRoom}>Add Room</button>
                            </div>
                             <ul className="list-group" style={{marginTop: "20px"}}>
                                {rooms.map((room, index) => (
                                    <li key={index} className="list-item">
                                        {editingRoom.index === index ? (
                                            <>
                                                <input type="text" value={editingRoom.name} onChange={(e) => setEditingRoom({...editingRoom, name: e.target.value})} />
                                                <div className="action-buttons">
                                                    <button className="complete-btn" onClick={handleUpdateRoom}>Save</button>
                                                    <button className="delete-btn" onClick={() => setEditingRoom({index: null, name: ''})}>Cancel</button>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <span>{room}</span>
                                                <div className="action-buttons">
                                                    <button onClick={() => handleMoveRoom(index, 'up')} disabled={index === 0}>↑</button>
                                                    <button onClick={() => handleMoveRoom(index, 'down')} disabled={index === rooms.length - 1}>↓</button>
                                                    <button className="edit-btn" onClick={() => setEditingRoom({index, name: room})}>Edit</button>
                                                    <button className="delete-btn" onClick={() => handleDeleteRoom(index)}>Delete</button>
                                                </div>
                                            </>
                                        )}
                                    </li>
                                ))}
                            </ul>

                            <h3 style={{marginTop: '30px'}}>Family Members</h3>
                            <ul className="list-group" style={{marginTop: "20px"}}>
                                {familyMembers.map(member => (
                                    <li key={member.uid} className="list-item">
                                        <div className="item-details">
                                            <span>{member.displayName} ({member.role})</span>
                                        </div>
                                        <div className="action-buttons" style={{flexDirection: "row", alignItems: "center"}}>
                                            {member.role === "child" && <button className="assign-btn" style={{backgroundColor: "#ff9800"}} onClick={() => handleSendReminder(member.uid)}>Remind</button>}
                                            <select className="assign-select" value={member.role} onChange={e => handleRoleChange(member.uid, e.target.value)} disabled={member.uid === user.uid}>
                                                <option value="parent">Parent</option>
                                                <option value="child">Child</option>
                                            </select>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                            <form onSubmit={handleSendInvite} style={{marginTop: "20px"}}><div className="input-group"><label>Invite New Member:</label><input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required /><button type="submit">Send Invite</button></div></form>
                        </div>
                    )}
                </div>
            );
        };
        

export default ProfilePage;
