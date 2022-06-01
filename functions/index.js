// Actions SDK
const {conversation} = require("@assistant/conversation");
const app = conversation({
  debug: true,
  clientId: "591618152780-8r7novrnehq8oh2n1nn89f013j5ij6fh.apps.googleusercontent.com",
});

// Firebase SDK
const functions = require("firebase-functions");
const admin = require("firebase-admin");

// nodemailer
const nodemailer = require("nodemailer");
// const cors = require("cors")({origin: true});

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
  // check if gp email is in db
  // if not then user must enter it
  // else then send email
  this.sendEmail();
});

app.handle("viewLog", (conv) => {
  conv.add("tbd");
});

exports.analyseMoodData = functions.pubsub.schedule("0 0 1 1 *")
    .onRun(async (context) => {
      // iterate through each user
      // get mood data within a certain time frame

      const analysis = [];
      const users = db.collection("users");

      // sleep & mood
      await users.doc("user1").collection("mood_data").where("sleep", "<", 8).get().then((snapshot) => {
        if (!snapshot.empty) {
          const mood = [];
          snapshot.forEach((doc) => {
            mood.push(doc.data().mood);
          });

          const topMood = getMostFreq(mood);
          analysis.push("You are more likely to log " + topMood + " when you get less than 8 hours of sleep.");
        }
      });

      // activity & sleep, mood
      await users.doc("user1").collection("mood_data").where("activity", "==", "mild").get().then((snapshot) => {
        if (!snapshot.empty) {
          const mood = [];
          const sleep = [];
          snapshot.forEach((doc) => {
            mood.push(doc.data().mood);
            sleep.push(doc.data().sleep);
          });

          const topSleep = getMostFreq(sleep);
          analysis.push("When you sleep " + topSleep + " hours, you are more likely to be mildly active.");
          analysis.push("You are more likely to log " + getMostFreq(mood) + " when you are mildly active.");
        }
      });

      // water & activity, mood
      await users.doc("user1").collection("mood_data").where("water", "<", 8).get().then((snapshot) => {
        if (!snapshot.empty) {
          const mood = [];
          const activity = [];

          snapshot.forEach((doc) => {
            mood.push(doc.data().mood);
            activity.push(doc.data().activity);
          });

          const topMood = getMostFreq(mood);
          const topActivity = getMostFreq(activity);

          analysis.push("You are more likely to log " + topMood + " when you drink less than 8 glasses of water a day.");
          analysis.push("You are usually " + topActivity + " activity when you drink more than 8 glasses of water a day.");
        }
      });

      // day & bad mood
      await users.doc("user1").collection("mood_data").where("mood", "==", "bad").get().then((snapshot) => {
        if (!snapshot.empty) {
          const days = [];
          snapshot.forEach((doc) => {
            days.push(doc.data().date.toDate().toLocaleString("default", {weekday: "long"}));
          });

          const topDay = getMostFreq(days);
          analysis.push("On " + topDay + "s you usually log bad moods");
        }
      });

      // day most active
      await users.doc("user1").collection("mood_data").where("activity", "in", ["moderate", "very active"]).get().then((snapshot) => {
        if (!snapshot.empty) {
          const days = [];
          const mood = [];
          snapshot.forEach((doc) => {
            days.push(doc.data().date.toDate().toLocaleString("default", {weekday: "long"}));
            mood.push(doc.data().mood);
          });

          const topDay = getMostFreq(days);
          const topMood = getMostFreq(mood);
          analysis.push("You are usually moderately or very active on " + topDay + "s, and on these days you usually log " + topMood + " moods.");
        }
      });

      db.collection("test_analysis").add({
        date: admin.firestore.Timestamp.now(),
        analysis: analysis,
      }).then((newDoc) => {
        console.log("added analysis", newDoc.id);
      });
    });

exports.sendEmail = functions.https.onRequest((req, res) => {
  const key = require("./moodLoggerEmailKey.json");
  const transporter = nodemailer.createTransport({
    host: "smtp-relay.sendinblue.com",
    port: 587,
    auth: {
      user: key.user,
      pass: key.pass,
    },
  });

  const dest = "ciaragil98@gmail.com";

  const mail = {
    from: "gilsenci@tcd.ie",
    to: dest,
    subject: "From Mood Logger",
    text: "testing email from firebase",
  };

  return transporter.sendMail(mail, (error, info) => {
    if (error) {
      console.log(error.toString());
    }
  });
});

/**
 * Helper function to analyseMoodData, finds most frequent element in the given array.
 * @param {Array} array - array
 * @return {(number|string)} - most frequent element
 */
function getMostFreq(array) {
  // https://javascript.plainenglish.io/how-to-find-the-most-frequent-element-in-an-array-in-javascript-c85119dc78d2
  const hashmap = array.reduce((acc, val) => {
    acc[val] = (acc[val] || 0) + 1;
    return acc;
  }, {});
  return Object.keys(hashmap).reduce((a, b) => hashmap[a] > hashmap[b] ? a : b);
}

exports.ActionsOnGoogleFulfillment = functions.https.onRequest(app);
