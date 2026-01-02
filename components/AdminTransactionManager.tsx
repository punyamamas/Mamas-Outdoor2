
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ClipboardList, Loader2, Calendar, Eye, Trash2, X, User, CreditCard, Banknote, ArrowRightLeft, Save, Calculator, CheckCircle, RotateCcw, Wallet, Edit, Plus, Minus, Search, ShoppingBag, Printer, Filter, DollarSign, Receipt, BarChart3, TrendingUp, Lightbulb, AlertTriangle, ArrowUpRight, Share2, Image as ImageIcon, CreditCard as CardIcon, ExternalLink, QrCode, FileText, Clock, ShieldCheck, ChevronDown, ChevronUp, Upload, LogIn, LogOut, FileCheck, PackagePlus, Camera, RefreshCw, MessageCircle, History, CreditCard as IdCard, ChevronLeft, ChevronRight, Bluetooth, Grid, List } from 'lucide-react';
import { Transaction, Product, CartItem, UserDetails } from '../types';
import { updateTransactionPayment, updateTransactionItems, updateTransactionDetails, printInvoice, applyTransactionFine, calculateOverdueFine, copyInvoiceToClipboard, uploadPaymentProof, createTransaction, calculateItemPriceForDuration, recordPaymentLog, uploadIdentityProof, sendWhatsAppInvoice, sendImageInvoiceToWhatsapp } from '../services/transactionService';
import { processStockReduction, processStockRestoration } from '../services/productService';
import { printTransactionReceipt } from '../services/bluetoothPrinterService';
import QRScannerModal from './QRScannerModal'; 
import ImageLoader from './ImageLoader'; // Import ImageLoader

interface AdminTransactionManagerProps {
  transactions: Transaction[];
  isLoading: boolean;
  products: Product[];
  onStatusUpdate: (id: string, newStatus: string) => Promise<boolean>;
  onDeleteTransaction: (id: string) => Promise<void>;
  onRefreshData: () => Promise<void>;
  // Pagination & Filter Props
  totalCount: number;
  currentPage: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  filterStatus: string;
  onFilterChange: (status: string) => void;
}

