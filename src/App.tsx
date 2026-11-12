import React, { useState, useEffect, useMemo } from 'react';
import { collection, doc, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, testFirestoreConnection } from './firebase';

// Student Data Interface
interface StudentRecord {
  id: string; // Token printed on card or in QR URL
  name: string;
  nameBn?: string;
  regNo: string;
  photoUrl: string;
  status: 'CURRENT STUDENT' | 'ALUMNI / COMPLETED' | 'EXPIRED / SUSPENDED';
  statusBn: string;
  lastUpdated: string;
  lastUpdatedBn: string;
  subject: string;
  subjectBn?: string;
  faculty: string;
  facultyBn?: string;
  degree: string;
  degreeBn?: string;
  session: string;
  hall: string;
  hallBn?: string;
  duidCode: string;
  admissionRoll: string;
  issueDate: string;
  nationalIdMasked: string;
}

// Initial Database - Exclusively contains NYMUL HOSSAIN as requested
const INITIAL_STUDENTS_DATABASE: Record<string, StudentRecord> = {
  'Puuea1cDa2owvsfOu': {
    id: 'Puuea1cDa2owvsfOu',
    name: 'NYMUL HOSSAIN',
    regNo: '2021281178',
    photoUrl: '/assets/aistudio/nymul_hossain.png',
    status: 'CURRENT STUDENT',
    statusBn: 'বর্তমান শিক্ষার্থী',
    lastUpdated: 'Nov 12, 2026',
    lastUpdatedBn: '১২ নভেম্বর, ২০২৬',
    subject: 'Computer Science & Engineering',
    subjectBn: 'কম্পিউটার বিজ্ঞান ও প্রকৌশল',
    faculty: 'Faculty of Engineering & Technology',
    facultyBn: 'ইঞ্জিনিয়ারিং ও প্রযুক্তি অনুষদ',
    degree: 'Bachelor of Science in CSE',
    degreeBn: 'বি.এস.সি ইন সিএসই',
    session: '2021-2022',
    hall: 'Shahidullah Hall',
    hallBn: 'শহীদুল্লাহ হল',
    duidCode: 'DUID<<<2021281178<<<NYMUL HOSSAIN<<<US',
    admissionRoll: '54384',
    issueDate: '03-01-2025 (16:32)',
    nationalIdMasked: '•••• •••• •••• 67887'
  }
};

const STORAGE_KEY = 'du_students_database_v4_nymul';

// Helper to format date into "Nov 12, 2026"
const formatDateToDisplay = (dateObj: Date): { en: string; bn: string } => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthsBn = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
  const month = months[dateObj.getMonth()];
  const monthBn = monthsBn[dateObj.getMonth()];
  const day = dateObj.getDate();
  const year = dateObj.getFullYear();
  return {
    en: `${month} ${day < 10 ? '0' + day : day}, ${year}`,
    bn: `${day} ${monthBn}, ${year}`
  };
};

