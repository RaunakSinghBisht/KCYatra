import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
// TODO: connect to API — seed data below is mock-only; replace with real API fetches

// ─── Banner asset URLs (Lovable CDN) ─────────────────────────────────────────
// NOTE: These URLs (/__l5e/assets-v1/...) only work when served by Lovable
// hosting. Replace them with public URLs or your own CDN before deploying.
const BANNER_URLS = {
  banner1: "/__l5e/assets-v1/de06ac7f-e801-4dfb-bbd2-588e2c1fb6a0/banner-1.jpg",
  banner2: "/__l5e/assets-v1/de06ac7f-e801-4dfb-bbd2-588e2c1fb6a0/banner-2.jpg",
  banner3: "/__l5e/assets-v1/de06ac7f-e801-4dfb-bbd2-588e2c1fb6a0/banner-3.jpg",
  banner4: "/__l5e/assets-v1/de06ac7f-e801-4dfb-bbd2-588e2c1fb6a0/banner-4.jpg",
  banner5: "/__l5e/assets-v1/de06ac7f-e801-4dfb-bbd2-588e2c1fb6a0/banner-5.jpg",
  banner6: "/__l5e/assets-v1/de06ac7f-e801-4dfb-bbd2-588e2c1fb6a0/banner-6.jpg",
  banner7: "/__l5e/assets-v1/de06ac7f-e801-4dfb-bbd2-588e2c1fb6a0/banner-7.jpg",
};

export type CarouselSlide = { id: string; src: string; alt: string };

export type Yatra = {
  id: string;
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  status: "Open" | "Closed" | "Draft";
  whatsapp: string;
  description: string;
};

export type HotelPackage = { id: string; yatraId: string; name: string; sharing: string; price: number; seats: number; seatsBooked: number };
export type TravelPackage = { id: string; yatraId: string; name: string; mode: string; price: number; seats: number; seatsBooked: number };

export type AdminBooking = {
  id: string;
  userId: string;
  passenger: string;
  age: number;
  gender: "M" | "F";
  yatra: string;
  yearOfBirth?: string;
  assistance?: "Required" | "Not Required";
  phone?: string;
  state?: string;
  district?: string;
  city?: string;
  aadhaar?: string;
  hotelPackage: string;
  travelPackage: string;
  concession: number;
  total: number;
  journeyDate: string;
  paymentId: string;
  status: "Paid" | "Interested" | "Pending";
};

export type AdminUser = {
  id: string;
  name: string;
  loginPhone?: string;
  phone: string;
  city: string;
  state: string;
  joined: string;
  status: "Active" | "Blocked";
  bookings: number;
  gender?: "M" | "F";
  yearOfBirth?: string;
  assistance?: "Required" | "Not Required";
  district?: string;
  aadhaar?: string;
};

export type AdminPassenger = {
  id: string;
  userId: string;
  name: string;
  age: number;
  gender: "M" | "F";
  state: string;
  district: string;
  assistance: "Required" | "Not Required";
};

export type AdminNotice = {
  id: string;
  title: string;
  body: string;
  senderName: string;
  date: string;
  tag: string;
  published: boolean;
};

export type AdminAccount = {
  id: string;
  name: string;
  email: string;
  role: "Super Admin" | "Manager" | "Support";
  status: "Active" | "Disabled";
  createdAt: string;
};

export type SiteSettings = {
  siteName: string;
  supportEmail: string;
  supportPhone: string;
  whatsapp: string;
  bookingsOpen: boolean;
  maintenanceMode: boolean;
};

export type MaintenancePage = {
  enabled: boolean;
  title: string;
  description: string;
};

type StoreShape = {
  yatras: Yatra[];
  hotelPackages: HotelPackage[];
  travelPackages: TravelPackage[];
  bookings: AdminBooking[];
  users: AdminUser[];
  passengers: AdminPassenger[];
  notices: AdminNotice[];
  admins: AdminAccount[];
  settings: SiteSettings;
  slides: CarouselSlide[];
  maintenance: MaintenancePage;
  otpLoginEnabled: boolean;
  acceptPayments: boolean;
  youtubeLinks: string[];
};

const STORAGE_KEY = "kcy-admin-store-v1";

