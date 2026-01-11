import React, { useEffect, useState } from "react";
import axios from "axios";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import "./App.css";

// --- STORE THE URL HERE ---
const API_BASE_URL = "https://inventory-backend-8feq.onrender.com";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [view, setView] = useState("login");
  const [business, setBusiness] = useState({ name: "", logo: "" });
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [message, setMessage] = useState({ text: "", type: "" });
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "dark");
  const [filterLowStock, setFilterLowStock] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: "",
    sku: "",
    price: "",
    quantity: "",
  });
  const [editingProduct, setEditingProduct] = useState(null);

  useEffect(() => {
    const savedBus = localStorage.getItem("activeBusiness");
    if (savedBus) {
      setBusiness(JSON.parse(savedBus));
      setIsLoggedIn(true);
      fetchProducts();
    }
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const showFeedback = (text, type) => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: "", type: "" }), 3000);
  };

 const handleSignup = (e) => {
   e.preventDefault();
   const formData = new FormData(e.target);
   const busName = formData.get("busName");
   const email = formData.get("email");
   const password = formData.get("password");
   const file = e.target.busLogo.files[0];

   // --- CHANGED SECTION: Send to Cloud instead of LocalStorage ---
   const saveAccount = async (logoData = "") => {
     try {
       const newUser = {
         name: busName,
         logo: logoData,
         email: email,
         password: password,
       };

       // Send to your Spring Boot Backend
       await axios.post(`${API_BASE_URL}/api/users/signup`, newUser);

       showFeedback("Account Created!", "success");
       setView("login");
     } catch (err) {
       console.error("Signup error:", err);
       // Fallback message if the server is down or email exists
       const errMsg = err.response?.data || "Signup failed. Try again.";
       showFeedback(errMsg, "error");
     }
   };
   // -----------------------------------------------------------

   if (file) {
     const reader = new FileReader();
     reader.onload = (event) => {
       const img = new Image();
       img.onload = () => {
         const canvas = document.createElement("canvas");
         const MAX_WIDTH = 150;
         const scaleSize = MAX_WIDTH / img.width;
         canvas.width = MAX_WIDTH;
         canvas.height = img.height * scaleSize;
         const ctx = canvas.getContext("2d");
         ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

         // Calls the new async saveAccount
         saveAccount(canvas.toDataURL("image/jpeg", 0.7));
       };
       img.src = event.target.result;
     };
     reader.readAsDataURL(file);
   } else {
     saveAccount();
   }
 };

const handleLogin = async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const email = formData.get("email");
  const password = formData.get("password");

  try {
    // Ask Spring Boot to check the Aiven Database
    const res = await axios.post(`${API_BASE_URL}/api/users/login`, {
      email,
      password,
    });

    // Spring Boot returns the user object { name, email, logo }
    const userData = res.data;

    const busInfo = {
      name: userData.name,
      logo: userData.logo,
      email: userData.email,
    };

    setBusiness(busInfo);
    // We only save the ACTIVE session locally, not the password/account details
    localStorage.setItem("activeBusiness", JSON.stringify(busInfo));
    setIsLoggedIn(true);
    fetchProducts();
  } catch (err) {
    const errMsg =
      err.response?.status === 401
        ? "Wrong password!"
        : "User not found or Server error";
    showFeedback(errMsg, "error");
  }
};

const handleLogout = () => {
  localStorage.removeItem("activeBusiness");
  setBusiness({ name: "", logo: "" }); // Reset business state
  setProducts([]);
  setIsLoggedIn(false);
};# 1. Check which files you changed (like App.js)
git status

# 2. Add the changes
git add .

# 3. Commit the changes
git commit -m "Update frontend to use Cloud Login and Signup"

# 4. Push to GitHub
git push origin main

const fetchProducts = async () => {
  const user = JSON.parse(localStorage.getItem("activeBusiness"));

  if (!user || !user.email) {
    setProducts([]);
    return;
  }

  try {
    const res = await axios.get(
      `${API_BASE_URL}/api/products?email=${user.email}`
    );
    setProducts(res.data);
  } catch (err) {
    console.error("Fetch failed", err);
  }
};

