import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("it_hub.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT,
    sku TEXT,
    hpp REAL,
    sdp REAL,
    srp REAL,
    config TEXT,
    photo_url TEXT,
    datasheet_url TEXT,
    stock_status TEXT
  );
`);

// Migration: Add new columns if they don't exist (for existing databases)
const migrations = [
  "ALTER TABLE products ADD COLUMN hpp REAL;",
  "ALTER TABLE products ADD COLUMN sdp REAL;",
  "ALTER TABLE products ADD COLUMN srp REAL;",
  "ALTER TABLE products ADD COLUMN sku TEXT;"
];

for (const sql of migrations) {
  try {
    db.exec(sql);
  } catch (e) {
    // Column likely already exists
  }
}

db.exec(`
  CREATE TABLE IF NOT EXISTS programs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    type TEXT, -- promo, sell-out, price-protection, display
    description TEXT,
    start_date TEXT,
    end_date TEXT,
    status TEXT DEFAULT 'active'
  );

  CREATE TABLE IF NOT EXISTS follow_ups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sales_name TEXT NOT NULL,
    request_details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reminder_date TEXT,
    is_completed INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS warehouse (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    jenis TEXT,
    kode_barang TEXT UNIQUE,
    nama_barang TEXT,
    kuantiti INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL -- admin, sales
  );
`);

// Seed initial users if empty
const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
if (userCount.count === 0) {
  const insertUser = db.prepare("INSERT INTO users (username, password, role) VALUES (?, ?, ?)");
  insertUser.run("admin", "admin123", "admin");
  insertUser.run("sales", "sales123", "sales");
}

// Seed initial data if empty
const productCount = db.prepare("SELECT COUNT(*) as count FROM products").get() as { count: number };
if (productCount.count === 0) {
  const insertProduct = db.prepare("INSERT INTO products (name, category, hpp, sdp, srp, config, photo_url, datasheet_url, stock_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
  insertProduct.run("ThinkPad X1 Carbon Gen 11", "Laptop", 20000000, 23000000, 25000000, "Core i7-1355U, 16GB RAM, 512GB SSD", "https://picsum.photos/seed/x1/400/300", "https://example.com/datasheet-x1.pdf", "In Stock");
  insertProduct.run("Dell XPS 13 Plus", "Laptop", 22000000, 25000000, 28000000, "Core i7-1360P, 32GB RAM, 1TB SSD", "https://picsum.photos/seed/xps/400/300", "https://example.com/datasheet-xps.pdf", "Limited Stock");
}

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const PORT = 3000;

// Auth Routes
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  // Case-insensitive username check and allow empty password if DB password is empty
  const user = db.prepare("SELECT * FROM users WHERE LOWER(username) = LOWER(?)").get(username) as any;
  
  if (user) {
    // If user has a password, check it. If not, allow login.
    const isPasswordCorrect = !user.password || user.password === password;
    
    if (isPasswordCorrect) {
      res.json({ 
        id: user.id, 
        username: user.username, 
        role: user.role 
      });
    } else {
      res.status(401).json({ error: "Invalid password" });
    }
  } else {
    res.status(401).json({ error: "User not found" });
  }
});

// User Management Routes (Admin only)
app.get("/api/users", (req, res) => {
  const users = db.prepare("SELECT id, username, role FROM users").all();
  res.json(users);
});

app.post("/api/users", (req, res) => {
  const { username, password, role } = req.body;
  try {
    const result = db.prepare("INSERT INTO users (username, password, role) VALUES (?, ?, ?)").run(username, password || '', role);
    res.json({ id: result.lastInsertRowid, username, role });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.put("/api/users/:id", (req, res) => {
  const { id } = req.params;
  const { username, password, role } = req.body;
  try {
    if (password) {
      db.prepare("UPDATE users SET username = ?, password = ?, role = ? WHERE id = ?").run(username, password, role, id);
    } else {
      db.prepare("UPDATE users SET username = ?, role = ? WHERE id = ?").run(username, role, id);
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.delete("/api/users/:id", (req, res) => {
  const { id } = req.params;
  console.log(`Attempting to delete user with ID: ${id}`);
  try {
    const result = db.prepare("DELETE FROM users WHERE id = ?").run(id);
    console.log(`Delete result:`, result);
    res.json({ success: true });
  } catch (error: any) {
    console.error(`Delete error:`, error);
    res.status(400).json({ error: error.message });
  }
});

// API Routes
app.get("/api/products", (req, res) => {
  const role = req.query.role || 'sales';
  
  let query = `
    SELECT p.*, w.kuantiti as warehouse_stock 
    FROM products p 
    LEFT JOIN warehouse w ON p.sku = w.kode_barang
  `;
  
  const products = db.prepare(query).all() as any[];
  
  // Filter HPP if not admin
  const filteredProducts = products.map(p => {
    if (role !== 'admin') {
      const { hpp, ...rest } = p;
      return rest;
    }
    return p;
  });
  
  res.json(filteredProducts);
});

app.post("/api/products", (req, res) => {
  try {
    const { name, category, sku, hpp, sdp, srp, config, photo_url, datasheet_url, stock_status } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: "Product name is required" });
    }

    const info = db.prepare(`
      INSERT INTO products (name, category, sku, hpp, sdp, srp, config, photo_url, datasheet_url, stock_status) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name, 
      category || 'Uncategorized', 
      sku || '',
      Number(hpp) || 0, 
      Number(sdp) || 0, 
      Number(srp) || 0, 
      config || '', 
      photo_url || '', 
      datasheet_url || '', 
      stock_status || 'In Stock'
    );
    
    res.json({ id: info.lastInsertRowid });
  } catch (error) {
    console.error("Database Error:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Internal Server Error" });
  }
});

