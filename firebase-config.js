import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";

// --- IMPORTANT ---
// REPLACE WITH YOUR FIREBASE PROJECT CONFIGURATION
const firebaseConfig = {
  apiKey: "AIzaSyYOUR_API_KEY_HERE",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "your-sender-id",
  appId: "1:your-app-id:web:your-web-app-id"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };```

---

### 🛍️ **User Side (Customer)**

#### **`/customer/index.html`**

html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pharma Express</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <header>
        <nav class="container">
            <a href="index.html" class="logo">Pharma Express</a>
            <a href="cart.html" class="cart-link">
                Cart (<span id="cart-count">0</span>)
            </a>
        </nav>
    </header>
    <main>
        <section id="hero-banner" class="hero">
            <!-- Dynamic Banner will be loaded here -->
            <div class="loader"></div>
        </section>
        <section class="container product-section">
            <h2>Our Products</h2>
            <div id="product-grid" class="product-grid">
                <!-- Products will be loaded here -->
                <div class="loader"></div>
            </div>
        </section>
    </main>
    <footer>
        <div class="container">
            <p>&copy; 2025 Pharma Express. All Rights Reserved.</p>
        </div>
    </footer>
    <div id="toast" class="toast"></div>
    <script type="module" src="../firebase-config.js"></script>
    <script type="module" src="app.js"></script>
</body>
</html>