const handleAddProduct = async (e) => {
  e.preventDefault();
  const user = JSON.parse(localStorage.getItem("activeBusiness"));

  if (!user || !user.email) {
    showFeedback("Session expired. Please login.", "error");
    return;
  }

  try {
    await axios.post(`${API_BASE_URL}/api/products`, {
      name: newProduct.name,
      sku: newProduct.sku,
      price: newProduct.price,
      quantity: newProduct.quantity,
      userEmail: user.email,
    });

    setNewProduct({ name: "", sku: "", price: "", quantity: "" });
    fetchProducts();
    showFeedback("Registered Successfully", "success");
  } catch (err) {
    console.error("Registration failed:", err);
    showFeedback("SKU already exists in your inventory!", "error");
  }
};

  const updateQuantity = async (product, change) => {
    const newQty = parseInt(product.quantity) + change;
    if (newQty < 0) return;
    await axios.put(`${API_BASE_URL}/api/products/${product.id}`, {
      ...product,
      quantity: newQty,
    });
    fetchProducts();
  };

  const handleDelete = async (id) => {
    if (window.confirm("Delete this item?")) {
      await axios.delete(`${API_BASE_URL}/api/products/${id}`);
      fetchProducts();
      showFeedback("Item Deleted", "success");
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    await axios.put(
      `${API_BASE_URL}/api/products/${editingProduct.id}`,
      editingProduct
    );
    setEditingProduct(null);
    fetchProducts();
    showFeedback("Updated", "success");
  };

  const downloadPDF = (type) => {
    const items =
      type === "restock" ? products.filter((p) => p.quantity < 5) : products;

    if (items.length === 0) {
      const errorMsg =
        type === "restock"
          ? "No items need restocking!"
          : "Your inventory is currently empty!";

      showFeedback(errorMsg, "error");
      return;
    }

    const doc = new jsPDF();
    const title =
      type === "restock" ? "Restock Report" : "Full Inventory Ledger";

    doc.setFontSize(18);
    doc.text(`${business.name}`, 14, 15);
    doc.setFontSize(11);
    doc.text(title, 14, 22);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 28);

    autoTable(doc, {
      head: [["SKU", "Item", "Price", "Qty"]],
      body: items.map((p) => [p.sku, p.name, `₹${p.price}`, p.quantity]),
      startY: 35,
      theme: "striped",
      headStyles: { fillColor: [37, 99, 235] },
    });

    doc.save(`${business.name}_${type}_Report.pdf`);
    showFeedback(`${title} Downloaded!`, "success");
  };

  const filteredProducts = products.filter(
    (p) =>
      (p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchTerm.toLowerCase())) &&
      (filterLowStock ? p.quantity < 5 : true)
  );

  const totalValue = products.reduce((acc, p) => acc + p.price * p.quantity, 0);

  if (!isLoggedIn) {
    return (
      <div className="auth-container">
        {message.text ? (
          <div className={`status-overlay ${message.type}`}>
            <div className="status-content">
              <div className="status-icon">
                {message.type === "success" ? "✅" : "❌"}
              </div>
              <h2>{message.text}</h2>
              <p>Please wait a moment...</p>
            </div>
          </div>
        ) : (
          <div className="auth-card">
            <h2>{view === "login" ? "Sign In" : "Register Business"}</h2>
            <form
              onSubmit={view === "login" ? handleLogin : handleSignup}
              className="auth-form"
            >
              {view === "signup" && (
                <>
                  <input name="busName" placeholder="Bussiness Name" required />
                  <div className="file-upload-wrapper">
                    <label>Logo Upload</label>
                    <input type="file" name="busLogo" accept="image/*" />
                  </div>
                </>
              )}
              <input name="email" type="email" placeholder="Email" required />
              <input
                name="password"
                type="password"
                placeholder="Password"
                required
              />
              <button type="submit" className="btn-primary">
                Submit
              </button>
              <p
                className="auth-footer"
                onClick={() => setView(view === "login" ? "signup" : "login")}
              >
                {view === "login"
                  ? "Need an account? Sign Up"
                  : "Already registered? Login"}
              </p>
            </form>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="app-wrapper">
      {message.text && (
        <div className={`alert-toast ${message.type}`}>{message.text}</div>
      )}

      <header className="main-header">
        <div className="brand-section">
          {business.logo && (
            <img src={business.logo} alt="logo" className="nav-logo" />
          )}
          <div className="title-stack">
            <h1 className="nav-title">{business.name}</h1>
            <div className="pdf-group">
              <button className="btn-pdf" onClick={() => downloadPDF("all")}>
                Full list
              </button>
              <button
                className="btn-pdf restock"
                onClick={() => downloadPDF("restock")}
              >
                Restock list
              </button>
            </div>
          </div>
        </div>
        <div className="actions-section">
          <input
            className="search-input"
            placeholder="Search items or SKU..."
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            className="theme-btn"
          >
            {theme === "light" ? "🌙" : "☀️"}
          </button>
          <button onClick={handleLogout} className="logout-btn">
            Logout
          </button>
        </div>
      </header>

      <section className="stats-row">
        <div className="stat-card">
          <span className="label">Total SKUs</span>
          <span className="val">{products.length}</span>
        </div>
        <div className="stat-card highlight">
          <span className="label">Inventory Value</span>
          <span className="val">₹{totalValue.toLocaleString("en-IN")}</span>
        </div>
      </section>

      <div className="main-layout">
        <aside className="entry-sidebar">
          <div className="card">
            <h3>Add New Product</h3>
            <form onSubmit={handleAddProduct} className="entry-form">
              <input
                placeholder="Name"
                value={newProduct.name}
                onChange={(e) =>
                  setNewProduct({ ...newProduct, name: e.target.value })
                }
                required
              />
              <input
                placeholder="SKU Code"
                value={newProduct.sku}
                onChange={(e) =>
                  setNewProduct({ ...newProduct, sku: e.target.value })
                }
                required
              />
              <input
                type="number"
                placeholder="Price (₹)"
                value={newProduct.price}
                onChange={(e) =>
                  setNewProduct({ ...newProduct, price: e.target.value })
                }
                required
              />
              <input
                type="number"
                placeholder="Stock Qty"
                value={newProduct.quantity}
                onChange={(e) =>
                  setNewProduct({ ...newProduct, quantity: e.target.value })
                }
                required
              />
              <button type="submit" className="btn-primary">
                Register Item
              </button>
            </form>
          </div>
        </aside>

        <main className="inventory-list">
          <div className="card">
            <div className="card-header">
              <h3>Stock Overview</h3>
              <button
                className={`filter-btn ${filterLowStock ? "active" : ""}`}
                onClick={() => setFilterLowStock(!filterLowStock)}
              >
                {filterLowStock ? "Show All" : "Low Stock Only"}
              </button>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.name}</strong>
                      <br />
                      <small>{p.sku}</small>
                    </td>
                    <td>₹{p.price}</td>
                    <td>
                      <span
                        className={`badge ${p.quantity < 5 ? "red" : "green"}`}
                      >
                        {p.quantity} Units
                      </span>
                    </td>
                    <td>
                      <div className="btn-row">
                        <button
                          className="unit-btn"
                          onClick={() => updateQuantity(p, 1)}
                        >
                          +
                        </button>
                        <button
                          className="unit-btn minus"
                          onClick={() => updateQuantity(p, -1)}
                        >
                          −
                        </button>
                        <button
                          className="act-btn edit"
                          onClick={() => setEditingProduct(p)}
                        >
                          ✎
                        </button>
                        <button
                          className="act-btn del"
                          onClick={() => handleDelete(p.id)}
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      </div>

      {editingProduct && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3>Update Product</h3>
            <form onSubmit={handleEditSubmit} className="modal-form">
              <label>Product Name</label>
              <input
                value={editingProduct.name}
                onChange={(e) =>
                  setEditingProduct({ ...editingProduct, name: e.target.value })
                }
              />
              <label>Price</label>
              <input
                type="number"
                value={editingProduct.price}
                onChange={(e) =>
                  setEditingProduct({
                    ...editingProduct,
                    price: e.target.value,
                  })
                }
              />
              <label>Stock Qty</label>
              <input
                type="number"
                value={editingProduct.quantity}
                onChange={(e) =>
                  setEditingProduct({
                    ...editingProduct,
                    quantity: e.target.value,
                  })
                }
              />
              <div className="modal-actions">
                <button type="submit" className="btn-primary">
                  Update
                </button>
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="btn-cancel"
                >
                  Back
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;