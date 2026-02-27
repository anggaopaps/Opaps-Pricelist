/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  Megaphone, 
  Bell, 
  Plus, 
  Search, 
  FileText, 
  Image as ImageIcon, 
  CheckCircle2, 
  Clock, 
  Printer, 
  Download,
  ChevronRight,
  Filter,
  MessageSquare,
  X,
  Send,
  Menu,
  Edit,
  Trash2,
  Warehouse,
  Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import { Copy, Check, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';

// Types
interface Product {
  id: number;
  name: string;
  category: string;
  sku: string;
  hpp: number;
  sdp: number;
  srp: number;
  config: string;
  photo_url: string;
  datasheet_url: string;
  stock_status: string;
  warehouse_stock?: number;
}

interface Program {
  id: number;
  title: string;
  type: string;
  description: string;
  start_date: string;
  end_date: string;
  status: string;
}

interface FollowUp {
  id: number;
  sales_name: string;
  request_details: string;
  created_at: string;
  reminder_date: string;
  is_completed: number;
}

interface WarehouseItem {
  id: number;
  jenis: string;
  kode_barang: string;
  nama_barang: string;
  kuantiti: number;
}

interface UserAccount {
  id: number;
  username: string;
  role: string;
  password?: string;
}

export default function App() {
  const [user, setUser] = useState<{ username: string, role: string } | null>(null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'products' | 'programs' | 'followups' | 'warehouse' | 'users'>('dashboard');
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouseItems, setWarehouseItems] = useState<WarehouseItem[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [aiMessages, setAiMessages] = useState<{ role: 'user' | 'ai', text: string }[]>([]);
  const [aiInput, setAiInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Form States
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isProgramModalOpen, setIsProgramModalOpen] = useState(false);
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const resetProductForm = () => {
    setNewProduct({ 
      name: '', 
      category: 'Laptop', 
      sku: '',
      hpp: '', 
      sdp: '', 
      srp: '', 
      config: '', 
      photo_url: '', 
      datasheet_url: '', 
      stock_status: 'In Stock' 
    });
    setIsEditing(false);
    setEditingId(null);
  };

  const openAddModal = () => {
    resetProductForm();
    setIsProductModalOpen(true);
  };

  const [newProduct, setNewProduct] = useState({
    name: '', category: 'Laptop', sku: '', hpp: '', sdp: '', srp: '', config: '', photo_url: '', datasheet_url: '', stock_status: 'In Stock'
  });
  const [newProgram, setNewProgram] = useState({
    title: '', type: 'promo', description: '', start_date: '', end_date: ''
  });
  const [newFollowUp, setNewFollowUp] = useState({
    sales_name: '', request_details: '', reminder_date: ''
  });
  const [newWarehouseItem, setNewWarehouseItem] = useState({
    jenis: '', kode_barang: '', nama_barang: '', kuantiti: ''
  });
  const [newUser, setNewUser] = useState({
    username: '', password: '', role: 'sales'
  });
  const [isWarehouseModalOpen, setIsWarehouseModalOpen] = useState(false);
  const [isWarehouseBulkOpen, setIsWarehouseBulkOpen] = useState(false);
  const [warehouseBulkInput, setWarehouseBulkInput] = useState('');
  const [isWarehouseUploading, setIsWarehouseUploading] = useState(false);
  const [isWarehouseEditing, setIsWarehouseEditing] = useState(false);
  const [warehouseEditingId, setWarehouseEditingId] = useState<number | null>(null);
  const [isUserEditing, setIsUserEditing] = useState(false);
  const [userEditingId, setUserEditingId] = useState<number | null>(null);
  const [userToDelete, setUserToDelete] = useState<number | null>(null);
  const warehouseFileInputRef = React.useRef<HTMLInputElement>(null);

  // Fetch Data
  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm)
      });
      const data = await response.json();
      if (response.ok) {
        setUser(data);
        localStorage.setItem('it_hub_user', JSON.stringify(data));
      } else {
        setLoginError(data.error || 'Login failed');
      }
    } catch (error) {
      setLoginError('Server error. Please try again.');
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('it_hub_user');
  };

  useEffect(() => {
    const savedUser = localStorage.getItem('it_hub_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const fetchData = async () => {
    try {
      const [prodRes, progRes, followRes, wareRes] = await Promise.all([
        fetch(`/api/products?role=${user?.role || 'sales'}`),
        fetch('/api/programs'),
        fetch('/api/followups'),
        fetch('/api/warehouse')
      ]);
      setProducts(await prodRes.json());
      setPrograms(await progRes.json());
      setFollowUps(await followRes.json());
      setWarehouseItems(await wareRes.json());
      
      if (user?.role === 'admin') {
        fetchUsers();
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      setUsers(await res.json());
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = isUserEditing ? `/api/users/${userEditingId}` : '/api/users';
      const method = isUserEditing ? 'PUT' : 'POST';
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      });
      if (response.ok) {
        setIsUserModalOpen(false);
        setNewUser({ username: '', password: '', role: 'sales' });
        setIsUserEditing(false);
        setUserEditingId(null);
        fetchUsers();
      }
    } catch (error) {
      console.error("Error saving user:", error);
    }
  };

  const handleDeleteUser = async (id: number) => {
    console.log("handleDeleteUser executing for id:", id);
    try {
      console.log("Sending DELETE request to /api/users/" + id);
      const response = await fetch(`/api/users/${id}`, { method: 'DELETE' });
      console.log("Response status:", response.status);
      
      if (response.ok) {
        console.log("Delete successful");
        setUserToDelete(null);
        fetchUsers();
      } else {
        const data = await response.json();
        console.error("Delete failed:", data);
        alert(`Gagal menghapus user: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error("Error deleting user:", error);
      alert('Terjadi kesalahan saat menghapus user.');
    }
  };

  const openEditUserModal = (u: UserAccount) => {
    setIsUserEditing(true);
    setUserEditingId(u.id);
    setNewUser({ username: u.username, password: '', role: u.role });
    setIsUserModalOpen(true);
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Clean price strings
      const cleanPrice = (val: any) => {
        if (typeof val === 'number') return val;
        if (!val) return 0;
        const cleaned = val.toString().replace(/[^\d.-]/g, '');
        return parseFloat(cleaned) || 0;
      };

      const payload = { 
        ...newProduct, 
        hpp: cleanPrice(newProduct.hpp),
        sdp: cleanPrice(newProduct.sdp),
        srp: cleanPrice(newProduct.srp)
      };

      const url = isEditing ? `/api/products/${editingId}` : '/api/products';
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to save product');
      }

      setIsProductModalOpen(false);
      resetProductForm();
      fetchData();
    } catch (error) {
      alert(`Gagal menyimpan produk: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error(error);
    }
  };

  const openEditModal = (p: Product) => {
    setIsEditing(true);
    setEditingId(p.id);
    setNewProduct({
      name: p.name,
      category: p.category,
      sku: p.sku || '',
      hpp: p.hpp.toString(),
      sdp: p.sdp.toString(),
      srp: p.srp.toString(),
      config: p.config,
      photo_url: p.photo_url,
      datasheet_url: p.datasheet_url,
      stock_status: p.stock_status
    });
    setIsProductModalOpen(true);
    setSelectedProduct(null);
  };

  const downloadTemplate = () => {
    const templateData = [
      {
        'Product Name': 'Example Laptop',
        'Category': 'Laptop',
        'SKU': 'LAP-001',
        'HPP': 10000000,
        'SDP': 11000000,
        'SRP': 12000000,
        'Configuration': 'Intel i7, 16GB RAM, 512GB SSD'
      }
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "Product_Template.xlsx");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        const productsToImport = data.map((row: any) => ({
          name: row['Product Name'] || 'Unnamed Product',
          category: row['Category'] || 'Laptop',
          sku: row['SKU'] || row['sku'] || '',
          hpp: Number(row['HPP']) || 0,
          sdp: Number(row['SDP']) || 0,
          srp: Number(row['SRP']) || 0,
          config: row['Configuration'] || '',
          stock_status: 'In Stock'
        }));

        const response = await fetch('/api/products/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(productsToImport)
        });

        if (!response.ok) throw new Error('Upload failed');

        fetchData();
        alert(`Berhasil mengimpor ${productsToImport.length} produk.`);
      } catch (error) {
        alert("Gagal mengimpor file Excel. Pastikan format kolom sesuai template.");
      } finally {
        setIsUploading(false);
        if (e.target) e.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleDeleteProduct = async (id: number) => {
    console.log("Delete button clicked for ID:", id);
    try {
      const response = await fetch(`/api/products/${id}`, { method: 'DELETE' });
      const result = await response.json();
      
      if (!response.ok) throw new Error(result.error || "Failed to delete");
      
      setSelectedProduct(null);
      setConfirmDeleteId(null);
      fetchData();
    } catch (error) {
      console.error("Delete error:", error);
    }
  };

  const handleAddWarehouseItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = isWarehouseEditing ? `/api/warehouse/${warehouseEditingId}` : '/api/warehouse';
      const method = isWarehouseEditing ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newWarehouseItem)
      });
      if (!response.ok) throw new Error('Failed to save warehouse item');
      
      setIsWarehouseModalOpen(false);
      setIsWarehouseEditing(false);
      setWarehouseEditingId(null);
      setNewWarehouseItem({ jenis: '', kode_barang: '', nama_barang: '', kuantiti: '' });
      fetchData();
    } catch (error) {
      alert("Gagal menyimpan barang.");
    }
  };

  const openEditWarehouseModal = (item: WarehouseItem) => {
    setIsWarehouseEditing(true);
    setWarehouseEditingId(item.id);
    setNewWarehouseItem({
      jenis: item.jenis,
      kode_barang: item.kode_barang,
      nama_barang: item.nama_barang,
      kuantiti: item.kuantiti.toString()
    });
    setIsWarehouseModalOpen(true);
  };

  const handleDeleteWarehouseItem = async (id: number) => {
    if (!confirm("Yakin ingin menghapus barang ini?")) return;
    try {
      const response = await fetch(`/api/warehouse/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete');
      fetchData();
    } catch (error) {
      alert("Gagal menghapus barang.");
    }
  };

  const downloadWarehouseTemplate = () => {
    const templateData = [
      {
        'Jenis': 'Hardware',
        'Kode Barang': 'LAP-001',
        'Nama Barang': 'Laptop ASUS ExpertBook',
        'Kuantiti': 10
      }
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Warehouse_Template");
    XLSX.writeFile(wb, "Warehouse_Template.xlsx");
  };

  const handleWarehouseFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    console.log("File selected:", file.name);
    setIsWarehouseUploading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const dataBuffer = evt.target?.result;
        if (!dataBuffer) throw new Error("Failed to read file buffer");
        
        const wb = XLSX.read(dataBuffer, { type: 'array' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        console.log("Raw Excel data:", data);

        if (!data || data.length === 0) {
          alert("File Excel kosong atau tidak terbaca. Pastikan data ada di sheet pertama.");
          return;
        }

        // Robust key mapping to handle variations in column names
        const itemsToImport = data.map((row: any) => {
          const findValue = (possibleKeys: string[]) => {
            const key = Object.keys(row).find(k => 
              possibleKeys.some(pk => k.trim().toLowerCase() === pk.toLowerCase())
            );
            return key ? row[key] : '';
          };

          return {
            jenis: String(findValue(['Jenis', 'Category', 'Tipe']) || '').trim(),
            kode_barang: String(findValue(['Kode Barang', 'Kode', 'Part Number', 'SKU', 'KodeBarang']) || '').trim(),
            nama_barang: String(findValue(['Nama Barang', 'Nama', 'Product Name', 'Item', 'NamaBarang']) || '').trim(),
            kuantiti: Number(findValue(['Kuantiti', 'Qty', 'Stock', 'Jumlah', 'Quantity']) || 0)
          };
        }).filter(item => item.nama_barang || item.kode_barang);

        if (itemsToImport.length === 0) {
          alert("Tidak ada data valid yang ditemukan. Pastikan judul kolom sesuai (Jenis, Kode Barang, Nama Barang, Kuantiti).");
          return;
        }

        const response = await fetch('/api/warehouse/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(itemsToImport)
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || 'Upload failed');
        }

        fetchData();
        alert(`Berhasil mengimpor ${itemsToImport.length} barang ke gudang.`);
      } catch (error: any) {
        console.error("Upload error:", error);
        alert(`Gagal mengimpor: ${error.message || "Pastikan format kolom sesuai template."}`);
      } finally {
        setIsWarehouseUploading(false);
        if (e.target) e.target.value = '';
      }
    };
    reader.onerror = (error) => {
      console.error("FileReader error:", error);
      alert("Gagal membaca file.");
      setIsWarehouseUploading(false);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleWarehouseBulkPaste = async () => {
    if (!warehouseBulkInput.trim()) return;

    try {
      const rows = warehouseBulkInput.trim().split('\n');
      const itemsToImport = rows.map(row => {
        const cols = row.split('\t'); // Excel paste is tab-separated
        return {
          jenis: cols[0]?.trim() || '',
          kode_barang: cols[1]?.trim() || '',
          nama_barang: cols[2]?.trim() || '',
          kuantiti: Number(cols[3]?.replace(/[^\d.-]/g, '') || 0)
        };
      }).filter(item => item.nama_barang || item.kode_barang);

      const response = await fetch('/api/warehouse/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(itemsToImport)
      });

      if (!response.ok) throw new Error('Bulk import failed');

      setIsWarehouseBulkOpen(false);
      setWarehouseBulkInput('');
      fetchData();
      alert(`Berhasil mengimpor ${itemsToImport.length} barang.`);
    } catch (error) {
      alert("Gagal mengimpor data. Pastikan format sesuai (Copy dari Excel).");
    }
  };

  const handleAddProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/programs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProgram)
      });
      if (!response.ok) throw new Error('Failed to add program');
      setIsProgramModalOpen(false);
      setNewProgram({ title: '', type: 'promo', description: '', start_date: '', end_date: '' });
      fetchData();
    } catch (error) {
      alert("Gagal menambah program.");
      console.error(error);
    }
  };

  const handleAddFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/followups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newFollowUp)
      });
      if (!response.ok) throw new Error('Failed to add follow-up');
      setIsFollowUpModalOpen(false);
      setNewFollowUp({ sales_name: '', request_details: '', reminder_date: '' });
      fetchData();
      
      // Request notification permission for automatic reminders
      if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
      }
    } catch (error) {
      alert("Gagal menambah follow-up.");
      console.error(error);
    }
  };

  // Automatic Reminder Logic
  useEffect(() => {
    const checkReminders = () => {
      const today = new Date().toISOString().split('T')[0];
      const dueTasks = followUps.filter(f => !f.is_completed && f.reminder_date === today);
      
      if (dueTasks.length > 0 && "Notification" in window && Notification.permission === "granted") {
        dueTasks.forEach(task => {
          new Notification("Reminder Follow-up", {
            body: `Hari ini waktunya follow up ke ${task.sales_name}: ${task.request_details}`,
            icon: "/favicon.ico"
          });
        });
      }
    };

    if (followUps.length > 0) {
      checkReminders();
    }
  }, [followUps]);

  const toggleFollowUp = async (id: number, currentStatus: number) => {
    await fetch(`/api/followups/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_completed: !currentStatus })
    });
    fetchData();
  };

  const filteredProducts = useMemo(() => {
    return products.filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      p.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.config.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [products, searchQuery]);

  const filteredPrograms = useMemo(() => {
    return programs.filter(p => 
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      p.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [programs, searchQuery]);

  const filteredFollowUps = useMemo(() => {
    return followUps.filter(f => 
      f.sales_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      f.request_details.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [followUps, searchQuery]);

  const filteredWarehouseItems = useMemo(() => {
    return warehouseItems.filter(item => 
      item.nama_barang.toLowerCase().includes(searchQuery.toLowerCase()) || 
      item.kode_barang.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.jenis.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [warehouseItems, searchQuery]);

  const filteredUsers = useMemo(() => {
    return users.filter(u => 
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) || 
      u.role.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [users, searchQuery]);

  const handleAiChat = async () => {
    if (!aiInput.trim()) return;
    const userMsg = aiInput;
    setAiMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setAiInput('');
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const model = "gemini-3-flash-preview";
      
      const context = `
        You are an IT Product Assistant. Here is the current product catalog:
        ${JSON.stringify(products.map(p => ({ name: p.name, sdp: p.sdp, srp: p.srp, config: p.config, stock: p.stock_status })))}
        
        Answer questions about products, prices (SDP, SRP), and configurations accurately.
        
        CRITICAL RULE: NEVER disclose HPP (Cost Price) information. If asked about HPP or cost price, politely state that you are not authorized to share that information.
        
        Format your response clearly. Use bullet points for specifications but avoid excessive markdown if possible.
      `;

      const response = await ai.models.generateContent({
        model,
        contents: [
          { role: 'user', parts: [{ text: context }] },
          ...aiMessages.map(m => ({ role: m.role === 'ai' ? 'model' : 'user', parts: [{ text: m.text }] })),
          { role: 'user', parts: [{ text: userMsg }] }
        ]
      });

      setAiMessages(prev => [...prev, { role: 'ai', text: response.text || "I'm sorry, I couldn't process that." }]);
    } catch (error) {
      console.error("AI Error:", error);
      setAiMessages(prev => [...prev, { role: 'ai', text: "Error connecting to AI assistant." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(price);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white w-full max-w-md p-8 rounded-3xl shadow-xl border border-black/5"
        >
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mb-4">
              <Package className="w-8 h-8 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">IT Hub Login</h1>
            <p className="text-sm text-black/40 mt-1">Enter your credentials to continue</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-black/40">Username</label>
              <input 
                required 
                type="text" 
                className="w-full bg-black/5 border-none rounded-xl py-3 px-4 text-sm" 
                value={loginForm.username} 
                onChange={e => setLoginForm({...loginForm, username: e.target.value})}
                placeholder="admin or sales"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-black/40">Password</label>
              <input 
                type="password" 
                className="w-full bg-black/5 border-none rounded-xl py-3 px-4 text-sm" 
                value={loginForm.password} 
                onChange={e => setLoginForm({...loginForm, password: e.target.value})}
                placeholder="Enter password (if any)"
              />
            </div>
            {loginError && (
              <p className="text-xs text-red-500 font-bold">{loginError}</p>
            )}
            <button 
              type="submit" 
              className="w-full bg-black text-white py-4 rounded-xl font-bold hover:shadow-lg transition-all mt-4"
            >
              Sign In
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F5] text-[#1A1A1A] font-sans flex flex-col md:flex-row">
      {/* Mobile Header */}
      <header className="md:hidden bg-white border-b border-black/5 px-4 py-3 flex items-center justify-between sticky top-0 z-30">
        <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
          <Package className="w-5 h-5 text-emerald-600" />
          IT Hub
        </h1>
        <button onClick={() => setIsSidebarOpen(true)} className="p-2 hover:bg-black/5 rounded-lg">
          <Menu size={24} />
        </button>
      </header>

      {/* Sidebar Overlay (Mobile) */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 w-64 bg-white border-r border-black/5 flex flex-col z-50 transition-transform duration-300 md:relative md:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6 border-b border-black/5 flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Package className="w-6 h-6 text-emerald-600" />
            IT Hub
          </h1>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-2 hover:bg-black/5 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2">
          <button 
            onClick={() => { setActiveTab('dashboard'); setIsSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'dashboard' ? 'bg-black text-white shadow-lg' : 'hover:bg-black/5 text-black/60'}`}
          >
            <LayoutDashboard size={20} />
            <span className="font-medium">Dashboard</span>
          </button>
          <button 
            onClick={() => { setActiveTab('products'); setIsSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'products' ? 'bg-black text-white shadow-lg' : 'hover:bg-black/5 text-black/60'}`}
          >
            <Package size={20} />
            <span className="font-medium">Pricelist & Config</span>
          </button>
          <button 
            onClick={() => { setActiveTab('programs'); setIsSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'programs' ? 'bg-black text-white shadow-lg' : 'hover:bg-black/5 text-black/60'}`}
          >
            <Megaphone size={20} />
            <span className="font-medium">Programs & Promos</span>
          </button>
          <button 
            onClick={() => { setActiveTab('followups'); setIsSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'followups' ? 'bg-black text-white shadow-lg' : 'hover:bg-black/5 text-black/60'}`}
          >
            <Bell size={20} />
            <span className="font-medium">Follow-ups</span>
            {followUps.filter(f => !f.is_completed).length > 0 && (
              <span className="ml-auto bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                {followUps.filter(f => !f.is_completed).length}
              </span>
            )}
          </button>
          <button 
            onClick={() => { setActiveTab('warehouse'); setIsSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'warehouse' ? 'bg-black text-white shadow-lg' : 'hover:bg-black/5 text-black/60'}`}
          >
            <Warehouse size={20} />
            <span className="font-medium">Gudang (Stock)</span>
          </button>
          {user?.role === 'admin' && (
            <button 
              onClick={() => { setActiveTab('users'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'users' ? 'bg-black text-white shadow-lg' : 'hover:bg-black/5 text-black/60'}`}
            >
              <Users size={20} />
              <span className="font-medium">User Management</span>
            </button>
          )}
        </nav>

        <div className="p-4">
          <button 
            onClick={() => { setIsAiOpen(true); setIsSidebarOpen(false); }}
            className="w-full bg-emerald-50 text-emerald-700 border border-emerald-200 p-4 rounded-2xl flex items-center gap-3 hover:bg-emerald-100 transition-colors"
          >
            <MessageSquare size={20} />
            <div className="text-left">
              <p className="text-sm font-bold">Product AI</p>
              <p className="text-[10px] opacity-70">Ask about specs & prices</p>
            </div>
          </button>
        </div>

        <div className="p-4 mt-auto border-t border-black/5">
          <div className="flex items-center gap-3 px-4 py-3 mb-2">
            <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center text-white text-[10px] font-bold">
              {user?.username.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold truncate">{user?.username}</p>
              <p className="text-[10px] text-black/40 uppercase tracking-widest">{user?.role}</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-600 hover:bg-red-50 transition-all font-medium"
          >
            <X size={20} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <header className="bg-white/80 backdrop-blur-md sticky top-0 z-20 border-b border-black/5 px-4 md:px-8 py-4 flex items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-black/30" size={18} />
            <input 
              type="text" 
              placeholder="Search..."
              className="w-full bg-black/5 border-none rounded-full py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-black/10 transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="hidden md:flex items-center gap-4 ml-4">
            <button className="p-2 hover:bg-black/5 rounded-full transition-colors relative">
              <Bell size={20} className="text-black/60" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            <div className="flex items-center gap-3 pl-4 border-l border-black/10">
              <div className="text-right hidden lg:block">
                <p className="text-xs font-bold">{user?.username}</p>
                <p className="text-[10px] text-black/40 uppercase tracking-widest leading-none">{user?.role}</p>
              </div>
              <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center text-white text-xs font-bold">
                {user?.username.charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-black/5">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                        <Package size={24} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-black/40 uppercase tracking-wider">Total Products</p>
                        <h3 className="text-2xl font-bold">{products.length}</h3>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-black/5">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-orange-50 text-orange-600 rounded-2xl">
                        <Megaphone size={24} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-black/40 uppercase tracking-wider">Active Programs</p>
                        <h3 className="text-2xl font-bold">{programs.length}</h3>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-black/5">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl">
                        <Bell size={24} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-black/40 uppercase tracking-wider">Pending Requests</p>
                        <h3 className="text-2xl font-bold">{followUps.filter(f => !f.is_completed).length}</h3>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Urgent Reminders Banner */}
                {followUps.filter(f => !f.is_completed && f.reminder_date === new Date().toISOString().split('T')[0]).length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-red-50 border border-red-100 p-6 rounded-3xl flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-red-500 text-white rounded-2xl animate-pulse">
                        <Bell size={24} />
                      </div>
                      <div>
                        <h4 className="text-red-900 font-bold">Ada Follow-up Hari Ini!</h4>
                        <p className="text-red-700 text-sm">Segera hubungi tim sales yang meminta bantuan hari ini.</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setActiveTab('followups')}
                      className="px-6 py-2 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 transition-colors"
                    >
                      Lihat Daftar
                    </button>
                  </motion.div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <section className="bg-white rounded-3xl shadow-sm border border-black/5 overflow-hidden">
                    <div className="p-6 border-b border-black/5 flex items-center justify-between">
                      <h3 className="font-bold flex items-center gap-2">
                        <Bell size={18} className="text-purple-600" />
                        Recent Sales Requests
                      </h3>
                      <button onClick={() => setActiveTab('followups')} className="text-xs font-bold text-black/40 hover:text-black uppercase tracking-wider">View All</button>
                    </div>
                    <div className="divide-y divide-black/5">
                      {followUps.slice(0, 4).map(f => (
                        <div key={f.id} className="p-4 flex items-center gap-4 hover:bg-black/[0.02] transition-colors">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${f.is_completed ? 'bg-emerald-50 text-emerald-600' : 'bg-black/5 text-black/60'}`}>
                            {f.sales_name.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-bold truncate ${f.is_completed ? 'line-through opacity-40' : ''}`}>{f.sales_name}</p>
                            <p className="text-xs text-black/40 truncate">{f.request_details}</p>
                          </div>
                          {!f.is_completed && (
                            <button 
                              onClick={() => toggleFollowUp(f.id, f.is_completed)}
                              className="p-2 hover:bg-emerald-50 text-emerald-600 rounded-full transition-colors"
                            >
                              <CheckCircle2 size={18} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="bg-white rounded-3xl shadow-sm border border-black/5 overflow-hidden">
                    <div className="p-6 border-b border-black/5 flex items-center justify-between">
                      <h3 className="font-bold flex items-center gap-2">
                        <Megaphone size={18} className="text-orange-600" />
                        Active Programs
                      </h3>
                      <button onClick={() => setActiveTab('programs')} className="text-xs font-bold text-black/40 hover:text-black uppercase tracking-wider">View All</button>
                    </div>
                    <div className="p-6 space-y-4">
                      {programs.slice(0, 2).map(p => (
                        <div key={p.id} className="p-4 border border-black/5 rounded-2xl bg-black/[0.01]">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full">
                              {p.type}
                            </span>
                            <span className="text-[10px] text-black/40 font-mono">{p.end_date}</span>
                          </div>
                          <h4 className="font-bold text-sm mb-1">{p.title}</h4>
                          <p className="text-xs text-black/60 line-clamp-2">{p.description}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              </motion.div>
            )}

            {activeTab === 'products' && (
              <motion.div 
                key="products"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl md:text-3xl font-light tracking-tight">Pricelist & Config</h2>
                    <p className="text-sm text-black/40 mt-1">Manage hardware specifications and pricing</p>
                  </div>
                  <div className="flex items-center gap-2 md:gap-3">
                    <button className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white border border-black/5 rounded-xl text-sm font-bold hover:bg-black/5 transition-all">
                      <Printer size={16} />
                      Print
                    </button>
                    {user?.role === 'admin' && (
                      <>
                        <button 
                          onClick={downloadTemplate}
                          className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white border border-black/10 rounded-xl text-sm font-bold hover:bg-black/5 transition-all"
                        >
                          <Download size={16} />
                          Template
                        </button>
                        <label className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white border border-black/10 rounded-xl text-sm font-bold hover:bg-black/5 transition-all cursor-pointer">
                          <Upload size={16} />
                          {isUploading ? 'Uploading...' : 'Upload Excel'}
                          <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
                        </label>
                        <button onClick={openAddModal} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-black text-white rounded-xl text-sm font-bold hover:shadow-lg transition-all">
                          <Plus size={16} />
                          Add Product
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Desktop Table View (Excel Style) */}
                <div className="hidden md:block bg-white border border-black/10 overflow-auto max-h-[70vh]">
                  <table className="w-full text-left border-collapse table-fixed">
                    <thead className="sticky top-0 z-10 bg-[#F8F9FA] shadow-sm">
                      <tr>
                        <th className="w-10 border border-black/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-black/60 bg-[#F1F3F4]">No</th>
                        <th className="w-48 border border-black/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-black/60 bg-[#F1F3F4]">Product Name</th>
                        <th className="border border-black/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-black/60 bg-[#F1F3F4]">Configuration / Specs</th>
                        {user?.role === 'admin' && (
                          <th className="w-24 border border-black/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-black/60 text-center bg-[#F1F3F4]">HPP</th>
                        )}
                        <th className="w-24 border border-black/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-black/60 text-center bg-[#F1F3F4]">SDP</th>
                        <th className="w-24 border border-black/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-black/60 text-center bg-[#F1F3F4]">SRP</th>
                        <th className="w-20 border border-black/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-black/60 text-center bg-[#F1F3F4]">Gudang</th>
                        <th className="w-20 border border-black/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-black/60 text-center bg-[#F1F3F4]">Stock</th>
                        <th className="w-12 border border-black/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-black/60 text-center bg-[#F1F3F4]">Doc</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProducts.map((p, index) => (
                        <tr 
                          key={p.id} 
                          className="hover:bg-blue-50/50 transition-colors group cursor-pointer even:bg-[#F8F9FA]"
                          onClick={() => setSelectedProduct(p)}
                        >
                          <td className="border border-black/10 px-3 py-2 text-xs text-black/40 text-center font-mono">
                            {index + 1}
                          </td>
                          <td className="border border-black/10 px-3 py-2">
                            <p className="text-xs font-bold text-black/80 truncate">{p.name}</p>
                            <p className="text-[9px] text-black/40 uppercase tracking-tight">{p.category}</p>
                          </td>
                          <td className="border border-black/10 px-3 py-2">
                            <p className="text-[11px] text-black/60 leading-tight line-clamp-2 relative group-hover:line-clamp-none">
                              {p.config}
                              {p.config.length > 60 && (
                                <span className="inline-block md:hidden text-[9px] text-blue-500 ml-1 font-bold">...</span>
                              )}
                            </p>
                          </td>
                          {user?.role === 'admin' && (
                            <td className="border border-black/10 px-3 py-2 text-center bg-red-50/30">
                              <p className="text-[11px] font-mono text-red-700 font-medium">{formatPrice(p.hpp)}</p>
                            </td>
                          )}
                          <td className="border border-black/10 px-3 py-2 text-center bg-blue-50/30">
                            <p className="text-[11px] font-mono text-blue-700 font-medium">{formatPrice(p.sdp)}</p>
                          </td>
                          <td className="border border-black/10 px-3 py-2 text-center bg-emerald-50/30">
                            <p className="text-[11px] font-mono text-emerald-700 font-bold">{formatPrice(p.srp)}</p>
                          </td>
                          <td className="border border-black/10 px-3 py-2 text-center bg-gray-50/50">
                            <p className={`text-[11px] font-mono font-bold ${p.warehouse_stock && p.warehouse_stock <= 5 ? 'text-red-500' : 'text-black/60'}`}>
                              {p.warehouse_stock !== undefined ? p.warehouse_stock : '-'}
                            </p>
                          </td>
                          <td className="border border-black/10 px-3 py-2 text-center">
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                              p.stock_status === 'In Stock' 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                : 'bg-orange-50 text-orange-700 border-orange-200'
                            }`}>
                              {p.stock_status}
                            </span>
                          </td>
                          <td className="border border-black/10 px-3 py-2 text-center">
                            {p.datasheet_url && (
                              <a 
                                href={p.datasheet_url} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="inline-block p-1 hover:bg-black/5 rounded text-black/40" 
                                onClick={(e) => e.stopPropagation()}
                              >
                                <FileText size={14} />
                              </a>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden space-y-4">
                  {filteredProducts.map(p => (
                    <div 
                      key={p.id} 
                      className="bg-white p-5 rounded-2xl shadow-sm border border-black/5 space-y-4"
                      onClick={() => setSelectedProduct(p)}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-bold text-sm">{p.name}</h3>
                          <p className="text-[10px] text-black/40 uppercase tracking-widest">{p.category}</p>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.stock_status === 'In Stock' ? 'bg-emerald-50 text-emerald-700' : 'bg-orange-50 text-orange-700'}`}>
                          {p.stock_status}
                        </span>
                      </div>
                      
                      <div className={`grid ${user?.role === 'admin' ? 'grid-cols-4' : 'grid-cols-3'} gap-1 py-3 border-y border-black/5`}>
                        {user?.role === 'admin' && (
                          <div className="text-center">
                            <p className="text-[8px] font-bold text-black/40 uppercase">HPP</p>
                            <p className="text-[10px] font-mono text-red-600 font-bold">{formatPrice(p.hpp)}</p>
                          </div>
                        )}
                        <div className={`text-center ${user?.role === 'admin' ? 'border-x' : 'border-r'} border-black/5`}>
                          <p className="text-[8px] font-bold text-black/40 uppercase">SDP</p>
                          <p className="text-[10px] font-mono text-blue-600 font-bold">{formatPrice(p.sdp)}</p>
                        </div>
                        <div className="text-center border-r border-black/5">
                          <p className="text-[8px] font-bold text-black/40 uppercase">SRP</p>
                          <p className="text-[10px] font-mono text-emerald-600 font-bold">{formatPrice(p.srp)}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[8px] font-bold text-black/40 uppercase">Gudang</p>
                          <p className={`text-[10px] font-mono font-bold ${p.warehouse_stock && p.warehouse_stock <= 5 ? 'text-red-500' : 'text-black/60'}`}>
                            {p.warehouse_stock !== undefined ? p.warehouse_stock : '-'}
                          </p>
                        </div>
                      </div>

                      <p className="text-xs text-black/60 line-clamp-3 leading-relaxed">
                        {p.config}
                        {p.config.length > 80 && (
                          <span className="text-blue-500 font-bold ml-1">... (Tap for more)</span>
                        )}
                      </p>

                      <div className="flex justify-end gap-2 pt-2">
                        {p.datasheet_url && (
                          <a 
                            href={p.datasheet_url} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="flex items-center gap-2 px-3 py-1.5 bg-black/5 rounded-lg text-xs font-bold text-black/60"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <FileText size={14} />
                            Datasheet
                          </a>
                        )}
                        <button className="flex items-center gap-2 px-3 py-1.5 bg-black text-white rounded-lg text-xs font-bold">
                          Detail
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'programs' && (
              <motion.div 
                key="programs"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-light tracking-tight">Marketing Programs</h2>
                    <p className="text-sm text-black/40 mt-1">Track promos, price protection, and display programs</p>
                  </div>
                  <button onClick={() => setIsProgramModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-xl text-sm font-bold hover:shadow-lg transition-all">
                    <Plus size={16} />
                    New Program
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {filteredPrograms.map(p => (
                    <div key={p.id} className="bg-white p-6 rounded-3xl shadow-sm border border-black/5 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-4">
                        <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full ${
                          p.type === 'promo' ? 'bg-blue-50 text-blue-700' : 
                          p.type === 'sell-out' ? 'bg-emerald-50 text-emerald-700' :
                          'bg-orange-50 text-orange-700'
                        }`}>
                          {p.type}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold mb-2 pr-20">{p.title}</h3>
                      <p className="text-sm text-black/60 mb-6 leading-relaxed">{p.description}</p>
                      
                      <div className="flex items-center justify-between pt-6 border-t border-black/5">
                        <div className="flex items-center gap-4">
                          <div className="text-center">
                            <p className="text-[10px] font-bold text-black/40 uppercase tracking-wider">Start</p>
                            <p className="text-xs font-mono">{p.start_date}</p>
                          </div>
                          <ChevronRight size={14} className="text-black/20" />
                          <div className="text-center">
                            <p className="text-[10px] font-bold text-black/40 uppercase tracking-wider">End</p>
                            <p className="text-xs font-mono">{p.end_date}</p>
                          </div>
                        </div>
                        <button className="p-2 bg-black/5 rounded-xl opacity-0 group-hover:opacity-100 transition-all">
                          <FileText size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'followups' && (
              <motion.div 
                key="followups"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-light tracking-tight">Sales Follow-ups</h2>
                    <p className="text-sm text-black/40 mt-1">Never forget to respond to your sales team</p>
                  </div>
                  <button onClick={() => setIsFollowUpModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-xl text-sm font-bold hover:shadow-lg transition-all">
                    <Plus size={16} />
                    Add Task
                  </button>
                </div>

                <div className="space-y-4">
                  {filteredFollowUps.map(f => (
                    <div key={f.id} className={`bg-white p-6 rounded-3xl shadow-sm border transition-all ${f.is_completed ? 'border-black/5 opacity-60' : 'border-black/10 hover:border-black/20'}`}>
                      <div className="flex items-start gap-6">
                        <button 
                          onClick={() => toggleFollowUp(f.id, f.is_completed)}
                          className={`mt-1 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${f.is_completed ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-black/10 hover:border-black/30'}`}
                        >
                          {f.is_completed && <CheckCircle2 size={14} />}
                        </button>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className={`font-bold ${f.is_completed ? 'line-through' : ''}`}>{f.sales_name}</h4>
                            <div className="flex items-center gap-2 text-[10px] font-bold text-black/40 uppercase tracking-wider">
                              <Clock size={12} />
                              Reminder: {f.reminder_date || 'No date'}
                            </div>
                          </div>
                          <p className="text-sm text-black/60 leading-relaxed">{f.request_details}</p>
                          <div className="mt-4 flex items-center gap-2">
                            <span className="text-[10px] px-2 py-0.5 bg-black/5 rounded-full font-bold text-black/40 uppercase tracking-wider">
                              Created {new Date(f.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'warehouse' && (
              <motion.div 
                key="warehouse"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl md:text-3xl font-light tracking-tight">Gudang & Stock</h2>
                    <p className="text-sm text-black/40 mt-1">Laporan posisi stock dan manajemen barang</p>
                  </div>
                  <div className="flex items-center gap-2 md:gap-3">
                    {user?.role === 'admin' && (
                      <>
                        <button 
                          onClick={downloadWarehouseTemplate}
                          className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white border border-black/10 rounded-xl text-sm font-bold hover:bg-black/5 transition-all"
                        >
                          <Download size={16} />
                          Template
                        </button>
                        <button 
                          onClick={() => warehouseFileInputRef.current?.click()}
                          className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white border border-black/10 rounded-xl text-sm font-bold hover:bg-black/5 transition-all cursor-pointer"
                        >
                          <Upload size={16} />
                          {isWarehouseUploading ? 'Uploading...' : 'Upload Excel'}
                        </button>
                        <input 
                          ref={warehouseFileInputRef}
                          type="file" 
                          accept=".xlsx, .xls" 
                          className="hidden" 
                          onChange={handleWarehouseFileUpload} 
                          disabled={isWarehouseUploading} 
                        />
                        <button 
                          onClick={() => setIsWarehouseBulkOpen(true)}
                          className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white border border-black/10 rounded-xl text-sm font-bold hover:bg-black/5 transition-all"
                        >
                          <FileText size={16} />
                          Bulk Paste
                        </button>
                        <button onClick={() => setIsWarehouseModalOpen(true)} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-black text-white rounded-xl text-sm font-bold hover:shadow-lg transition-all">
                          <Plus size={16} />
                          Tambah Barang
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Warehouse Table / Mobile Cards */}
                <div className="bg-white border border-black/10 rounded-3xl overflow-hidden shadow-sm">
                  {/* Desktop View */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[#F8F9FA] border-b border-black/5">
                          <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-black/40">No</th>
                          <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-black/40">Jenis</th>
                          <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-black/40">Kode Barang</th>
                          <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-black/40">Nama Barang</th>
                          <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-black/40 text-center">Kuantiti</th>
                          <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-black/40 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/5">
                        {filteredWarehouseItems.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-6 py-12 text-center text-black/40 text-sm italic">Belum ada data di gudang.</td>
                          </tr>
                        ) : (
                          filteredWarehouseItems.map((item, index) => (
                            <tr key={item.id} className="hover:bg-black/[0.02] transition-colors group">
                              <td className="px-6 py-4 text-sm text-black/40">{index + 1}</td>
                              <td className="px-6 py-4">
                                <span className="text-[10px] font-bold px-2 py-0.5 bg-black/5 rounded-full uppercase tracking-wider text-black/60">
                                  {item.jenis}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-sm font-mono font-bold">{item.kode_barang}</td>
                              <td className="px-6 py-4 text-sm font-medium">{item.nama_barang}</td>
                              <td className="px-6 py-4 text-center">
                                <span className={`text-sm font-mono font-bold ${item.kuantiti <= 5 ? 'text-red-500' : 'text-black/60'}`}>
                                  {item.kuantiti}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                {user?.role === 'admin' && (
                                  <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                    <button 
                                      onClick={() => openEditWarehouseModal(item)}
                                      className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                                    >
                                      <Edit size={14} />
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteWarehouseItem(item.id)}
                                      className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile View */}
                  <div className="md:hidden divide-y divide-black/5">
                    {filteredWarehouseItems.length === 0 ? (
                      <div className="px-6 py-12 text-center text-black/40 text-sm italic">Belum ada data di gudang.</div>
                    ) : (
                      filteredWarehouseItems.map((item) => (
                        <div key={item.id} className="p-4 space-y-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[9px] font-bold px-1.5 py-0.5 bg-black/5 rounded-full uppercase tracking-wider text-black/60">
                                  {item.jenis}
                                </span>
                                <span className="text-[10px] font-mono font-bold text-black/40">{item.kode_barang}</span>
                              </div>
                              <h4 className="text-sm font-bold text-black/80">{item.nama_barang}</h4>
                            </div>
                            <div className="text-right">
                              <p className="text-[9px] font-bold text-black/40 uppercase tracking-widest mb-0.5">Stock</p>
                              <p className={`text-lg font-mono font-bold ${item.kuantiti <= 5 ? 'text-red-500' : 'text-black/60'}`}>
                                {item.kuantiti}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center justify-end gap-3 pt-2 border-t border-black/[0.03]">
                            {user?.role === 'admin' && (
                              <>
                                <button 
                                  onClick={() => openEditWarehouseModal(item)}
                                  className="flex items-center gap-1.5 text-xs font-bold text-blue-600 px-3 py-1.5 bg-blue-50 rounded-lg"
                                >
                                  <Edit size={12} />
                                  Edit
                                </button>
                                <button 
                                  onClick={() => handleDeleteWarehouseItem(item.id)}
                                  className="flex items-center gap-1.5 text-xs font-bold text-red-600 px-3 py-1.5 bg-red-50 rounded-lg"
                                >
                                  <Trash2 size={12} />
                                  Hapus
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'users' && user?.role === 'admin' && (
              <motion.div 
                key="users"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl md:text-3xl font-light tracking-tight">User Management</h2>
                    <p className="text-sm text-black/40 mt-1">Manage accounts and access roles</p>
                  </div>
                  <button 
                    onClick={() => {
                      setIsUserEditing(false);
                      setNewUser({ username: '', password: '', role: 'sales' });
                      setIsUserModalOpen(true);
                    }}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-black text-white rounded-xl text-sm font-bold hover:shadow-lg transition-all"
                  >
                    <Plus size={18} />
                    Add New User
                  </button>
                </div>

                <div className="bg-white border border-black/10 rounded-3xl overflow-hidden shadow-sm">
                  {/* Desktop View */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[#F8F9FA] border-b border-black/5">
                          <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-black/40">Username</th>
                          <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-black/40">Role</th>
                          <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-black/40 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/5">
                        {filteredUsers.map(u => (
                          <tr key={u.id} className="hover:bg-black/[0.01] transition-colors group">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-black/5 rounded-full flex items-center justify-center text-black/40 font-bold text-xs uppercase">
                                  {u.username.charAt(0)}
                                </div>
                                <span className="font-bold text-sm">{u.username}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${u.role === 'admin' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'}`}>
                                {u.role}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-2 transition-all">
                                <button 
                                  onClick={() => openEditUserModal(u)}
                                  className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                                >
                                  <Edit size={16} />
                                </button>
                                {user?.username.toLowerCase() !== u.username.toLowerCase() && (
                                  <button 
                                    onClick={() => setUserToDelete(u.id)}
                                    className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile View */}
                  <div className="md:hidden divide-y divide-black/5">
                    {filteredUsers.map(u => (
                      <div key={u.id} className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-black/5 rounded-full flex items-center justify-center text-black/40 font-bold text-sm uppercase">
                            {u.username.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-sm">{u.username}</p>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider ${u.role === 'admin' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'}`}>
                              {u.role}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => openEditUserModal(u)}
                            className="p-2 bg-blue-50 text-blue-600 rounded-lg"
                          >
                            <Edit size={16} />
                          </button>
                          {user?.username.toLowerCase() !== u.username.toLowerCase() && (
                            <button 
                              onClick={() => setUserToDelete(u.id)}
                              className="p-2 bg-red-50 text-red-600 rounded-lg"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Modals */}
      <AnimatePresence>
        {/* Warehouse Bulk Paste Modal */}
        {isWarehouseBulkOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsWarehouseBulkOpen(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-black/5 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold">Bulk Import Gudang (Copy-Paste)</h3>
                  <p className="text-xs text-black/40 mt-1">Salin baris dari Excel dan tempel di sini</p>
                </div>
                <button onClick={() => setIsWarehouseBulkOpen(false)} className="p-2 hover:bg-black/5 rounded-full"><X size={20} /></button>
              </div>
              <div className="p-6 space-y-4">
                <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                  <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest mb-2">Format Kolom (Urutan):</p>
                  <p className="text-xs text-emerald-800 font-mono">Jenis [Tab] Kode Barang [Tab] Nama Barang [Tab] Kuantiti</p>
                </div>
                <textarea 
                  className="w-full h-64 bg-black/5 border-none rounded-2xl p-4 text-xs font-mono focus:ring-2 focus:ring-black/5"
                  placeholder="Tempel data Excel di sini..."
                  value={warehouseBulkInput}
                  onChange={(e) => setWarehouseBulkInput(e.target.value)}
                />
                <div className="flex gap-3">
                  <button onClick={() => setIsWarehouseBulkOpen(false)} className="flex-1 py-3 border border-black/10 rounded-xl font-bold hover:bg-black/5 transition-all">Batal</button>
                  <button onClick={handleWarehouseBulkPaste} className="flex-1 bg-black text-white py-3 rounded-xl font-bold hover:shadow-lg transition-all">Import Sekarang</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Warehouse Modal */}
        {isWarehouseModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setIsWarehouseModalOpen(false); setIsWarehouseEditing(false); setWarehouseEditingId(null); setNewWarehouseItem({ jenis: '', kode_barang: '', nama_barang: '', kuantiti: '' }); }} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-black/5 flex items-center justify-between">
                <h3 className="text-xl font-bold">{isWarehouseEditing ? 'Edit Barang Gudang' : 'Tambah Barang ke Gudang'}</h3>
                <button onClick={() => { setIsWarehouseModalOpen(false); setIsWarehouseEditing(false); setWarehouseEditingId(null); setNewWarehouseItem({ jenis: '', kode_barang: '', nama_barang: '', kuantiti: '' }); }} className="p-2 hover:bg-black/5 rounded-full"><X size={20} /></button>
              </div>
              <form onSubmit={handleAddWarehouseItem} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-black/40">Jenis Barang</label>
                    <input required type="text" className="w-full bg-black/5 border-none rounded-xl py-2 px-3 text-sm" value={newWarehouseItem.jenis} onChange={e => setNewWarehouseItem({...newWarehouseItem, jenis: e.target.value})} placeholder="e.g. Hardware, Sparepart" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-black/40">Kode Barang</label>
                    <input required type="text" className="w-full bg-black/5 border-none rounded-xl py-2 px-3 text-sm font-mono" value={newWarehouseItem.kode_barang} onChange={e => setNewWarehouseItem({...newWarehouseItem, kode_barang: e.target.value})} placeholder="e.g. LAP-001" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-black/40">Nama Barang</label>
                  <input required type="text" className="w-full bg-black/5 border-none rounded-xl py-2 px-3 text-sm" value={newWarehouseItem.nama_barang} onChange={e => setNewWarehouseItem({...newWarehouseItem, nama_barang: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-black/40">Kuantiti (Stock)</label>
                  <input required type="number" className="w-full bg-black/5 border-none rounded-xl py-2 px-3 text-sm font-mono" value={newWarehouseItem.kuantiti} onChange={e => setNewWarehouseItem({...newWarehouseItem, kuantiti: e.target.value})} />
                </div>
                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => setIsWarehouseModalOpen(false)} className="flex-1 py-3 border border-black/10 rounded-xl font-bold hover:bg-black/5 transition-all">Batal</button>
                  <button type="submit" className="flex-1 bg-black text-white py-3 rounded-xl font-bold hover:shadow-lg transition-all">Simpan Barang</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {isProductModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsProductModalOpen(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-black/5 flex items-center justify-between">
                <h3 className="text-xl font-bold">{isEditing ? 'Edit Product' : 'Add New Product'}</h3>
                <button onClick={() => { setIsProductModalOpen(false); resetProductForm(); }} className="p-2 hover:bg-black/5 rounded-full"><X size={20} /></button>
              </div>
              <form onSubmit={handleAddProduct} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-black/40">Product Name</label>
                    <input required type="text" className="w-full bg-black/5 border-none rounded-xl py-2 px-3 text-sm" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-black/40">SKU / Kode Barang</label>
                    <input type="text" className="w-full bg-black/5 border-none rounded-xl py-2 px-3 text-sm" value={newProduct.sku} onChange={e => setNewProduct({...newProduct, sku: e.target.value})} placeholder="Link to Warehouse" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-black/40">Category</label>
                    <select className="w-full bg-black/5 border-none rounded-xl py-2 px-3 text-sm" value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value})}>
                      <option>Laptop</option><option>Desktop</option><option>Server</option><option>Networking</option><option>Storage</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-black/40">Stock Status</label>
                    <select className="w-full bg-black/5 border-none rounded-xl py-2 px-3 text-sm" value={newProduct.stock_status} onChange={e => setNewProduct({...newProduct, stock_status: e.target.value})}>
                      <option>In Stock</option><option>Limited Stock</option><option>Out of Stock</option><option>Indent</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-black/40">HPP (Cost)</label>
                    <input required type="number" className="w-full bg-black/5 border-none rounded-xl py-2 px-3 text-sm font-mono" value={newProduct.hpp} onChange={e => setNewProduct({...newProduct, hpp: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-black/40">SDP (Dealer)</label>
                    <input required type="number" className="w-full bg-black/5 border-none rounded-xl py-2 px-3 text-sm font-mono" value={newProduct.sdp} onChange={e => setNewProduct({...newProduct, sdp: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-black/40">SRP (Retail)</label>
                    <input required type="number" className="w-full bg-black/5 border-none rounded-xl py-2 px-3 text-sm font-mono" value={newProduct.srp} onChange={e => setNewProduct({...newProduct, srp: e.target.value})} />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-black/40">Configuration Details</label>
                  <textarea required rows={3} className="w-full bg-black/5 border-none rounded-xl py-2 px-3 text-sm" value={newProduct.config} onChange={e => setNewProduct({...newProduct, config: e.target.value})} placeholder="e.g. Intel i7, 16GB RAM, 512GB SSD" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-black/40">Photo URL</label>
                    <input type="text" className="w-full bg-black/5 border-none rounded-xl py-2 px-3 text-sm" value={newProduct.photo_url} onChange={e => setNewProduct({...newProduct, photo_url: e.target.value})} placeholder="https://..." />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-black/40">Datasheet URL</label>
                    <input type="text" className="w-full bg-black/5 border-none rounded-xl py-2 px-3 text-sm" value={newProduct.datasheet_url} onChange={e => setNewProduct({...newProduct, datasheet_url: e.target.value})} placeholder="https://..." />
                  </div>
                </div>
                <button type="submit" className="w-full bg-black text-white py-3 rounded-xl font-bold hover:shadow-lg transition-all mt-4">
                  {isEditing ? 'Update Product' : 'Save Product'}
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {isProgramModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsProgramModalOpen(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-black/5 flex items-center justify-between">
                <h3 className="text-xl font-bold">New Marketing Program</h3>
                <button onClick={() => setIsProgramModalOpen(false)} className="p-2 hover:bg-black/5 rounded-full"><X size={20} /></button>
              </div>
              <form onSubmit={handleAddProgram} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-black/40">Program Title</label>
                  <input required type="text" className="w-full bg-black/5 border-none rounded-xl py-2 px-3 text-sm" value={newProgram.title} onChange={e => setNewProgram({...newProgram, title: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-black/40">Program Type</label>
                  <select className="w-full bg-black/5 border-none rounded-xl py-2 px-3 text-sm" value={newProgram.type} onChange={e => setNewProgram({...newProgram, type: e.target.value})}>
                    <option value="promo">Promo</option>
                    <option value="sell-out">Sell-out Program</option>
                    <option value="price-protection">Price Protection</option>
                    <option value="display">Display Program</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-black/40">Description</label>
                  <textarea required rows={3} className="w-full bg-black/5 border-none rounded-xl py-2 px-3 text-sm" value={newProgram.description} onChange={e => setNewProgram({...newProgram, description: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-black/40">Start Date</label>
                    <input required type="date" className="w-full bg-black/5 border-none rounded-xl py-2 px-3 text-sm" value={newProgram.start_date} onChange={e => setNewProgram({...newProgram, start_date: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-black/40">End Date</label>
                    <input required type="date" className="w-full bg-black/5 border-none rounded-xl py-2 px-3 text-sm" value={newProgram.end_date} onChange={e => setNewProgram({...newProgram, end_date: e.target.value})} />
                  </div>
                </div>
                <button type="submit" className="w-full bg-black text-white py-3 rounded-xl font-bold hover:shadow-lg transition-all mt-4">Launch Program</button>
              </form>
            </motion.div>
          </div>
        )}

        {isFollowUpModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsFollowUpModalOpen(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-black/5 flex items-center justify-between">
                <h3 className="text-xl font-bold">New Sales Follow-up</h3>
                <button onClick={() => setIsFollowUpModalOpen(false)} className="p-2 hover:bg-black/5 rounded-full"><X size={20} /></button>
              </div>
              <form onSubmit={handleAddFollowUp} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-black/40">Sales Name</label>
                  <input required type="text" className="w-full bg-black/5 border-none rounded-xl py-2 px-3 text-sm" value={newFollowUp.sales_name} onChange={e => setNewFollowUp({...newFollowUp, sales_name: e.target.value})} placeholder="Who is asking?" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-black/40">Request Details</label>
                  <textarea required rows={3} className="w-full bg-black/5 border-none rounded-xl py-2 px-3 text-sm" value={newFollowUp.request_details} onChange={e => setNewFollowUp({...newFollowUp, request_details: e.target.value})} placeholder="What do they need? (e.g. Pricelist for Project X)" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-black/40">Reminder Date</label>
                  <input required type="date" className="w-full bg-black/5 border-none rounded-xl py-2 px-3 text-sm" value={newFollowUp.reminder_date} onChange={e => setNewFollowUp({...newFollowUp, reminder_date: e.target.value})} />
                </div>
                <button type="submit" className="w-full bg-black text-white py-3 rounded-xl font-bold hover:shadow-lg transition-all mt-4">Add Follow-up</button>
              </form>
            </motion.div>
          </div>
        )}

        {isUserModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsUserModalOpen(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-black/5 flex items-center justify-between">
                <h3 className="text-xl font-bold">{isUserEditing ? 'Edit User' : 'Add New User'}</h3>
                <button onClick={() => setIsUserModalOpen(false)} className="p-2 hover:bg-black/5 rounded-full"><X size={20} /></button>
              </div>
              <form onSubmit={handleAddUser} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-black/40">Username</label>
                  <input required type="text" className="w-full bg-black/5 border-none rounded-xl py-2 px-3 text-sm" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-black/40">Password {isUserEditing && '(Biarkan kosong jika tidak ingin ganti)'}</label>
                  <input type="password" className="w-full bg-black/5 border-none rounded-xl py-2 px-3 text-sm" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-black/40">Role</label>
                  <select className="w-full bg-black/5 border-none rounded-xl py-2 px-3 text-sm" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
                    <option value="sales">Sales</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <button type="submit" className="w-full bg-black text-white py-3 rounded-xl font-bold hover:shadow-lg transition-all mt-4">
                  {isUserEditing ? 'Update User' : 'Create User'}
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {userToDelete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setUserToDelete(null)} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white w-full max-w-sm rounded-3xl shadow-2xl p-8 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-xl font-bold mb-2">Hapus User?</h3>
              <p className="text-sm text-black/40 mb-8">Tindakan ini tidak dapat dibatalkan. Akun user akan dihapus permanen dari sistem.</p>
              <div className="flex gap-3">
                <button onClick={() => setUserToDelete(null)} className="flex-1 py-3 border border-black/10 rounded-xl font-bold hover:bg-black/5 transition-all">Batal</button>
                <button onClick={() => handleDeleteUser(userToDelete)} className="flex-1 bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700 shadow-lg shadow-red-200 transition-all">Ya, Hapus</button>
              </div>
            </motion.div>
          </div>
        )}

        {selectedProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedProduct(null)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-black/5 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold">{selectedProduct.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs text-black/40 uppercase tracking-widest">{selectedProduct.category}</p>
                    {selectedProduct.sku && (
                      <span className="text-[10px] bg-black/5 px-2 py-0.5 rounded-full font-mono text-black/60">
                        SKU: {selectedProduct.sku}
                      </span>
                    )}
                  </div>
                </div>
                <button onClick={() => setSelectedProduct(null)} className="p-2 hover:bg-black/5 rounded-full"><X size={20} /></button>
              </div>
              <div className="p-8 space-y-8">
                <div className={`grid ${user?.role === 'admin' ? 'grid-cols-3' : 'grid-cols-2'} gap-6`}>
                  {user?.role === 'admin' && (
                    <div className="p-4 bg-red-50 rounded-2xl">
                      <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-1">HPP (Cost)</p>
                      <p className="text-lg font-mono font-bold text-red-600">{formatPrice(selectedProduct.hpp)}</p>
                    </div>
                  )}
                  <div className="p-4 bg-blue-50 rounded-2xl">
                    <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-1">SDP (Dealer)</p>
                    <p className="text-lg font-mono font-bold text-blue-600">{formatPrice(selectedProduct.sdp)}</p>
                  </div>
                  <div className="p-4 bg-emerald-50 rounded-2xl">
                    <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1">SRP (Retail)</p>
                    <p className="text-lg font-mono font-bold text-emerald-600">{formatPrice(selectedProduct.srp)}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-black/40">Full Specifications</h4>
                  <div className="bg-black/5 p-6 rounded-2xl">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap text-black/70">
                      {selectedProduct.config}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4">
                  <div className="flex items-center gap-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${selectedProduct.stock_status === 'In Stock' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>
                      {selectedProduct.stock_status}
                    </span>
                    <div className="flex gap-2">
                      {user?.role === 'admin' && (
                        <>
                          <button 
                            onClick={() => openEditModal(selectedProduct)}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl font-bold hover:bg-blue-100 transition-colors"
                          >
                            <Edit size={16} />
                            Edit
                          </button>
                          
                          {confirmDeleteId === selectedProduct.id ? (
                            <div className="flex items-center gap-2 bg-red-50 px-2 py-1 rounded-xl border border-red-100">
                              <span className="text-xs text-red-600 font-bold px-2">Yakin hapus?</span>
                              <button 
                                onClick={() => handleDeleteProduct(selectedProduct.id)}
                                className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-colors"
                              >
                                Ya
                              </button>
                              <button 
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-3 py-1.5 bg-white text-black/60 rounded-lg text-xs font-bold hover:bg-black/5 transition-colors border border-black/5"
                              >
                                Batal
                              </button>
                            </div>
                          ) : (
                            <button 
                              onClick={() => setConfirmDeleteId(selectedProduct.id)}
                              className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100 transition-colors"
                            >
                              <Trash2 size={16} />
                              Hapus
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-3">
                    {selectedProduct.datasheet_url && (
                      <a 
                        href={selectedProduct.datasheet_url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="flex items-center gap-2 px-6 py-3 bg-black text-white rounded-xl font-bold hover:shadow-lg transition-all"
                      >
                        <FileText size={18} />
                        Open Datasheet
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* AI Chat Drawer */}
      <AnimatePresence>
        {isAiOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAiOpen(false)}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="fixed right-0 top-0 bottom-0 w-full md:w-[400px] bg-white shadow-2xl z-50 flex flex-col"
            >
              <div className="p-6 border-b border-black/5 flex items-center justify-between bg-emerald-600 text-white">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <MessageSquare size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold">Product Assistant</h3>
                    <p className="text-[10px] opacity-80">Powered by Gemini AI</p>
                  </div>
                </div>
                <button onClick={() => setIsAiOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#F9F9F9]">
                {aiMessages.length === 0 && (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <MessageSquare size={32} />
                    </div>
                    <p className="text-sm font-bold text-black/60">How can I help you today?</p>
                    <p className="text-xs text-black/40 mt-1">Ask about product specs, prices, or stock status.</p>
                  </div>
                )}
                {aiMessages.map((m, i) => (
                  <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`relative group max-w-[90%] p-4 rounded-2xl text-sm ${
                      m.role === 'user' ? 'bg-black text-white rounded-tr-none' : 'bg-white border border-black/5 shadow-sm rounded-tl-none'
                    }`}>
                      <div className="markdown-body">
                        <ReactMarkdown>{m.text}</ReactMarkdown>
                      </div>
                      {m.role === 'ai' && (
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(m.text);
                            // Simple feedback could be added here
                          }}
                          className="absolute -right-10 top-0 p-2 bg-white border border-black/5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-black/5"
                          title="Copy to clipboard"
                        >
                          <Copy size={14} className="text-black/40" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-black/5 shadow-sm p-4 rounded-2xl rounded-tl-none">
                      <div className="flex gap-1">
                        <span className="w-1.5 h-1.5 bg-black/20 rounded-full animate-bounce"></span>
                        <span className="w-1.5 h-1.5 bg-black/20 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                        <span className="w-1.5 h-1.5 bg-black/20 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-black/5 bg-white">
                <div className="relative">
                  <input 
                    type="text" 
                    placeholder="Type your question..."
                    className="w-full bg-black/5 border-none rounded-2xl py-4 pl-4 pr-14 text-sm focus:ring-2 focus:ring-emerald-500/20 transition-all"
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAiChat()}
                  />
                  <button 
                    onClick={handleAiChat}
                    disabled={isLoading}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50"
                  >
                    <Send size={18} />
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
