import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  updateProfile,
  getAdditionalUserInfo
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, getDocs, query, where, collection } from 'firebase/firestore';
import { auth, googleProvider, db } from './firebaseConfig';

// User entity class that mimics Base44 User API
class FirebaseUser {
  // Login with Google
  async login() {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const additionalInfo = getAdditionalUserInfo(result);
      
      // Check if user document exists in Firestore
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        // Create user document if it doesn't exist
        await setDoc(userDocRef, {
          email: user.email,
          name: user.displayName || '',
          photo_url: user.photoURL || '',
          role: 'trainee', // Default role
          status: 'active',
          created_at: new Date().toISOString(),
          contract_signed: false,
          // Add other default fields as needed
        });
      } else {
        // Update last login
        await updateDoc(userDocRef, {
          last_login: new Date().toISOString()
        });
      }
      
      return user;
    } catch (error) {
      console.error('Error during login:', error);
      throw error;
    }
  }

  // Get current user
  async me() {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('No user logged in');
      }
      
      const userDocRef = doc(db, 'users', currentUser.uid);
      const userDoc = await getDoc(userDocRef);
      
      // If document doesn't exist but user is authenticated, create it
      if (!userDoc.exists()) {
        console.warn('User document not found in Firestore, creating it...');
        try {
          await setDoc(userDocRef, {
            email: currentUser.email,
            name: currentUser.displayName || '',
            photo_url: currentUser.photoURL || '',
            role: 'trainee', // Default role
            status: 'active',
            created_at: new Date().toISOString(),
            contract_signed: false,
            // Add other default fields as needed
          });
          
          // Fetch the newly created document
          const newUserDoc = await getDoc(userDocRef);
          if (newUserDoc.exists()) {
            return {
              id: newUserDoc.id,
              uid: currentUser.uid,
              email: currentUser.email,
              ...newUserDoc.data()
            };
          }
        } catch (createError) {
          console.error('Error creating user document:', createError);
          throw new Error('Failed to create user document');
        }
      }
      
      return {
        id: userDoc.id,
        uid: currentUser.uid,
        email: currentUser.email,
        ...userDoc.data()
      };
    } catch (error) {
      console.error('Error getting current user:', error);
      throw error;
    }
  }

  // List all users
  async list() {
    try {
      const usersRef = collection(db, 'users');
      const querySnapshot = await getDocs(usersRef);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error listing users:', error);
      throw error;
    }
  }

  // Update user
  async update(userId, data) {
    try {
      const userDocRef = doc(db, 'users', userId);
      await updateDoc(userDocRef, {
        ...data,
        updated_at: new Date().toISOString()
      });
      return { id: userId, ...data };
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }

  // Update current user's own data
  async updateMyUserData(data) {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('No user logged in');
      }
      
      const userDocRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userDocRef, {
        ...data,
        updated_at: new Date().toISOString()
      });
      
      // Also update Firebase Auth profile if name or photo is being updated
      if (data.name || data.photo_url) {
        await updateProfile(currentUser, {
          displayName: data.name || currentUser.displayName,
          photoURL: data.photo_url || currentUser.photoURL
        });
      }
      
      return { id: currentUser.uid, ...data };
    } catch (error) {
      console.error('Error updating user data:', error);
      throw error;
    }
  }

  // Logout
  async logout() {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error during logout:', error);
      throw error;
    }
  }

  // Get auth state observer
  onAuthStateChanged(callback) {
    return onAuthStateChanged(auth, callback);
  }
}

export const User = new FirebaseUser();

