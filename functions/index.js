const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { timeEnd } = require('console');
admin.initializeApp();
const db = admin.firestore();
exports.checkPersonage = functions.https.onCall(async (data, context) => {
  const docRef = db.collection('coord').where('name', '==', data.name);
  let res = {};
  try {
    const snap = await docRef.get();
    let doc = snap.docs[0];
    let coordinates = doc.data().coordinates;
    if (!doc.exists) {
      res = { data: 'document not Found' };
    } else if (
      data.coordinates[0] >= coordinates.startX &&
      data.coordinates[0] <= coordinates.endX &&
      data.coordinates[1] >= coordinates.startY &&
      data.coordinates[1] <= coordinates.endY
    ) {
      const matchRef = db.collection('matchs').doc(data.id);
      const matchDoc = await matchRef.get();
      const newPersonages = matchDoc.data().personages;
      newPersonages[data.name] = true;
      await matchRef.update({
        personages: newPersonages,
      });
      const win = await checkWin(data.id);
      if (win) {
        await matchRef.set(
          {
            end: admin.firestore.Timestamp.now(),
          },
          { merge: true },
        );
        res.miliseconds = await getTime(data.id);
        res.isTopTen = await isTopTen(res.miliseconds);
      }
      res.data = true;
    } else {
      res.data = false;
    }
  } catch (err) {
    res.data = 'Error getting document' + err;
  }
  return res;
});
exports.newMatch = functions.https.onCall(async (data, context) => {
  let personages;
  let start;
  try {
    personages = data.personages.reduce((a, b) => ((a[b] = false), a), {});
  } catch (err) {
    return 'wrong personages list';
  }
  try {
    start = admin.firestore.Timestamp.now();
  } catch (err) {
    return err.message;
  }
  const newMatch = await db.collection('matchs').add({ personages, start });
  return newMatch.id;
});

exports.addToTimesTable = functions.https.onCall(async (data, context) => {
  const name = data.name;
  const time = await getTime(data.id);
  const topTen = await isTopTen(time);
  if (topTen) {
    await db.collection('matchsTable').doc(data.id).set({ name, time });
  }
  const topTenTable = await getTopTen();
  return topTenTable;
});
exports.getTopTenTable = functions.https.onCall(async (data, context) => {
  const topTen = await getTopTen();
  return topTen;
});

async function checkWin(id) {
  let gameEnds = true;
  let doc = await db.collection('matchs').doc(id).get();
  let personages = doc.data().personages;
  for (const key in personages) {
    if (personages.hasOwnProperty(key)) {
      if (personages[key] === false) {
        gameEnds = false;
        break;
      }
    }
  }
  return gameEnds;
}
async function getTime(id) {
  let doc = await db.collection('matchs').doc(id).get();
  const start = doc.data().start.toMillis();
  const end = doc.data().end.toMillis();
  const millis = end - start;

  return millis;
}

async function isTopTen(time) {
  const topTen = await getTopTen();
  if (!topTen[9] || time < topTen[9].time) {
    return true;
  }
  return false;
}
async function getTopTen() {
  const topTenref = db.collection('matchsTable').orderBy('time').limit(10);
  const topTen = await topTenref.get();
  const list = topTen.docs.map((doc) => {
    return { time: doc.data().time, name: doc.data().name };
  });
  return list;
}