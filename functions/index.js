// Actions SDK
const {conversation} = require("@assistant/conversation");

const app = conversation({
  debug: true,
  clientId: "591618152780-8r7novrnehq8oh2n1nn89f013j5ij6fh.apps.googleusercontent.com",
});
//  const https = requre("https");

// Firebase SDK
const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

app.handle("collectMood", (conv) => {
  conv.user.params.mood = conv.session.params.todaysMood;
});

app.handle("collectWaterIntake", (conv) => {
  conv.user.params.water = conv.session.params.water_intake;
});

app.handle("collectHoursOfSleep", (conv) => {
  conv.user.params.sleep = conv.session.params.hours_of_sleep;
});

app.handle("collectExercise", (conv) => {
  conv.user.params.exercise = conv.session.params.exercise;
});

app.handle("sendDataToDB", (conv) => {
  /* const newLog = {
    mood: conv.user.params.mood,
    water: conv.user.params.water,
    sleep: conv.user.params.sleep,
    activity: conv.user.params.exercise,
  };*/
});

app.handle("sendToGP", (conv) => {
  conv.add("tbd");
});

app.handle("viewLog", (conv) => {
  conv.add("tbd");
});

app.handle("getAnalysisFromDB", (conv) => {
  const analysis = db.collection("user1/analysis");

  return analysis.get().then((snapshot) => {
    const newAnalysis = snapshot.docs[0].data().data;
    conv.session.params.analysis = newAnalysis;
  });
});

app.handle("init", (conv) => {
  // check if user has logged and save in session storage

  // get most recent analysis from db

  // get user id and save to user storage if not already saved

  console.log(conv.headers.authorization.email);
  if (!conv.user.params.uid) {
    conv.user.params.uid = admin.auth().getUserByEmail(conv.headers.authorization.email);
  }

  if (!conv.user.params.name) {
    conv.user.params.name = conv.headers.authorization.given_name;
  }
});

app.handle("deliverAnalysis", (conv) => {
  conv.add(conv.session.params.analysis.join(" "));
});

exports.analyseMoodData = functions.pubsub.schedule("0 0 1 * *")
    .onRun((context) => {
      const data = {
        analysis: ["a1", "a2", "a3"],
      };
      return db.collection("analysis").doc("test").set(data);
    });


exports.ActionsOnGoogleFulfillment = functions.https.onRequest(app);
