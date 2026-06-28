import { db } from "../src/firebase";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";

async function deleteCollection(colPath: string, subColNames: string[] = []) {
  console.log(`Fetching documents from collection: ${colPath}`);
  const snap = await getDocs(collection(db, colPath));
  console.log(`Found ${snap.size} documents in ${colPath}`);
  
  const deletePromises = snap.docs.map(async (document) => {
    console.log(`Deleting document ${document.id} from ${colPath}...`);
    // Delete subcollections in parallel
    for (const subCol of subColNames) {
      const subSnap = await getDocs(collection(db, colPath, document.id, subCol));
      if (subSnap.size > 0) {
        console.log(`Found ${subSnap.size} subdocs in ${colPath}/${document.id}/${subCol}`);
        const subDeletes = subSnap.docs.map(subDoc => 
          deleteDoc(doc(db, colPath, document.id, subCol, subDoc.id))
            .then(() => console.log(`Deleted subdoc ${subDoc.id} from ${colPath}/${document.id}/${subCol}`))
        );
        await Promise.all(subDeletes);
      }
    }
    // Delete root doc
    await deleteDoc(doc(db, colPath, document.id));
    console.log(`Deleted document ${document.id} from ${colPath}`);
  });

  await Promise.all(deletePromises);
  console.log(`Finished clearing collection: ${colPath}`);
}

async function run() {
  try {
    // Delete sessions and all subcollections
    await deleteCollection("sessions", ["attendance", "timeline", "alerts", "comments"]);
    
    // Delete courses and all subcollections
    await deleteCollection("courses", ["students"]);
    
    // Delete users
    await deleteCollection("users");

    console.log("Database successfully cleared!");
    process.exit(0);
  } catch (err) {
    console.error("Error clearing database:", err);
    process.exit(1);
  }
}

run();
