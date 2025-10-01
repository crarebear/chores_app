const admin = require("firebase-admin");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {
  onDocumentCreated,
  onDocumentUpdated,
} = require("firebase-functions/v2/firestore");
const {onCall, HttpsError} = require("firebase-functions/v2/https");

admin.initializeApp();

// --- NEW MIGRATION FUNCTION ---
/**
 * Migrates old documents to the new family data model.
 * Adds the user's familyId to any documents that are missing it.
 * @param {object} request The function request object.
 * @return {Promise<{success: boolean, message: string}>}
 */
exports.migrateDataToFamilyModel = onCall(async (request) => {
  console.log("Request Auth Object for migrateDataToFamilyModel:",
      request.auth);
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }
  const uid = request.auth.uid;
  const db = admin.firestore();

  const userDoc = await db.collection("users").doc(uid).get();
  const userData = userDoc.data();

  if (userData.role !== "parent" || !userData.familyId) {
    throw new HttpsError("permission-denied",
        "Only parents can run this migration.");
  }

  const familyId = userData.familyId;
  const collectionsToMigrate = [
    "chores", "recurring_chores", "marketplace_items",
    "purchased_rewards", "activity_feed",
  ];
  const promises = [];
  let updatedCount = 0;

  for (const collectionName of collectionsToMigrate) {
    // Fetch all documents and filter in the function
    const snapshot = await db.collection(collectionName).get();

    if (!snapshot.empty) {
      const batch = db.batch();
      snapshot.docs.forEach((doc) => {
        // If the familyId field does NOT exist, add it to the batch
        if (!doc.data().familyId) {
          batch.update(doc.ref, {familyId: familyId});
          updatedCount++;
        }
      });
      if (updatedCount > 0) {
        promises.push(batch.commit());
      }
    }
  }

  await Promise.all(promises);
  const message = `Migration complete. Updated ${updatedCount} documents.`;
  return {success: true, message: message};
});


/**
 * Creates a new family and assigns the calling user as the first parent.
 */
