import yatra1 from "@/assets/yatra-1.jpg";

export const bookings = [
  {
    id: "KCY-24817",
    name: "Dwarka Yatra 2026",
    date: "25 May 2026",
    status: "Confirmed",
    img: yatra1,
    progress: 70,
  },
];

export const yatraPackages = [
  {
    id: "PK-01",
    name: "Dwarka Yatra 2026",
    days: "7 days · 6 nights · 25–31 May 2026",
    price: "₹12,000",
    img: yatra1,
    tag: "Registrations open",
  },
];

export const transactions = [
  {
    id: "TXN-9021",
    status: "Booked",
    userId: "YB-USER-1042",
    paymentId: "pay_MtQ9xR4KzL21bd",
    passenger: "Avishkar Jaiswal",
    age: "20 Y",
    gender: "M",
    yatra: "Dwarka",
    hotelPackage: "Deluxe twin sharing",
    travelPackage: "Kedarnath — AC Volvo",
    concession: "₹500",
    total: "₹18,499",
    journeyDate: "Tue, 25 Aug 26",
    whatsapp: "https://chat.whatsapp.com/yatra-kedarnath",
  },
  {
    id: "TXN-9014",
    status: "Booked",
    userId: "YB-USER-1042",
    paymentId: "pay_MtL2vB8NpQ77af",
    passenger: "Shivang Pandey",
    age: "24 Y",
    gender: "M",
    yatra: "Kashi",
    hotelPackage: "Standard triple sharing",
    travelPackage: "Kashi Darshan — Sleeper",
    concession: "₹0",
    total: "₹12,499",
    journeyDate: "Sat, 12 Sep 26",
    whatsapp: "https://chat.whatsapp.com/yatra-kashi",
  },
  {
    id: "TXN-8990",
    status: "Pending",
    userId: "YB-USER-1042",
    paymentId: "pay_MsZ7kC1WdE05gh",
    passenger: "Meera Jaiswal",
    age: "48 Y",
    gender: "F",
    yatra: "Kerala",
    hotelPackage: "Premium double",
    travelPackage: "Kerala Backwaters — Flight",
    concession: "₹1,000",
    total: "₹21,299",
    journeyDate: "Mon, 05 Oct 26",
    whatsapp: "https://chat.whatsapp.com/yatra-kerala",
  },
];


export const notices = [
  {
    id: "NT-05",
    title: "Kedarnath route reopens from 10 Sep",
    body: "The Gaurikund–Kedarnath trek route reopens after maintenance. Departures resume as scheduled.",
    date: "Today",
    time: "10:24 AM",
    tag: "Important",
    author: "admin",
    senderName: "Yatra Admin",
    senderRole: "Head of Ops",
    senderColor: "primary",
  },
  {
    id: "NT-04",
    title: "Carry Aadhaar for all passengers",
    body: "Aadhaar or a government photo ID is now mandatory at every yatra boarding point.",
    date: "Today",
    time: "9:15 AM",
    tag: "Update",
    author: "admin",
    senderName: "Support Desk",
    senderRole: "Coordinator",
    senderColor: "chart-3",
  },
  {
    id: "NT-03",
    title: "Monsoon advisory for Kashi Darshan",
    body: "Ghat aartis may be rescheduled on heavy rain days. Your guide will inform you a day ahead.",
    date: "Yesterday",
    time: "4:45 PM",
    tag: "Advisory",
    author: "admin",
    senderName: "Yatra Admin",
    senderRole: "Head of Ops",
    senderColor: "primary",
  },
];

