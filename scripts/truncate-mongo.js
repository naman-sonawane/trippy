// MongoDB shell script to truncate all collections
// Run with: mongosh "your-connection-string" < truncate-mongo.js
// Or paste into mongosh directly

db.getCollectionNames().forEach(collection => {
  print(`Deleting all documents from ${collection}...`);
  db[collection].deleteMany({});
  print(`✓ ${collection} truncated`);
});

print('\nAll collections truncated successfully!');
