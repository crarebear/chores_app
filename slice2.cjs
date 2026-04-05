const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');
const appLines = fs.readFileSync(path.join(srcDir, 'App.jsx'), 'utf8').split('\n');

const getLines = (start, end) => {
    // start and end are 1-indexed line numbers
    return appLines.slice(start - 1, end).join('\n') + '\n\n';
};

const headerContext = `import React, { useState, useEffect, useContext, createContext, useRef } from 'react';\nimport firebase, { db, auth, functions, initMessaging } from '../firebase';\n\n`;
const headerPage = `import React, { useState, useEffect, useContext, useRef } from 'react';\nimport { useNavigate, useLocation } from 'react-router-dom';\nimport firebase, { db, functions } from '../firebase';\nimport { AuthContext } from '../context/AuthContext';\n\n`;
const headerModal = `import React, { useState, useContext } from 'react';\nimport firebase, { db } from '../firebase';\nimport { AuthContext } from '../context/AuthContext';\n\n`;

// 1. AuthContext.jsx
fs.writeFileSync(path.join(srcDir, 'context', 'AuthContext.jsx'),
    headerContext + getLines(33, 334) + `export { AuthContext, AuthProvider };\n`
);

// 2. LoginSignup.jsx
fs.writeFileSync(path.join(srcDir, 'pages', 'LoginSignup.jsx'),
    `import React, { useState } from 'react';\nimport firebase, { auth, db } from '../firebase';\n\n` +
    getLines(335, 432) + `export default LoginSignup;\n`
);

// 3. ActivityFeedPage.jsx
fs.writeFileSync(path.join(srcDir, 'pages', 'ActivityFeedPage.jsx'),
    headerPage + getLines(433, 581) + `export default ActivityFeedPage;\n`
);

// 4. NotificationSettingsPage.jsx
fs.writeFileSync(path.join(srcDir, 'pages', 'NotificationSettingsPage.jsx'),
    headerPage + getLines(582, 629) + `export default NotificationSettingsPage;\n`
);

// 5. LeaderboardPage.jsx
fs.writeFileSync(path.join(srcDir, 'pages', 'LeaderboardPage.jsx'),
    headerPage + getLines(630, 709) + `export default LeaderboardPage;\n`
);

// 6. MyCompletedChoresPage.jsx
fs.writeFileSync(path.join(srcDir, 'pages', 'MyCompletedChoresPage.jsx'),
    headerPage + getLines(710, 758) + `export default MyCompletedChoresPage;\n`
);

// 7. ChoresPage.jsx
fs.writeFileSync(path.join(srcDir, 'pages', 'ChoresPage.jsx'),
    headerPage + 
    getLines(759, 784) +
    getLines(785, 863) +
    getLines(864, 955) +
    getLines(1101, 1143) +
    `export default ChoresPage;\n`
);

// 8. RewardsPage.jsx
fs.writeFileSync(path.join(srcDir, 'pages', 'RewardsPage.jsx'),
    headerPage + 
    getLines(956, 981) +
    getLines(982, 1064) +
    getLines(1065, 1100) +
    getLines(1144, 1169) +
    `export default RewardsPage;\n`
);

// 9. ProfilePage.jsx
fs.writeFileSync(path.join(srcDir, 'pages', 'ProfilePage.jsx'),
    headerPage + getLines(1170, 1434) + `export default ProfilePage;\n`
);

// 10. FeedbackPage.jsx
fs.writeFileSync(path.join(srcDir, 'pages', 'FeedbackPage.jsx'),
    headerPage + getLines(1435, 1536) + `export default FeedbackPage;\n`
);

// 11. Modals
fs.writeFileSync(path.join(srcDir, 'components', 'FeedbackModal.jsx'),
    headerModal + getLines(1537, 1588) + `export default FeedbackModal;\n`
);
fs.writeFileSync(path.join(srcDir, 'components', 'RewardModal.jsx'),
    headerModal + getLines(1589, 1636) + `export default RewardModal;\n`
);
fs.writeFileSync(path.join(srcDir, 'components', 'CashRedemptionModal.jsx'),
    headerModal + getLines(1637, 1728) + `export default CashRedemptionModal;\n`
);

console.log("Slicing complete using precise line numbers.");
