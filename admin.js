rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /products/{document=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /settings/{document=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /orders/{document=**} {
       // Allow users to create orders, but only admin can read them
      allow create: if true; 
      allow read, update: if request.auth != null;
    }
  }
}