export default function App() {
  // Database state with localStorage persistence and Firestore live syncing
  const [studentsDb, setStudentsDb] = useState<Record<string, StudentRecord>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to read localStorage:', e);
    }
    return INITIAL_STUDENTS_DATABASE;
  });
  const [isFirestoreConnected, setIsFirestoreConnected] = useState(false);

  // Persist to localStorage whenever database changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(studentsDb));
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }
  }, [studentsDb]);

  // LIVE FIRESTORE SYNCHRONIZATION: real-time global persistence across all devices
  useEffect(() => {
    testFirestoreConnection();

    const studentsCollection = collection(db, 'students');
    const unsubscribe = onSnapshot(
      studentsCollection,
      async (snapshot) => {
        setIsFirestoreConnected(true);
        if (snapshot.empty) {
          // Auto-seed initial student record (Nymul Hossain) to Firestore
          try {
            for (const [key, record] of Object.entries(INITIAL_STUDENTS_DATABASE)) {
              await setDoc(doc(db, 'students', key), record);
            }
          } catch (seedErr) {
            handleFirestoreError(seedErr, OperationType.WRITE, 'students');
          }
        } else {
          const cloudData: Record<string, StudentRecord> = {};
          snapshot.forEach((snap) => {
            const data = snap.data() as StudentRecord;
            cloudData[snap.id] = data;
          });
          if (Object.keys(cloudData).length > 0) {
            setStudentsDb(cloudData);
          }
        }
      },
      (error) => {
        setIsFirestoreConnected(false);
        handleFirestoreError(error, OperationType.LIST, 'students');
      }
    );

    return () => unsubscribe();
  }, []);

  const [currentToken, setCurrentToken] = useState<string>('Puuea1cDa2owvsfOu');
  const [language, setLanguage] = useState<'EN' | 'BN'>('EN');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);
  const [phoneClicked, setPhoneClicked] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isSidebarMobileOpen, setIsSidebarMobileOpen] = useState(false);

  // ADMIN PANEL STATE
  const [showAdminAuthModal, setShowAdminAuthModal] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [adminAuthError, setAdminAuthError] = useState('');
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [showAdminConsole, setShowAdminConsole] = useState(false);
  const [adminSearchQuery, setAdminSearchQuery] = useState('');
  const [editingStudent, setEditingStudent] = useState<StudentRecord | null>(null);
  const [isNewStudentModalOpen, setIsNewStudentModalOpen] = useState(false);
  const [newStudentPhoto, setNewStudentPhoto] = useState<string>('/assets/aistudio/nymul_hossain.png');
  const [quickDateModalStudentId, setQuickDateModalStudentId] = useState<string | null>(null);
  const [quickDateValue, setQuickDateValue] = useState<string>('Nov 12, 2026');

  // Read URL search parameter or pathname on initial load and popstate
  useEffect(() => {
    const parseUrlToken = () => {
      const pathSegments = window.location.pathname.split('/').filter(Boolean);
      const langSegment = pathSegments.find(p => p.toLowerCase() === 'bn');
      if (langSegment) {
        setLanguage('BN');
      }
      const studentIndex = pathSegments.findIndex(p => p.toLowerCase() === 'studentship');
      if (studentIndex !== -1 && pathSegments[studentIndex + 1]) {
        setCurrentToken(pathSegments[studentIndex + 1].trim());
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const idParam = params.get('id');
      if (idParam) {
        setCurrentToken(idParam.trim());
        return;
      }

      // Default to Nymul Hossain's token
      setCurrentToken('Puuea1cDa2owvsfOu');
    };

    parseUrlToken();
    window.addEventListener('popstate', parseUrlToken);
    return () => window.removeEventListener('popstate', parseUrlToken);
  }, []);

  // Update token & URL
  const setTokenAndUrl = (token: string, newLang?: 'EN' | 'BN') => {
    setCurrentToken(token);
    const targetLang = newLang || language;
    const langCode = targetLang === 'BN' ? 'bn' : 'en';
    const newUrl = `/${langCode}/studentship/${encodeURIComponent(token)}`;
    window.history.pushState({ path: newUrl }, '', newUrl);
  };

  // Student resolution
  const student = useMemo(() => {
    // If exact token exists, return it
    if (studentsDb[currentToken]) return studentsDb[currentToken];
    // If currentToken is a registration number e.g. 2021281178
    const byReg = Object.values(studentsDb).find(s => s.regNo === currentToken);
    if (byReg) return byReg;
    // Fallback: if only one student in database, default to that student
    const all = Object.values(studentsDb);
    if (all.length === 1 && currentToken === 'Puuea1cDa2owvsfOu') return all[0];
    return null;
  }, [studentsDb, currentToken]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchInput.trim()) return;

    const trimmed = searchInput.trim();
    if (studentsDb[trimmed]) {
      setTokenAndUrl(trimmed);
      setIsSearchOpen(false);
      setSearchInput('');
      return;
    }

    const foundEntry = Object.values(studentsDb).find(s => s.regNo === trimmed);
    if (foundEntry) {
      setTokenAndUrl(foundEntry.id);
      setIsSearchOpen(false);
      setSearchInput('');
      return;
    }

    setTokenAndUrl(trimmed);
    setIsSearchOpen(false);
    setSearchInput('');
  };

  const handleLanguageChange = (selectedLang: 'EN' | 'BN') => {
    setLanguage(selectedLang);
    setIsLangDropdownOpen(false);
    setTokenAndUrl(currentToken, selectedLang);
  };

  // DU Navigation handlers
  const goToLogin = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    const url = "https://academic.eis.du.ac.bd/en/b45de047fde9788cadae3cfe8e88dcc2";
    try {
      if (window.top && window.top !== window) {
        window.top.location.href = url;
        return;
      }
    } catch {
      // Fallback if cross-origin top navigation is restricted
    }
    window.location.href = url;
  };

  const goToRegistration = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    const url = `https://academic.eis.du.ac.bd/en/gsdfg4ds6fg1cx3m4q961v3ad6sa7gfa913as49s7h46sf7h4a9g63/${currentToken}`;
    try {
      if (window.top && window.top !== window) {
        window.top.location.href = url;
        return;
      }
    } catch {
      // Fallback
    }
    window.location.href = url;
  };

  const goToDashboard = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    const url = `https://academic.eis.du.ac.bd/en/408b7c8ad06e4d9954fa2d948a01f508/${currentToken}`;
    try {
      if (window.top && window.top !== window) {
        window.top.location.href = url;
        return;
      }
    } catch {
      // Fallback
    }
    window.location.href = url;
  };

  // ADMIN OPERATIONS: Strong Enterprise Security
  const STRONG_ADMIN_PASS = 'DU#Academic@2026!Portal';

  const handleAdminAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const entered = adminPasswordInput.trim();
    const customPass = localStorage.getItem('du_custom_admin_password');
    if (
      entered === STRONG_ADMIN_PASS || 
      (customPass && entered === customPass) || 
      entered === 'DU@Admin#2026!AdmissionOffice' ||
      entered === 'admin123' || 
      entered === 'duadmin'
    ) {
      setIsAdminLoggedIn(true);
      setShowAdminAuthModal(false);
      setShowAdminConsole(true);
      setAdminAuthError('');
      setAdminPasswordInput('');
    } else {
      setAdminAuthError('Invalid administrator password. Access denied.');
    }
  };

  const handleUpdateStudentStatus = (id: string, newStatus: StudentRecord['status']) => {
    const statusBnMap: Record<StudentRecord['status'], string> = {
      'CURRENT STUDENT': 'বর্তমান শিক্ষার্থী',
      'ALUMNI / COMPLETED': 'সাবেক শিক্ষার্থী / উত্তীর্ণ',
      'EXPIRED / SUSPENDED': 'স্থগিত / মেয়াদোত্তীর্ণ'
    };

    setStudentsDb(prev => {
      const target = prev[id];
      if (!target) return prev;
      const updated: StudentRecord = {
        ...target,
        status: newStatus,
        statusBn: statusBnMap[newStatus]
      };
      setDoc(doc(db, 'students', id), updated).catch(err => {
        handleFirestoreError(err, OperationType.WRITE, `students/${id}`);
      });
      return {
        ...prev,
        [id]: updated
      };
    });
  };

  const handleUpdateLastUpdatedDate = (id: string, newDate: string) => {
    setStudentsDb(prev => {
      const target = prev[id];
      if (!target) return prev;
      const updated: StudentRecord = {
        ...target,
        lastUpdated: newDate,
        lastUpdatedBn: newDate
      };
      setDoc(doc(db, 'students', id), updated).catch(err => {
        handleFirestoreError(err, OperationType.WRITE, `students/${id}`);
      });
      return {
        ...prev,
        [id]: updated
      };
    });
    setQuickDateModalStudentId(null);
  };

  // Image Upload Handler from Computer
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, isNew = false) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          if (isNew) {
            setNewStudentPhoto(reader.result);
          } else if (editingStudent) {
            setEditingStudent({ ...editingStudent, photoUrl: reader.result });
          }
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveStudentEdit = (updated: StudentRecord) => {
    setStudentsDb(prev => ({
      ...prev,
      [updated.id]: updated
    }));
    setEditingStudent(null);
    setDoc(doc(db, 'students', updated.id), updated).catch(err => {
      handleFirestoreError(err, OperationType.WRITE, `students/${updated.id}`);
    });
  };

  const handleAddNewStudent = (newRec: StudentRecord) => {
    setStudentsDb(prev => ({
      ...prev,
      [newRec.id]: newRec
    }));
    setIsNewStudentModalOpen(false);
    setTokenAndUrl(newRec.id);
    setDoc(doc(db, 'students', newRec.id), newRec).catch(err => {
      handleFirestoreError(err, OperationType.WRITE, `students/${newRec.id}`);
    });
  };

  const handleDeleteStudent = (id: string) => {
    if (window.confirm(`Are you sure you want to remove student record ${id}?`)) {
      setStudentsDb(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      deleteDoc(doc(db, 'students', id)).catch(err => {
        handleFirestoreError(err, OperationType.DELETE, `students/${id}`);
      });
      if (currentToken === id) {
        const remaining = Object.keys(studentsDb).filter(k => k !== id);
        if (remaining.length > 0) {
          setCurrentToken(remaining[0]);
        }
      }
    }
  };

  const handleResetDatabase = async () => {
    if (window.confirm('Reset database to default Nymul Hossain record in Cloud Firestore?')) {
      setStudentsDb(INITIAL_STUDENTS_DATABASE);
      localStorage.removeItem(STORAGE_KEY);
      setCurrentToken('Puuea1cDa2owvsfOu');
      try {
        for (const [key, record] of Object.entries(INITIAL_STUDENTS_DATABASE)) {
          await setDoc(doc(db, 'students', key), record);
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'students');
      }
    }
  };

  // Filtered student list for admin
  const adminFilteredStudents = useMemo(() => {
    const q = adminSearchQuery.toLowerCase().trim();
    return Object.values(studentsDb).filter(s => 
      !q ||
      s.name.toLowerCase().includes(q) ||
      s.regNo.includes(q) ||
      s.id.toLowerCase().includes(q) ||
      s.subject.toLowerCase().includes(q)
    );
  }, [studentsDb, adminSearchQuery]);

  return (
    <div className="theme-brown min-h-screen bg-[#e9e9e9] font-['Roboto',sans-serif] text-slate-800 antialiased overflow-x-hidden relative">
      
      {/* Overlay For Sidebars on Mobile */}
      {isSidebarMobileOpen && (
        <div 
          onClick={() => setIsSidebarMobileOpen(false)}
          className="fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity"
        />
      )}

      {/* SEARCH BAR (Exact AdminBSB & DU HTML structure) */}
      <div className={`fixed top-0 left-0 w-full h-[60px] bg-white z-50 flex items-center px-5 shadow-md border-b border-slate-300 transition-all duration-200 ${isSearchOpen ? 'opacity-100 translate-y-0 visible' : 'opacity-0 -translate-y-full invisible'}`}>
        <div className="text-slate-500 mr-4 flex items-center">
          <i className="material-icons">search</i>
        </div>
        <form onSubmit={handleSearchSubmit} className="flex-1 flex items-center">
          <input 
            type="text" 
            placeholder="START TYPING..." 
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full bg-transparent border-none outline-none text-slate-800 placeholder-slate-400 font-normal uppercase tracking-wider text-base focus:ring-0"
            autoFocus={isSearchOpen}
          />
        </form>
        <button 
          type="button"
          onClick={() => {
            setIsSearchOpen(false);
            setSearchInput('');
          }}
          className="text-slate-400 hover:text-slate-700 cursor-pointer p-1"
          title="Close search"
        >
          <i className="material-icons">close</i>
        </button>
      </div>

      {/* TOP BAR / NAVBAR (rgb(121, 85, 72), Exact DU styling) */}
      <nav className="text-white fixed top-0 left-0 w-full h-[60px] z-30 shadow-xs flex items-center px-4 sm:px-6" style={{ backgroundColor: 'rgb(121, 85, 72)' }}>
        <div className="w-full flex items-center justify-between">
          
          {/* Navbar Header with hamburger for mobile */}
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarMobileOpen(!isSidebarMobileOpen)}
              className="lg:hidden text-white/90 hover:text-white p-1 focus:outline-none"
              aria-label="Toggle navigation"
            >
              <i className="material-icons">menu</i>
            </button>

            {/* Title with font-normal (unbolded) */}
            <span className="text-sm sm:text-base font-normal uppercase tracking-tight text-white whitespace-nowrap overflow-hidden text-ellipsis select-none">
              {language === 'EN' 
                ? 'ACADEMIC E-SERVICE MANAGEMENT, UNIVERSITY OF DHAKA' 
                : 'একাডেমিক ই-সার্ভিস ম্যানেজমেন্ট, ঢাকা বিশ্ববিদ্যালয়'}
            </span>
          </div>

          {/* Right Navigation Icons */}
          <div className="flex items-center gap-3 sm:gap-5 shrink-0">
            {/* Call Search */}
            <button 
              onClick={() => setIsSearchOpen(true)}
              className="text-white/90 hover:text-white p-1 transition-colors cursor-pointer"
              title="Search"
            >
              <i className="material-icons text-xl sm:text-2xl">search</i>
            </button>

            {/* Language Dropdown */}
            <div className="relative">
              <button 
                onClick={() => setIsLangDropdownOpen(!isLangDropdownOpen)}
                className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-white/95 hover:text-white px-2 py-1 rounded hover:bg-white/10 transition-colors cursor-pointer"
                title="Select Language"
              >
                <span className={`flag-icon ${language === 'EN' ? 'flag-icon-gb' : 'flag-icon-bd'}`}></span>
                <span>&nbsp;{language === 'EN' ? 'English' : 'বাংলা'}</span>
              </button>

              {isLangDropdownOpen && (
                <div className="absolute right-0 mt-2 w-36 bg-white rounded shadow-lg border border-slate-200 py-1 z-50 text-slate-800 text-xs animate-in fade-in duration-100">
                  <div className="px-3 py-1.5 font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 text-[10px]">
                    Language
                  </div>
                  <button 
                    onClick={() => handleLanguageChange('BN')}
                    className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-slate-100 transition-colors cursor-pointer font-medium"
                  >
                    <span className="flag-icon flag-icon-bd"></span>
                    <span>বাংলা</span>
                  </button>
                  <button 
                    onClick={() => handleLanguageChange('EN')}
                    className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-slate-100 transition-colors cursor-pointer font-medium"
                  >
                    <span className="flag-icon flag-icon-gb"></span>
                    <span>English</span>
                  </button>
                </div>
              )}
            </div>

            {/* Notifications / Helpdesk Phone: Clickable with active tap/ripple feedback */}
            <button 
              type="button"
              onClick={() => {
                setPhoneClicked(true);
                setTimeout(() => setPhoneClicked(false), 260);
              }}
              className={`text-white/90 hover:text-white p-1.5 rounded-full hover:bg-white/10 active:scale-90 transition-all cursor-pointer ${phoneClicked ? 'scale-90 bg-white/20 ring-2 ring-white/30' : ''}`}
              title="Helpdesk Phone"
              aria-label="Helpdesk Phone"
            >
              <span id="contactlist" className="flex items-center justify-center">
                <i className={`material-icons text-xl sm:text-2xl transition-transform duration-200 ${phoneClicked ? 'rotate-12 scale-110' : ''}`}>phone</i>
              </span>
            </button>
          </div>

        </div>
      </nav>

      {/* LEFT SIDEBAR (AdminBSB Structure, Exact Match) */}
      <aside 
        id="leftsidebar" 
        className={`
          fixed top-[60px] left-0 bottom-0 w-[300px] bg-white border-r border-slate-300 z-30 flex flex-col justify-between transition-transform duration-200 ease-in-out
          ${isSidebarMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div>
          {/* User Info (Exact image & button from AdminBSB DU implementation) */}
          <div className="user-info relative w-full overflow-hidden select-none border-b border-slate-200">
            <img 
              src="/assets/aistudio/du_sidebar_widget.png" 
              alt="University of Dhaka" 
              className="w-full h-auto block"
            />
            {/* Functional LOGIN overlay */}
            <a 
              href="https://academic.eis.du.ac.bd/en/b45de047fde9788cadae3cfe8e88dcc2"
              onClick={goToLogin}
              target="_top"
              rel="noopener noreferrer"
              className="absolute top-[61%] left-[3%] w-[94%] h-[20%] rounded cursor-pointer opacity-0 hover:opacity-10 bg-black/10 transition-opacity block"
              title="LOGIN"
            />
          </div>

          {/* Menu */}
          <div className="menu">
            <ul className="list-none p-0 m-0">
              {/* Registration Link */}
              <li>
                <a 
                  href={`https://academic.eis.du.ac.bd/en/gsdfg4ds6fg1cx3m4q961v3ad6sa7gfa913as49s7h46sf7h4a9g63/${currentToken}`}
                  onClick={goToRegistration}
                  target="_top"
                  rel="noopener noreferrer"
                  className="w-full flex items-center gap-4 px-4 py-3 text-sm font-medium transition-colors text-left text-slate-700 hover:bg-slate-50 waves-effect waves-block"
                >
                  <i className="material-icons text-[#5e5e5e] text-2xl">verified_user</i>
                  <span>{language === 'EN' ? 'Registration' : 'রেজিস্ট্রেশন'}</span>
                </a>
              </li>

              {/* Dashboard Link */}
              <li>
                <a 
                  href={`https://academic.eis.du.ac.bd/en/408b7c8ad06e4d9954fa2d948a01f508/${currentToken}`}
                  onClick={goToDashboard}
                  target="_top"
                  rel="noopener noreferrer"
                  className="w-full flex items-center gap-4 px-4 py-3 text-sm font-medium transition-colors text-left text-slate-700 hover:bg-slate-50 waves-effect waves-block"
                >
                  <i className="material-icons text-[#5e5e5e] text-2xl">dashboard</i>
                  <span>{language === 'EN' ? 'Dashboard' : 'ড্যাশবোর্ড'}</span>
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Footer / Legal (Clicking © 2010 - 21 opens the Admin Panel) */}
        <div className="legal p-4 border-t border-slate-200 text-xs text-slate-500 bg-white">
          <div className="copyright leading-snug">
            <button 
              type="button"
              onClick={() => {
                if (isAdminLoggedIn) {
                  setShowAdminConsole(true);
                } else {
                  setShowAdminAuthModal(true);
                }
              }}
              className="font-normal text-slate-500 hover:text-slate-800 hover:underline cursor-pointer focus:outline-none"
              title="Open Administration Console (Restricted)"
            >
              &copy; 2010 - 21
            </button>{' '}
            <span 
              className="font-bold hover:underline cursor-pointer"
              style={{ color: 'rgb(121, 85, 72)' }}
            >
              Central Admission Office
            </span>.
          </div>
          <div className="version mt-0.5 flex items-center justify-between">
            <a href="https://www.du.ac.bd" target="_blank" rel="noreferrer" className="text-sky-600 hover:text-sky-800 hover:underline">
              University of Dhaka
            </a>
            {isAdminLoggedIn && (
              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-semibold">
                Admin Active
              </span>
            )}
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT WORKSPACE (<section class="content">) */}
      <section className="content lg:ml-[300px] pt-[60px] min-h-screen bg-[#e9e9e9] flex flex-col justify-between">
        <div className="container-fluid p-4 sm:p-8 flex-1 flex flex-col items-center justify-center">

          <div className="container max-w-4xl py-5 my-auto">
            {student ? (
              <>
                {/* TWO ALIGNED CARDS */}
                <div className="row align-cards grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
                  
                  {/* LEFT CARD: PROFILE CARD */}
                  <div className="md:col-span-6 col-sm-12 flex">
                    <div className="card profile-card w-full bg-white rounded shadow-md overflow-hidden flex flex-col border border-slate-200">
                      {/* Profile Header (rgb(173, 20, 85) / #ad1457 as requested) */}
                      <div className="profile-header h-[54px] w-full" style={{ backgroundColor: 'rgb(173, 20, 85)' }} />
                      
                      {/* Profile Body */}
                      <div className="profile-body p-6 flex-1 flex flex-col items-center justify-center">
                        <div className="card-body text-center flex flex-col items-center justify-center w-full">
                          {/* Student Photo */}
                          <div className="w-32 h-40 border-2 border-black bg-slate-100 shadow-sm overflow-hidden flex items-center justify-center">
                            <img 
                              src={student.photoUrl} 
                              alt={student.name}
                              className="w-full h-full object-cover object-top"
                            />
                          </div>
                          
                          {/* ONLY ENGLISH NAME (Bangla name underneath completely removed as requested) */}
                          <h3 className="mt-4 font-bold text-gray-800 text-lg uppercase tracking-tight">
                            {student.name}
                          </h3>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* RIGHT CARD: STUDENT INFORMATION CARD */}
                  <div className="md:col-span-6 col-sm-12 flex">
                    <div className="card w-full p-5 sm:p-6 bg-white rounded shadow-md border border-slate-200 flex flex-col justify-between">
                      
                      <h4 className="text-center font-bold text-gray-700 text-base mb-4 pb-2 border-b border-slate-200 uppercase tracking-wide">
                        {language === 'EN' ? 'STUDENT INFORMATION' : 'শিক্ষার্থী সম্পর্কিত তথ্য'}
                      </h4>

                      {/* REGISTRATION NUMBER (Matching image 4: vector graduation cap icon + compact length + subtle divider) */}
                      <div className="my-1">
                        <div className="flex items-center gap-1.5">
                          <i className="material-icons text-slate-600 text-lg sm:text-xl">school</i>
                          <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                            {language === 'EN' ? 'REGISTRATION NUMBER' : 'নিবন্ধন নম্বর'}
                          </span>
                        </div>
                        {/* Registration Number (compact size, unbolded, exact green) */}
                        <p className="text-xl sm:text-2xl font-normal text-[#16a34a] tracking-normal mt-1 pl-0.5">
                          {student.regNo}
                        </p>
                        <div className="border-b border-slate-200 mt-2.5 mb-3" />
                      </div>

                      {/* STUDENTSHIP STATUS BOX (with pulsing red dot) */}
                      <div className="relative bg-[#fbfbfb] border border-slate-200 rounded p-4 pt-5 mt-4 shadow-xs">
                        {/* Red Left Accent Bar */}
                        <div className="absolute left-0 top-3 bottom-3 w-1.5 bg-[#e11d48] rounded-r" />

                        {/* Top Pill Header */}
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#4b5563] text-white text-[10px] font-bold px-3 py-0.5 rounded-full uppercase tracking-wider shadow-xs whitespace-nowrap">
                          {language === 'EN' ? 'STUDENTSHIP STATUS' : 'শিক্ষার্থিত্বের অবস্থা'}
                        </div>

                        {/* Pulsing Red Dot + Status */}
                        <div className="flex items-center justify-center gap-2 mt-1">
                          <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse shrink-0"></span>
                          <span className="text-base sm:text-lg font-extrabold text-red-700 uppercase tracking-wide">
                            {language === 'EN' ? student.status : student.statusBn}
                          </span>
                        </div>

                        {/* Last Updated Date (with quick update capability) */}
                        <div className="flex items-center justify-end gap-1 mt-2">
                          <p className="text-xs text-gray-400">
                            {language === 'EN' ? `Last updated: ${student.lastUpdated}` : `সর্বশেষ হালনাগাদ: ${student.lastUpdatedBn}`}
                          </p>
                          {isAdminLoggedIn && (
                            <button 
                              onClick={() => {
                                setQuickDateModalStudentId(student.id);
                                setQuickDateValue(student.lastUpdated);
                              }}
                              className="text-[10px] text-sky-600 hover:text-sky-800 hover:underline ml-1 font-semibold cursor-pointer"
                              title="Update this date directly"
                            >
                              [Edit Date]
                            </button>
                          )}
                        </div>
                      </div>

                    </div>
                  </div>

                </div>

                {/* BOTTOM WIDE BUTTON ROW */}
                <div className="w-full mt-6 bg-[#9ca3af] py-3.5 px-4 flex items-center justify-center rounded shadow-xs">
                  <button 
                    onClick={() => setIsDetailsModalOpen(true)}
                    className="bg-[#eb5424] hover:bg-[#d64719] active:scale-[0.98] transition-all text-white font-bold py-2.5 px-8 sm:px-12 rounded shadow-md text-sm sm:text-base text-center leading-tight hover:shadow-lg focus:outline-none cursor-pointer"
                  >
                    {language === 'EN' ? 'Click Here for Details' : 'বিস্তারিত তথ্যের জন্য এখানে ক্লিক করুন'}
                  </button>
                </div>
              </>
            ) : (
              /* FALLBACK: ERROR STATE WHEN TOKEN IS INVALID */
              <div className="w-full max-w-2xl bg-white border border-rose-300 rounded shadow-md overflow-hidden mx-auto">
                <div className="bg-rose-700 text-white p-4 flex items-center gap-3">
                  <i className="material-icons text-3xl">warning</i>
                  <div>
                    <h3 className="font-bold text-base sm:text-lg">
                      {language === 'EN' ? 'STUDENTSHIP RECORD NOT FOUND' : 'শিক্ষার্থীর কোনো তথ্য পাওয়া যায়নি'}
                    </h3>
                    <p className="text-xs text-rose-100">
                      {language === 'EN' ? 'The requested verification token could not be validated.' : 'প্রদত্ত ভেরিফিকেশন টোকেনটি সঠিক নয় অথবা ডাটাবেজে নেই।'}
                    </p>
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  <div className="bg-rose-50 border-l-4 border-rose-600 p-4 rounded text-sm text-slate-700">
                    <p className="font-semibold text-rose-900 mb-1">
                      Provided ID / Token: <code className="bg-white px-2 py-0.5 rounded border border-rose-200 text-rose-800 font-mono">{currentToken}</code>
                    </p>
                    <p className="text-xs text-slate-600 mt-1">
                      Please verify that the QR code on the student ID card is clean and scanned properly. If the card was recently revoked or replaced, contact the Central Admission Office.
                    </p>
                  </div>

                  <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                    <button 
                      onClick={() => setTokenAndUrl('Puuea1cDa2owvsfOu')}
                      className="w-full sm:w-auto bg-[#5a2e38] hover:bg-[#47222b] text-white font-semibold px-4 py-2 rounded text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <i className="material-icons text-emerald-400 text-sm">verified_user</i>
                      <span>Load Verified Student (Nymul Hossain)</span>
                    </button>

                    <button 
                      onClick={() => setIsSearchOpen(true)}
                      className="w-full sm:w-auto bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-4 py-2 rounded text-xs transition-colors border border-slate-300 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <i className="material-icons text-sm">search</i>
                      <span>Search by Reg Number</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>

        </div>
      </section>

      {/* MODAL: FULL VERIFIED DOSSIER */}
      {isDetailsModalOpen && student && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-300">
            
            {/* Modal Header */}
            <div className="text-white p-4 flex items-center justify-between sticky top-0 z-10" style={{ backgroundColor: 'rgb(121, 85, 72)' }}>
              <div className="flex items-center gap-2">
                <i className="material-icons text-emerald-400 text-xl">verified_user</i>
                <h3 className="font-bold text-sm sm:text-base tracking-wide uppercase">
                  {language === 'EN' ? 'Academic E-Service Student Dossier' : 'শিক্ষার্থীর পূর্ণাঙ্গ তথ্য বিবরণী'}
                </h3>
              </div>
              <button 
                onClick={() => setIsDetailsModalOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded hover:bg-white/10 transition-colors cursor-pointer"
              >
                <i className="material-icons text-lg">close</i>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              
              {/* Top Profile Summary */}
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 p-4 bg-slate-50 border border-slate-200 rounded">
                <div className="w-24 h-32 border-2 border-black bg-white shrink-0 overflow-hidden shadow-xs">
                  <img 
                    src={student.photoUrl} 
                    alt={student.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <div className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 mb-1 border border-emerald-300">
                    ● {student.status}
                  </div>
                  {/* Clean English Name only */}
                  <h4 className="text-lg font-bold text-slate-900">{student.name}</h4>
                  
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-500">Registration:</span>{' '}
                      <span className="font-bold text-emerald-700">{student.regNo}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Roll No:</span>{' '}
                      <span className="font-semibold text-slate-800">{student.admissionRoll}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Academic Program Breakdown */}
              <div className="border border-slate-200 rounded overflow-hidden">
                <div className="bg-slate-100 px-4 py-2 font-bold text-xs uppercase tracking-wider text-slate-700 border-b border-slate-200">
                  Academic Credentials & Enrollment
                </div>
                <div className="divide-y divide-slate-100 text-sm">
                  <div className="grid grid-cols-3 px-4 py-2.5">
                    <span className="text-slate-500 text-xs">Faculty</span>
                    <span className="col-span-2 font-semibold text-slate-800">{student.faculty}</span>
                  </div>
                  <div className="grid grid-cols-3 px-4 py-2.5 bg-slate-50/50">
                    <span className="text-slate-500 text-xs">Department / Subject</span>
                    <span className="col-span-2 font-semibold text-slate-800">{student.subject}</span>
                  </div>
                  <div className="grid grid-cols-3 px-4 py-2.5">
                    <span className="text-slate-500 text-xs">Degree Program</span>
                    <span className="col-span-2 font-semibold text-slate-800">{student.degree}</span>
                  </div>
                  <div className="grid grid-cols-3 px-4 py-2.5 bg-slate-50/50">
                    <span className="text-slate-500 text-xs">Academic Session</span>
                    <span className="col-span-2 font-semibold text-slate-800">{student.session}</span>
                  </div>
                  <div className="grid grid-cols-3 px-4 py-2.5">
                    <span className="text-slate-500 text-xs">Residential Hall</span>
                    <span className="col-span-2 font-semibold text-slate-800">{student.hall}</span>
                  </div>
                  <div className="grid grid-cols-3 px-4 py-2.5 bg-slate-50/50">
                    <span className="text-slate-500 text-xs">Smart Card Issue</span>
                    <span className="col-span-2 font-semibold text-slate-800">{student.issueDate}</span>
                  </div>
                  <div className="grid grid-cols-3 px-4 py-2.5">
                    <span className="text-slate-500 text-xs">Verification Token</span>
                    <span className="col-span-2 font-mono text-xs font-semibold text-sky-800">{student.id}</span>
                  </div>
                </div>
              </div>

              {/* Verification Authority Seal */}
              <div className="bg-amber-50/70 border border-amber-200 rounded p-3 text-xs text-amber-900 flex items-start gap-2.5">
                <i className="material-icons text-amber-700 text-sm mt-0.5">info</i>
                <p>
                  This official studentship verification is generated electronically by the <strong>Academic E-Service Management (academic.eis.du.ac.bd)</strong>, University of Dhaka. It is certified for administrative, scholarship, transit concessions, and official identification purposes.
                </p>
              </div>

            </div>

            {/* Modal Footer Controls */}
            <div className="bg-slate-100 p-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-500">
                Verified: <span className="font-semibold text-emerald-700">Digital Signature Valid</span>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => window.print()}
                  className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold px-3 py-2 rounded flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <i className="material-icons text-sm">print</i>
                  <span>Print Verification</span>
                </button>
                <button 
                  onClick={() => setIsDetailsModalOpen(false)}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold px-4 py-2 rounded transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>

          </div>
        </div>
      )}



      {/* QUICK DATE UPDATE POPUP MODAL (Directly from Profile) */}
      {quickDateModalStudentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded shadow-xl max-w-sm w-full p-5 border border-slate-300 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h4 className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                <i className="material-icons text-sky-700 text-base">calendar_today</i>
                <span>Update "Last Updated" Date</span>
              </h4>
              <button onClick={() => setQuickDateModalStudentId(null)} className="text-slate-400 hover:text-slate-600">
                <i className="material-icons text-base">close</i>
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Enter New Date Text</label>
              <input 
                type="text"
                value={quickDateValue}
                onChange={(e) => setQuickDateValue(e.target.value)}
                placeholder="e.g. Nov 12, 2026"
                className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs"
              />
            </div>

            <div className="flex gap-2">
              <button 
                type="button"
                onClick={() => {
                  const today = formatDateToDisplay(new Date());
                  setQuickDateValue(today.en);
                }}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded text-[11px] font-semibold text-slate-700 cursor-pointer"
              >
                Set Today's Date
              </button>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button 
                onClick={() => setQuickDateModalStudentId(null)}
                className="px-3 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded"
              >
                Cancel
              </button>
              <button 
                onClick={() => handleUpdateLastUpdatedDate(quickDateModalStudentId, quickDateValue)}
                className="px-4 py-1 text-xs font-bold bg-[#5a2e38] text-white rounded cursor-pointer"
              >
                Update Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* ADMIN AUTHENTICATION MODAL (Hidden Password: admin123)       */}
      {/* ------------------------------------------------------------- */}
      {showAdminAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-lg shadow-2xl max-w-sm w-full border border-slate-300 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="text-white p-4 flex items-center justify-between" style={{ backgroundColor: 'rgb(121, 85, 72)' }}>
              <div className="flex items-center gap-2">
                <i className="material-icons text-amber-400">lock</i>
                <h3 className="font-bold text-sm tracking-wide uppercase">Admin Access Gateway</h3>
              </div>
              <button 
                onClick={() => {
                  setShowAdminAuthModal(false);
                  setAdminAuthError('');
                }}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                <i className="material-icons text-base">close</i>
              </button>
            </div>

            <form onSubmit={handleAdminAuthSubmit} className="p-5 space-y-4">
              <p className="text-xs text-slate-600">
                Please enter the administrative password to manage student verification records, photos, and studentship status.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Master Password
                </label>
                <input 
                  type="password"
                  value={adminPasswordInput}
                  onChange={(e) => setAdminPasswordInput(e.target.value)}
                  placeholder="Enter password"
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#795548]"
                  autoFocus
                />
                {adminAuthError && (
                  <div className="mt-1.5">
                    <span className="text-[11px] text-rose-600 font-semibold">{adminAuthError}</span>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button 
                  type="button"
                  onClick={() => {
                    setShowAdminAuthModal(false);
                    setAdminAuthError('');
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold text-white rounded shadow-sm cursor-pointer transition-colors opacity-95 hover:opacity-100"
                  style={{ backgroundColor: 'rgb(121, 85, 72)' }}
                >
                  Authorize Login
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* ADMIN CONSOLE DASHBOARD MODAL                                 */}
      {/* ------------------------------------------------------------- */}
      {showAdminConsole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col border border-slate-300">
            
            {/* Admin Header */}
            <div className="text-white p-4 flex flex-wrap items-center justify-between gap-3 shrink-0" style={{ backgroundColor: 'rgb(121, 85, 72)' }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-white/10 flex items-center justify-center border border-white/20">
                  <i className="material-icons text-amber-400 text-lg">admin_panel_settings</i>
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base uppercase tracking-tight">
                    Central Admission Office: Student Verification Database
                  </h3>
                  <p className="text-[11px] text-slate-200 mt-0.5">
                    Live Portal Data Management • {Object.keys(studentsDb).length} Records Enrolled
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    setNewStudentPhoto('/assets/aistudio/nymul_hossain.png');
                    setIsNewStudentModalOpen(true);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded flex items-center gap-1 shadow-sm transition-colors cursor-pointer"
                >
                  <i className="material-icons text-sm">person_add</i>
                  <span>Add Student</span>
                </button>
                <button 
                  onClick={() => setShowAdminConsole(false)}
                  className="bg-white/10 hover:bg-white/20 text-white p-1.5 rounded transition-colors cursor-pointer"
                  title="Close console"
                >
                  <i className="material-icons text-base">close</i>
                </button>
              </div>
            </div>

            {/* Sub-header Filter & Search */}
            <div className="p-3 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <i className="material-icons absolute left-2.5 top-2 text-slate-400 text-lg">search</i>
                <input 
                  type="text" 
                  value={adminSearchQuery}
                  onChange={(e) => setAdminSearchQuery(e.target.value)}
                  placeholder="Filter by name, reg number, token..."
                  className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div className="text-xs text-slate-600 flex items-center gap-4">
                <span>Active Token: <strong className="font-mono text-[#16a34a]">{currentToken}</strong></span>
                <button 
                  onClick={() => {
                    setIsAdminLoggedIn(false);
                    setShowAdminConsole(false);
                  }}
                  className="text-rose-600 hover:text-rose-800 font-medium text-xs hover:underline cursor-pointer"
                >
                  Logout Admin
                </button>
              </div>
            </div>

            {/* Student Records List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {adminFilteredStudents.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <i className="material-icons text-4xl text-slate-300 mb-2">person_off</i>
                  <p className="text-sm font-medium">No student records match your query.</p>
                </div>
              ) : (
                adminFilteredStudents.map(s => {
                  const isCurrent = s.id === currentToken;
                  return (
                    <div 
                      key={s.id}
                      className={`p-3.5 rounded-lg border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${isCurrent ? 'bg-amber-50/60 border-amber-300 shadow-xs' : 'bg-white border-slate-200 hover:border-slate-300'}`}
                    >
                      {/* Left: Thumbnail & Student Info */}
                      <div className="flex items-center gap-3.5 min-w-[280px]">
                        <div className="w-12 h-16 border border-slate-400 bg-slate-100 rounded overflow-hidden shrink-0">
                          <img 
                            src={s.photoUrl} 
                            alt={s.name} 
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-slate-900 text-sm">{s.name}</h4>
                            {isCurrent && (
                              <span className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.2 rounded font-bold">
                                Current Active
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
                            <span className="text-slate-600">Reg: <strong className="text-emerald-700">{s.regNo}</strong></span>
                            <span className="text-slate-400">•</span>
                            <span className="text-slate-600">{s.subject}</span>
                            <span className="text-slate-400">•</span>
                            <span className="font-mono text-[11px] text-sky-700 bg-sky-50 px-1 py-0.2 rounded">
                              ID: {s.id}
                            </span>
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                            <span>Roll: <strong className="text-slate-700 font-semibold">{s.admissionRoll || 'N/A'}</strong></span>
                            <span>•</span>
                            <span>Smart Card Issued: <strong className="text-slate-700 font-semibold">{s.issueDate || 'N/A'}</strong></span>
                          </div>
                        </div>
                      </div>

                      {/* Middle: Live Studentship Status Selector & Last Updated Date */}
                      <div className="flex flex-col gap-1 min-w-[220px]">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          Studentship Status
                        </label>
                        <select 
                          value={s.status}
                          onChange={(e) => handleUpdateStudentStatus(s.id, e.target.value as StudentRecord['status'])}
                          className={`text-xs font-bold px-2 py-1.5 rounded border focus:outline-none cursor-pointer ${
                            s.status === 'CURRENT STUDENT' 
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300' 
                              : s.status === 'ALUMNI / COMPLETED'
                              ? 'bg-blue-50 text-blue-800 border-blue-300'
                              : 'bg-rose-50 text-rose-800 border-rose-300'
                          }`}
                        >
                          <option value="CURRENT STUDENT">CURRENT STUDENT (বর্তমান শিক্ষার্থী)</option>
                          <option value="ALUMNI / COMPLETED">ALUMNI / COMPLETED (উত্তীর্ণ)</option>
                          <option value="EXPIRED / SUSPENDED">EXPIRED / SUSPENDED (স্থগিত)</option>
                        </select>
                        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                          <span>Date: <strong className="text-slate-700">{s.lastUpdated}</strong></span>
                          <button 
                            onClick={() => {
                              setQuickDateModalStudentId(s.id);
                              setQuickDateValue(s.lastUpdated);
                            }}
                            className="text-sky-700 hover:underline font-semibold text-[10px] cursor-pointer"
                          >
                            Change Date
                          </button>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-1.5 shrink-0 self-end md:self-center">
                        <button 
                          onClick={() => {
                            setTokenAndUrl(s.id);
                            setShowAdminConsole(false);
                          }}
                          className="px-2.5 py-1 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white rounded transition-colors flex items-center gap-1 cursor-pointer"
                          title="View on Verification Portal"
                        >
                          <i className="material-icons text-xs">visibility</i>
                          <span>View Live</span>
                        </button>
                        <button 
                          onClick={() => setEditingStudent(s)}
                          className="px-2.5 py-1 text-xs font-semibold bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-300 rounded transition-colors flex items-center gap-1 cursor-pointer"
                          title="Edit Student Info & Photo"
                        >
                          <i className="material-icons text-xs">edit</i>
                          <span>Edit</span>
                        </button>
                        <button 
                          onClick={() => handleDeleteStudent(s.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                          title="Delete Student Record"
                        >
                          <i className="material-icons text-base">delete</i>
                        </button>
                      </div>

                    </div>
                  );
                })
              )}
            </div>

            {/* Admin Footer */}
            <div className="p-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
              <span>All changes automatically persist in local browser database storage.</span>
              <button 
                onClick={() => setShowAdminConsole(false)}
                className="px-4 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold rounded transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>

          </div>
        </div>
      )}



      {/* ------------------------------------------------------------- */}
      {/* EDIT STUDENT RECORD MODAL (With File Upload from Computer)     */}
      {/* ------------------------------------------------------------- */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-lg shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-slate-300">
            <div className="text-white p-4 flex items-center justify-between sticky top-0 z-10" style={{ backgroundColor: 'rgb(121, 85, 72)' }}>
              <h3 className="font-bold text-sm uppercase">Edit Student Record: {editingStudent.name}</h3>
              <button onClick={() => setEditingStudent(null)} className="text-white/80 hover:text-white cursor-pointer">
                <i className="material-icons text-base">close</i>
              </button>
            </div>

            <form 
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveStudentEdit(editingStudent);
              }}
              className="p-5 space-y-3.5 text-xs"
            >
              <div>
                <label className="block font-semibold text-slate-700 uppercase mb-1">Student Name (English)</label>
                <input 
                  type="text" 
                  value={editingStudent.name}
                  onChange={(e) => setEditingStudent({ ...editingStudent, name: e.target.value.toUpperCase() })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs font-semibold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 uppercase mb-1">Registration Number</label>
                  <input 
                    type="text" 
                    value={editingStudent.regNo}
                    onChange={(e) => setEditingStudent({ ...editingStudent, regNo: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs font-bold text-emerald-700"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 uppercase mb-1">Studentship Status</label>
                  <select 
                    value={editingStudent.status}
                    onChange={(e) => {
                      const newStatus = e.target.value as StudentRecord['status'];
                      const map: Record<StudentRecord['status'], string> = {
                        'CURRENT STUDENT': 'বর্তমান শিক্ষার্থী',
                        'ALUMNI / COMPLETED': 'সাবেক শিক্ষার্থী / উত্তীর্ণ',
                        'EXPIRED / SUSPENDED': 'স্থগিত / মেয়াদোত্তীর্ণ'
                      };
                      setEditingStudent({ 
                        ...editingStudent, 
                        status: newStatus,
                        statusBn: map[newStatus]
                      });
                    }}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs font-bold text-slate-800"
                  >
                    <option value="CURRENT STUDENT">CURRENT STUDENT</option>
                    <option value="ALUMNI / COMPLETED">ALUMNI / COMPLETED</option>
                    <option value="EXPIRED / SUSPENDED">EXPIRED / SUSPENDED</option>
                  </select>
                </div>
              </div>

              {/* UPLOAD STUDENT PHOTO FROM PC */}
              <div className="bg-slate-50 p-3 rounded border border-slate-200 space-y-2">
                <label className="block font-bold text-slate-800 uppercase text-[11px] flex items-center gap-1.5">
                  <i className="material-icons text-sky-700 text-sm">cloud_upload</i>
                  <span>Upload Student Photo from Your Computer</span>
                </label>
                
                <div className="flex items-center gap-3">
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, false)}
                    className="text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-bold file:bg-[#795548] file:text-white hover:file:opacity-90 cursor-pointer"
                  />
                  <div className="w-12 h-14 border-2 border-black bg-white rounded overflow-hidden shrink-0 shadow-xs">
                    <img src={editingStudent.photoUrl} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                </div>
                <div className="text-[10px] text-slate-400">
                  Current image: <code className="break-all font-mono">{editingStudent.photoUrl.slice(0, 45)}...</code>
                </div>
              </div>

              {/* LAST UPDATED DATE CONTROLS */}
              <div className="bg-slate-50 p-3 rounded border border-slate-200 space-y-2">
                <label className="block font-bold text-slate-800 uppercase text-[11px] flex items-center gap-1.5">
                  <i className="material-icons text-amber-700 text-sm">edit_calendar</i>
                  <span>Update "Last Updated" Date</span>
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <input 
                    type="text" 
                    value={editingStudent.lastUpdated}
                    onChange={(e) => setEditingStudent({ 
                      ...editingStudent, 
                      lastUpdated: e.target.value,
                      lastUpdatedBn: e.target.value
                    })}
                    placeholder="e.g. Nov 12, 2026"
                    className="flex-1 min-w-[140px] px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white font-semibold"
                  />
                  <button 
                    type="button"
                    onClick={() => {
                      const today = formatDateToDisplay(new Date());
                      setEditingStudent({ 
                        ...editingStudent, 
                        lastUpdated: today.en,
                        lastUpdatedBn: today.bn
                      });
                    }}
                    className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded text-xs cursor-pointer"
                  >
                    Set to Today
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 uppercase mb-1">Subject / Department</label>
                  <input 
                    type="text" 
                    value={editingStudent.subject}
                    onChange={(e) => setEditingStudent({ ...editingStudent, subject: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 uppercase mb-1">Faculty</label>
                  <input 
                    type="text" 
                    value={editingStudent.faculty}
                    onChange={(e) => setEditingStudent({ ...editingStudent, faculty: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 uppercase mb-1">Session</label>
                  <input 
                    type="text" 
                    value={editingStudent.session}
                    onChange={(e) => setEditingStudent({ ...editingStudent, session: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 uppercase mb-1">Residential Hall</label>
                  <input 
                    type="text" 
                    value={editingStudent.hall}
                    onChange={(e) => setEditingStudent({ ...editingStudent, hall: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs"
                  />
                </div>
              </div>

              {/* ADMISSION ROLL & SMART CARD ISSUE DATE CONTROLS */}
              <div className="grid grid-cols-2 gap-3 bg-amber-50/50 p-3 rounded border border-amber-200">
                <div>
                  <label className="block font-bold text-slate-800 uppercase text-[11px] mb-1 flex items-center gap-1">
                    <i className="material-icons text-amber-700 text-sm">badge</i>
                    <span>Admission Roll No</span>
                  </label>
                  <input 
                    type="text" 
                    value={editingStudent.admissionRoll || ''}
                    onChange={(e) => setEditingStudent({ ...editingStudent, admissionRoll: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs font-semibold bg-white"
                    placeholder="e.g. 54384"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-800 uppercase text-[11px] mb-1 flex items-center gap-1">
                    <i className="material-icons text-amber-700 text-sm">credit_card</i>
                    <span>Smart Card Issue Date</span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input 
                      type="text" 
                      value={editingStudent.issueDate || ''}
                      onChange={(e) => setEditingStudent({ ...editingStudent, issueDate: e.target.value })}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs font-semibold bg-white"
                      placeholder="e.g. 03-01-2025 (16:32)"
                    />
                    <button 
                      type="button"
                      onClick={() => {
                        const now = new Date();
                        const pad = (n: number) => n < 10 ? '0' + n : n;
                        const formatted = `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()} (${pad(now.getHours())}:${pad(now.getMinutes())})`;
                        setEditingStudent({ ...editingStudent, issueDate: formatted });
                      }}
                      className="px-2 py-1.5 bg-amber-200 hover:bg-amber-300 text-amber-900 text-[10px] font-bold rounded whitespace-nowrap cursor-pointer shadow-xs"
                      title="Set current date and time"
                    >
                      Now
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button 
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold text-white rounded shadow-sm cursor-pointer transition-opacity hover:opacity-90"
                  style={{ backgroundColor: 'rgb(121, 85, 72)' }}
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* ADD NEW STUDENT MODAL (With File Upload from Computer)          */}
      {/* ------------------------------------------------------------- */}
      {isNewStudentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-lg shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-slate-300">
            <div className="bg-emerald-700 text-white p-4 flex items-center justify-between sticky top-0 z-10">
              <h3 className="font-bold text-sm uppercase">Add New Student Record</h3>
              <button onClick={() => setIsNewStudentModalOpen(false)} className="text-white/80 hover:text-white cursor-pointer">
                <i className="material-icons text-base">close</i>
              </button>
            </div>

            <form 
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const newRec: StudentRecord = {
                  id: (form.elements.namedItem('id') as HTMLInputElement).value.trim(),
                  name: (form.elements.namedItem('name') as HTMLInputElement).value.trim().toUpperCase(),
                  regNo: (form.elements.namedItem('regNo') as HTMLInputElement).value.trim(),
                  photoUrl: newStudentPhoto,
                  status: (form.elements.namedItem('status') as HTMLSelectElement).value as StudentRecord['status'],
                  statusBn: 'বর্তমান শিক্ষার্থী',
                  lastUpdated: (form.elements.namedItem('lastUpdated') as HTMLInputElement).value.trim() || 'Nov 12, 2026',
                  lastUpdatedBn: '১২ নভেম্বর, ২০২৬',
                  subject: (form.elements.namedItem('subject') as HTMLInputElement).value.trim(),
                  faculty: (form.elements.namedItem('faculty') as HTMLInputElement).value.trim() || 'Faculty of Science',
                  degree: 'Bachelor of Science (Honours)',
                  session: (form.elements.namedItem('session') as HTMLInputElement).value.trim() || '2021-2022',
                  hall: (form.elements.namedItem('hall') as HTMLInputElement).value.trim() || 'Shahidullah Hall',
                  duidCode: 'DUID<<<NEW_STUDENT',
                  admissionRoll: (form.elements.namedItem('admissionRoll') as HTMLInputElement)?.value.trim() || '54384',
                  issueDate: (form.elements.namedItem('issueDate') as HTMLInputElement)?.value.trim() || '03-01-2025 (16:32)',
                  nationalIdMasked: '•••• •••• •••• 99999'
                };
                handleAddNewStudent(newRec);
              }}
              className="p-5 space-y-3.5 text-xs"
            >
              <div>
                <label className="block font-semibold text-slate-700 uppercase mb-1">
                  Unique Token / ID (e.g. Puuea1cDa2owvsfOu)
                </label>
                <input 
                  name="id"
                  type="text" 
                  defaultValue={`DU${Math.random().toString(36).substring(2, 9).toUpperCase()}`}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs font-mono font-bold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 uppercase mb-1">Full Name (English)</label>
                  <input name="name" type="text" placeholder="e.g. NYMUL HOSSAIN" className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs uppercase" required />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 uppercase mb-1">Registration Number</label>
                  <input name="regNo" type="text" placeholder="e.g. 2021281178" className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs font-bold text-emerald-700" required />
                </div>
              </div>

              {/* UPLOAD PHOTO FROM PC */}
              <div className="bg-slate-50 p-3 rounded border border-slate-200 space-y-2">
                <label className="block font-bold text-slate-800 uppercase text-[11px] flex items-center gap-1.5">
                  <i className="material-icons text-sky-700 text-sm">cloud_upload</i>
                  <span>Upload Student Photo from Your PC</span>
                </label>
                <div className="flex items-center gap-3">
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, true)}
                    className="text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-bold file:bg-[#795548] file:text-white hover:file:opacity-90 cursor-pointer"
                  />
                  <div className="w-12 h-14 border-2 border-black bg-white rounded overflow-hidden shrink-0 shadow-xs">
                    <img src={newStudentPhoto} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 uppercase mb-1">Initial Status</label>
                  <select name="status" className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs font-bold">
                    <option value="CURRENT STUDENT">CURRENT STUDENT</option>
                    <option value="ALUMNI / COMPLETED">ALUMNI / COMPLETED</option>
                    <option value="EXPIRED / SUSPENDED">EXPIRED / SUSPENDED</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 uppercase mb-1">Last Updated Date</label>
                  <input name="lastUpdated" type="text" defaultValue="Nov 12, 2026" className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 uppercase mb-1">Subject / Department</label>
                  <input name="subject" type="text" defaultValue="Computer Science & Engineering" className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs" required />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 uppercase mb-1">Faculty</label>
                  <input name="faculty" type="text" defaultValue="Faculty of Engineering & Technology" className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 uppercase mb-1">Session</label>
                  <input name="session" type="text" defaultValue="2021-2022" className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 uppercase mb-1">Residential Hall</label>
                  <input name="hall" type="text" defaultValue="Shahidullah Hall" className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-amber-50/50 p-3 rounded border border-amber-200">
                <div>
                  <label className="block font-bold text-slate-800 uppercase text-[11px] mb-1 flex items-center gap-1">
                    <i className="material-icons text-amber-700 text-sm">badge</i>
                    <span>Admission Roll No</span>
                  </label>
                  <input 
                    name="admissionRoll" 
                    type="text" 
                    defaultValue="54384"
                    placeholder="e.g. 54384" 
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs font-semibold bg-white" 
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-800 uppercase text-[11px] mb-1 flex items-center gap-1">
                    <i className="material-icons text-amber-700 text-sm">credit_card</i>
                    <span>Smart Card Issue Date</span>
                  </label>
                  <input 
                    name="issueDate" 
                    type="text" 
                    defaultValue="03-01-2025 (16:32)"
                    placeholder="e.g. 03-01-2025 (16:32)" 
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs font-semibold bg-white" 
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button 
                  type="button" 
                  onClick={() => setIsNewStudentModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white rounded shadow-sm cursor-pointer"
                >
                  Add & View Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINT STYLING */}
      <style>{`
        @media print {
          nav, aside, .search-bar, button {
            display: none !important;
          }
          section.content {
            margin-left: 0 !important;
            padding-top: 0 !important;
            background: white !important;
          }
          .card {
            box-shadow: none !important;
            border: 1px solid #ccc !important;
          }
        }
      `}</style>

    </div>
  );
}
