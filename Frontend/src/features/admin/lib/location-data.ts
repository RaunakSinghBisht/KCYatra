export const states: Record<string, string[]> = {
  "Uttar Pradesh": ["Lucknow", "Kanpur", "Varanasi", "Prayagraj", "Gorakhpur", "Mathura"],
  "Uttarakhand": ["Dehradun", "Haridwar", "Rishikesh", "Nainital", "Almora", "Pauri Garhwal"],
  "Bihar": ["Patna", "Gaya", "Muzaffarpur", "Bhagalpur", "Darbhanga"],
  "Rajasthan": ["Jaipur", "Jodhpur", "Udaipur", "Ajmer", "Bikaner"],
  "Madhya Pradesh": ["Bhopal", "Indore", "Ujjain", "Jabalpur", "Gwalior"],
  "Maharashtra": ["Mumbai", "Pune", "Nagpur", "Nashik", "Aurangabad"],
  "West Bengal": ["Kolkata", "Howrah", "Darjeeling", "Siliguri", "Asansol"],
  "Gujarat": ["Ahmedabad", "Surat", "Vadodara", "Rajkot", "Bhavnagar"],
  "Tamil Nadu": ["Chennai", "Coimbatore", "Madurai", "Salem", "Tiruchirappalli"],
  "Karnataka": ["Bengaluru", "Mysuru", "Mangaluru", "Hubli", "Belagavi"],
};

export const stateOptions = Object.keys(states).map((s) => ({ value: s, label: s }));
