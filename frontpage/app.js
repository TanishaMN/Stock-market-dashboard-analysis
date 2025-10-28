// --- MODIFIED: Use CDN URL for Supabase import ---
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// --- Supabase Config ---
// !! Replace with your actual URL and Anon Key !!
const SUPABASE_URL = 'https://becatoozlwvfatgecxzl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJlY2F0b296bHd2ZmF0Z2VjeHpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU0MTI3MTIsImV4cCI6MjA3MDk4ODcxMn0.ir4qrNBY3jiHLvUxGhzi_b2jXG-AnVzbOWeL0DDRWeU';
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- DOM Elements (Declared with 'let') ---
// We declare them here so all functions can access them
let loginModalOverlay;
let signupModalOverlay;
let loginForm;
let signupForm;
let loginButtonHeader;
let userDisplayHeader;
let logoutButton;
let loginErrorMsg;
let signupErrorMsg;
let launchDashboardGuestBtn; // <-- ADDED
let currentUser = null; // <-- ADDED: To track login state for the button

// --- Modal Control Functions ---
function openModal(overlay) {
  if (overlay) {
    overlay.classList.add('visible');
  }
}

function closeModal(overlay) {
  if (overlay) {
    overlay.classList.remove('visible');
    // Reset error messages on close
    if (overlay === loginModalOverlay && loginErrorMsg) loginErrorMsg.style.display = 'none';
    if (overlay === signupModalOverlay && signupErrorMsg) signupErrorMsg.style.display = 'none';
  }
}

// --- Auth State & UI Update ---
export function updateHeaderUI(user) {
  // === MODIFIED: Added logic for launchDashboardGuestBtn ===
  const launchButton = document.getElementById('launchDashboardGuestBtn');

  if (user && user.email) {
    // User is logged in
    if (loginButtonHeader) loginButtonHeader.style.display = 'none';
    if (userDisplayHeader) {
      userDisplayHeader.style.display = 'flex';
      // Use metadata username if available, otherwise fall back to email
      const userIdentifier = user.user_metadata?.username || user.email.split('@')[0];
      const userNameSpan = userDisplayHeader.querySelector('span');
      if (userNameSpan) userNameSpan.textContent = `Hello, ${userIdentifier}`;
    }
    if(logoutButton) logoutButton.style.display = 'inline-block';
    // --- ADDED: Change launch button text ---
    if (launchButton) launchButton.textContent = 'Launch Dashboard';
  } else {
    // User is logged out
    if (loginButtonHeader) loginButtonHeader.style.display = 'block';
    if (userDisplayHeader) userDisplayHeader.style.display = 'none';
    if(logoutButton) logoutButton.style.display = 'none';
    // --- ADDED: Change launch button text back ---
    if (launchButton) launchButton.textContent = 'Launch as Guest';
  }
  // === END MODIFIED ===
}

export async function checkAuthState() {
  const { data: { session }, error } = await supabase.auth.getSession();
  console.log("Checking Auth State - Session:", session);
  if (error) {
    console.error("Error getting session:", error);
    updateHeaderUI(null);
    sessionStorage.removeItem('loggedInUserEmail');
    sessionStorage.removeItem('loggedInUsername');
    currentUser = null; // <-- ADDED
    return null;
  }
  const user = session?.user ?? null;
  currentUser = user; // <-- ADDED: Update global state
  updateHeaderUI(user);
  if (user && user.email) {
      sessionStorage.setItem('loggedInUserEmail', user.email);
      const username = user.user_metadata?.username || user.email.split('@')[0];
      sessionStorage.setItem('loggedInUsername', username);
      console.log("User email stored:", user.email, "Username stored:", username);
  } else {
      sessionStorage.removeItem('loggedInUserEmail');
      sessionStorage.removeItem('loggedInUsername');
      console.log("User email removed.");
  }
  return user;
}

