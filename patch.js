const fs = require('fs');
let content = fs.readFileSync('/src/App.tsx', 'utf8');

// Update getStatus logic
content = content.replace(
  /const getStatus = \(date: string\) => \{[\s\S]*?\};/,
  `const getStatus = (date: string) => {
  if (!date) return 'unknown';
  const exp = parseISO(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Start of today
  
  const sixtyDays = addDays(today, 60);
  const thirtyDays = addDays(today, 30);
  
  if (isBefore(exp, today)) return 'expired';
  if (isBefore(exp, thirtyDays)) return 'expiring soon';
  if (isBefore(exp, sixtyDays)) return 'expiring';
  return 'active';
};`
);

// Update status order
content = content.replace(
  /const statusOrder = \{ 'expired': 0, 'expiring': 1, 'active': 2 \};/,
  "const statusOrder = { 'expired': 0, 'expiring soon': 1, 'expiring': 2, 'active': 3 };"
);

// Update status styles with rose specifically for expiring soon
content = content.replace(
  /getStatus\(cert\.expiration_date\) === 'expired' \? "bg-red-(\d+) text-red-700" :\s+getStatus\(cert\.expiration_date\) === 'expiring' \? "bg-amber-(\d+) text-amber-700" :/g,
  `getStatus(cert.expiration_date) === 'expired' ? "bg-red-$1 text-red-700" :
                          getStatus(cert.expiration_date) === 'expiring soon' ? "bg-rose-$1 text-rose-700" :
                          getStatus(cert.expiration_date) === 'expiring' ? "bg-amber-$1 text-amber-700" :`
);

// Fix slides and other cases
content = content.replace(
  /getStatus\(cert\.expiration_date\) === 'expired' \? "bg-red-600\/60 text-white border border-red-500\/50" : "bg-amber-600\/60 text-white border border-amber-500\/50"/g,
  `getStatus(cert.expiration_date) === 'expired' ? "bg-red-600/60 text-white border border-red-500/50" : 
                        getStatus(cert.expiration_date) === 'expiring soon' ? "bg-rose-600/60 text-white border border-rose-500/50" :
                        "bg-amber-600/60 text-white border border-amber-500/50"`
);

// Fix green to blue
content = content.replace(/"bg-green-100 text-green-700"/g, '"bg-blue-100 text-blue-700"');

fs.writeFileSync('/src/App.tsx', content);
console.log('App.tsx updated via patch script');
