import { apiClient } from './apiClient';
import { mockSeries } from './data';

export async function seedDatabase() {
  try {
    const list = mockSeries.map(series => ({
      id: series.id,
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
      chapters: series.chapters?.map(ch => ({
        id: ch.id,
        number: ch.number,
        title: ch.title || '',
        images: ch.images || []
      })) || []
    }));

    const result = await apiClient.seedDatabase({
      series: list,
      admins: [
        "amirrezaveisi45@gmail.com",
        "Mr.V@admin.com"
      ]
    });

    if (result.success) {
      alert('Database seeded successfully on local/cPanel SQL Server!');
    } else {
      alert('Seed failed. Server message: ' + (result.error || 'Unknown error'));
    }
  } catch (error: any) {
    console.error(error);
    alert('Seed failed: ' + error.message);
  }
}