// --- Supabase Auth Functions ---
export async function signUpUser(email, username, password) {
  if(signupErrorMsg) signupErrorMsg.style.display = 'none';
  try {
      if (!username || username.trim().length < 3) {
        throw new Error("Username must be at least 3 characters.");
      }
      const specialCharRegex = /[!@#$%^&*(),.?":{}|<>]/;
      if (!password || (password.length < 8 && !specialCharRegex.test(password))) { 
         throw new Error("Password must be at least 8 characters OR contain a special character."); 
      }

      const { data, error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
            data: {
                username: username.trim()
            }
        }
      });

      if (error) throw error;
      
      alert('Sign up successful! Check email verification, then log in.');
      closeModal(signupModalOverlay);
      openModal(loginModalOverlay);
  } catch (err) {
      console.error("Full signup error:", err); // Log the full error
      if(signupErrorMsg) { 
      	// === MODIFIED: Check for the unique username error ===
      	if (err.message && (err.message.includes("duplicate key value violates unique constraint") || err.message.includes("profiles_username_key"))) {
      	  signupErrorMsg.textContent = "This username is already taken. Please choose another.";
  	  } else if (err.message && err.message.includes("Database error saving new user")) {
        // Fallback for the old error message just in case
        signupErrorMsg.textContent = "This username is already taken. Please choose another.";
      } else {
      	  signupErrorMsg.textContent = err.message;
      	}
      	signupErrorMsg.style.display = 'block';
  	}
      else { alert(err.message); }
  }
}

// === MODIFIED: signInUser function to handle username/email ===
export async function signInUser(identifier, password) {
  if(loginErrorMsg) loginErrorMsg.style.display = 'none';
  let email = identifier; // Assume it's an email by default

  try {
    // 1. Check if the identifier is a username (doesn't contain '@')
    if (!identifier.includes('@')) {
      console.log("Attempting login with username:", identifier);
      // It's a username, so we need to find the email from the 'profiles' table
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('email')
        .eq('username', identifier) // Find the profile with this username
        .single(); // We only expect one result

      if (profileError) {
        console.error("Error fetching profile for username:", profileError);
        throw new Error("Incorrect email or password.");
      }
      if (!profile) {
        console.log("No profile found for username:", identifier);
        throw new Error("Incorrect email or password.");
      }
      
      email = profile.email;
      console.log("Found email:", email, "for username:", identifier);
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    console.log('Login successful! Session:', data.session);
    currentUser = data.user; 
    closeModal(loginModalOverlay);
    updateHeaderUI(data.user);
    sessionStorage.setItem('loggedInUserEmail', data.user.email);
    const username = data.user.user_metadata?.username || data.user.email.split('@')[0];
    sessionStorage.setItem('loggedInUsername', username);
    console.log("User logged in, email stored:", data.user.email, "Username stored:", username);

  } catch (err) {
    console.error("Login error:", err);
    if(loginErrorMsg) {
      if (err.message.includes("Invalid login credentials") || err.message.includes("Incorrect email or password")) {
      	loginErrorMsg.textContent = "Incorrect email/username or password.";
      } else if (err.message.includes("Email not confirmed")) {
      	loginErrorMsg.textContent = "Please verify your email first.";
      } else {
      	loginErrorMsg.textContent = err.message;
      }
      loginErrorMsg.style.display = 'block';
    } else {
    	alert(err.message);
    }
  }
}

export async function signOutUser() {
  const { error } = await supabase.auth.signOut();
  if (error) { console.error('Sign out error:', error); alert('Error signing out.'); }
  else {
    console.log('User signed out.');
    currentUser = null; // <-- ADDED: Update global state
    updateHeaderUI(null);
    sessionStorage.removeItem('loggedInUserEmail');
    sessionStorage.removeItem('loggedInUsername');
    // === THIS IS THE FIX ===
    // This will redirect the user from any page (like the dashboard)
    // back to the front page after logging out.
    window.location.href = '../frontpage/frontpage.html';
    // === END FIX ===
  }
}

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
  
  // Assign variables *inside* the listener
  loginModalOverlay = document.getElementById('loginModalOverlay');
  signupModalOverlay = document.getElementById('signupModalOverlay');
  loginForm = document.getElementById('login-form');
  signupForm = document.getElementById('signup-form');
  loginButtonHeader = document.getElementById('loginButtonHeader');
  userDisplayHeader = document.getElementById('userDisplayHeader');
  logoutButton = document.getElementById('logoutButton');
  loginErrorMsg = document.getElementById('login-error-message');
  signupErrorMsg = document.getElementById('signup-error-message');
  launchDashboardGuestBtn = document.getElementById('launchDashboardGuestBtn'); 

  checkAuthState(); 

  if (loginButtonHeader) {
    loginButtonHeader.addEventListener('click', (e) => { e.preventDefault(); openModal(loginModalOverlay); });
  } else { console.warn("#loginButtonHeader not found."); }

  if (launchDashboardGuestBtn) {
    launchDashboardGuestBtn.addEventListener('click', (e) => {
      if (!currentUser) {
        e.preventDefault(); 
        openModal(loginModalOverlay); 
      }

    });
  } else { console.warn("#launchDashboardGuestBtn not found."); }

  if (logoutButton) {
      logoutButton.addEventListener('click', (e) => { e.preventDefault(); signOutUser(); });
  } else { console.warn("#logoutButton not found."); }

  document.querySelectorAll('.auth-modal-close-btn').forEach(button => {
      button.addEventListener('click', () => { 
        closeModal(button.closest('.auth-modal-overlay')); 
      });
 });

  [loginModalOverlay, signupModalOverlay].forEach(overlay => {
    overlay?.addEventListener('click', (e) => { if (e.target === overlay) closeModal(overlay); });
  });

  document.getElementById('show-signup')?.addEventListener('click', (e) => { e.preventDefault(); closeModal(loginModalOverlay); openModal(signupModalOverlay); });
  document.getElementById('show-login')?.addEventListener('click', (e) => { e.preventDefault(); closeModal(signupModalOverlay); openModal(loginModalOverlay); });

  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const identifier = loginForm.querySelector('#login-identifier')?.value;
      const password = loginForm.querySelector('#login-password')?.value;
      if (identifier && password) {
    	  signInUser(identifier, password);
      }
      else {
    	  loginErrorMsg.textContent = "Please fill out all fields.";
    	  loginErrorMsg.style.display = 'block';
      }
    });
  } else { console.warn("#login-form not found."); }

  if (signupForm) {
    signupForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = signupForm.querySelector('#signup-email')?.value;
      const username = signupForm.querySelector('#signup-username')?.value;
      const password = signupForm.querySelector('#signup-password')?.value;

       if (email && username && password) {
         signUpUser(email, username, password);
      }
       else {
        console.error("Signup form inputs (email, username, or password) not found or are empty.");
        if(signupErrorMsg) { 
           signupErrorMsg.textContent = "Please fill out all fields."; 
           signupErrorMsg.style.display = 'block'; 
         }
        }
    });
  } else { console.warn("#signup-form not found."); }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeModal(loginModalOverlay); closeModal(signupModalOverlay); }
  });
}); 

