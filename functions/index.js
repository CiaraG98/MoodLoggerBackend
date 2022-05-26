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

app.handle("init", (conv) => {
  // check if they have a user id in user storage if not then most likely a new user
  if (conv.user.params.uid == "" || !conv.user.params.uid) {
    const userEmail = conv.user.params.tokenPayload.email;
    // check if the user's email is stored in db
    return db.collection("users").where("email", "==", userEmail).get().then((snapshot) => {
      if (snapshot.empty) {
        // add new user to db
        return db.collection("users").add({
          email: userEmail,
        }).then((docRef) => {
          conv.user.params.uid = docRef.id;
        });
      } else {
        // assign uid with matching doc
        conv.user.params.uid = snapshot.docs[0].id;
      }
    });
  } else {
    // get most recent analysis
    return db.collection("users").doc(conv.user.params.uid).collection("analysis")
        .orderBy("date", "desc").get().then((snapshot) => {
          if (snapshot.docs.length > 0) {
            conv.session.params.analysis = snapshot.docs[0].data().data;
          }
        });
  }
});

app.handle("checkLog", (conv) => {
  // get most recent log date from db and compare with today's date
  const today = admin.firestore.Timestamp.now().toDate();
  return db.collection("users").doc(conv.user.params.uid).collection("mood_data")
      .orderBy("date", "desc").get().then((snapshot) => {
        console.log("Dates: " + today.getDate().toString() + " " +
          snapshot.docs[0].data().date.toDate().getDate().toString());
        conv.session.params.hasLoggedToday = today.getDate() == snapshot.docs[0].data().date.toDate().getDate();
      });
});

app.handle("initLog", (conv) => {
  if (conv.session.params.hasLoggedToday) {
    conv.add("Sorry, you have already logged your mood today. Say exit and come back tomorrow.");
  } else {
    conv.add("How was your mood today?");
  }
});

app.handle("sendDataToDB", (conv) => {
  return db.collection("users").doc(conv.user.params.uid).collection("mood_data").add({
    date: admin.firestore.Timestamp.now(),
    mood: conv.session.params.mood_today,
    water: conv.session.params.water_intake,
    sleep: conv.session.params.hours_of_sleep,
    activity: conv.session.params.exercise,
  }).then((docRef) => {
    console.log("Added mood data with ID: ", docRef.id);
  });
});

app.handle("deliverAnalysis", (conv) => {
  if (conv.session.params.analysis) {
    conv.add(conv.session.params.analysis.join(" "));
  } else {
    conv.add("Sorry there seems to be a problem with obtaining your analysis.");
    conv.add("If you are a new user, you will get a new analysis next month.");
  }
});

app.handle("sendToGP", (conv) => {
  conv.add("tbd");
  // check if gp email is in db
  // if not then user must enter it
  // else then send email
});

app.handle("viewLog", (conv) => {
  conv.add("tbd");
});

exports.analyseMoodData = functions.pubsub.schedule("0 0 1 * *")
    .onRun((context) => {
      // iterate through each user
      // get mood data within a certain time frame
      // do analysis
      // store in user's analysis collection
      /*
      const data = {
        analysis: ["a1", "a2", "a3"],
      };
       return db.collection("analysis").doc("test").set(data);*/
    });


exports.ActionsOnGoogleFulfillment = functions.https.onRequest(app);