app.put("/api/products/:id", (req, res) => {
  try {
    const { name, category, sku, hpp, sdp, srp, config, photo_url, datasheet_url, stock_status } = req.body;
    const { id } = req.params;

    db.prepare(`
      UPDATE products 
      SET name = ?, category = ?, sku = ?, hpp = ?, sdp = ?, srp = ?, config = ?, photo_url = ?, datasheet_url = ?, stock_status = ?
      WHERE id = ?
    `).run(name, category, sku, hpp, sdp, srp, config, photo_url, datasheet_url, stock_status, id);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to update product" });
  }
});

app.delete("/api/products/:id", (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ID format" });
    }
    
    console.log(`Attempting to delete product with ID: ${id}`);
    const result = db.prepare("DELETE FROM products WHERE id = ?").run(id);
    console.log(`Delete result: ${JSON.stringify(result)}`);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: "Product not found" });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error("Delete Error:", error);
    res.status(500).json({ error: "Failed to delete product" });
  }
});

app.post("/api/products/bulk", (req, res) => {
  try {
    const products = req.body; // Array of product objects
    if (!Array.isArray(products)) {
      return res.status(400).json({ error: "Invalid data format. Expected an array." });
    }

    const insert = db.prepare(`
      INSERT INTO products (name, category, sku, hpp, sdp, srp, config, photo_url, datasheet_url, stock_status) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((items) => {
      for (const item of items) {
        insert.run(
          item.name, 
          item.category || 'Uncategorized', 
          item.sku || '',
          Number(item.hpp) || 0, 
          Number(item.sdp) || 0, 
          Number(item.srp) || 0, 
          item.config || '', 
          item.photo_url || '', 
          item.datasheet_url || '', 
          item.stock_status || 'In Stock'
        );
      }
    });

    insertMany(products);
    res.json({ success: true, count: products.length });
  } catch (error) {
    console.error("Bulk Insert Error:", error);
    res.status(500).json({ error: "Failed to bulk insert products" });
  }
});

app.get("/api/programs", (req, res) => {
  const programs = db.prepare("SELECT * FROM programs").all();
  res.json(programs);
});

app.post("/api/programs", (req, res) => {
  const { title, type, description, start_date, end_date } = req.body;
  const info = db.prepare("INSERT INTO programs (title, type, description, start_date, end_date) VALUES (?, ?, ?, ?, ?)").run(title, type, description, start_date, end_date);
  res.json({ id: info.lastInsertRowid });
});

// Warehouse Endpoints
app.get("/api/warehouse", (req, res) => {
  const items = db.prepare("SELECT * FROM warehouse").all();
  res.json(items);
});

app.post("/api/warehouse", (req, res) => {
  try {
    const { jenis, kode_barang, nama_barang, kuantiti } = req.body;
    const info = db.prepare(`
      INSERT INTO warehouse (jenis, kode_barang, nama_barang, kuantiti) 
      VALUES (?, ?, ?, ?)
    `).run(jenis, kode_barang, nama_barang, kuantiti);
    res.json({ id: info.lastInsertRowid });
  } catch (error) {
    res.status(500).json({ error: "Failed to add warehouse item" });
  }
});

app.post("/api/warehouse/bulk", (req, res) => {
  try {
    const items = req.body;
    const insert = db.prepare(`
      INSERT OR REPLACE INTO warehouse (jenis, kode_barang, nama_barang, kuantiti) 
      VALUES (?, ?, ?, ?)
    `);
    const insertMany = db.transaction((data) => {
      for (const item of data) {
        insert.run(item.jenis, item.kode_barang, item.nama_barang, item.kuantiti);
      }
    });
    insertMany(items);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to bulk import warehouse items" });
  }
});

app.delete("/api/warehouse/:id", (req, res) => {
  try {
    db.prepare("DELETE FROM warehouse WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete warehouse item" });
  }
});

app.patch("/api/warehouse/:id", (req, res) => {
  try {
    const { jenis, kode_barang, nama_barang, kuantiti } = req.body;
    db.prepare(`
      UPDATE warehouse 
      SET jenis = ?, kode_barang = ?, nama_barang = ?, kuantiti = ?
      WHERE id = ?
    `).run(jenis, kode_barang, nama_barang, kuantiti, req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to update warehouse item" });
  }
});

app.get("/api/followups", (req, res) => {
  const followups = db.prepare("SELECT * FROM follow_ups ORDER BY is_completed ASC, created_at DESC").all();
  res.json(followups);
});

app.post("/api/followups", (req, res) => {
  const { sales_name, request_details, reminder_date } = req.body;
  const info = db.prepare("INSERT INTO follow_ups (sales_name, request_details, reminder_date) VALUES (?, ?, ?)").run(sales_name, request_details, reminder_date);
  res.json({ id: info.lastInsertRowid });
});

app.patch("/api/followups/:id", (req, res) => {
  const { is_completed } = req.body;
  db.prepare("UPDATE follow_ups SET is_completed = ? WHERE id = ?").run(is_completed ? 1 : 0, req.params.id);
  res.json({ success: true });
});

// Vite middleware for development
if (process.env.NODE_ENV !== "production") {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.join(__dirname, "dist")));
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "dist", "index.html"));
  });
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