const API_URL = 'http://localhost:3000';

export async function fetchWishlist() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { console.warn("Cannot fetch wishlist: User not logged in."); return null; }
  try {
    const response = await fetch(`${API_URL}/api/wishlist`, {
      method: 'GET', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` }
    });
    if (!response.ok) { const err = await response.json(); throw new Error(err.error || 'Failed fetch'); }
    return await response.json();
  } catch (error) { console.error('Fetch wishlist error:', error); return null; }
}

export async function addToWishlist(tickerSymbol) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { alert("Login to add companies to wishlist."); openModal(loginModalOverlay); return null; }
    try {
        const response = await fetch(`${API_URL}/api/wishlist`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
            body: JSON.stringify({ ticker: tickerSymbol })
        });
      	const result = await response.json();
      	if (!response.ok) { throw new Error(result.error || 'Failed add'); }
      	console.log('Add wishlist ok:', result.message);
      	return result.data;
    } catch (error) { console.error('Add wishlist error:', error); alert('Error: ' + error.message); return null; }
}

export async function removeFromWishlist(tickerSymbol) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { alert("You must be logged in."); return false; }
  	try {
        const response = await fetch(`${API_URL}/api/wishlist`, {
            method: 'DELETE', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
           	body: JSON.stringify({ ticker: tickerSymbol })
        });
        const result = await response.json();
        if (!response.ok) { throw new Error(result.error || 'Failed remove'); }
        console.log('Remove wishlist ok:', result.message);
        return true;
    } catch (error) { 
        console.error('Remove wishlist error:', error); 
        alert('Error: ' + error.message); 
        return false; 
      }
}

