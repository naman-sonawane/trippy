import mongoose from 'mongoose';
import connectDB from '../lib/mongodb';

const truncateAllCollections = async () => {
  try {
    await connectDB();
    const db = mongoose.connection.db;
    
    if (!db) {
      throw new Error('Database connection not available');
    }

    const collections = await db.listCollections().toArray();
    
    console.log(`Found ${collections.length} collections`);
    
    for (const collection of collections) {
      const collectionName = collection.name;
      const result = await db.collection(collectionName).deleteMany({});
      console.log(`✓ Truncated ${collectionName}: ${result.deletedCount} documents deleted`);
    }
    
    console.log('\nAll collections truncated successfully!');
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error truncating collections:', error);
    process.exit(1);
  }
};

truncateAllCollections();