exports.createFamily = onCall(async (request) => {
  console.log("Request Auth Object for createFamily:", request.auth);
  const uid = request.auth.uid;
  const {familyName} = request.data;

  if (!uid) {
    throw new HttpsError("unauthenticated",
        "You must be logged in to create a family.");
  }
  if (!familyName || typeof familyName !== "string" ||
      familyName.trim().length === 0) {
    throw new HttpsError("invalid-argument",
        "A valid family name must be provided.");
  }

  const db = admin.firestore();
  const userRef = db.collection("users").doc(uid);
  const familyRef = db.collection("families").doc();

  try {
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      throw new HttpsError("not-found", "User document not found.");
    }
    if (userDoc.data().familyId) {
      throw new HttpsError("failed-precondition",
          "User is already in a family.");
    }

    const batch = db.batch();

    batch.set(familyRef, {
      name: familyName.trim(),
      creatorId: uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    batch.update(userRef, {
      familyId: familyRef.id,
      role: "parent",
    });

    await batch.commit();

    return {familyId: familyRef.id};
  } catch (error) {
    console.error("Error creating family:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal",
        "An unexpected error occurred while creating the family.");
  }
});

/**
 * Generates recurring chores for all families.
 * Scheduled to run daily at 7:00 AM Pacific Time.
 */
exports.generateDailyChores = onSchedule({
  schedule: "every day 07:00",
  timeZone: "America/Los_Angeles",
}, async (event) => {
  const db = admin.firestore();
  const now = new Date();
  const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday",
    "Friday", "Saturday"];
  const currentDayName = daysOfWeek[now.getDay()];
  const dateString = now.toISOString().slice(0, 10); // YYYY-MM-DD format

  const familiesSnapshot = await db.collection("families").get();
  if (familiesSnapshot.empty) {
    console.log("No families found.");
    return null;
  }

  const promises = familiesSnapshot.docs.map(async (familyDoc) => {
    const familyId = familyDoc.id;
    const recurringChoresRef = db.collection("recurring_chores")
        .where("familyId", "==", familyId);
    const choresRef = db.collection("chores");

    try {
      const snapshot = await recurringChoresRef.get();
      if (snapshot.empty) {
        return;
      }
      const batch = db.batch();
      let choresToGenerate = 0;

      for (const doc of snapshot.docs) {
        const recurringChore = {id: doc.id, ...doc.data()};
        let shouldGenerate = false;

        switch (recurringChore.frequency) {
          case "daily": shouldGenerate = true; break;
          case "weekly":
            if (currentDayName === recurringChore.dayOfWeek) {
              shouldGenerate = true;
            }
            break;
          case "monthly":
            if (now.getDate() === recurringChore.dayOfMonth) {
              shouldGenerate = true;
            }
            break;
          case "pickDays":
            if (recurringChore.pickedDays &&
              recurringChore.pickedDays.includes(currentDayName)) {
              shouldGenerate = true;
            }
            break;
        }

        if (shouldGenerate) {
          // Check for any existing incomplete chore from this template.
          const existingIncompleteQuery = choresRef
              .where("familyId", "==", familyId)
              .where("recurringTemplateId", "==", recurringChore.id)
              .where("isComplete", "==", false);

          const incompleteSnapshot = await existingIncompleteQuery.get();

          if (!incompleteSnapshot.empty) {
            console.log(`Skipping generation for "${recurringChore.title}" ` +
              `for family ${familyId} because an incomplete version ` +
              "already exists.");
            continue;
          }

          // Create a predictable, unique ID to prevent race
          // condition duplicates
          const newChoreId = `${recurringChore.id}_${dateString}`;
          const newChoreRef = choresRef.doc(newChoreId);

          const newChoreData = {
            ...recurringChore,
            isComplete: false,
            isRecurring: true,
            recurringTemplateId: recurringChore.id,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          };
          delete newChoreData.id;
          batch.set(newChoreRef, newChoreData);
          choresToGenerate++;
        }
      }

      if (choresToGenerate > 0) {
        await batch.commit();
        console.log(`${choresToGenerate} recurring chores generated` +
         ` for family ${familyId}.`);
      }
    } catch (error) {
      console.error("Error generating recurring chores for family " +
      `${familyId}:`, error);
    }
  });

  await Promise.all(promises);
  return null;
});


/**
 * Reverts a chore completion.
 */
exports.undoChoreCompletion = onCall(async (request) => {
  console.log("Request Auth Object for undoChoreCompletion:", request.auth);
  const {choreId, completedByUid, points, activityId} = request.data;
  const db = admin.firestore();

  if (!choreId || !completedByUid || points === undefined || !activityId) {
    throw new HttpsError( "invalid-argument",
        "Missing required data for the undo operation.");
  }

  try {
    const choreRef = db.collection("chores").doc(choreId);
    const userRef = db.collection("users").doc(completedByUid);
    const activityRef = db.collection("activity_feed").doc(activityId);

    await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) {
        throw new HttpsError("not-found", "User not found.");
      }
      const currentPoints = userDoc.data().points || 0;

      transaction.update(userRef, {points: currentPoints - points});
      transaction.update(choreRef, {
        isComplete: false,
        completedBy: null,
        completedByEmail: null,
        completedAt: null,
      });
      transaction.delete(activityRef);
    });

    return {success: true, message: "Chore completion undone successfully."};
  } catch (error) {
    console.error("Error undoing chore completion:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal",
        "An unexpected error occurred while undoing the chore.");
  }
});


/**
 * Reverts a reward redemption.
 */
