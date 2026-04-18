import React, { useState, useEffect, useContext } from 'react';
import firebase, { db } from '../firebase';
import { AuthContext } from '../context/AuthContext';
import { 
    DndContext, 
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    TouchSensor,
    MouseSensor
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const ChoresPage = ({ openChoreModal, showToast }) => {
    const [activeSubTab, setActiveSubTab] = useState("assigned");
    const { userData } = useContext(AuthContext);
    const isParent = userData?.role === "parent";
    
    const renderChoresContent = () => {
        const pageProps = { openChoreModal, isParent, showToast };
        switch (activeSubTab) {
            case "unassigned": return <Chores {...pageProps} />;
            case "assigned": return <AssignedChores {...pageProps} />;
            case "recurring": return isParent ? <RecurringChoresManager {...pageProps} /> : <p>Only parents can manage recurring chores.</p>;
            default: return null;
        }
    };
    return (
        <div>
            <div className="sub-tab-bar">
                <div className={`sub-tab ${activeSubTab === "unassigned" ? "active" : ""}`} onClick={() => setActiveSubTab("unassigned")}>Unassigned</div>
                <div className={`sub-tab ${activeSubTab === "assigned" ? "active" : ""}`} onClick={() => setActiveSubTab("assigned")}>Assigned</div>
                {isParent && <div className={`sub-tab ${activeSubTab === "recurring" ? "active" : ""}`} onClick={() => setActiveSubTab("recurring")}>Recurring</div>}
            </div>
            <div>{renderChoresContent()}</div>
        </div>
    );
};

// Reorder Logic Array Move
const handleDragEndGlobal = async (event, currentChores, setLocalChores) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
        const oldIndex = currentChores.findIndex((c) => c.id === active.id);
        const newIndex = currentChores.findIndex((c) => c.id === over.id);
        
        const newArr = arrayMove(currentChores, oldIndex, newIndex);
        setLocalChores(newArr);

        const batch = db.batch();
        // Since we sort descending visually (newest highest by default),
        // we assign the order property starting from highest length down to 1.
        newArr.forEach((c, idx) => {
            const newOrder = newArr.length - idx;
            batch.update(db.collection("chores").doc(c.id), { order: newOrder });
        });
        
        try {
            await batch.commit();
        } catch (e) { console.error('Drag end commit failed', e); }
    }
};

