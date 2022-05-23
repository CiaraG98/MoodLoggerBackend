// Actions SDK
const {conversation} = require("@assistant/conversation");
const app = conversation({debug: true});
//  const https = requre("https");

// Firebase SDK
const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

app.handle("collectMood", (conv) => {
  // get data
  const currentDate = new Date();
  let dateTime = currentDate.getDate() + "/";
  dateTime += (currentDate.getMonth()+1) + "/" + currentDate.getFullYear();

  conv.user.params.date = dateTime;
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
  conv.add("Saved: " + conv.user.params.exercise);
});

app.handle("sendToGP", (conv) => {
  conv.add("tbd");
});

app.handle("viewLog", (conv) => {
  conv.add("tbd");
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

exports.analyseMoodData = functions.pubsub.schedule("0 0 1 * *")
    .onRun((context) => {
      const data = {
        analysis: ["a1", "a2", "a3"],
      };
      return db.collection("analysis").doc("test").set(data);
    });


exports.ActionsOnGoogleFulfillment = functions.https.onRequest(app);
