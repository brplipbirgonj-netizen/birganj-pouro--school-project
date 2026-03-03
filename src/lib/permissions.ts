'use client';

// This is a placeholder for permissions management.
// In a real application, you would fetch these from a database.

export const availablePermissions = [
  { id: 'view:dashboard', label: 'ড্যাসবোর্ড দেখুন' },
  
  { id: 'view:students', label: 'শিক্ষার্থী তালিকা দেখুন' },
  { id: 'manage:students', label: 'শিক্ষার্থী ম্যানেজ করুন (যোগ, এডিট, ডিলিট)' },
  { id: 'view:student-profile', label: 'শিক্ষার্থী প্রোফাইল সার্চ করুন' },

  { id: 'view:staff', label: 'শিক্ষক ও কর্মচারী তালিকা দেখুন' },
  { id: 'manage:staff', label: 'শিক্ষক ও কর্মচারী ম্যানেজ করুন' },

  { id: 'manage:attendance', label: 'হাজিরা ম্যানেজ করুন' },

  { id: 'manage:results', label: 'ফলাফল ও নম্বর ম্যানেজ করুন' },
  { id: 'promote:students', label: 'শিক্ষার্থী প্রমোশন ও বিশেষ পাশ' },
  
  { id: 'view:accounts', label: 'হিসাব শাখা দেখুন' },
  { id: 'collect:fees', label: 'বেতন আদায় করুন' },
  { id: 'view:collection-report', label: 'বেতন আদায়ের রিপোর্ট দেখুন' },
  { id: 'manage:transactions', label: 'সাধারণ লেনদেন ম্যানেজ করুন' },
  
  { id: 'manage:documents', label: 'ডকুমেন্ট ম্যানেজ করুন' },
  { id: 'view:routines', label: 'রুটিন দেখুন' },
  { id: 'manage:routines', label: 'রুটিন ম্যানেজ করুন' },

  { id: 'manage:messaging', label: 'মেসেজ পাঠানো ও ম্যানেজ করুন' },

  { id: 'manage:settings', label: 'সেটিংস ম্যানেজ করুন' },
];

export const defaultPermissions: { [key: string]: string[] } = {
  admin: availablePermissions.map(p => p.id),
  teacher: [
    'view:dashboard',
    'view:students',
    'view:student-profile',
    'view:staff',
    'manage:attendance',
    'manage:results', 
    'view:accounts',
    'collect:fees',
    'view:collection-report',
    'view:routines',
    'manage:documents',
    'manage:messaging'
  ],
};