const SortableChoreItem = (props) => {
    const { chore, isParent, openChoreModal, handleDeleteChore, handleAssignChore, handleCompleteChore, familyMembers, user, isAssignedList } = props;
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: chore.id });
    
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 100 : 'auto',
        opacity: isDragging ? 0.8 : 1,
        position: 'relative'
    };

    const isPastDue = chore.completeBy && new Date(chore.completeBy + "T00:00:00") <= new Date(new Date().setHours(0, 0, 0, 0));

    return (
        <li ref={setNodeRef} style={style} className={`list-item`} {...attributes} {...listeners}>
            <div className="item-details">
                <h4>{chore.title}</h4>
                <p>{chore.points} points {chore.room && `• ${chore.room}`}</p>
                {chore.completeBy && (
                    <p style={{ color: isPastDue ? 'var(--danger)' : 'inherit', fontWeight: isPastDue ? 'bold' : 'normal', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        {isPastDue && <span role="img" aria-label="overdue">⚠️</span>}
                        Complete by: {new Date(chore.completeBy + "T00:00:00").toLocaleDateString()}
                    </p>
                )}
                {isAssignedList && <p>Assigned to: {chore.assignedToDisplayName}</p>}
            </div>
            <div className="action-buttons" onPointerDown={(e) => e.stopPropagation()}>
                {isParent && <button className="edit-btn" onClick={() => openChoreModal(chore)}>Edit</button>}
                {isParent && <button className="delete-btn" onClick={() => handleDeleteChore(chore)}>Delete</button>}
                
                {!isAssignedList ? (
                    isParent && <select className="assign-select" value={chore.assignedTo || ""} onChange={(e) => handleAssignChore(chore, e.target.value)}><option value="">Assign To</option>{familyMembers.map(m => (<option key={m.uid} value={m.uid}>{m.displayName}</option>))}</select>
                ) : (
                    isParent && <select className="assign-select" value={chore.assignedTo} onChange={(e) => handleAssignChore(chore, e.target.value)}><option value="">Unassign</option>{familyMembers.map(m => (<option key={m.uid} value={m.uid}>{m.displayName}</option>))}</select>
                )}
                
                {(!isAssignedList || chore.assignedTo === user.uid) && <button className="complete-btn" onClick={() => handleCompleteChore(chore)}>Done</button>} 
            </div>
        </li>
    );
};

const Chores = ({ openChoreModal, isParent, showToast }) => {
    const { user, userData, familyMembers } = useContext(AuthContext);
    const [chores, setChores] = useState([]);
    
    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    useEffect(() => {
        if(!userData?.familyId) return;
        const unsubscribe = db.collection("chores")
            .where("familyId", "==", userData.familyId)
            .where("isComplete", "==", false)
            .where("assignedTo", "==", null)
            .onSnapshot(snapshot => { 
                let docs = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })); 
                docs.sort((a,b) => {
                    const orderA = a.order !== undefined ? a.order : (a.createdAt ? a.createdAt.toMillis() : 0);
                    const orderB = b.order !== undefined ? b.order : (b.createdAt ? b.createdAt.toMillis() : 0);
                    return orderB - orderA; // Descending
                });
                setChores(docs);
            });
        return () => unsubscribe();
    }, [userData?.familyId]);
    
    const handleDeleteChore = async (chore) => {
        if (isParent) {
            await db.collection("chores").doc(chore.id).delete();
            showToast("success", "Chore deleted!", () => { db.collection("chores").doc(chore.id).set(chore); });
        }
    };

    const handleAssignChore = async (chore, assignedToUid) => {
        if(!isParent) return;
        const member = familyMembers.find(m => m.uid === assignedToUid);
        const updateData = assignedToUid ? { assignedTo: assignedToUid, assignedToDisplayName: member.displayName } : { assignedTo: null, assignedToDisplayName: null };
        try { await db.collection("chores").doc(chore.id).update(updateData); showToast("success", "Chore assigned!"); } catch(e){}
    };

    const handleCompleteChore = async (chore) => {
        const userRef = db.collection("users").doc(user.uid);
        const choreRef = db.collection("chores").doc(chore.id);
        await db.runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userRef);
            transaction.update(userRef, { points: (userDoc.data()?.points || 0) + chore.points });
            transaction.update(choreRef, { isComplete: true, completedBy: user.uid, completedByEmail: user.email, completedAt: firebase.firestore.FieldValue.serverTimestamp() });
        });
        showToast("success", "Chore completed!");
    };

    return (
        <div>
            <h3 className="section-title">Unassigned Chores</h3>
            <p style={{fontSize:'0.8rem', color:'#aaa', textAlign:'center', marginTop:'-10px', marginBottom: '10px'}}>Hold to drag & reorder</p>
            {chores.length > 0 ? (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEndGlobal(e, chores, setChores)}>
                    <SortableContext items={chores.map(c=>c.id)} strategy={verticalListSortingStrategy}>
                        <ul className="list-group">
                            {chores.map((chore) => (
                                <SortableChoreItem 
                                    key={chore.id} chore={chore} isParent={isParent}
                                    openChoreModal={openChoreModal} handleDeleteChore={handleDeleteChore} 
                                    handleAssignChore={handleAssignChore} handleCompleteChore={handleCompleteChore}
                                    familyMembers={familyMembers} user={user} isAssignedList={false}
                                />
                            ))}
                        </ul>
                    </SortableContext>
                </DndContext>
            ) : ( <p className="no-tasks">No unassigned chores. Time to relax! 😴</p> )}
        </div>
    );
};