exports.undoRewardPurchase = onCall(async (request) => {
  console.log("Request Auth Object for undoRewardPurchase:", request.auth);
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }
  const {rewardId, redeemedByUid, cost, activityId} = request.data;
  const db = admin.firestore();

  if (!rewardId || !redeemedByUid || cost === undefined || !activityId) {
    throw new HttpsError("invalid-argument",
        "Missing required data for the undo operation.");
  }

  const callerUid = request.auth.uid;
  const callerUserDoc = await db.collection("users").doc(callerUid).get();
  if (!callerUserDoc.exists || callerUserDoc.data().role !== "parent") {
    throw new HttpsError("permission-denied",
        "Only a parent can undo a reward purchase.");
  }

  try {
    const redeemedRewardRef = db.collection("purchased_rewards").doc(rewardId);
    const userRef = db.collection("users").doc(redeemedByUid);
    const activityRef = db.collection("activity_feed").doc(activityId);

    const redeemedRewardDoc = await redeemedRewardRef.get();
    if (!redeemedRewardDoc.exists) {
      throw new HttpsError("not-found", "Redeemed reward not found.");
    }

    const redeemedRewardData = redeemedRewardDoc.data();
    const batch = db.batch();

    // 1. Restore the user's points
    batch.update(userRef, {
      points: admin.firestore.FieldValue.increment(cost),
    });

    // 2. Put the item back on the marketplace
    const marketplaceItemRef = db.collection("marketplace_items").doc();
    batch.set(marketplaceItemRef, {
      name: redeemedRewardData.name,
      description: redeemedRewardData.description,
      cost: redeemedRewardData.cost,
      providerId: redeemedRewardData.providerId,
      providerDisplayName: redeemedRewardData.providerDisplayName,
      familyId: redeemedRewardData.familyId,
      createdAt: redeemedRewardData.createdAt,
    });

    // 3. Delete the redeemed reward document
    batch.delete(redeemedRewardRef);

    // 4. Delete the activity log entry
    batch.delete(activityRef);

    await batch.commit();

    return {success: true, message: "Reward purchase undone successfully."};
  } catch (error) {
    console.error("Error undoing reward purchase:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "An unexpected error occurred "+
      "while undoing the reward purchase.");
  }
});


// --- ACTIVITY LOGGING FUNCTIONS ---
exports.logChoreCompleted = onDocumentUpdated("chores/{choreId}",
    async (event) => {
      const before = event.data.before.data();
      const after = event.data.after.data();
      if (!before.isComplete && after.isComplete) {
        return admin.firestore().collection("activity_feed").add({
          eventType: "CHORE_COMPLETED",
          userId: after.completedBy,
          userDisplayName: after.completedByEmail.split("@")[0],
          familyId: after.familyId,
          details: {
            title: after.title,
            points: after.points,
            choreId: event.params.choreId,
            room: after.room || null,
          },
          timestamp: after.completedAt,
        });
      }
      return null;
    });

exports.logChoreAdded = onDocumentCreated("chores/{choreId}", (event) => {
  const chore = event.data.data();
  // Don't log the automatic creation of recurring chores
  if (chore.isRecurring) {
    return null;
  }
  return admin.firestore().collection("activity_feed").add({
    eventType: "CHORE_ADDED",
    userId: chore.addedBy,
    userDisplayName: chore.addedByEmail.split("@")[0],
    familyId: chore.familyId,
    details: {title: chore.title},
    timestamp: chore.createdAt,
  });
});

exports.logRewardAdded = onDocumentCreated("marketplace_items/{itemId}",
    (event) => {
      const reward = event.data.data();
      return admin.firestore().collection("activity_feed").add({
        eventType: "REWARD_ADDED",
        userId: reward.providerId,
        userDisplayName: reward.providerDisplayName,
        familyId: reward.familyId,
        details: {name: reward.name},
        timestamp: reward.createdAt,
      });
    });

exports.logRewardRedeemed = onDocumentCreated("purchased_rewards/{rewardId}",
    (event) => {
      const reward = event.data.data();
      return admin.firestore().collection("activity_feed").add({
        eventType: "REWARD_REDEEMED",
        userId: reward.purchasedBy,
        userDisplayName: reward.purchasedByDisplayName,
        familyId: reward.familyId,
        details: {
          itemName: reward.name, // Corrected from itemName
          itemCost: reward.cost, // Corrected from itemCost
          provider: reward.providerDisplayName,
          rewardId: event.params.rewardId,
        },
        timestamp: reward.purchasedAt,
      });
    });

