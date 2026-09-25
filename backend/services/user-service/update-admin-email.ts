import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// Load .env
const envPath = resolve(__dirname, '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq > 0) process.env[t.substring(0, eq).trim()] = t.substring(eq + 1).trim();
  }
} else {
  console.log('No .env found at', envPath);
}

import { getAuth } from 'firebase-admin/auth';
import { createClient } from '@supabase/supabase-js';
import { initFirebaseAdmin } from './src/firebase-admin';

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceRole) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRole);

async function updateAdminEmail() {
  const oldEmail = 'admin@campusrso.local';
  const newEmail = 'sumalkm48@gmail.com';

  console.log(`Starting update process for admin email: ${oldEmail} -> ${newEmail}`);

  // 1. Initialize Firebase Admin
  initFirebaseAdmin();
  const adminAuth = getAuth();

  try {
    // 2. Find existing user in Firebase
    console.log(`Looking up user in Firebase Auth by old email (${oldEmail})...`);
    let firebaseUser;
    try {
      firebaseUser = await adminAuth.getUserByEmail(oldEmail);
      console.log(`Found Firebase user. UID: ${firebaseUser.uid}`);
    } catch (e: any) {
      if (e.code === 'auth/user-not-found') {
        console.log(`Firebase user with email ${oldEmail} not found. They might have already been updated.`);
        // Let's try checking if new email already exists
        try {
          firebaseUser = await adminAuth.getUserByEmail(newEmail);
          console.log(`Firebase user is already updated to ${newEmail}. UID: ${firebaseUser.uid}`);
        } catch (err) {
          console.error(`Error: Could not find Firebase user by old OR new email.`);
          process.exit(1);
        }
      } else {
        throw e;
      }
    }

    // 3. Update Firebase Auth Email
    if (firebaseUser.email !== newEmail) {
      console.log(`Updating Firebase Auth email to ${newEmail}...`);
      await adminAuth.updateUser(firebaseUser.uid, {
        email: newEmail,
        emailVerified: true // Automatically verify since it's the admin
      });
      console.log(`✓ Firebase Auth email updated successfully.`);
    } else {
      console.log(`✓ Firebase Auth email is already ${newEmail}.`);
    }

    // 4. Update Supabase user_profiles
    console.log(`Updating Supabase user_profiles table...`);
    const { data, error } = await supabase
      .from('user_profiles')
      .update({ email: newEmail })
      .eq('firebase_uid', firebaseUser.uid)
      .select();

    if (error) {
      console.error('Error updating Supabase:', error);
      process.exit(1);
    }

    if (data && data.length > 0) {
      console.log(`✓ Supabase user_profiles updated successfully.`);
    } else {
      console.log(`⚠ Warning: No Supabase profile found to update for UID ${firebaseUser.uid}.`);
    }

    console.log('\n=== Admin Email Update Complete ===\n');
    process.exit(0);
  } catch (error) {
    console.error('An error occurred during the update process:', error);
    process.exit(1);
  }
}

updateAdminEmail();
