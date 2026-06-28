import { db } from "../src/firebase";
import { collection, getDocs } from "firebase/firestore";

async function run() {
  try {
    console.log("--- Users ---");
    const usersSnap = await getDocs(collection(db, "users"));
    usersSnap.forEach((doc) => {
      console.log(doc.id, "=>", doc.data());
    });

    console.log("\n--- Courses ---");
    const coursesSnap = await getDocs(collection(db, "courses"));
    coursesSnap.forEach((doc) => {
      console.log(doc.id, "=>", doc.data());
    });

    console.log("\n--- Sessions ---");
    const sessionsSnap = await getDocs(collection(db, "sessions"));
    sessionsSnap.forEach((doc) => {
      console.log(doc.id, "=>", doc.data());
    });

    process.exit(0);
  } catch (err) {
    console.error("Error reading database:", err);
    process.exit(1);
  }
}

run();