// TODO: connect to API — replace seed with GET /yatras/, GET /registrations/, GET /users/, etc.
const seed: StoreShape = {
  yatras: [
    {
      id: "PK-01",
      name: "Dwarka Yatra 2026",
      destination: "Dwarka, Gujarat",
      startDate: "2026-05-25",
      endDate: "2026-05-31",
      status: "Open",
      whatsapp: "https://chat.whatsapp.com/yatra-dwarka",
      description: "7 days · 6 nights guided Dwarka pilgrimage with kirtan and prasadam.",
    },
  ],
  hotelPackages: [
    // TODO: connect to API — fetch from yatra.hotel_packages field on GET /yatras/{id}
    { id: "HP-01", yatraId: "PK-01", name: "Deluxe twin sharing", sharing: "2 sharing", price: 6500, seats: 60, seatsBooked: 24 },
    { id: "HP-02", yatraId: "PK-01", name: "Standard triple sharing", sharing: "3 sharing", price: 4800, seats: 60, seatsBooked: 22 },
  ],
  travelPackages: [
    // TODO: connect to API — fetch from yatra.travel_packages field on GET /yatras/{id}
    { id: "TP-01", yatraId: "PK-01", name: "AC Volvo Coach", mode: "Bus", price: 5200, seats: 80, seatsBooked: 30 },
    { id: "TP-02", yatraId: "PK-01", name: "Sleeper Train", mode: "Train", price: 3100, seats: 40, seatsBooked: 16 },
  ],
  bookings: [
    // TODO: connect to API — fetch from GET /registrations/yatra/{id} for each yatra
    {
      id: "TXN-9021",
      userId: "YB-USER-1042",
      passenger: "Avishkar Jaiswal",
      age: 20,
      gender: "M",
      yatra: "Dwarka",
      hotelPackage: "Deluxe twin sharing",
      travelPackage: "AC Volvo Coach",
      concession: 500,
      total: 18499,
      journeyDate: "2026-08-25",
      paymentId: "pay_MtQ9xR4KzL21bd",
      status: "Paid",
    },
    {
      id: "TXN-9014",
      userId: "YB-USER-1042",
      passenger: "Shivang Pandey",
      age: 24,
      gender: "M",
      yatra: "Kashi",
      hotelPackage: "Standard triple sharing",
      travelPackage: "Sleeper Train",
      concession: 0,
      total: 12499,
      journeyDate: "2026-09-12",
      paymentId: "pay_MtL2vB8NpQ77af",
      status: "Paid",
    },
    {
      id: "TXN-8990",
      userId: "YB-USER-1088",
      passenger: "Meera Jaiswal",
      age: 48,
      gender: "F",
      yatra: "Kerala",
      hotelPackage: "Premium double",
      travelPackage: "Flight",
      concession: 1000,
      total: 21299,
      journeyDate: "2026-10-05",
      paymentId: "pay_MsZ7kC1WdE05gh",
      status: "Pending",
    },
  ],
  users: [
    // TODO: connect to API — fetch from GET /users/ (endpoint needs to be created on backend)
    { id: "YB-USER-1042", name: "Avishkar Jaiswal", loginPhone: "9876543210", phone: "", city: "Lucknow", state: "Uttar Pradesh", joined: "2026-03-11", status: "Active", bookings: 2, gender: "M", yearOfBirth: "2006", assistance: "Not Required", district: "Lucknow", aadhaar: "" },
    { id: "YB-USER-1088", name: "Meera Jaiswal", loginPhone: "9812345678", phone: "", city: "Kochi", state: "Kerala", joined: "2026-04-02", status: "Active", bookings: 1, gender: "F", yearOfBirth: "1978", assistance: "Required", district: "Ernakulam", aadhaar: "" },
  ],
  passengers: [
    // TODO: connect to API — fetch from GET /passengers/ (endpoint needs to be created on backend)
    { id: "PS-01", userId: "YB-USER-1042", name: "Avishkar Jaiswal", age: 20, gender: "M", state: "Uttar Pradesh", district: "Lucknow", assistance: "Not Required" },
    { id: "PS-02", userId: "YB-USER-1042", name: "Shivang Pandey", age: 24, gender: "M", state: "Uttar Pradesh", district: "Varanasi", assistance: "Not Required" },
    { id: "PS-03", userId: "YB-USER-1088", name: "Meera Jaiswal", age: 48, gender: "F", state: "Kerala", district: "Ernakulam", assistance: "Required" },
  ],
  notices: [
    // TODO: connect to API — no notices endpoint on backend yet
    { id: "NT-05", title: "Kedarnath route reopens from 10 Sep", body: "The Gaurikund–Kedarnath trek route reopens after maintenance. Departures resume as scheduled.", senderName: "Yatra Admin", date: "2026-09-08", tag: "Important", published: true },
    { id: "NT-04", title: "Carry Aadhaar for all passengers", body: "Aadhaar or a government photo ID is now mandatory at every yatra boarding point.", senderName: "Support Desk", date: "2026-09-07", tag: "Update", published: true },
  ],
  admins: [
    // TODO: connect to API — no admin accounts endpoint on backend yet
    { id: "AD-01", name: "Yatra Admin", email: "admin@krishnaconsciousyatra.com", role: "Super Admin", status: "Active", createdAt: "2026-01-04" },
  ],
  settings: {
    // TODO: connect to API — no site-settings endpoint on backend yet
    siteName: "Krishna Conscious Yatra",
    supportEmail: "support@krishnaconsciousyatra.com",
    supportPhone: "+91 98765 43210",
    whatsapp: "https://chat.whatsapp.com/yatra-support",
    bookingsOpen: true,
    maintenanceMode: false,
  },
  slides: [
    // TODO: connect to API — carousel images; replace Lovable CDN URLs with your own hosting
    { id: "SL-1", src: BANNER_URLS.banner1, alt: "Chalo Dwarka — a sacred journey awaits" },
    { id: "SL-4", src: BANNER_URLS.banner4, alt: "Dwarka Yatra 2026, 25–31 May 2026" },
    { id: "SL-5", src: BANNER_URLS.banner5, alt: "Experience the magic of Krishna's kingdom" },
    { id: "SL-2", src: BANNER_URLS.banner2, alt: "One yatra, complete divine darshan of all sacred temples" },
    { id: "SL-3", src: BANNER_URLS.banner3, alt: "More than a yatra — a living experience of bhakti" },
    { id: "SL-6", src: BANNER_URLS.banner6, alt: "Yatra packages — Basic, Standard and Premium" },
    { id: "SL-7", src: BANNER_URLS.banner7, alt: "Package description — accommodation, meals and bus fares" },
  ],
  maintenance: {
    // TODO: connect to API — no maintenance mode endpoint on backend yet
    enabled: false,
    title: "Website Under Maintenance",
    description:
      "We are performing scheduled maintenance to serve you better. Please check back in a little while. Hare Krishna!",
  },
  otpLoginEnabled: true,
  acceptPayments: true,
  youtubeLinks: ["https://www.youtube.com/watch?v=JvsRTWg8ojo"],
};