exports.logRewardFulfilled = onDocumentUpdated("purchased_rewards/{rewardId}",
    (event) => {
      const before = event.data.before.data();
      const after = event.data.after.data();
      if (!before.isFulfilled && after.isFulfilled) {
        return admin.firestore().collection("activity_feed").add({
          eventType: "REWARD_FULFILLED",
          userId: after.providerId,
          userDisplayName: after.providerDisplayName,
          familyId: after.familyId,
          details: {
            itemName: after.name, // Corrected from itemName
            purchasedBy: after.purchasedByDisplayName,
          },
          timestamp: after.fulfilledAt,
        });
      }
      return null;
    });

exports.logUserJoined = onDocumentUpdated("users/{userId}", (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();

  if (!before.familyId && after.familyId) {
    return admin.firestore().collection("activity_feed").add({
      eventType: "USER_JOINED",
      userId: event.params.userId,
      userDisplayName: after.displayName || after.email.split("@")[0],
      familyId: after.familyId,
      details: {email: after.email},
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
  return null;
});


// --- NOTIFICATION FUNCTIONS ---
/**
 * Sends a push notification.
 * @param {string} uid The user ID of the recipient.
 * @param {string} preferenceKey The key for notification preferences.
 * @param {object} payload The FCM message payload.
 * @return {Promise|null} A promise that resolves when the message is sent.
 */
async function sendNotification(uid, preferenceKey, payload) {
  const userDoc = await admin.firestore().collection("users").doc(uid).get();
  if (!userDoc.exists) {
    return null;
  }
  const userData = userDoc.data();
  const prefs = userData.notificationPreferences || {};
  if (prefs[preferenceKey] === false) {
    return null;
  }
  if (userData.fcmToken) {
    return admin.messaging().send({...payload, token: userData.fcmToken});
  }
  return null;
}

exports.sendChoreReminders = onSchedule("every day 09:00", async () => {
  const twentyFourHoursAgo = new Date();
  twentyFourHoursAgo.setDate(twentyFourHoursAgo.getDate() - 1);
  const querySnapshot = await admin.firestore().collection("chores")
      .where("isComplete", "==", false)
      .where("assignedTo", "!=", null)
      .where("createdAt", "<",
          admin.firestore.Timestamp.fromDate(twentyFourHoursAgo))
      .get();
  if (querySnapshot.empty) {
    return null;
  }
  const promises = querySnapshot.docs.map((doc) => {
    const chore = doc.data();
    const payload = {
      notification: {
        title: "Chore Reminder! ⏰",
        body: `Don't forget, the chore "${chore.title}" is waiting for you!`,
      },
    };
    return sendNotification(chore.assignedTo, "choreAssignedToMe", payload);
  });
  return Promise.all(promises);
});

exports.sendNotificationOnChoreCreate = onDocumentCreated("chores/{choreId}",
    async (event) => {
      const chore = event.data.data();
      const creatorId = chore.addedBy;
      if (chore.assignedTo) {
        if (creatorId !== chore.assignedTo) {
          const payload = {
            notification: {
              title: "New Chore Assigned! ✅",
              body: `${chore.addedByEmail} assigned you: "${chore.title}"`,
            },
          };
          return sendNotification(chore.assignedTo, "choreAssignedToMe",
              payload);
        }
      } else {
        // Don't notify on automatic recurring chore creation
        if (chore.isRecurring) {
          return null;
        }
        const usersSnapshot = await admin.firestore().collection("users")
            .where("familyId", "==", chore.familyId).get();
        const promises = usersSnapshot.docs.map((doc) => {
          if (doc.id !== creatorId) {
            const payload = {
              notification: {
                title: "New Chore Available! ✨",
                body: `A new chore is available: "${chore.title}"`,
              },
            };
            return sendNotification(doc.id, "newUnassignedChore", payload);
          }
          return null;
        });
        return Promise.all(promises);
      }
      return null;
    });

exports.sendNotificationOnChoreAssign = onDocumentUpdated("chores/{choreId}",
    async (event) => {
      if (!event.data) return null;
      const before = event.data.before.data();
      const after = event.data.after.data();
      if (after.assignedTo && after.assignedTo !== before.assignedTo) {
        const payload = {
          notification: {
            title: "You've Been Assigned a Chore!",
            body: `The chore "${after.title}" has been assigned to you.`,
          },
        };
        return sendNotification(after.assignedTo, "choreAssignedToMe", payload);
      }
      return null;
    });

/**
 * Sends a notification when a reward is redeemed.
 */
exports.sendNotificationOnRewardRedeem = onDocumentCreated(
    "purchased_rewards/{rewardId}", async (event) => {
      if (!event.data) return null;
      const reward = event.data.data();
      const payload = {
        notification: {
          title: "Your Reward Was Redeemed! 🎁",
          body: `${reward.purchasedByDisplayName} redeemed:
              "${reward.name}"`, // Corrected from itemName
        },
      };
      return sendNotification(reward.providerId, "rewardRedeemed", payload);
    });

exports.sendNotificationOnRewardFulfill = onDocumentUpdated(
    "purchased_rewards/{rewardId}", async (event) => {
      if (!event.data) return null;
      const after = event.data.after.data();
      if (after.isFulfilled && !event.data.before.data().isFulfilled) {
        const payload = {
          notification: {
            title: "Your Reward Was Fulfilled! 🤝",
            body: `${after.providerDisplayName} has fulfilled: ` +
             `"${after.name}"`, // Corrected from itemName
          },
        };
        return sendNotification(after.purchasedBy, "rewardFulfilled", payload);
      }
      return null;
    });

exports.sendChoreReminderToUser = onCall(async (request) => {
  console.log("Request Auth Object for sendChoreReminderToUser:", request.auth);
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }
  const {userIdToRemind} = request.data;
  const callerUid = request.auth.uid;
  const db = admin.firestore();

  if (!userIdToRemind) {
    throw new HttpsError("invalid-argument", "Missing userIdToRemind.");
  }

  const callerDoc = await db.collection("users").doc(callerUid).get();
  const userToRemindDoc = await db.collection("users").
      doc(userIdToRemind).get();

  if (!callerDoc.exists || !userToRemindDoc.exists) {
    throw new HttpsError("not-found", "User not found.");
  }

  const callerData = callerDoc.data();
  const userToRemindData = userToRemindDoc.data();

  if (callerData.role !== "parent" ||
      callerData.familyId !== userToRemindData.familyId) {
    throw new HttpsError("permission-denied",
        "You don't have permission to send this reminder.");
  }

  const choresSnapshot = await db.collection("chores")
      .where("assignedTo", "==", userIdToRemind)
      .where("isComplete", "==", false)
      .get();

  if (choresSnapshot.empty) {
    return {
      success: true,
      message: "User has no pending chores to be reminded of.",
    };
  }

  const choreCount = choresSnapshot.size;
  const payload = {
    notification: {
      title: `${callerData.displayName} nudges you 👋`,
      body: `You have ${choreCount} incomplete chore` +
            `${choreCount > 1 ? "s" : ""}. Don't forget to complete them!`,
    },
  };

  await sendNotification(userIdToRemind, "choreAssignedToMe", payload);

  return {
    success: true,
    message: `Reminder sent to ${userToRemindData.displayName}!`,
  };
});

// --- DATA FETCHING FUNCTIONS ---
/**
 * Fetches the activity feed for the caller's family.
 * @param {object} request The function request object.
 * @return {Promise<{activities: object[]}>}
 */
exports.getActivityFeed = onCall(async (request) => {
  console.log("Request Auth Object for getActivityFeed:", request.auth);
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }
  const uid = request.auth.uid;
  const userDoc = await admin.firestore().collection("users").doc(uid).get();
  if (!userDoc.exists || !userDoc.data().familyId) {
    throw new HttpsError("failed-precondition", "User not in a family.");
  }
  const familyId = userDoc.data().familyId;

  try {
    const activitySnapshot = await admin.firestore()
        .collection("activity_feed")
        .where("familyId", "==", familyId)
        .orderBy("timestamp", "desc")
        .limit(50)
        .get();

    const activities = activitySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        timestamp: data.timestamp ?
          data.timestamp.toDate().toISOString() : null,
      };
    });
    return {activities};
  } catch (error) {
    console.error("Error fetching activity feed:", error);
    throw new HttpsError("internal", "Failed to fetch activity feed.");
  }
});

