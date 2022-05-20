// Actions SDK
const {conversation} = require("@assistant/conversation");
const app = conversation({debug: true});
//  const https = requre("https");
//  const cors = require("cors")({origin: true});

// Firebase SDK
const functions = require("firebase-functions");
const admin = require("firebase-admin");

/*
const {getDatabase} = require("firebase-admin/database");
const serviceAccount = require("./moodLoggerKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://moodloggerbackend-32f31-default-rtdb.firebaseio.com",
});

const db = getDatabase();
const ref = db.ref("userData");
const users = ref.child("user1");
users.child("today").set({
  mood: "grand",
});*/

// const users = db.collection("user1").limit(5);

admin.initializeApp();
const db = admin.firestore();

app.handle("collectMood", (conv) => {
  // get data
  const currentDate = new Date();
  let dateTime = currentDate.getDate() + "/";
  dateTime += (currentDate.getMonth()+1) + "/" + currentDate.getFullYear();

  conv.user.params.date = dateTime;

  // get data (will change to hash map?)
  if (conv.intent.params.chosenMood) {
    conv.user.params.mood = conv.intent.params.chosenMood.original;
  } else {
    conv.user.params.mood = conv.session.params.todaysMood;
  }

  // conv.add("You logged: " + conv.user.params.mood);
});

app.handle("showData", (conv) => {
  let data = "This is the last thing you have logged on ";
  data += conv.user.params.date + ":\n";
  data += "Your mood was " + conv.user.params.mood + ".\n";
  data += "You got " + conv.user.params.sleep + " of sleep.\n";
  data += "You had " + conv.user.params.water + " of water.\n And ";
  data += "you were " + conv.user.params.exercise + " active.";
  conv.add(data);
});

app.handle("collectWaterIntake", (conv) => {
  conv.user.params.water = conv.session.params.water_intake;
});

app.handle("collectHoursOfSleep", (conv) => {
  conv.user.params.sleep = conv.session.params.hours_of_sleep;
});

app.handle("collectExercise", (conv) => {
  conv.user.params.exercise = conv.session.params.didExercise;
});

/*
app.handle("testdb", (conv) => {
  const ref = db.ref("userData/user1/today");

  return ref.on("value", (snapshot) => {
    console.log("SNAP: " + snapshot.val().mood);
    conv.user.params.snapshot = snapshot.val().water;
  });
  /* users.get().then((snapshot) => {
    const resp = snapshot.docs[0].data().mood;
    console.log("MOOD " + resp);
    conv.add(resp);
  });
});*/

app.handle("testFirestore", (conv) => {
  const users = db.collection("user1");
  const snapshot = users;

  return snapshot.get().then((snapshot) => {
    console.log("New: " + snapshot.docs[0].data().mood);
    conv.user.params.snapshot = snapshot.docs[0].data().mood;
  });
});

app.handle("getAnalysisFromDB", (conv) => {
  const analysis = db.collection("analysis");

  return analysis.get().then((snapshot) => {
    const newAnalysis = snapshot.docs[0].data().data;
    conv.session.params.analysis = newAnalysis;
  });
});

app.handle("deliverAnalysis", (conv) => {
  conv.add(conv.session.params.analysis.join(" "));
});

app.handle("getSnapshot", (conv) => {
  conv.add("Snapshot: " + conv.user.params.snapshot);
});


exports.ActionsOnGoogleFulfillment = functions.https.onRequest(app);
