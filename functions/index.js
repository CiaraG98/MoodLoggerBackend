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

// init firestore
admin.initializeApp();
const db = admin.firestore();

// moment
const moment = require("moment");

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
        conv.session.params.hasLoggedToday = today.getDate() == snapshot.docs[0].data().date.toDate().getDate();
      });
});

app.handle("checkGPEmail", (conv) => {
  // checks if the user has saved their GP's email in the past
  return db.collection("users").doc(conv.user.params.uid).get().then((doc) => {
    if (doc.data().GP_email) {
      conv.session.params.gp = true;
    } else {
      conv.session.params.gp = false;
    }
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
    conv.add("If you are a new user, you will get a new analysis in 7 days.");
  }
});

app.handle("setGPEmail", (conv) => {
  if (conv.session.params.gp_email) {
    return db.collection("users").doc(conv.user.params.uid).set({
      GP_email: conv.session.params.gp_email,
    }, {merge: true}).then((docRef) => {
      console.log("added new email to ", conv.user.params.uid);
      conv.session.params.gp = true;
    });
  }
});

app.handle("sendToGP", (conv) => {
  return db.collection("users").doc(conv.user.params.uid).get().then((doc) => {
    if (doc.exists) {
      if (doc.data().GP_email) {
        const userName = conv.user.params.tokenPayload.name;
        const userEmail = conv.user.params.tokenPayload.email;
        sendGPEmail(doc.data().GP_email, userName, userEmail, conv.user.params.uid);
        conv.add("Alright, sending your mood data to ", doc.data().GP_email);
      } else {
        conv.add("Sorry there is a problem finding your gp's email. Please try again.");
      }
    }
  });
});

app.handle("viewLog", (conv) => {
  const dateInput = conv.session.params.dateToView;
  const dateString = dateInput.year + "-" + dateInput.month + "-" + dateInput.day;

  const startOf = moment(dateString).startOf().toDate();
  const endOf = moment(startOf).endOf("day").toDate();

  return db.collection("users").doc(conv.user.params.uid).collection("mood_data").where("date", ">", startOf)
      .where("date", "<", endOf).get().then((snapshot) => {
        if (snapshot.empty) {
          conv.add("Sorry there is no record of a log on that date.");
        } else {
          const mood = snapshot.docs[0].data().mood;
          const water = snapshot.docs[0].data().water;
          const sleep = snapshot.docs[0].data().sleep;
          const activity = snapshot.docs[0].data().activity;

          let resp = "You logged: \nMood: " + mood + ".\nSleep: " + sleep;
          resp += ".\nWater: " + water + ".\nActivity: " + activity;
          conv.add(resp);
        }
      });
});

// log response

const moodResponseGood = ["That's great!🌞\n", "🌞\n", "Wonderfull ☀️."];
// const moodResponseOkay = [""];
const moodResponseBad = ["That's too bad.", "I am sorry you are feeling this way 😥."];

app.handle("reactToMood", (conv) => {
  if (conv.session.params.mood_today == "good") {
    conv.add(moodResponseGood[Math.floor(Math.random()*moodResponseGood.length)]);
  } else if (conv.session.params.mood_today == "bad") {
    conv.add(moodResponseBad[Math.floor(Math.random()*moodResponseBad.length)]);
  }
});

// const sleepRessponseLow = ["Hmm that doesn't sound like a lot.", "Only"]
const sleepRessponseHigh = ["That sounds like a good night's sleep.", "You must be well rested 😊."];
app.handle("reactToSleep", (conv) => {
  if (conv.session.params.hours_of_sleep < 7) {
    conv.add("Hmm that doesn't sound like a lot.");
  } else if (conv.session.params.hours_of_sleep >= 8 && conv.session.params.mood_today != "bad") {
    conv.add(sleepRessponseHigh[Math.floor(Math.random()*sleepRessponseHigh.length)]);
  } else if (conv.session.params.hours_of_sleep >= 10) {
    conv.add("Hmm that sounds like too much sleep 😴.");
  }
});

// 0 0 * * 0 --> Every 7 days
exports.analyseMoodData = functions.pubsub.schedule("0 0 * * 0")
    .onRun(async (context) => {
      const lessOrMore = [">", "<"];
      const activity = ["mild, moderate"];
      const sleep = [6, 8];
      const glasses = [6, 8];
      const moods = ["okay", "bad", "good"];

      // from https://www.w3resource.com/javascript-exercises/javascript-array-exercise-35.php
      const randomSymbol = lessOrMore[Math.floor(Math.random()*lessOrMore.length)];
      const randomActivity = activity[Math.floor(Math.random()*activity.length)];
      const randomSleep = sleep[Math.floor(Math.random()*sleep.length)];
      const randomGlasses = glasses[Math.floor(Math.random()*glasses.length)];
      const randomMood = moods[Math.floor(Math.random()*moods.length)];

      startAnalysis(randomSymbol, randomActivity, randomSleep, randomGlasses, randomMood);
    });

/**
 * Does analysis
 * @param {string} lm - less or more
 * @param {string} act - less or more
 * @param {number} hours - less or more
 * @param {number} glasses - less or more
 * @param {string} m - less or more
 */
async function startAnalysis(lm, act, hours, glasses, m) {
  // iterate through each user
  // get mood data within a certain time frame

  const users = db.collection("users");

  await users.get().then((snapshot) => {
    snapshot.forEach(async (doc) => {
      const uid = doc.id;
      const analysis = [];

      // sleep & mood
      await users.doc(uid).collection("mood_data").where("sleep", lm, hours).get().then((snapshot) => {
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
      await users.doc(uid).collection("mood_data").where("activity", "==", act).get().then((snapshot) => {
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
      await users.doc(uid).collection("mood_data").where("water", lm, glasses).get().then((snapshot) => {
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
          analysis.push("You are usually " + topActivity + " active when you drink more than 8 glasses of water a day.");
        }
      });

      // day & bad mood
      await users.doc(uid).collection("mood_data").where("mood", "==", m).get().then((snapshot) => {
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
      await users.doc(uid).collection("mood_data").where("activity", "==", act).get().then((snapshot) => {
        if (!snapshot.empty) {
          const days = [];
          snapshot.forEach((doc) => {
            days.push(doc.data().date.toDate().toLocaleString("default", {weekday: "long"}));
          });

          const topDay = getMostFreq(days);
          analysis.push("You are usually " + act + "ly active on" + topDay + "s.");
        }
      });

      db.collection("users").doc(uid).collection("analysis").add({
        date: admin.firestore.Timestamp.now(),
        analysis: analysis,
      }).then((newDoc) => {
        console.log("added analysis", newDoc.id);
      });
    });
  });
}

/**
 * Sends email to GP
 * @param {string} gpEmail - gp email
 * @param {string} userName - username
 * @param {string} userEmail - user email
 * @param {string} uid - user uid
 */
async function sendGPEmail(gpEmail, userName, userEmail, uid) {
  const key = require("./moodLoggerEmailKey.json");
  const transporter = nodemailer.createTransport({
    host: "smtp-relay.sendinblue.com",
    port: 587,
    auth: {
      user: key.user,
      pass: key.pass,
    },
  });

  // form html body using table: https://www.w3schools.com/html/html_tables.asp
  let style = "table {width: 100%;}";
  style += "\ntd, th {border: 1px solid #dddddd; padding: 5px; text-align: left;}";
  let body = "<head><style>" + style + "</style></head><h2>Google Assistant Mood Logger Data</h2>";
  body += "<p>Patient Name: " + userName + "</p><p>Patient Email: " + userEmail + "</p>";
  body += "<br><br><table><tr><th>Date</th><th>Mood</th><th>Water</th><th>Sleep</th><th>Activity</th></tr>";

  // get mood data
  await db.collection("users").doc(uid).collection("mood_data").get().then((snapshot) => {
    if (!snapshot.empty) {
      snapshot.forEach((doc) => {
        const date = doc.data().date.toDate().toString().replace("GMT+0000 (Coordinated Universal Time)", "");
        body += "<tr><td>" + date + "</td>";
        body += "<td>" + doc.data().mood + "</td>";
        body += "<td>" + doc.data().water + "</td>";
        body += "<td>" + doc.data().sleep + "</td>";
        body += "<td>" + doc.data().activity + "</td></tr>";
      });
    }
    body += "</table>";
  });

  const mail = {
    from: "gilsenci@tcd.ie",
    to: gpEmail,
    subject: "New From Mood Logger",
    html: body,
  };

  return transporter.sendMail(mail, (error, info) => {
    if (error) {
      console.log(error.toString());
    }
  });
}

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
