import { auth } from '../firebase-config.js';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";

const currentPath = window.location.pathname;

// Redirect logic based on auth state
onAuthStateChanged(auth, user => {
    if (user) {
        // User is signed in
        if (currentPath.includes('login.html')) {
            window.location.replace('dashboard.html');
        }
    } else {
        // User is signed out
        if (currentPath.includes('dashboard.html')) {
            window.location.replace('login.html');
        }
    }
});

// Login form handler
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const errorMessage = document.getElementById('error-message');

        signInWithEmailAndPassword(auth, email, password)
            .catch(error => {
                errorMessage.textContent = 'Invalid email or password.';
                console.error(error);
            });
    });
}

// Logout button handler
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        signOut(auth).catch(error => console.error("Logout Error:", error));
    });
}
