const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');
const content = fs.readFileSync(path.join(srcDir, 'App.jsx'), 'utf8');

function getBlock(name, nextName = null) {
    let s = content.indexOf(`        const ${name} =`);
    if (s === -1) s = content.indexOf(`const ${name} =`);
    
    let e = content.length;
    if (nextName) {
        const nextNames = Array.isArray(nextName) ? nextName : [nextName];
        let earliest = content.length;
        for (const nn of nextNames) {
            let ns = content.indexOf(`        const ${nn} =`);
            if (ns === -1) ns = content.indexOf(`const ${nn} =`);
            if (ns !== -1 && ns > s && ns < earliest) earliest = ns;
        }
        e = earliest;
    } else {
        const defaultEnd = content.indexOf('export default App;');
        if (defaultEnd !== -1 && defaultEnd > s) e = defaultEnd;
    }
    return content.substring(s, e).trimRight() + '\n\n';
}

const headerContext = `import React, { useState, useEffect, useContext, createContext, useRef } from 'react';\nimport firebase, { db, auth, functions, initMessaging } from '../firebase';\n\n`;
const headerPage = `import React, { useState, useEffect, useContext, useRef } from 'react';\nimport { useNavigate, useLocation } from 'react-router-dom';\nimport firebase, { db, functions } from '../firebase';\nimport { AuthContext } from '../context/AuthContext';\n\n`;

// 1. AuthContext.jsx
fs.writeFileSync(path.join(srcDir, 'context', 'AuthContext.jsx'),
    headerContext +
    getBlock('setupNotifications', 'getStartOfDay') +
    getBlock('getStartOfDay', 'generateRecurringChores') +
    getBlock('generateRecurringChores', 'AuthContext') +
    getBlock('AuthContext', 'AuthProvider') +
    getBlock('AuthProvider', 'OnboardingWizard') +
    getBlock('OnboardingWizard', 'LoginSignup') +
    `export { AuthContext, AuthProvider };\n`
);

// 2. LoginSignup.jsx
fs.writeFileSync(path.join(srcDir, 'pages', 'LoginSignup.jsx'),
    `import React, { useState } from 'react';\nimport firebase, { auth, db } from '../firebase';\n\n` +
    getBlock('LoginSignup', 'ActivityFeedPage') +
    `export default LoginSignup;\n`
);

// 3. ActivityFeedPage.jsx
fs.writeFileSync(path.join(srcDir, 'pages', 'ActivityFeedPage.jsx'),
    headerPage + getBlock('ActivityFeedPage', 'NotificationSettingsPage') + `export default ActivityFeedPage;\n`
);

// 4. NotificationSettingsPage.jsx
fs.writeFileSync(path.join(srcDir, 'pages', 'NotificationSettingsPage.jsx'),
    headerPage + getBlock('NotificationSettingsPage', 'LeaderboardPage') + `export default NotificationSettingsPage;\n`
);

// 5. LeaderboardPage.jsx
fs.writeFileSync(path.join(srcDir, 'pages', 'LeaderboardPage.jsx'),
    headerPage + getBlock('LeaderboardPage', 'MyCompletedChoresPage') + `export default LeaderboardPage;\n`
);

// 6. MyCompletedChoresPage.jsx
fs.writeFileSync(path.join(srcDir, 'pages', 'MyCompletedChoresPage.jsx'),
    headerPage + getBlock('MyCompletedChoresPage', 'ChoresPage') + `export default MyCompletedChoresPage;\n`
);

// 7. ChoresPage.jsx
fs.writeFileSync(path.join(srcDir, 'pages', 'ChoresPage.jsx'),
    headerPage + 
    content.substring(content.indexOf('        const ChoresPage ='), content.indexOf('        const RewardsPage =')) +
    `\nexport default ChoresPage;\n`
);

// 8. RewardsPage.jsx
fs.writeFileSync(path.join(srcDir, 'pages', 'RewardsPage.jsx'),
    headerPage + 
    content.substring(content.indexOf('        const RewardsPage ='), content.indexOf('        const ProfilePage =')) +
    `\nexport default RewardsPage;\n`
);

// 9. ProfilePage.jsx
fs.writeFileSync(path.join(srcDir, 'pages', 'ProfilePage.jsx'),
    headerPage + getBlock('ProfilePage', 'FeedbackPage') + `export default ProfilePage;\n`
);

// 10. FeedbackPage.jsx
fs.writeFileSync(path.join(srcDir, 'pages', 'FeedbackPage.jsx'),
    headerPage + getBlock('FeedbackPage', 'FeedbackModal') + `export default FeedbackPage;\n`
);

// 11. Modals
const headerModal = `import React, { useState, useContext } from 'react';\nimport firebase, { db } from '../firebase';\nimport { AuthContext } from '../context/AuthContext';\n\n`;

fs.writeFileSync(path.join(srcDir, 'components', 'FeedbackModal.jsx'),
    headerModal + getBlock('FeedbackModal', 'RewardModal') + `export default FeedbackModal;\n`
);
fs.writeFileSync(path.join(srcDir, 'components', 'RewardModal.jsx'),
    headerModal + getBlock('RewardModal', 'CashRedemptionModal') + `export default RewardModal;\n`
);
fs.writeFileSync(path.join(srcDir, 'components', 'CashRedemptionModal.jsx'),
    headerModal + getBlock('CashRedemptionModal', 'App') + `export default CashRedemptionModal;\n`
);

console.log("Slicing complete");
