
import { StoreConfig } from '../types';

const CONFIG_KEY = 'mamasStoreConfig';

export const DEFAULT_CONFIG: StoreConfig = {
  storeName: 'Mamas Outdoor',
  storeAddress: 'Jalan Cenderawasih, Grendeng, Purwokerto Utara, Kabupaten Banyumas, Jawa Tengah 53122 (Area Kampus UNSOED)',
  adminWhatsapp: '6285137411145',
  bankName: 'BSI',
  bankAccount: '7279048215',
  bankHolder: 'Umar Abdulloh',
  footerMessage: 'Simpan struk ini sebagai bukti pengambilan. Keterlambatan pengembalian dikenakan denda sesuai tarif harian. Terima kasih telah menyewa di Mamas Outdoor Purwokerto. #SalamLestari',
  waGatewayUrl: 'https://api.fonnte.com/send', // Default Fonnte (Popular in Indo)
  waGatewayToken: ''
};

export const getStoreConfig = (): StoreConfig => {
  try {
    const saved = localStorage.getItem(CONFIG_KEY);
    if (saved) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.error("Error loading store config", e);
  }
  return DEFAULT_CONFIG;
};

export const saveStoreConfig = (config: StoreConfig) => {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
};
