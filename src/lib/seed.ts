import { collection, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { mockSeries } from './data';

enum OperationType { WRITE = 'write' }
interface FirestoreErrorInfo { error: string; operationType: OperationType; path: string | null; authInfo: any; }

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {},
    operationType,
    path
  };
  throw new Error(JSON.stringify(errInfo));
}

export async function seedDatabase() {
  try {
    const batch = writeBatch(db);
    
    for (const series of mockSeries) {
      const seriesRef = doc(collection(db, 'series'), series.id);
      batch.set(seriesRef, {
        title: series.title,
        alternativeTitles: series.alternativeTitles || [],
        cover: series.cover,
        banner: series.banner,
        author: series.author,
        artist: series.artist,
        synopsis: series.synopsis,
        genres: series.genres || [],
        tags: series.tags || [],
        status: series.status || 'Ongoing',
        rating: series.rating || 0,
        type: series.type || 'Manhwa',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (series.chapters) {
        for (const ch of series.chapters) {
          const chapterRef = doc(collection(db, `series/${series.id}/chapters`), ch.id);
          batch.set(chapterRef, {
            seriesId: series.id,
            number: ch.number,
            title: ch.title || '',
            images: ch.images || [],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      }
    }

    await batch.commit();
    alert('Database seeded successfully!');
  } catch (error) {
    console.error(error);
    alert('Seed failed. You might not have admin permission. Add your UID to /admins collection in Firestore.');
  }
}
