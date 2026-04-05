import React, { useState, useEffect, useContext } from 'react';
import firebase, { db } from '../firebase';
import { AuthContext } from '../context/AuthContext';
import CustomDatePicker from './CustomDatePicker';

const ChoreModal = ({ isOpen, setIsOpen, editingChore, showToast }) => {
    const { user, userData, familyMembers, familyData } = useContext(AuthContext);
    
    const [newChore, setNewChore] = useState("");
    const [pointsValue, setPointsValue] = useState(10);
    const [isRepeating, setIsRepeating] = useState(false);
    const [frequency, setFrequency] = useState("daily");
    const [dayOfWeek, setDayOfWeek] = useState("");
    const [dayOfMonth, setDayOfMonth] = useState("");
    const [assignedTo, setAssignedTo] = useState("");
    const [pickedDays, setPickedDays] = useState([]);
    const [room, setRoom] = useState("");
    const [completeBy, setCompleteBy] = useState("");

    const isParent = userData?.role === "parent";

    useEffect(() => {
        if (isOpen) {
            if (editingChore) {
                setNewChore(editingChore.title || ""); 
                setPointsValue(editingChore.points || 10); 
                setIsRepeating(!!editingChore.frequency); 
                setFrequency(editingChore.frequency || "daily"); 
                setDayOfWeek(editingChore.dayOfWeek || ""); 
                setDayOfMonth(editingChore.dayOfMonth || ""); 
                setAssignedTo(editingChore.assignedTo || ""); 
                setPickedDays(editingChore.pickedDays || []); 
                setRoom(editingChore.room || "");
                setCompleteBy(editingChore.completeBy || "");
            } else {
                setNewChore(""); 
                setPointsValue(10); 
                setIsRepeating(false); 
                setFrequency("daily"); 
                setDayOfWeek(""); 
                setDayOfMonth(""); 
                setAssignedTo(""); 
                setPickedDays([]); 
                setRoom("");
                setCompleteBy("");
            }
        }
    }, [isOpen, editingChore]);

    const resetFormAndCloseModal = () => {
        setIsOpen(false);
    };

    const handleChoreSubmit = async (e) => {
        e.preventDefault();
        if (!newChore.trim() || !isParent) return;
        
        const selectedAssignee = familyMembers.find(u => u.uid === assignedTo);
        const choreData = { 
            title: newChore,
            points: parseInt(pointsValue),
            room: room || null, 
            assignedTo: assignedTo || null, 
            assignedToEmail: selectedAssignee ? selectedAssignee.email : null,
            assignedToDisplayName: selectedAssignee ? selectedAssignee.displayName : null,
            addedBy: user.uid,
            addedByEmail: user.email, 
            familyId: userData.familyId,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        };

        const collectionName = isRepeating ? "recurring_chores" : "chores";
        const docRef = editingChore ? db.collection(collectionName).doc(editingChore.id) : db.collection(collectionName).doc();

        if (isRepeating) {
            Object.assign(choreData, { frequency, dayOfWeek, dayOfMonth, pickedDays });
        } else {
             Object.assign(choreData, { isComplete: false, isRecurring: false, completeBy: completeBy || null });
        }

        try {
            if(editingChore){ 
                await docRef.update(choreData); 
                showToast("success", "Chore updated!", () => {
                    docRef.set(editingChore);
                });
            } else { 
                await docRef.set(choreData);
                showToast("success", "Chore added!");
            }
        } catch (error) { 
            console.error(`Error saving chore:`, error);
            showToast("error", "Could not save chore.");
        }
        
        resetFormAndCloseModal();
    };

    const handleDayToggle = (day) => { setPickedDays(prevDays => prevDays.includes(day) ? prevDays.filter(d => d !== day) : [...prevDays, day]); };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={resetFormAndCloseModal}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>{editingChore ? "Edit Chore" : "Add New Chore"}</h3>
                    <button type="button" className="close-btn" onClick={resetFormAndCloseModal}>&times;</button>
                </div>
                <form onSubmit={handleChoreSubmit}>
                    <div className="input-group"><label>Title:</label><input type="text" value={newChore} onChange={(e) => setNewChore(e.target.value)} required /></div>
                    <div className="input-group"><label>Points:</label><input type="number" min="1" value={pointsValue} onChange={(e) => setPointsValue(e.target.value)} required /></div>
                    <div className="input-group"><label>Room:</label><select value={room} onChange={(e) => setRoom(e.target.value)}><option value="">Select Room</option>{(familyData?.rooms || []).map(r => <option key={r} value={r}>{r}</option>)}</select></div>
                    <div className="toggle-row" onClick={() => setIsRepeating(!isRepeating)}>
                        <div className="toggle-text">
                            <span className="toggle-title">Repeat Chore?</span>
                            <span className="toggle-desc">Create recurring entries for this task</span>
                        </div>
                        <div className={`toggle-switch ${isRepeating ? 'active' : ''}`}></div>
                    </div>

                    {!isRepeating && (
                        <div className="input-group">
                            <label>Complete By Date (Optional):</label>
                            <CustomDatePicker 
                                value={completeBy} 
                                onChange={(date) => setCompleteBy(date)} 
                                placeholder="Choose a deadline"
                            />
                        </div>
                    )}
                    {isRepeating && (
                        <>
                            <div className="input-group"><label>Frequency:</label><select value={frequency} onChange={(e) => setFrequency(e.target.value)}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="pickDays">Pick Days</option></select></div>
                            {frequency === "weekly" && (<div className="input-group"><label>Day:</label><select value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value)} required><option value="">Select Day</option>{["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map(day => <option key={day} value={day}>{day}</option>)}</select></div>)}
                            {frequency === "monthly" && (<div className="input-group"><label>Day:</label><input type="number" min="1" max="31" value={dayOfMonth} onChange={(e) => setDayOfMonth(e.target.value)} required /></div>)}
                            {frequency === "pickDays" && (<div className="input-group"><label>Days:</label><div className="day-picker">{["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map(day => (<div key={day}><input type="checkbox" id={`day-${day}`} checked={pickedDays.includes(day)} onChange={() => handleDayToggle(day)} /><label htmlFor={`day-${day}`}>{day.substring(0,3)}</label></div>))}</div></div>)}
                        </>
                    )}
                    <div className="input-group"><label>Assigned To:</label><select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}><option value="">Unassigned</option>{familyMembers.map(member => (<option key={member.uid} value={member.uid}>{member.displayName}</option>))}</select></div>
                    <button type="submit" className="full-width-button">{editingChore ? "Update Chore" : "Add Chore"}</button>
                </form>
            </div>
        </div>
    );
};

export default ChoreModal;