const AdminTransactionManager: React.FC<AdminTransactionManagerProps> = ({ 
  transactions, 
  isLoading, 
  products, 
  onStatusUpdate, 
  onDeleteTransaction,
  onRefreshData,
  totalCount,
  currentPage,
  itemsPerPage,
  onPageChange,
  searchTerm,
  onSearchChange,
  filterStatus,
  onFilterChange
}) => {
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  // --- EDIT MODE STATES ---
  const [isEditingData, setIsEditingData] = useState(false);
  const [editForm, setEditForm] = useState<{
    customerName: string;
    customerWhatsapp: string;
    customerIdentity: string; 
    rentalDate: string;
    duration: number;
    fineAmount: number;
    items: CartItem[]; 
  }>({ customerName: '', customerWhatsapp: '', customerIdentity: '', rentalDate: '', duration: 0, fineAmount: 0, items: [] });
  
  // Scanner State
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerContext, setScannerContext] = useState<'search_trx' | 'add_item_create' | 'add_item_edit'>('search_trx');

  // POS (Create Transaction) States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTrxDetails, setNewTrxDetails] = useState<UserDetails>({
    name: '', whatsapp: '', location: '', rentalDate: new Date().toISOString().split('T')[0], duration: 2, paymentMethod: 'cash'
  });
  const [newTrxItems, setNewTrxItems] = useState<CartItem[]>([]);
  const [newTrxSearch, setNewTrxSearch] = useState('');
  const [newTrxStatus, setNewTrxStatus] = useState('booked');
  const [newTrxPaid, setNewTrxPaid] = useState<number>(0);
  const [isCreating, setIsCreating] = useState(false);
  const [posCategory, setPosCategory] = useState('Semua'); // NEW: POS Category Filter

  // Payment Recording State
  const [newPaymentAmount, setNewPaymentAmount] = useState<number>(0);
  const [newPaymentMethod, setNewPaymentMethod] = useState<'cash' | 'transfer'>('cash');
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);

  // Identity Photo State
  const [isUploadingIdentity, setIsUploadingIdentity] = useState(false);

  // Extract Categories dynamically from products
  const posCategories = useMemo(() => {
      const cats = new Set(products.map(p => p.category));
      return ['Semua', ...Array.from(cats)];
  }, [products]);

  // --- Handlers ---
  const openEditModal = (trx: Transaction) => {
    setSelectedTransaction(trx);
    setIsEditingData(false); 
    setEditForm({
        customerName: trx.customerName,
        customerWhatsapp: trx.customerWhatsapp,
        customerIdentity: trx.customerIdentity || '', 
        rentalDate: trx.rentalDate.split('T')[0],
        duration: trx.duration,
        fineAmount: trx.fineAmount || 0,
        items: JSON.parse(JSON.stringify(trx.items)) 
    });
    setNewPaymentAmount(0); // Reset Payment Input
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    setSelectedTransaction(null);
    setIsEditModalOpen(false);
  };

  const handleStatusChange = async (id: string, status: string) => {
    if (!selectedTransaction) return;

    if (status === 'completed' && selectedTransaction.status === 'rented') {
        const potentialFine = calculateOverdueFine(selectedTransaction);
        
        if (potentialFine > 0 && (selectedTransaction.fineAmount || 0) === 0) {
            const confirmFine = window.confirm(
                `⚠️ PERINGATAN KETERLAMBATAN!\n\n` +
                `Sistem mendeteksi keterlambatan pengembalian.\n` +
                `Estimasi Denda: Rp${potentialFine.toLocaleString('id-ID')}\n\n` +
                `Klik OK untuk MENERAPKAN denda otomatis & selesaikan.\n` +
                `Klik Cancel untuk mengabaikan denda (hanya selesaikan).`
            );

            if (confirmFine) {
                await applyTransactionFine(id, potentialFine);
                setSelectedTransaction(prev => prev ? { 
                    ...prev, 
                    fineAmount: potentialFine, 
                    totalPrice: prev.totalPrice + potentialFine 
                } : null);
            }
        }
    }

    await onStatusUpdate(id, status);
    if (selectedTransaction && selectedTransaction.id === id) {
        setSelectedTransaction({ ...selectedTransaction, status: status as any });
    }
  };

  // FITUR: TAMBAH PEMBAYARAN
  const handleAddPayment = async () => {
    if (!selectedTransaction || newPaymentAmount <= 0) return;
    setIsRecordingPayment(true);

    try {
        const remainingBill = Math.max(0, selectedTransaction.totalPrice - selectedTransaction.amountPaid);
        const realIncome = Math.min(newPaymentAmount, remainingBill);
        const currentPaid = selectedTransaction.amountPaid || 0;
        const updatedPaid = currentPaid + realIncome;
        
        await updateTransactionPayment(selectedTransaction.id, updatedPaid);

        if (realIncome > 0) {
            await recordPaymentLog({
                transaction_id: selectedTransaction.id,
                amount: realIncome,
                payment_method: newPaymentMethod,
                type: 'IN',
                description: `Pelunasan/Cicilan Sewa #${selectedTransaction.id.slice(0,6)}`,
                category: 'Sewa'
            });
        }

        setSelectedTransaction({ ...selectedTransaction, amountPaid: updatedPaid });
        
        const change = newPaymentAmount - realIncome;
        if (change > 0) {
            alert(`✅ Pembayaran Berhasil!\n\n💰 KEMBALIAN: Rp${change.toLocaleString('id-ID')}\n(Uang masuk ke Kas: Rp${realIncome.toLocaleString('id-ID')})`);
        } else {
            alert(`✅ Pembayaran Rp${realIncome.toLocaleString('id-ID')} Berhasil Dicatat.`);
        }

        setNewPaymentAmount(0);
        await onRefreshData();
    } catch (e) {
        console.error("Payment Error", e);
        alert("Gagal mencatat pembayaran.");
    } finally {
        setIsRecordingPayment(false);
    }
  };

  const handleAddEditItem = (product: Product) => {
    setEditForm(prev => {
        const existing = prev.items.find(i => i.id === product.id && !i.selectedSize && !i.selectedColor);
        let newItems;
        const hasVariants = (product.sizes && Object.keys(product.sizes).length > 0) || (product.variants && product.variants.length > 0);
        
        if (existing && !hasVariants) {
            newItems = prev.items.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
        } else {
            newItems = [...prev.items, { ...product, quantity: 1, selectedSize: '', selectedColor: '' }];
        }
        return { ...prev, items: newItems };
    });
  };

  // Helper untuk update varian di Edit Mode
  const updateEditItemVariant = (idx: number, field: 'selectedSize' | 'selectedColor', val: string) => {
      setEditForm(prev => {
          const items = [...prev.items];
          items[idx] = { ...items[idx], [field]: val };
          return { ...prev, items };
      });
  };

  const handleUpdateEditItemQty = (idx: number, delta: number) => {
    setEditForm(prev => {
        const newItems = prev.items.map((item, i) => {
            if (i === idx) {
                return { ...item, quantity: Math.max(1, item.quantity + delta) };
            }
            return item;
        });
        return { ...prev, items: newItems };
    });
  };

  const handleRemoveEditItem = (idx: number) => {
    setEditForm(prev => ({
        ...prev,
        items: prev.items.filter((_, i) => i !== idx)
    }));
  };

  const calculateEditTotal = () => {
      const itemsTotal = editForm.items.reduce((acc, item) => {
          const price = calculateItemPriceForDuration(item, editForm.duration);
          return acc + (price * item.quantity);
      }, 0);
      return itemsTotal + editForm.fineAmount;
  };

  const handleSaveDetails = async () => {
    if (!selectedTransaction) return;
    if (editForm.items.length === 0) return alert("Transaksi tidak boleh kosong (tanpa barang).");

    // Validasi Varian
    const invalidItems = editForm.items.filter(i => {
        const prod = products.find(p => p.id === i.id);
        if (!prod) return false;
        const hasSize = prod.sizes && Object.keys(prod.sizes).length > 0;
        const hasVariant = prod.variants && prod.variants.length > 0;
        return (hasSize || hasVariant) && !i.selectedSize;
    });

    if (invalidItems.length > 0) {
        return alert(`Mohon pilih ukuran untuk: ${invalidItems.map(i => i.name).join(', ')}`);
    }

    const newTotalPrice = calculateEditTotal();
    
    const shouldUpdateStock = ['booked', 'rented', 'pending', 'partial_payment'].includes(selectedTransaction.status);
    
    if (shouldUpdateStock) {
        await processStockRestoration(selectedTransaction.items);
        await processStockReduction(editForm.items);
    }

    await updateTransactionDetails(selectedTransaction.id, {
        customerName: editForm.customerName,
        customerWhatsapp: editForm.customerWhatsapp,
        customerIdentity: editForm.customerIdentity, 
        rentalDate: editForm.rentalDate,
        duration: editForm.duration,
    });

    await updateTransactionItems(selectedTransaction.id, editForm.items, newTotalPrice);
    await applyTransactionFine(selectedTransaction.id, editForm.fineAmount);

    setSelectedTransaction({
        ...selectedTransaction,
        customerName: editForm.customerName,
        customerWhatsapp: editForm.customerWhatsapp,
        customerIdentity: editForm.customerIdentity,
        rentalDate: editForm.rentalDate,
        duration: editForm.duration,
        fineAmount: editForm.fineAmount,
        totalPrice: newTotalPrice,
        items: editForm.items
    });
    
    setIsEditingData(false);
    onRefreshData();
    alert("Data transaksi berhasil diperbarui!");
  };

  const handleUploadProof = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedTransaction || !e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const url = await uploadPaymentProof(selectedTransaction.id, file);
    if (url) {
      setSelectedTransaction({ ...selectedTransaction, paymentProofUrl: url });
      onRefreshData();
    }
  };

  const handleUploadIdentity = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedTransaction || !e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setIsUploadingIdentity(true);
    const url = await uploadIdentityProof(selectedTransaction.id, file);
    if (url) {
        setSelectedTransaction({ ...selectedTransaction, identityPhotoUrl: url });
        await onRefreshData(); // Sync DB
    }
    setIsUploadingIdentity(false);
  };

  // --- POS / NEW TRANSACTION LOGIC ---

  const handleScanSuccess = (decodedText: string) => {
      setIsScannerOpen(false);

      if (scannerContext === 'search_trx') {
          onSearchChange(decodedText);
          alert(`Scanning transaction: ${decodedText}`);
      } else {
          const product = products.find(p => p.id === decodedText);
          if (product) {
              if (scannerContext === 'add_item_create') {
                  handleAddItemToNewTrx(product);
              } else if (scannerContext === 'add_item_edit') {
                  handleAddEditItem(product);
              }
          } else {
              alert(`Produk dengan ID ${decodedText} tidak ditemukan di katalog.`);
          }
      }
  };

  const handleAddItemToNewTrx = (product: Product) => {
    const hasVariants = (product.sizes && Object.keys(product.sizes).length > 0) || (product.variants && product.variants.length > 0);
    const existing = newTrxItems.find(i => i.id === product.id && !i.selectedSize);

    if (existing && !hasVariants) {
        setNewTrxItems(prev => prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
        // Auto select first variant if available? No, user should pick.
        setNewTrxItems(prev => [...prev, { ...product, quantity: 1, selectedSize: '', selectedColor: '' }]);
    }
    setNewTrxSearch('');
  };

  const updateNewTrxItemVariant = (idx: number, field: 'selectedSize' | 'selectedColor', val: string) => {
      setNewTrxItems(prev => {
          const items = [...prev];
          items[idx] = { ...items[idx], [field]: val };
          return items;
      });
  };

  const handleRemoveItemFromNewTrx = (idx: number) => {
    setNewTrxItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateItemQtyNewTrx = (idx: number, delta: number) => {
    setNewTrxItems(prev => prev.map((item, i) => {
        if (i === idx) {
            const newQty = Math.max(1, item.quantity + delta);
            return { ...item, quantity: newQty };
        }
        return item;
    }));
  };

  const calculateNewTrxTotal = () => {
    return newTrxItems.reduce((acc, item) => {
        const price = calculateItemPriceForDuration(item, newTrxDetails.duration);
        return acc + (price * item.quantity);
    }, 0);
  };

  const handleCreateTransaction = async () => {
    if (!newTrxDetails.name || newTrxItems.length === 0) return alert("Lengkapi data pelanggan dan barang!");
    
    const invalidItems = newTrxItems.filter(i => {
        const prod = products.find(p => p.id === i.id);
        if (!prod) return false;
        const hasSize = prod.sizes && Object.keys(prod.sizes).length > 0;
        const hasVariant = prod.variants && prod.variants.length > 0;
        return (hasSize || hasVariant) && !i.selectedSize;
    });

    if (invalidItems.length > 0) {
        return alert(`Mohon pilih ukuran untuk: ${invalidItems.map(i => i.name).join(', ')}`);
    }

    setIsCreating(true);
    const total = calculateNewTrxTotal();
    
    const newTrx = await createTransaction(
        newTrxDetails, 
        newTrxItems, 
        total, 
        newTrxDetails.location,
        newTrxStatus,
        newTrxPaid
    );

    if (newTrx) {
        if (newTrxStatus !== 'cancelled' && newTrxStatus !== 'completed') {
            await processStockReduction(newTrxItems);
        }
        
        const change = newTrxPaid - total;
        if (change > 0) {
            alert(`✅ Transaksi Berhasil!\n\n💰 KEMBALIAN: Rp${change.toLocaleString('id-ID')}\n(Uang masuk ke Kas: Rp${total.toLocaleString('id-ID')})`);
        } else {
            alert("Transaksi Berhasil!");
        }

        await onRefreshData();
        setIsCreateModalOpen(false);
        // Reset POS State
        setNewTrxDetails({ name: '', whatsapp: '', location: '', rentalDate: new Date().toISOString().split('T')[0], duration: 2, paymentMethod: 'cash' });
        setNewTrxItems([]);
        setNewTrxPaid(0);
        setNewTrxStatus('booked');
        
        // Open Print/View Modal
        setSelectedTransaction(newTrx);
        setIsEditModalOpen(true);
    } else {
        alert("Gagal membuat transaksi.");
    }
    setIsCreating(false);
  };

  const openWhatsApp = (phone: string, name: string) => {
      let p = phone.replace(/\D/g, '');
      if (p.startsWith('0')) p = '62' + p.slice(1);
      const url = `https://wa.me/${p}?text=Halo Kak ${name}, kami dari Mamas Outdoor...`;
      window.open(url, '_blank');
  };

  // --- RENDER HELPERS ---

  const renderItemRow = (item: CartItem, idx: number, mode: 'edit' | 'create') => {
      const product = products.find(p => p.id === item.id);
      const hasSize = product?.sizes && Object.keys(product.sizes).length > 0;
      const hasVariant = product?.variants && product.variants.length > 0;
      
      const availableColors = hasVariant ? Array.from(new Set(product!.variants!.map(v => v.color))) : [];
      let availableSizes: string[] = [];
      
      if (hasVariant) {
          if (item.selectedColor) {
              availableSizes = product!.variants!.filter(v => v.color === item.selectedColor).map(v => v.size);
          } else {
              availableSizes = Array.from(new Set(product!.variants!.map(v => v.size)));
          }
      } else if (hasSize) {
          availableSizes = Object.keys(product!.sizes!);
      }

      // Calculate unit price for display based on duration
      const duration = mode === 'edit' ? editForm.duration : newTrxDetails.duration;
      const unitPrice = calculateItemPriceForDuration(item, duration);

      return (
        <div key={idx} className="flex flex-col bg-white p-3 rounded-xl border border-gray-200 shadow-sm gap-2 relative group hover:border-nature-300 transition-all">
            <div className="flex justify-between items-start gap-2">
                <div className="flex-1">
                    <div className="text-sm font-bold text-gray-800 line-clamp-1">{item.name}</div>
                    <div className="text-[10px] text-gray-500 font-medium">Rp{unitPrice.toLocaleString('id-ID')} x {item.quantity}</div>
                </div>
                <div className="font-bold text-sm text-nature-700">Rp{(unitPrice * item.quantity).toLocaleString('id-ID')}</div>
            </div>
            
            <div className="flex items-center justify-between gap-2">
                {/* VARIANT SELECTORS */}
                <div className="flex gap-1 flex-1">
                    {(hasSize || hasVariant) ? (
                        <>
                            {hasVariant && (
                                <select 
                                    className="bg-gray-50 border border-gray-200 text-[10px] font-bold rounded p-1 outline-none w-full"
                                    value={item.selectedColor || ''}
                                    onChange={e => mode === 'edit' ? updateEditItemVariant(idx, 'selectedColor', e.target.value) : updateNewTrxItemVariant(idx, 'selectedColor', e.target.value)}
                                >
                                    <option value="">Warna...</option>
                                    {availableColors.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            )}
                            <select 
                                className="bg-gray-50 border border-gray-200 text-[10px] font-bold rounded p-1 outline-none w-full"
                                value={item.selectedSize || ''}
                                onChange={e => mode === 'edit' ? updateEditItemVariant(idx, 'selectedSize', e.target.value) : updateNewTrxItemVariant(idx, 'selectedSize', e.target.value)}
                            >
                                <option value="">Size...</option>
                                {availableSizes.map(sz => {
                                    let stockInfo = 0;
                                    if(hasVariant && item.selectedColor) {
                                        const v = product?.variants?.find(v => v.color === item.selectedColor && v.size === sz);
                                        stockInfo = v ? v.stock : 0;
                                    } else if (hasSize) {
                                        stockInfo = product?.sizes?.[sz] || 0;
                                    }
                                    return <option key={sz} value={sz}>{sz} ({stockInfo})</option>
                                })}
                            </select>
                        </>
                    ) : (
                        <div className="text-[10px] text-gray-400 italic">Tanpa Varian</div>
                    )}
                </div>

                {/* QTY CONTROLS */}
                <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                    <button onClick={() => mode === 'edit' ? handleUpdateEditItemQty(idx, -1) : handleUpdateItemQtyNewTrx(idx, -1)} className="p-1 hover:bg-white rounded-md text-gray-600 transition"><Minus size={12}/></button>
                    <span className="text-xs w-5 text-center font-bold">{item.quantity}</span>
                    <button onClick={() => mode === 'edit' ? handleUpdateEditItemQty(idx, 1) : handleUpdateItemQtyNewTrx(idx, 1)} className="p-1 hover:bg-white rounded-md text-gray-600 transition"><Plus size={12}/></button>
                </div>
                
                <button onClick={() => mode === 'edit' ? handleRemoveEditItem(idx) : handleRemoveItemFromNewTrx(idx)} className="text-red-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-lg transition"><Trash2 size={14}/></button>
            </div>
        </div>
      );
  };

  const getPaymentChangeDisplay = (inputAmount: number, total: number) => {
      const change = inputAmount - total;
      return (
          <div className={`mt-3 p-3 rounded-xl border flex justify-between items-center ${change >= 0 ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
              <span className="text-xs font-bold uppercase">{change >= 0 ? 'Kembalian' : 'Kurang'}</span>
              <span className="text-xl font-black">Rp{Math.abs(change).toLocaleString('id-ID')}</span>
          </div>
      );
  };

  const getAddPaymentChangeDisplay = () => {
      if (!selectedTransaction) return null;
      const remaining = Math.max(0, selectedTransaction.totalPrice - selectedTransaction.amountPaid);
      const change = newPaymentAmount - remaining;
      
      if (change > 0 && newPaymentAmount > 0) {
          return (
              <div className="mt-2 text-right">
                  <span className="text-xs text-green-600 font-bold bg-green-50 px-2 py-1 rounded">Kembalian: Rp{change.toLocaleString('id-ID')}</span>
              </div>
          )
      }
      return null;
  };

  const totalPages = Math.ceil(totalCount / itemsPerPage);

  // Filtered Products for POS Grid
  const posFilteredProducts = products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(newTrxSearch.toLowerCase());
      const matchesCategory = posCategory === 'Semua' || p.category === posCategory;
      return matchesSearch && matchesCategory;
  });

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[calc(100vh-150px)]">
      
      <QRScannerModal 
         isOpen={isScannerOpen} 
         onClose={() => setIsScannerOpen(false)} 
         onScanSuccess={handleScanSuccess} 
      />

      {/* Main Admin Transaction Header (Listing) */}
      <div className="p-5 border-b border-gray-100 bg-nature-50 flex flex-col md:flex-row gap-4 justify-between items-center">
        <h3 className="font-bold text-lg text-nature-800 flex items-center gap-2">
          <ClipboardList size={20} /> Manajemen Transaksi
        </h3>
        <div className="flex flex-wrap gap-2 items-center">
           <button 
             onClick={() => { setScannerContext('search_trx'); setIsScannerOpen(true); }}
             className="p-2 bg-gray-900 text-white rounded-lg hover:bg-black transition flex items-center gap-2 shadow-sm"
             title="Scan QR Transaksi (Nota)"
           >
             <Camera size={18} /> <span className="hidden sm:inline text-xs font-bold">Scan Nota</span>
           </button>

           <div className="relative">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
              <input 
                type="text" 
                placeholder="Cari Nama / ID..." 
                className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-nature-500 outline-none"
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
              />
           </div>
           
           <select 
             className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-nature-500 outline-none font-bold text-gray-600"
             value={filterStatus}
             onChange={(e) => onFilterChange(e.target.value)}
           >
             <option value="all">Semua Status</option>
             <option value="pending">Pending</option>
             <option value="booked">Booked (Lunas)</option>
             <option value="rented">Sedang Sewa</option>
             <option value="completed">Selesai</option>
             <option value="cancelled">Batal</option>
           </select>

           <button onClick={onRefreshData} className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">
             <RotateCcw size={18} />
           </button>

           <button 
             onClick={() => setIsCreateModalOpen(true)}
             className="flex items-center gap-2 bg-nature-600 hover:bg-nature-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition"
           >
             <PackagePlus size={18} /> Buat Transaksi (POS)
           </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm text-left text-gray-600">
          <thead className="bg-white text-gray-700 font-bold uppercase text-xs border-b border-gray-200 sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="px-6 py-4 whitespace-nowrap">ID & Tanggal</th>
              <th className="px-6 py-4 whitespace-nowrap">Pelanggan</th>
              <th className="px-6 py-4 whitespace-nowrap">Status</th>
              <th className="px-6 py-4 text-right whitespace-nowrap">Total</th>
              <th className="px-6 py-4 text-center whitespace-nowrap">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              <tr><td colSpan={5} className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-nature-600"/></td></tr>
            ) : transactions.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-gray-400">Tidak ada data transaksi.</td></tr>
            ) : (
              transactions.map(trx => (
                <tr key={trx.id} className="hover:bg-gray-50 transition group cursor-pointer" onClick={() => openEditModal(trx)}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-bold text-gray-900">#{trx.id.slice(0,8)}</div>
                    <div className="text-xs text-gray-500">{new Date(trx.rentalDate).toLocaleDateString('id-ID')}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-bold text-gray-800">{trx.customerName}</div>
                    <div className="text-xs text-gray-400">{trx.customerWhatsapp}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase border ${
                      trx.status === 'pending' ? 'bg-orange-50 text-orange-600 border-orange-100' :
                      trx.status === 'booked' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                      trx.status === 'rented' ? 'bg-purple-50 text-purple-600 border-purple-100' :
                      trx.status === 'completed' ? 'bg-green-50 text-green-600 border-green-100' :
                      'bg-red-50 text-red-600 border-red-100'
                    }`}>
                      {trx.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-mono font-bold text-gray-800 whitespace-nowrap">
                    Rp{trx.totalPrice.toLocaleString('id-ID')}
                  </td>
                  <td className="px-6 py-4 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-center gap-2">
                      <button onClick={() => openEditModal(trx)} className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition"><Eye size={18}/></button>
                      <button onClick={() => onDeleteTransaction(trx.id)} className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition"><Trash2 size={18}/></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
          <div className="text-xs text-gray-500">
              Total: <strong>{totalCount}</strong> Transaksi
          </div>
          <div className="flex items-center gap-2">
              <button 
                onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 disabled:opacity-50 transition text-gray-600"
              >
                  <ChevronLeft size={16}/>
              </button>
              <span className="text-xs font-bold text-gray-700">
                  Page {currentPage} of {Math.max(1, totalPages)}
              </span>
              <button 
                onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage >= totalPages}
                className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 disabled:opacity-50 transition text-gray-600"
              >
                  <ChevronRight size={16}/>
              </button>
          </div>
      </div>

      {/* --- EDIT MODAL (RETAINED AS IS) --- */}
      {isEditModalOpen && selectedTransaction && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeEditModal}></div>
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden animate-slide-in-right">
            {/* ... Content of Edit Modal (Same as existing code to keep functionality) ... */}
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
               <div>
                  <h3 className="font-bold text-xl text-gray-900 flex items-center gap-2">
                     <ClipboardList className="text-nature-600"/> 
                     {isEditingData ? 'Edit Data Transaksi' : `Detail Transaksi #${selectedTransaction.id.slice(0,8)}`}
                  </h3>
                  {!isEditingData && <p className="text-xs text-gray-500 mt-1">Dibuat: {new Date(selectedTransaction.created_at || '').toLocaleString('id-ID')}</p>}
               </div>
               <div className="flex items-center gap-2">
                   {!isEditingData ? (
                       <>
                         <button onClick={() => openWhatsApp(selectedTransaction.customerWhatsapp, selectedTransaction.customerName)} className="flex items-center gap-1 bg-green-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-green-600 transition shadow-sm">
                             <MessageCircle size={14}/> Chat WA
                         </button>
                         <button onClick={() => setIsEditingData(true)} className="flex items-center gap-1 bg-white border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-gray-50">
                             <Edit size={14}/> Edit / Ubah
                         </button>
                       </>
                   ) : (
                       <button onClick={() => setIsEditingData(false)} className="flex items-center gap-1 bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-gray-200">
                           <X size={14}/> Batal Edit
                       </button>
                   )}
                   <button onClick={closeEditModal} className="p-2 hover:bg-gray-200 rounded-full transition"><X size={20}/></button>
               </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
               <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                  <div className="xl:col-span-2 space-y-6">
                     {isEditingData ? (
                         <div className="bg-white p-5 rounded-2xl border border-blue-200 shadow-sm animate-slide-in-right">
                             <h4 className="text-sm font-bold text-blue-800 mb-4 flex items-center gap-2"><Edit size={16}/> Edit Data Pelanggan & Barang</h4>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <div><label className="text-xs font-bold text-gray-500 block mb-1">Nama</label><input className="w-full border rounded p-2 text-sm" value={editForm.customerName} onChange={e => setEditForm({...editForm, customerName: e.target.value})} /></div>
                                <div><label className="text-xs font-bold text-gray-500 block mb-1">WA</label><input className="w-full border rounded p-2 text-sm" value={editForm.customerWhatsapp} onChange={e => setEditForm({...editForm, customerWhatsapp: e.target.value})} /></div>
                                {/* ... other fields if needed ... */}
                             </div>
                             <div className="mb-4 pt-4 border-t border-gray-100">
                                <div className="space-y-2 bg-gray-50 p-3 rounded-lg border border-gray-100 max-h-60 overflow-y-auto">
                                    {editForm.items.map((item, idx) => renderItemRow(item, idx, 'edit'))}
                                </div>
                                <div className="mt-2 text-right"><span className="font-bold text-blue-800">Rp{calculateEditTotal().toLocaleString('id-ID')}</span></div>
                             </div>
                             <div className="flex justify-end pt-2 border-t border-gray-100">
                                 <button onClick={handleSaveDetails} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm"><Save size={16}/> Simpan</button>
                             </div>
                         </div>
                     ) : (
                         <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                            <h4 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2"><CheckCircle size={16}/> Update Status</h4>
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                            {['pending', 'booked', 'rented', 'completed', 'cancelled'].map(s => (
                                <button key={s} onClick={() => handleStatusChange(selectedTransaction.id, s)} className={`px-3 py-2 rounded-xl text-xs font-bold uppercase transition border ${selectedTransaction.status === s ? 'bg-nature-600 text-white border-nature-600 shadow-md' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>{s}</button>
                            ))}
                            </div>
                         </div>
                     )}

                     {!isEditingData && (
                        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                            <h4 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2"><ShoppingBag size={16}/> Barang Sewaan</h4>
                            <div className="space-y-3">
                            {selectedTransaction.items.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl border border-gray-100">
                                    <div><div className="font-bold text-gray-800 text-sm">{item.name}</div><div className="text-xs text-gray-500">Size: {item.selectedSize||'-'} | Warna: {item.selectedColor||'-'}</div></div>
                                    <div className="font-bold text-nature-600">x{item.quantity}</div>
                                </div>
                            ))}
                            </div>
                        </div>
                     )}
                  </div>

                  <div className="space-y-6">
                     <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                        <h4 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2"><Wallet size={16}/> Pembayaran</h4>
                        <div className="space-y-4">
                           <div className="flex justify-between text-sm"><span className="text-gray-600">Total Tagihan</span><span className="font-bold text-gray-900">Rp{selectedTransaction.totalPrice.toLocaleString('id-ID')}</span></div>
                           <div className="flex justify-between text-sm"><span className="text-gray-600">Sudah Bayar</span><span className="font-bold text-green-600">Rp{selectedTransaction.amountPaid.toLocaleString('id-ID')}</span></div>
                           <div className="flex justify-between text-sm pt-2 border-t border-gray-100"><span className="text-gray-600">Sisa</span><span className="font-bold text-red-500">Rp{Math.max(0, selectedTransaction.totalPrice - selectedTransaction.amountPaid).toLocaleString('id-ID')}</span></div>
                           
                           <div className="pt-3 border-t border-gray-100">
                              <label className="text-xs font-bold text-gray-500 mb-2 block">Catat Pembayaran</label>
                              <div className="flex flex-col gap-2 bg-gray-50 p-2 rounded-lg border border-gray-100">
                                 <div className="flex gap-2">
                                    <input type="number" className="flex-1 border border-gray-200 rounded px-2 py-1 text-sm font-bold" value={newPaymentAmount||''} onChange={(e) => setNewPaymentAmount(Number(e.target.value))} />
                                    <select className="border border-gray-200 rounded px-2 py-1 text-xs" value={newPaymentMethod} onChange={(e) => setNewPaymentMethod(e.target.value as any)}><option value="cash">Cash</option><option value="transfer">TF</option></select>
                                 </div>
                                 {getAddPaymentChangeDisplay()}
                                 <button onClick={handleAddPayment} disabled={!newPaymentAmount || isRecordingPayment} className="w-full bg-green-600 text-white text-xs font-bold py-2 rounded hover:bg-green-700 transition flex items-center justify-center gap-1">{isRecordingPayment ? <Loader2 size={12} className="animate-spin"/> : <Save size={12}/>} Simpan</button>
                              </div>
                           </div>
                        </div>
                     </div>
                     
                     <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                        <h4 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2"><Printer size={16}/> Cetak</h4>
                        <div className="grid grid-cols-2 gap-3 mb-3">
                           <button onClick={() => printInvoice(selectedTransaction, 'view', 'full')} className="bg-nature-600 text-white py-2 rounded-lg text-xs font-bold">Nota Lengkap</button>
                           <button onClick={() => printInvoice(selectedTransaction, 'view', 'rental')} className="bg-white border text-gray-600 py-2 rounded-lg text-xs font-bold">Nota Sewa</button>
                        </div>
                        <button onClick={() => printTransactionReceipt(selectedTransaction)} className="w-full py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition flex items-center justify-center gap-2 shadow-sm"><Bluetooth size={14}/> 🖨️ Cetak Thermal</button>
                     </div>
                  </div>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* --- NEW FULLSCREEN POS (REDESIGNED) --- */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-[60] bg-gray-50 flex flex-col h-screen w-screen overflow-hidden">
           
           {/* Header */}
           <div className="h-16 bg-white border-b border-gray-200 flex justify-between items-center px-6 shadow-sm z-20">
              <div className="flex items-center gap-3">
                 <div className="p-2 bg-nature-600 text-white rounded-lg"><PackagePlus size={20}/></div>
                 <div>
                    <h2 className="font-bold text-lg text-gray-800 leading-tight">Kasir / POS</h2>
                    <p className="text-xs text-gray-500">Buat Transaksi Baru</p>
                 </div>
              </div>
              <button onClick={() => setIsCreateModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition text-gray-500 hover:text-red-500">
                 <X size={24} />
              </button>
           </div>

           <div className="flex flex-1 overflow-hidden">
              
              {/* LEFT SIDE: PRODUCT CATALOG */}
              <div className="flex-1 flex flex-col min-w-0 bg-gray-50 border-r border-gray-200">
                 {/* Filters & Search */}
                 <div className="p-4 bg-white border-b border-gray-100 flex gap-3 items-center sticky top-0 z-10">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                        <input 
                            autoFocus
                            type="text" 
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-100 border-none rounded-xl focus:ring-2 focus:ring-nature-500 outline-none font-medium"
                            placeholder="Cari nama barang..."
                            value={newTrxSearch}
                            onChange={(e) => setNewTrxSearch(e.target.value)}
                        />
                    </div>
                    <button onClick={() => { setScannerContext('add_item_create'); setIsScannerOpen(true); }} className="p-2.5 bg-gray-800 text-white rounded-xl hover:bg-black transition"><Camera size={20}/></button>
                 </div>
                 
                 {/* Category Pills */}
                 <div className="px-4 py-2 bg-white border-b border-gray-100 overflow-x-auto whitespace-nowrap no-scrollbar flex gap-2">
                    {posCategories.map(cat => (
                        <button 
                            key={cat}
                            onClick={() => setPosCategory(cat)}
                            className={`px-4 py-1.5 rounded-full text-xs font-bold transition ${posCategory === cat ? 'bg-nature-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                        >
                            {cat}
                        </button>
                    ))}
                 </div>

                 {/* Product Grid */}
                 <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                        {posFilteredProducts.length === 0 ? (
                            <div className="col-span-full text-center py-20 text-gray-400">
                                <Search size={48} className="mx-auto mb-4 opacity-20"/>
                                <p>Barang tidak ditemukan</p>
                            </div>
                        ) : (
                            posFilteredProducts.map(product => {
                                const stock = product.stock; // Simplify stock for grid display
                                const isOOS = stock <= 0;
                                const inCartQty = newTrxItems.filter(i => i.id === product.id).reduce((acc, i) => acc + i.quantity, 0);
                                
                                return (
                                    <button 
                                        key={product.id}
                                        disabled={isOOS}
                                        onClick={() => handleAddItemToNewTrx(product)}
                                        className={`
                                            relative flex flex-col text-left bg-white rounded-xl border transition-all duration-200 overflow-hidden group
                                            ${isOOS ? 'opacity-60 grayscale cursor-not-allowed border-gray-200' : 'hover:border-nature-400 hover:shadow-md cursor-pointer border-gray-200'}
                                        `}
                                    >
                                        <div className="aspect-[4/3] w-full bg-gray-100 relative">
                                            <ImageLoader src={product.image} alt={product.name} className="w-full h-full object-cover"/>
                                            {inCartQty > 0 && (
                                                <div className="absolute top-2 right-2 bg-nature-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow-lg">
                                                    {inCartQty}
                                                </div>
                                            )}
                                            {isOOS && (
                                                <div className="absolute inset-0 bg-black/10 flex items-center justify-center">
                                                    <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded">HABIS</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="p-3 flex flex-col flex-1">
                                            <div className="text-xs font-bold text-gray-800 line-clamp-2 leading-tight mb-1">{product.name}</div>
                                            <div className="mt-auto flex justify-between items-end">
                                                <div>
                                                    <div className="text-[10px] text-gray-500">{product.category}</div>
                                                    <div className="font-black text-sm text-nature-700">Rp{product.price2Days.toLocaleString('id-ID')}</div>
                                                </div>
                                                <div className="text-[10px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">Stok: {stock}</div>
                                            </div>
                                        </div>
                                    </button>
                                )
                            })
                        )}
                    </div>
                 </div>
              </div>

              {/* RIGHT SIDE: CART & CHECKOUT */}
              <div className="w-[400px] bg-white border-l border-gray-200 flex flex-col shadow-2xl z-20">
                 
                 {/* Customer Info Section (Compact) */}
                 <div className="p-4 border-b border-gray-100 bg-gray-50/50 space-y-3">
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <User className="absolute left-2.5 top-2.5 text-gray-400" size={14}/>
                            <input 
                                className="w-full pl-8 pr-2 py-2 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-nature-500 outline-none font-bold" 
                                placeholder="Nama Pelanggan" 
                                value={newTrxDetails.name} 
                                onChange={e => setNewTrxDetails({...newTrxDetails, name: e.target.value})} 
                            />
                        </div>
                        <div className="relative w-1/3">
                            <Search className="absolute left-2.5 top-2.5 text-gray-400" size={14}/>
                            <input className="w-full pl-8 pr-2 py-2 text-xs border border-gray-300 rounded-lg outline-none" placeholder="Cari..." disabled />
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <input className="flex-1 px-3 py-2 text-xs border border-gray-300 rounded-lg outline-none" placeholder="WhatsApp (08...)" value={newTrxDetails.whatsapp} onChange={e => setNewTrxDetails({...newTrxDetails, whatsapp: e.target.value})} />
                        <div className="relative w-1/3">
                            <Calendar className="absolute left-2 top-2 text-gray-400" size={14}/>
                            <input type="number" min="1" className="w-full pl-7 pr-2 py-2 text-xs border border-gray-300 rounded-lg font-bold outline-none" placeholder="Hari" value={newTrxDetails.duration} onChange={e => setNewTrxDetails({...newTrxDetails, duration: parseInt(e.target.value)||1})} />
                        </div>
                    </div>
                 </div>

                 {/* Cart Items List */}
                 <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-white">
                    {newTrxItems.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-300">
                            <ShoppingBag size={48} className="mb-2 opacity-20"/>
                            <p className="text-sm font-medium">Keranjang Kosong</p>
                            <p className="text-xs">Pilih barang di kiri untuk menambahkan</p>
                        </div>
                    ) : (
                        newTrxItems.map((item, idx) => renderItemRow(item, idx, 'create'))
                    )}
                 </div>

                 {/* Footer: Totals & Payment */}
                 <div className="p-4 border-t border-gray-200 bg-gray-50">
                    <div className="flex justify-between items-end mb-4">
                        <div className="text-xs text-gray-500 font-bold uppercase tracking-wider">Total Tagihan</div>
                        <div className="text-2xl font-black text-gray-900">Rp{calculateNewTrxTotal().toLocaleString('id-ID')}</div>
                    </div>
                    
                    <div className="space-y-3">
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <div className="absolute left-3 top-2.5 text-gray-500 text-xs font-bold">Bayar</div>
                                <input 
                                    type="number" 
                                    className="w-full pl-14 pr-4 py-2.5 border border-gray-300 rounded-xl font-bold text-gray-800 focus:ring-2 focus:ring-green-500 outline-none text-right"
                                    placeholder="0"
                                    value={newTrxPaid || ''}
                                    onChange={e => setNewTrxPaid(parseInt(e.target.value) || 0)}
                                />
                            </div>
                            <select 
                                className="w-24 px-2 py-2.5 border border-gray-300 rounded-xl text-xs font-bold bg-white outline-none"
                                value={newTrxDetails.paymentMethod}
                                onChange={e => setNewTrxDetails({...newTrxDetails, paymentMethod: e.target.value as any})}
                            >
                                <option value="cash">Cash</option>
                                <option value="transfer">Transfer</option>
                            </select>
                        </div>

                        {/* Quick Cash Buttons */}
                        <div className="flex gap-2 justify-end">
                            {[20000, 50000, 100000].map(amt => (
                                <button key={amt} onClick={() => setNewTrxPaid(amt)} className="text-[10px] bg-white border border-gray-200 rounded px-2 py-1 hover:bg-gray-100 font-medium text-gray-600">
                                    {amt/1000}k
                                </button>
                            ))}
                            <button onClick={() => setNewTrxPaid(calculateNewTrxTotal())} className="text-[10px] bg-blue-50 border border-blue-100 rounded px-2 py-1 hover:bg-blue-100 font-bold text-blue-600">
                                Pas
                            </button>
                        </div>

                        {getPaymentChangeDisplay(newTrxPaid, calculateNewTrxTotal())}

                        <button 
                            onClick={handleCreateTransaction} 
                            disabled={isCreating || newTrxItems.length === 0 || !newTrxDetails.name}
                            className="w-full py-4 bg-nature-600 hover:bg-nature-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg transition flex items-center justify-center gap-2 mt-2"
                        >
                            {isCreating ? <Loader2 className="animate-spin" size={20}/> : <Save size={20}/>}
                            PROSES TRANSAKSI
                        </button>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default AdminTransactionManager;