// Extracts the video id from watch, share, shorts and embed YouTube URLs.
export function youtubeEmbedUrl(link: string): string | null {
  const m =
    link.match(/(?:youtube\.com\/(?:watch\?[^#]*v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/) ??
    link.match(/^([\w-]{11})$/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : null;
}

type StoreContext = {
  data: StoreShape;
  hydrated: boolean;
  update: (patch: Partial<StoreShape>) => void;
  reset: () => void;
};

const Ctx = createContext<StoreContext | null>(null);

const LEGACY_STATUS: Record<string, AdminBooking["status"]> = {
  Booked: "Paid",
  Cancelled: "Pending",
  Refunded: "Pending",
};

function migrate(store: StoreShape): StoreShape {
  return {
    ...store,
    bookings: (store.bookings ?? []).map((b) => {
      const legacy = LEGACY_STATUS[b.status];
      return legacy ? { ...b, status: legacy } : b;
    }),
    users: (store.users ?? []).map((u) =>
      u.loginPhone === undefined ? { ...u, loginPhone: u.phone, phone: "" } : u,
    ),
    acceptPayments:
      (store as StoreShape & { paymentsDisabled?: boolean }).paymentsDisabled === true
        ? false
        : (store.acceptPayments ?? true),
  };
}

export function AdminStoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<StoreShape>(seed);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setData(migrate({ ...seed, ...(JSON.parse(raw) as StoreShape) }));
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      try {
        setData(migrate({ ...seed, ...(JSON.parse(e.newValue) as StoreShape) }));
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const value = useMemo<StoreContext>(
    () => ({
      data,
      hydrated,
      update: (patch) =>
        setData((prev) => {
          const next = { ...prev, ...patch };
          try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          } catch {
            /* ignore */
          }
          return next;
        }),
      reset: () => {
        window.localStorage.removeItem(STORAGE_KEY);
        setData(seed);
      },
    }),
    [data, hydrated],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAdminStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAdminStore must be used inside AdminStoreProvider");
  return ctx;
}

export function newId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

export const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
