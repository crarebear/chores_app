import React, { useState, useRef, useEffect } from 'react';

const CustomDatePicker = ({ value, onChange, placeholder = "Select Date" }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [viewDate, setViewDate] = useState(value ? new Date(value + "T00:00:00") : new Date());
    const containerRef = useRef(null);

    // Close when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

    const handleMonthChange = (offset) => {
        const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + offset, 1);
        setViewDate(newDate);
    };

    const handleDateSelect = (day) => {
        const selectedDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
        const yyyy = selectedDate.getFullYear();
        const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
        const dd = String(selectedDate.getDate()).padStart(2, '0');
        onChange(`${yyyy}-${mm}-${dd}`);
        setIsOpen(false);
    };

    const renderCalendar = () => {
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        const totalDays = daysInMonth(year, month);
        const startDay = firstDayOfMonth(year, month);
        const monthName = viewDate.toLocaleString('default', { month: 'long' });

        const days = [];
        // Empty slots for previous month
        for (let i = 0; i < startDay; i++) {
            days.push(<div key={`empty-${i}`} className="calendar-day outside-month"></div>);
        }
        // Days of current month
        for (let d = 1; d <= totalDays; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const isActive = value === dateStr;
            const isToday = new Date().toDateString() === new Date(year, month, d).toDateString();
            
            days.push(
                <div 
                    key={d} 
                    className={`calendar-day ${isActive ? 'active' : ''} ${isToday ? 'today' : ''}`}
                    onClick={() => handleDateSelect(d)}
                >
                    {d}
                </div>
            );
        }

        return (
            <div className="calendar-modal-overlay" onClick={() => setIsOpen(false)}>
                <div className="calendar-popover" onClick={(e) => e.stopPropagation()}>
                    <div className="calendar-header">
                        <button type="button" className="calendar-nav-btn" onClick={() => handleMonthChange(-1)}>←</button>
                        <h4>{monthName} {year}</h4>
                        <button type="button" className="calendar-nav-btn" onClick={() => handleMonthChange(1)}>→</button>
                    </div>
                    <div className="calendar-grid">
                        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => (
                            <div key={d} className="calendar-day-label">{d}</div>
                        ))}
                        {days}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="custom-date-container" ref={containerRef}>
            <div className="date-input-wrapper" onClick={() => setIsOpen(!isOpen)}>
                <input 
                    type="text" 
                    readOnly 
                    value={value ? new Date(value + "T00:00:00").toLocaleDateString() : ""} 
                    placeholder={placeholder}
                />
                <div className="calendar-icon-overlay">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                </div>
            </div>
            {isOpen && renderCalendar()}
        </div>
    );
};

export default CustomDatePicker;
