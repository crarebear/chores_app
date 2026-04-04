import React, { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import firebase, { db, functions } from '../firebase';
import { AuthContext } from '../context/AuthContext';

        const FeedbackPage = () => {
            const { userData } = useContext(AuthContext);
            const [feedbackItems, setFeedbackItems] = useState([]);
            const [editingItem, setEditingItem] = useState(null);
            const [editText, setEditText] = useState("");
            const [activeSubTab, setActiveSubTab] = useState("open");

            useEffect(() => {
                const unsubscribe = db.collection("feedback").orderBy("createdAt", "desc").onSnapshot(snapshot => {
                    setFeedbackItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                });
                return () => unsubscribe();
            }, []);

            const handleStatusChange = async (id, newStatus) => {
                await db.collection("feedback").doc(id).update({ status: newStatus });
            };

            const handleDelete = async (id) => {
                if (window.confirm("Are you sure you want to delete this feedback?")) {
                    await db.collection("feedback").doc(id).delete();
                }
            };
            
            const handleEdit = (item) => {
                setEditingItem(item);
                setEditText(item.message || item.text);
            };

            const handleUpdate = async (e) => {
                e.preventDefault();
                if (!editText.trim()) return;
                await db.collection("feedback").doc(editingItem.id).update({ message: editText });
                setEditingItem(null);
                setEditText("");
            };
            
            const getStatusColor = (status) => {
                switch (status) {
                    case "new": return "#e7f3ff"; // soft light blue
                    case "in-progress": return "#fff4e5"; // soft light orange
                    case "done": return "#e8f5e9"; // soft light green
                    case "WAI": return "#f7f9fc"; // default grey
                    default: return "#f7f9fc";
                }
            };

            const filteredItems = feedbackItems.filter(item => {
                if (activeSubTab === "open") return ["new", "in-progress"].includes(item.status);
                if (activeSubTab === "closed") return ["done", "WAI"].includes(item.status);
                return true; // "all" tab
            });

            if (userData.role !== "parent") {
                return <p className="p-4 text-center">You do not have permission to view this page.</p>;
            }

            return (
                <div>
                    <div className="sub-tab-bar">
                        <div className={`sub-tab ${activeSubTab === "open" ? "active" : ""}`} onClick={() => setActiveSubTab("open")}>Open</div>
                        <div className={`sub-tab ${activeSubTab === "all" ? "active" : ""}`} onClick={() => setActiveSubTab("all")}>All</div>
                        <div className={`sub-tab ${activeSubTab === "closed" ? "active" : ""}`} onClick={() => setActiveSubTab("closed")}>Closed</div>
                    </div>

                    <ul className="list-group">
                        {filteredItems.map(item => (
                            <li key={item.id} className="list-item" style={{backgroundColor: getStatusColor(item.status)}}>
                                <div className="item-details">
                                    <p><strong>From:</strong> {item.userDisplayName || item.email || "Anonymous"} ({item.type})</p>
                                    <p className="my-2">{item.message || item.text}</p>
                                    <p className="text-xs text-gray-500">Submitted: {item.createdAt?.toDate().toLocaleString()}</p>
                                </div>
                                <div className="action-buttons">
                                    <select value={item.status} onChange={(e) => handleStatusChange(item.id, e.target.value)} className="assign-select">
                                        <option value="new">New</option>
                                        <option value="in-progress">In-progress</option>
                                        <option value="WAI">WAI</option>
                                        <option value="done">Done</option>
                                    </select>
                                    <button className="edit-btn" onClick={() => handleEdit(item)}>Edit</button>
                                    <button className="delete-btn" onClick={() => handleDelete(item.id)}>Delete</button>
                                </div>
                            </li>
                        ))}
                    </ul>
                     {filteredItems.length === 0 && <p className="no-tasks">No feedback items in this category.</p>}
                    {editingItem && (
                        <div className="modal-overlay" onClick={() => setEditingItem(null)}>
                            <div className="modal" onClick={(e) => e.stopPropagation()}>
                                <div className="modal-header"><h3>Edit Feedback</h3><button className="close-btn" onClick={() => setEditingItem(null)}>&times;</button></div>
                                <form onSubmit={handleUpdate}>
                                    <div className="input-group"><textarea value={editText} onChange={e => setEditText(e.target.value)} required rows="5" className="w-full"></textarea></div>
                                    <button type="submit" className="full-width-button">Update Feedback</button>
                                </form>
                            </div>
                        </div>
                    )}
                </div>
            );
        };
        

export default FeedbackPage;
