'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
// @ts-ignore
import Papa from 'papaparse';
import { Upload, Play, Pause, Square, Smartphone, FileText, Image as ImageIcon, CheckCircle, AlertCircle, RefreshCw, Lock, Mic, Calendar, Clock, Users, Save, Trash2, Moon, Sun } from 'lucide-react';

type Log = {
  phone: string;
  status: 'sent' | 'failed';
  error?: string;
  timestamp: string;
};

type Session = {
  id: string;
  status: string;
  qrCodeUrl: string | null;
};

type Subscription = {
  plan: 'free' | 'premium';
  maxAccounts: number;
  maxMessages: number;
  messageCount: number;
  expiry?: string | null;
};

type Status = {
  sessions?: Session[];
  subscription?: Subscription;
  campaign: {
    id?: string;
    status: 'idle' | 'running' | 'paused' | 'completed' | 'stopped' | 'scheduled';
    scheduledAt?: string;
    progress?: {
      total: number;
      sent: number;
      failed: number;
      pending: number;
    };
    logs?: Log[];
  };
};

export default function Home() {
  const router = useRouter();
  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');

  // App State
  const [status, setStatus] = useState<Status | null>(null);
  const [message, setMessage] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [parsedContacts, setParsedContacts] = useState<{ phone: string }[]>([]);
  const [delay, setDelay] = useState({ min: 5, max: 10 });
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');

  // New Features State
  const [scheduledTime, setScheduledTime] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [manualInput, setManualInput] = useState('');
  const [activeTab, setActiveTab] = useState<'csv' | 'txt' | 'manual' | 'groups'>('manual');
  
  // Group State
  const [groups, setGroups] = useState<{ name: string; count: number }[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [showSaveGroup, setShowSaveGroup] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  // Multi-Session & Subscription State
  const [sessions, setSessions] = useState<Session[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [newSessionId, setNewSessionId] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState(''); // For sending campaign

  const pollTimer = useRef<NodeJS.Timeout | null>(null);

  const toggleDarkMode = () => setIsDarkMode(!isDarkMode);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === process.env.NEXT_PUBLIC_APP_PASSWORD) {
      setIsAuthenticated(true);
      localStorage.setItem('auth', 'true');
    } else {
      alert('Incorrect Password');
    }
  };

  useEffect(() => {
    const isAuth = localStorage.getItem('auth');
    if (isAuth === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], 'voice-note.webm', { type: 'audio/webm' });
        await handleMediaUpload({ target: { files: [file] } } as any);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
    } catch (err) {
      console.error('Mic Error:', err);
      alert('Could not access microphone.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  useEffect(() => {
    let interval: any;
    if (isRecording) {
      interval = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const fetchStatus = async () => {
    if (!isAuthenticated) return;
    try {
      const res = await axios.get('/api/worker/status');
      // Update all states
      setStatus(res.data);
      if (res.data.sessions) setSessions(res.data.sessions);
      if (res.data.subscription) setSubscription(res.data.subscription);
      
      setError('');
    } catch (err) {
      console.error(err);
      setError('Failed to connect to Worker Server');
    }
  };

  const createSession = async () => {
    if (!newSessionId) return alert('Enter a session ID (e.g., "marketing", "support")');
    try {
      await axios.post('/api/worker/sessions', { id: newSessionId });
      setNewSessionId('');
      fetchStatus();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create session');
    }
  };

  const removeSession = async (id: string) => {
    if (!confirm('Remove this session?')) return;
    try {
      await axios.delete(`/api/worker/sessions/${id}`);
      fetchStatus();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to remove session');
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchStatus();
      pollTimer.current = setInterval(fetchStatus, 3000);
    }
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, [isAuthenticated]);

  const cleanPhoneNumber = (phone: string) => {
    return phone.replace(/[^\d]/g, '');
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCsvFile(file);
      Papa.parse(file, {
        header: true,
        complete: (results: any) => {
          const contacts = results.data
            .map((row: any) => ({ phone: cleanPhoneNumber(row.phone || row.Phone || row.PHONE || '') }))
            .filter((c: any) => c.phone && c.phone.length > 5); // Basic length check
          setParsedContacts(contacts);
        },
      });
    }
  };

  const handleTxtUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const contacts = text.split(/\r?\n/)
          .map(line => ({ phone: cleanPhoneNumber(line.trim()) }))
          .filter(c => c.phone && c.phone.length > 5);
        setParsedContacts(contacts);
      };
      reader.readAsText(file);
    }
  };

  const handleManualInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setManualInput(text);
    const contacts = text.split(/\r?\n/)
      .map(line => ({ phone: cleanPhoneNumber(line.trim()) }))
      .filter(c => c.phone && c.phone.length > 5);
    setParsedContacts(contacts);
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const res = await fetch(`/api/upload?filename=${file.name}`, {
        method: 'POST',
        body: file,
      });
      const data = await res.json();
      if (data.url) {
        setMediaUrl(data.url);
      } else {
        alert('Upload failed (Check Blob Token)');
      }
    } catch (err) {
      console.error(err);
      alert('Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  // Group Management
  const fetchGroups = async () => {
    if (!isAuthenticated) return;
    try {
      const res = await axios.get('/api/worker/contacts/groups');
      setGroups(res.data.groups || []);
    } catch (err) {
      console.error('Failed to fetch groups', err);
    }
  };

  useEffect(() => {
    if (isAuthenticated) fetchGroups();
  }, [isAuthenticated]);

  const saveCurrentContactsAsGroup = async () => {
    if (!newGroupName.trim()) return alert('Please enter a group name');
    if (parsedContacts.length === 0) return alert('No contacts to save');

    try {
      await axios.post('/api/worker/contacts/groups', {
        name: newGroupName,
        contacts: parsedContacts.map(c => c.phone)
      });
      setNewGroupName('');
      setShowSaveGroup(false);
      fetchGroups();
      alert('Group saved successfully');
    } catch (err: any) {
      alert('Failed to save group: ' + (err.response?.data?.error || err.message));
    }
  };

  const deleteGroup = async (name: string) => {
    if (!confirm(`Are you sure you want to delete group "${name}"?`)) return;
    try {
      await axios.delete(`/api/worker/contacts/groups/${encodeURIComponent(name)}`);
      fetchGroups();
      if (selectedGroups.includes(name)) {
        const newSelected = selectedGroups.filter(g => g !== name);
        setSelectedGroups(newSelected);
        updateContactsFromGroups(newSelected);
      }
    } catch (err: any) {
      alert('Failed to delete group');
    }
  };

  const updateContactsFromGroups = async (selected: string[]) => {
    if (selected.length === 0) {
      setParsedContacts([]);
      return;
    }
    try {
      const groupsParam = selected.map(g => encodeURIComponent(g)).join(',');
      const res = await axios.get(`/api/worker/contacts/list?groups=${groupsParam}`);
      setParsedContacts(res.data.map((phone: string) => ({ phone })));
    } catch (err) {
      console.error('Failed to fetch group contacts', err);
    }
  };

  const handleGroupToggle = (name: string) => {
    const newSelected = selectedGroups.includes(name)
      ? selectedGroups.filter(g => g !== name)
      : [...selectedGroups, name];
    
    setSelectedGroups(newSelected);
    updateContactsFromGroups(newSelected);
  };

  const startCampaign = async () => {
    if (!parsedContacts.length) return alert('No contacts loaded');
    if (!message && !mediaUrl) return alert('Message or Media required');

    const messages = parsedContacts.map((c) => ({
      phone: c.phone,
      message: message, // You could do template replacement here e.g. "Hello {name}"
      mediaUrl: mediaUrl || null,
    }));

    try {
      await axios.post('/api/worker/campaign/start', {
        id: crypto.randomUUID(),
        messages,
        scheduledAt: scheduledTime || null,
        config: {
          minDelay: Number(delay.min),
          maxDelay: Number(delay.max),
          sessionId: selectedSessionId || undefined,
        },
      });
      fetchStatus();
    } catch (err: any) {
      console.error(err);
      const errorMessage = err.response?.data?.error || err.message || 'Failed to start campaign';
      alert(`Error: ${errorMessage}`);
    }
  };

  const pauseCampaign = async () => {
    await axios.post('/api/worker/campaign/pause');
    fetchStatus();
  };

  const stopCampaign = async () => {
    await axios.post('/api/worker/campaign/stop');
    fetchStatus();
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md border border-gray-100">
          <div className="flex justify-center mb-6">
            <div className="bg-amber-100 p-3 rounded-full">
              <Lock className="w-8 h-8 text-amber-600" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-center mb-2">Welcome Back</h1>
          <p className="text-gray-500 text-center mb-6">Please enter the access password</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border focus:ring-2 focus:ring-amber-500 outline-none"
                placeholder="Password"
                autoFocus
              />
            </div>
            <button
              type="submit"
              className="w-full bg-amber-600 text-white py-3 rounded-lg font-semibold hover:bg-amber-700 transition-colors"
            >
              Access Dashboard
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4 lg:p-8 transition-colors duration-300">
        <div className="max-w-7xl mx-auto">
          <header className="mb-8 flex justify-between items-center">
            <div className="flex flex-col">
              <div className="h-16 lg:h-20 relative flex items-center">
                  {/* Light Mode Logo */}
                  <img 
                    src="/ecomerco-light.svg?v=2" 
                    alt="ecomerco Marketplace" 
                    className="h-full w-auto block dark:hidden object-contain"
                  />
                  {/* Dark Mode Logo */}
                  <img 
                    src="/ecomerco-dark.svg?v=2" 
                    alt="ecomerco Marketplace" 
                    className="h-full w-auto hidden dark:block object-contain"
                  />
               </div>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={toggleDarkMode}
                className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                {isDarkMode ? <Sun className="text-yellow-500" /> : <Moon className="text-gray-600" />}
              </button>
              <button 
                onClick={() => {
                  setIsAuthenticated(false);
                  localStorage.removeItem('auth');
                }}
                className="text-sm text-red-500 hover:text-red-700 font-medium"
              >
                Logout
              </button>
            </div>
          </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Status & Config */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Subscription Card */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
             <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Subscription</h2>
                <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${subscription?.plan === 'premium' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-700'}`}>
                  {subscription?.plan || 'FREE'}
                </span>
             </div>
             
             <div className="space-y-3 mb-4">
                <div>
                   <div className="flex justify-between text-sm mb-1 text-gray-600 dark:text-gray-300">
                      <span>Messages</span>
                      <span>{subscription?.messageCount || 0} / {subscription?.plan === 'premium' ? '∞' : subscription?.maxMessages || 1000}</span>
                   </div>
                   <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-amber-600 h-2 rounded-full transition-all" 
                        style={{ width: `${Math.min(((subscription?.messageCount || 0) / (subscription?.maxMessages || 1000)) * 100, 100)}%` }}
                      ></div>
                   </div>
                </div>
                <div>
                   <div className="flex justify-between text-sm mb-1 text-gray-600 dark:text-gray-300">
                      <span>Accounts</span>
                      <span>{sessions.length} / {subscription?.plan === 'premium' ? '∞' : subscription?.maxAccounts || 1}</span>
                   </div>
                </div>
             </div>

             {subscription?.plan !== 'premium' && (
               <button 
                 onClick={() => router.push('/payment')}
                 className="w-full bg-gradient-to-r from-amber-500 to-amber-600 text-white py-2 rounded-lg font-medium shadow-sm hover:from-amber-600 hover:to-amber-700 transition-all flex items-center justify-center gap-2"
               >
                 <Lock size={16} />
                 Upgrade to Premium (87 AED/wk)
               </button>
             )}
          </div>

          {/* Accounts Card */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">WhatsApp Accounts</h2>
            
            <div className="space-y-4 mb-4">
              {sessions.map(session => (
                <div key={session.id} className="border dark:border-gray-700 rounded-lg p-3">
                   <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-gray-900 dark:text-white">{session.id}</span>
                      <div className="flex items-center gap-2">
                         <span className={`text-xs px-2 py-0.5 rounded ${session.status === 'CONNECTED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                           {session.status}
                         </span>
                         <button onClick={() => removeSession(session.id)} className="text-red-500 hover:text-red-700">
                           <Trash2 size={16} />
                         </button>
                      </div>
                   </div>
                   
                   {session.status !== 'CONNECTED' && session.qrCodeUrl && (
                      <div className="flex flex-col items-center p-2 bg-gray-50 dark:bg-gray-900 rounded">
                         <img src={session.qrCodeUrl} alt="QR" className="w-32 h-32" />
                         <p className="text-xs text-gray-500 mt-1">Scan to connect</p>
                      </div>
                   )}
                </div>
              ))}
              {sessions.length === 0 && (
                <div className="text-center text-gray-500 text-sm py-4">No accounts connected</div>
              )}
            </div>

            <div className="flex gap-2">
               <input 
                 type="text" 
                 placeholder="New Account ID" 
                 value={newSessionId}
                 onChange={(e) => setNewSessionId(e.target.value)}
                 className="flex-1 px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white outline-none focus:ring-2 focus:ring-amber-500"
               />
               <button 
                 onClick={createSession}
                 className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors"
               >
                 Add
               </button>
            </div>
          </div>

          {/* Configuration Card */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Configuration</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Import Contacts</label>
                
                <div className="flex mb-4 border-b dark:border-gray-700">
                  <button 
                    className={`pb-2 px-4 text-sm font-medium ${activeTab === 'manual' ? 'border-b-2 border-amber-600 text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                    onClick={() => { setActiveTab('manual'); setParsedContacts([]); }}
                  >
                    Manual
                  </button>
                  <button 
                    className={`pb-2 px-4 text-sm font-medium ${activeTab === 'csv' ? 'border-b-2 border-amber-600 text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                    onClick={() => { setActiveTab('csv'); setParsedContacts([]); }}
                  >
                    CSV Upload
                  </button>
                  <button 
                    className={`pb-2 px-4 text-sm font-medium ${activeTab === 'txt' ? 'border-b-2 border-amber-600 text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                    onClick={() => { setActiveTab('txt'); setParsedContacts([]); }}
                  >
                    TXT Upload
                  </button>
                  <button 
                    className={`pb-2 px-4 text-sm font-medium ${activeTab === 'groups' ? 'border-b-2 border-amber-600 text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                    onClick={() => { setActiveTab('groups'); setParsedContacts([]); setSelectedGroups([]); }}
                  >
                    Groups
                  </button>
                </div>

                <div className="bg-amber-50 text-amber-800 text-xs p-3 rounded mb-4">
                  <strong>Format Tip:</strong> Use International Format (Country Code + Number). <br/>
                  Example: <code>15551234567</code> (USA), <code>447700900123</code> (UK). <br/>
                  Symbols like <code>+</code>, <code>-</code>, <code>( )</code> are automatically removed.
                </div>

                {activeTab === 'manual' && (
                   <textarea
                    value={manualInput}
                    onChange={handleManualInput}
                    className="w-full h-32 border rounded-lg p-3 text-sm focus:ring-2 focus:ring-amber-500 outline-none resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-200 dark:border-gray-600 placeholder-gray-400 dark:placeholder-gray-500"
                    placeholder="15551234567&#10;447700900123"
                  />
                )}

                {activeTab === 'csv' && (
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleCsvUpload}
                      className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100 file:dark:bg-amber-900 file:dark:text-amber-200 hover:file:dark:bg-amber-800"
                    />
                  </div>
                )}

                {activeTab === 'txt' && (
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      accept=".txt"
                      onChange={handleTxtUpload}
                      className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100 file:dark:bg-amber-900 file:dark:text-amber-200 hover:file:dark:bg-amber-800"
                    />
                  </div>
                )}

                {activeTab === 'groups' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center mb-2">
                       <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Select Groups</h3>
                       <button onClick={fetchGroups} className="text-amber-600 hover:text-amber-800">
                         <RefreshCw size={14} />
                       </button>
                    </div>
                    {groups.length === 0 ? (
                      <p className="text-sm text-gray-500 italic">No groups found. Create one from Manual/CSV tab.</p>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto border rounded p-2 dark:border-gray-700">
                        {groups.map(g => (
                          <div key={g.name} className="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded">
                            <label className="flex items-center gap-2 cursor-pointer flex-1">
                              <input 
                                type="checkbox" 
                                checked={selectedGroups.includes(g.name)}
                                onChange={() => handleGroupToggle(g.name)}
                                className="rounded text-amber-600 dark:bg-gray-600 dark:border-gray-500"
                              />
                              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{g.name}</span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">({g.count})</span>
                            </label>
                            <button 
                              onClick={() => deleteGroup(g.name)}
                              className="text-red-400 hover:text-red-600 p-1"
                              title="Delete Group"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {parsedContacts.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm text-green-600 font-medium flex items-center gap-2">
                      <CheckCircle size={16} /> {parsedContacts.length} contacts loaded
                    </p>
                    
                    {activeTab !== 'groups' && (
                      <div className="mt-4 border-t pt-4">
                        {!showSaveGroup ? (
                          <button 
                            onClick={() => setShowSaveGroup(true)}
                            className="flex items-center gap-2 text-sm text-amber-600 hover:text-amber-800 font-medium"
                          >
                            <Save size={16} /> Save as Group
                          </button>
                        ) : (
                          <div className="flex gap-2 items-center">
                            <input 
                              type="text" 
                              value={newGroupName}
                              onChange={(e) => setNewGroupName(e.target.value)}
                              placeholder="Group Name"
                              className="border rounded px-2 py-1 text-sm flex-1"
                            />
                            <button 
                              onClick={saveCurrentContactsAsGroup}
                              className="bg-amber-600 text-white px-3 py-1 rounded text-sm hover:bg-amber-700"
                            >
                              Save
                            </button>
                            <button 
                              onClick={() => setShowSaveGroup(false)}
                              className="text-gray-500 hover:text-gray-700"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Delay (Seconds)</label>
                <div className="flex gap-2">
                  <input 
                    type="number" 
                    value={delay.min}
                    onChange={e => setDelay(d => ({ ...d, min: Number(e.target.value) }))}
                    className="w-20 px-3 py-2 border rounded-lg text-center text-sm focus:ring-2 focus:ring-amber-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-200 dark:border-gray-600"
                    placeholder="Min"
                  />
                  <span className="self-center text-gray-400 dark:text-gray-500">-</span>
                  <input 
                    type="number" 
                    value={delay.max}
                    onChange={e => setDelay(d => ({ ...d, max: Number(e.target.value) }))}
                    className="w-20 px-3 py-2 border rounded-lg text-center text-sm focus:ring-2 focus:ring-amber-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-200 dark:border-gray-600"
                    placeholder="Max"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Middle Column: Message Editor */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 h-full">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Compose Message</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Message Text</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full h-48 border rounded-lg p-3 focus:ring-2 focus:ring-amber-500 outline-none resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-200 dark:border-gray-600 placeholder-gray-400 dark:placeholder-gray-500"
                  placeholder="Type your message here..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Attach Media / Voice Note</label>
                <div className="border-2 border-dashed rounded-lg p-6 text-center hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-600 transition-colors">
                  {isUploading ? (
                    <div className="flex items-center justify-center text-amber-600">
                      <RefreshCw className="animate-spin mr-2" /> Uploading...
                    </div>
                  ) : mediaUrl ? (
                    <div className="relative">
                      <p className="text-green-600 text-sm break-all mb-2">Media Attached</p>
                      {mediaUrl.endsWith('.webm') || mediaUrl.endsWith('.mp3') || mediaUrl.endsWith('.ogg') ? (
                         <audio controls src={mediaUrl} className="w-full" />
                      ) : (
                         <img src={mediaUrl} alt="Preview" className="h-32 mx-auto object-contain" />
                      )}
                      <button onClick={() => setMediaUrl('')} className="text-red-500 text-xs mt-2 underline">Remove</button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      <label className="cursor-pointer">
                        <input type="file" className="hidden" onChange={handleMediaUpload} accept="image/*,video/*,audio/*" />
                        <div className="flex flex-col items-center text-gray-500">
                          <ImageIcon size={32} className="mb-2" />
                          <span className="text-sm">Click to upload image/video/audio</span>
                        </div>
                      </label>
                      
                      <div className="flex items-center justify-center gap-2 border-t pt-4">
                         {!isRecording ? (
                           <button onClick={startRecording} className="flex items-center gap-2 text-red-500 hover:text-red-600 font-medium">
                             <Mic /> Record Voice Note
                           </button>
                         ) : (
                           <div className="flex flex-col items-center">
                             <div className="flex items-center gap-2 text-red-600 animate-pulse mb-2">
                               <div className="w-3 h-3 bg-red-600 rounded-full"></div>
                               Recording {new Date(recordingTime * 1000).toISOString().substr(14, 5)}
                             </div>
                             <button onClick={stopRecording} className="px-4 py-1 bg-red-500 text-white rounded-full text-sm">
                               Stop & Attach
                             </button>
                           </div>
                         )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Account Selection */}
              <div className="pt-2 border-t">
                 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Send From Account</label>
                 <select 
                   value={selectedSessionId} 
                   onChange={(e) => setSelectedSessionId(e.target.value)}
                   className="w-full px-3 py-2 border rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-200 dark:border-gray-600 outline-none focus:ring-2 focus:ring-amber-500"
                 >
                    <option value="">Auto (Any Connected)</option>
                    {sessions.filter(s => s.status === 'CONNECTED').map(s => (
                       <option key={s.id} value={s.id}>{s.id}</option>
                    ))}
                 </select>
              </div>

              {/* Scheduling */}
              <div className="pt-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <Calendar size={16} /> Schedule Campaign (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-200 dark:border-gray-600"
                />
                <p className="text-xs text-gray-500 mt-1">Leave empty to start immediately</p>
              </div>

              <div className="pt-4 flex gap-2">
                {status?.campaign.status === 'running' ? (
                  <button onClick={pauseCampaign} className="flex-1 bg-yellow-500 text-white py-3 rounded-lg font-semibold hover:bg-yellow-600 flex items-center justify-center gap-2">
                    <Pause /> Pause
                  </button>
                ) : (
                  <button 
                    onClick={startCampaign} 
                    disabled={!parsedContacts.length || !sessions.some(s => s.status === 'CONNECTED')}
                    className={`flex-1 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 text-white ${
                      !sessions.some(s => s.status === 'CONNECTED') ? 'bg-gray-400 cursor-not-allowed' : 'bg-amber-600 hover:bg-amber-700'
                    }`}
                  >
                    <Play /> Start Campaign
                  </button>
                )}
                
                {(status?.campaign.status === 'running' || status?.campaign.status === 'paused') && (
                  <button onClick={stopCampaign} className="bg-red-500 text-white p-3 rounded-lg hover:bg-red-600">
                    <Square />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Logs */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 h-full flex flex-col">
            <h2 className="text-xl font-semibold mb-4 flex justify-between items-center text-gray-900 dark:text-white">
              <span>Campaign Status</span>
              <span className={`text-sm px-2 py-1 rounded ${
                status?.campaign.status === 'running' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
              }`}>
                {status?.campaign.status?.toUpperCase() || 'IDLE'}
              </span>
            </h2>

            {status?.campaign.progress && (
              <div className="mb-6">
                <div className="flex justify-between text-sm mb-1 text-gray-600 dark:text-gray-400">
                  <span>Progress</span>
                  <span>{status.campaign.progress.sent} / {status.campaign.progress.total}</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                  <div 
                    className="bg-amber-600 dark:bg-amber-500 h-2.5 rounded-full transition-all duration-500" 
                    style={{ width: `${(status.campaign.progress.sent / status.campaign.progress.total) * 100}%` }}
                  ></div>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto bg-gray-900 rounded-lg p-4 font-mono text-xs text-green-400 max-h-[500px]">
              {status?.campaign.logs?.length ? (
                status.campaign.logs.slice().reverse().map((log, i) => (
                  <div key={i} className="mb-2 border-b border-gray-800 pb-1">
                    <span className="text-gray-500">[{new Date(log.timestamp).toLocaleTimeString()}]</span>{' '}
                    <span className={log.status === 'sent' ? 'text-green-400' : 'text-red-400'}>
                      {log.status === 'sent' ? 'SENT' : 'FAILED'}
                    </span>{' '}
                    - {log.phone}
                    {log.error && <div className="text-red-500 ml-4">{log.error}</div>}
                  </div>
                ))
              ) : (
                <div className="text-gray-600 italic text-center mt-10">No logs available...</div>
              )}
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
    </div>
  );
}