const AssignedChores = ({ openChoreModal, isParent, showToast }) => { 
    const { user, userData, familyMembers } = useContext(AuthContext); 
    const [assignedChores, setAssignedChores] = useState([]);
    const [filter, setFilter] = useState("mine"); 

    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    useEffect(() => {
        if (!userData?.familyId) return;
        const unsubscribe = db.collection("chores")
            .where("familyId", "==", userData.familyId)
            .where("isComplete", "==", false)
            .where("assignedTo", "!=", null)
            .onSnapshot(snapshot => {
                let docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); 
                docs.sort((a,b) => {
                    const orderA = a.order !== undefined ? a.order : (a.createdAt ? a.createdAt.toMillis() : 0);
                    const orderB = b.order !== undefined ? b.order : (b.createdAt ? b.createdAt.toMillis() : 0);
                    return orderB - orderA; 
                });
                setAssignedChores(docs);
        });
        return () => unsubscribe();
    }, [userData?.familyId]);

    const handleCompleteChore = async (chore) => {
        const userRef = db.collection("users").doc(user.uid); 
        const choreRef = db.collection("chores").doc(chore.id);
        await db.runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userRef);
            transaction.update(userRef, { points: (userDoc.data()?.points || 0) + chore.points });
            transaction.update(choreRef, { isComplete: true, completedBy: user.uid, completedByEmail: user.email, completedAt: firebase.firestore.FieldValue.serverTimestamp() });
        });
         showToast("success", "Chore completed!");
    };

    const handleDeleteChore = async (chore) => {
        if (isParent) { await db.collection("chores").doc(chore.id).delete(); showToast("success", "Chore deleted!"); }
    };
    
    const handleReassignChore = async (chore, assignedToUid) => {
        if(!isParent) return;
        const member = familyMembers.find(m => m.uid === assignedToUid);
        const updateData = assignedToUid ? { assignedTo: assignedToUid, assignedToDisplayName: member.displayName } : { assignedTo: null, assignedToDisplayName: null };
        await db.collection("chores").doc(chore.id).update(updateData);
         showToast("success", "Chore reassigned!");
    };

    const filteredChores = assignedChores.filter(chore => {
        if (filter === "all") return true; if (filter === "mine") return chore.assignedTo === user.uid; if (filter === "other") return chore.assignedTo !== user.uid; return true;
    });

    return (
        <div>
            <h3 className="section-title">Assigned Chores</h3>
            <p style={{fontSize:'0.8rem', color:'#aaa', textAlign:'center', marginTop:'-10px', marginBottom: '10px'}}>Hold to drag & reorder</p>
            <div className="filter-buttons">
                <button className={`filter-btn ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>All</button>
                <button className={`filter-btn ${filter === "mine" ? "active" : ""}`} onClick={() => setFilter("mine")}>Mine</button>
                <button className={`filter-btn ${filter === "other" ? "active" : ""}`} onClick={() => setFilter("other")}>Others</button>
            </div>
            {filteredChores.length > 0 ? (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEndGlobal(e, filteredChores, setAssignedChores)}>
                    <SortableContext items={filteredChores.map(c=>c.id)} strategy={verticalListSortingStrategy}>
                        <ul className="list-group">
                            {filteredChores.map((chore) => (
                                <SortableChoreItem 
                                    key={chore.id} chore={chore} isParent={isParent}
                                    openChoreModal={openChoreModal} handleDeleteChore={handleDeleteChore} 
                                    handleAssignChore={handleReassignChore} handleCompleteChore={handleCompleteChore}
                                    familyMembers={familyMembers} user={user} isAssignedList={true}
                                />
                            ))}
                        </ul>
                    </SortableContext>
                </DndContext>
            ) : (<p className="no-tasks">No chores match the current filter. 😴</p>)}
        </div>
    );
};

const RecurringChoresManager = ({ openChoreModal, showToast }) => {
    const { userData } = useContext(AuthContext); 
    const [recurringChores, setRecurringChores] = useState([]);
    
    useEffect(() => { 
        if (!userData?.familyId) return; 
        const unsubscribe = db.collection("recurring_chores").where("familyId", "==", userData.familyId).orderBy("createdAt", "desc").onSnapshot(snapshot => { 
            setRecurringChores(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }))); 
        }); 
        return () => unsubscribe(); 
    }, [userData?.familyId]);

    const handleDeleteClick = async (chore) => {
        await db.collection("recurring_chores").doc(chore.id).delete();
        showToast("success", "Recurring chore deleted!");
    };
    
    const getFrequencyDetails = (chore) => { if (chore.frequency === "weekly") return `Weekly on ${chore.dayOfWeek}`; if (chore.frequency === "monthly") return `Monthly on day ${chore.dayOfMonth}`; if (chore.frequency === "pickDays") return `On ${chore.pickedDays.join(", ")}`; return chore.frequency; };

    return (
        <div>
            <h3 className="section-title">Recurring Chore Templates</h3>
            {recurringChores.map(chore => ( 
                <li key={chore.id} className="list-item">
                    <div className="item-details">
                        <h4>{chore.title}</h4>
                        <p>{chore.points} points {chore.room && `• ${chore.room}`}</p>
                        <p>Frequency: {getFrequencyDetails(chore)}</p>
                        {chore.assignedToDisplayName && <p>Assigned to: {chore.assignedToDisplayName}</p>}
                    </div>
                    <div className="action-buttons">
                        <button className="edit-btn" onClick={() => openChoreModal(chore)}>Edit</button>
                        <button className="delete-btn" onClick={() => handleDeleteClick(chore)}>Delete</button>
                    </div>
                </li>
            ))}
            {recurringChores.length === 0 && <p className="no-tasks">No recurring chores defined yet.</p>}
        </div>
    );
};

export default ChoresPage;