/**
 * Fetches leaderboard data for the caller's family.
 * @param {object} request The function request object.
 * @return {Promise<{leaderboardData: object[], roomStats: object}>}
 */
exports.getLeaderboardData = onCall(async (request) => {
  console.log("Request Auth Object for getLeaderboardData:", request.auth);
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }

  const uid = request.auth.uid;
  const db = admin.firestore();

  const userDoc = await db.collection("users").doc(uid).get();
  if (!userDoc.exists || !userDoc.data().familyId) {
    throw new HttpsError("failed-precondition", "User not in a family.");
  }
  const familyId = userDoc.data().familyId;

  try {
    const usersSnapshot = await db.collection("users")
        .where("familyId", "==", familyId).get();
    const users = {};
    usersSnapshot.forEach((doc) => {
      const data = doc.data();
      users[doc.id] = {
        uid: doc.id,
        displayName: data.displayName || data.email,
        currentPoints: data.points || 0,
        userColor: data.userColor || null, // <-- THE FIX IS HERE
        totalPoints: 0,
        choreCount: 0,
        firstChoreDate: null,
      };
    });

    const choresSnapshot = await db.collection("chores")
        .where("familyId", "==", familyId)
        .where("isComplete", "==", true).get();
    const roomStats = {};

    choresSnapshot.forEach((doc) => {
      const chore = doc.data();
      const completedBy = chore.completedBy;
      const completedAt = chore.completedAt ?
        chore.completedAt.toDate() : null;

      if (users[completedBy] && completedAt) {
        users[completedBy].totalPoints += chore.points;
        users[completedBy].choreCount += 1;
        if (
          !users[completedBy].firstChoreDate ||
          completedAt < users[completedBy].firstChoreDate
        ) {
          users[completedBy].firstChoreDate = completedAt;
        }
      }

      if (chore.room) {
        if (!roomStats[chore.room]) {
          roomStats[chore.room] = {total: 0, userCounts: {}};
        }
        roomStats[chore.room].total += 1;
        if (completedBy && users[completedBy]) {
          const count = roomStats[chore.room].userCounts[completedBy] || 0;
          roomStats[chore.room].userCounts[completedBy] = count + 1;
        }
      }
    });

    const leaderboardData = Object.values(users).map((user) => {
      const avgPoints = user.choreCount > 0 ?
        (user.totalPoints / user.choreCount).toFixed(1) : "0.0";
      let avgChoresPerDay = (0).toFixed(2);
      if (user.firstChoreDate) {
        const now = new Date();
        const startDate = user.firstChoreDate;
        const diffTime = Math.abs(now - startDate);
        const diffDays = Math.max(1, diffTime / (1000 * 60 * 60 * 24));
        avgChoresPerDay = (user.choreCount / diffDays).toFixed(2);
      }
      return {
        ...user,
        avgPointsPerChore: parseFloat(avgPoints),
        avgChoresPerDay: avgChoresPerDay,
      };
    });

    leaderboardData.sort((a, b) => b.totalPoints - a.totalPoints);

    const finalRoomStats = {};
    for (const room in roomStats) {
      if (Object.prototype.hasOwnProperty.call(roomStats, room)) {
        let topUser = null;
        let maxChores = 0;
        for (const u in roomStats[room].userCounts) {
          if (Object.prototype.hasOwnProperty.call(
              roomStats[room].userCounts, u)) {
            if (roomStats[room].userCounts[u] > maxChores) {
              maxChores = roomStats[room].userCounts[u];
              topUser = users[u] ? users[u].displayName : "Unknown";
            }
          }
        }
        finalRoomStats[room] = {
          total: roomStats[room].total,
          topUser: topUser,
        };
      }
    }
    return {leaderboardData, roomStats: finalRoomStats};
  } catch (error) {
    console.error("Error fetching leaderboard data:", error);
    throw new HttpsError("internal", "Failed to fetch leaderboard data.");
  }
});
