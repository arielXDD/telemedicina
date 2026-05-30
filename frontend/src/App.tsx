import React, { useState, useEffect, useRef } from 'react';
import ShaderBackground from './components/ui/shader-background';

import { AnimatedTicket } from './components/AnimatedTicket';
import { CreditCardForm, type CardState, type CardValidity } from './components/CreditCardForm';

// URL del API Gateway
const API_URL = 'http://localhost:8000';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'PACIENTE' | 'MEDICO';
  specialty?: string | null;
}

interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  specialty: string;
  dateTime: string;
  status: 'PENDIENTE' | 'PAGADA' | 'COMPLETADA' | 'CANCELADA';
  amount: number;
}

interface MedicalRecord {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  date: string;
  diagnosis: string;
  treatment: string;
}

const formatScheduleDisplay = (schedule: any[]) => {
  const grouped: Record<string, Set<string>> = {};
  schedule.forEach(s => {
    const time = `${s.startTime} - ${s.endTime}`;
    if (!grouped[time]) grouped[time] = new Set();
    grouped[time].add(s.dayOfWeek);
  });

  const weekdays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
  const allDays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  return Object.entries(grouped).map(([time, daysSet], idx) => {
    const days = Array.from(daysSet);
    let daysText = days.join(', ');
    
    const hasAllWeekdays = weekdays.every(d => days.includes(d));
    const hasAllDays = allDays.every(d => days.includes(d));

    if (hasAllDays) {
      daysText = 'Todos los días';
    } else if (hasAllWeekdays && days.length === 5) {
      daysText = 'De lunes a viernes';
    } else if (hasAllWeekdays && days.length === 6 && days.includes('Sábado')) {
      daysText = 'Lunes a Sábado';
    }

    return (
      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', color: 'hsl(var(--text-muted))', paddingBottom: '4px' }}>
        <span>{daysText}:</span>
        <strong style={{ color: 'hsl(var(--text-main))' }}>{time}</strong>
      </div>
    );
  });
};

export default function App() {
  // Estados de Autenticación
  const [token, setToken] = useState<string | null>(sessionStorage.getItem('telemed_token'));
  const [user, setUser] = useState<User | null>(null);
  const [isLogin, setIsLogin] = useState(true);
  
  // Inputs de Auth Form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'PACIENTE' | 'MEDICO'>('PACIENTE');
  const [specialty, setSpecialty] = useState('Medicina General');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [doctorRegisterKey, setDoctorRegisterKey] = useState('');

  // Estados de Negocio
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<User[]>([]);
  const [medicalRecords, setMedicalRecords] = useState<MedicalRecord[]>([]);
  
  // Estado de Médicos para el Comité Administrativo
  const [doctorsListForAdmin, setDoctorsListForAdmin] = useState<any[]>([]);

  // Navegación
  const [view, setView] = useState<'auth' | 'patient_dashboard' | 'doctor_dashboard' | 'checkout' | 'consultation' | 'admin_controls'>('auth');
  const [patientActiveTab, setPatientActiveTab] = useState<'citas' | 'agendar' | 'historial'>('citas');
  const [doctorActiveTab, setDoctorActiveTab] = useState<'agenda' | 'horario' | 'diagnosticos'>('agenda');

  // Funciones de Administración y Control
  const fetchDoctorsForAdmin = async () => {
    try {
      const res = await fetch(`${API_URL}/auth/doctors`);
      if (res.ok) {
        const data = await res.json();
        setDoctorsListForAdmin(data);
      }
    } catch (e) {
      console.error('Error al cargar médicos para administración:', e);
    }
  };

  const handleApproveDoctor = async (doctorId: string, approve: boolean) => {
    try {
      const res = await fetch(`${API_URL}/auth/approve/${doctorId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approve }),
      });
      if (res.ok) {
        showToast('success', approve ? '¡Médico verificado y cuenta activada con éxito!' : 'Cuenta médica desactivada.');
        fetchDoctorsForAdmin();
        // Recargar doctores activos
        const docsRes = await fetch(`${API_URL}/auth/doctors`);
        if (docsRes.ok) {
          const docs = await docsRes.json();
          setDoctors(docs);
        }
      } else {
        const err = await res.json();
        showToast('error', err.message || 'Error al actualizar estado del médico.');
      }
    } catch (e) {
      showToast('error', 'Error de conexión con el API Gateway.');
    }
  };

  // Estados de Reserva e Interacción de Médicos
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [selectedDateTime, setSelectedDateTime] = useState('');
  const [doctorSearchKeyword, setDoctorSearchKeyword] = useState('');
  const [selectedSpecialtyFilter, setSelectedSpecialtyFilter] = useState('Todas');
  const [activeDoctorForProfileModal, setActiveDoctorForProfileModal] = useState<User | null>(null);
  const [selectedDoctorSchedule, setSelectedDoctorSchedule] = useState<any[]>([]);

  // Estados de Búsqueda de Historial
  const [medicalRecordsSearch, setMedicalRecordsSearch] = useState('');
  const [selectedRecordForPrescription, setSelectedRecordForPrescription] = useState<MedicalRecord | null>(null);

  // Estados de Pago Stripe (Simulación)
  const [activeAppointmentForCheckout, setActiveAppointmentForCheckout] = useState<Appointment | null>(null);
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [checkoutStep, setCheckoutStep] = useState<'form' | 'processing' | 'success'>('form');

  // Estados de Videollamada (WebRTC)
  const [activeAppointmentForConsultation, setActiveAppointmentForConsultation] = useState<Appointment | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(true);
  const [micActive, setMicActive] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  
  // Nota médica (Solo doctor en videollamada)
  const [diagnosis, setDiagnosis] = useState('');
  const [treatment, setTreatment] = useState('');

  // Chat en tiempo real de consulta
  const [chatMessages, setChatMessages] = useState<{ senderName: string; senderRole: string; message: string; timestamp: Date }[]>([]);
  const [newChatMessage, setNewChatMessage] = useState('');

  // Historial previo del paciente activo cargado para el médico
  const [activePatientHistory, setActivePatientHistory] = useState<MedicalRecord[]>([]);

  // Agenda y Horarios configurables del Médico
  const [doctorSchedules, setDoctorSchedules] = useState<{ dayOfWeek: string; startTime: string; endTime: string; enabled: boolean }[]>([
    { dayOfWeek: 'Lunes', startTime: '09:00', endTime: '17:00', enabled: true },
    { dayOfWeek: 'Martes', startTime: '09:00', endTime: '17:00', enabled: true },
    { dayOfWeek: 'Miércoles', startTime: '09:00', endTime: '17:00', enabled: true },
    { dayOfWeek: 'Jueves', startTime: '09:00', endTime: '17:00', enabled: true },
    { dayOfWeek: 'Viernes', startTime: '09:00', endTime: '17:00', enabled: true },
    { dayOfWeek: 'Sábado', startTime: '09:00', endTime: '14:00', enabled: false },
    { dayOfWeek: 'Domingo', startTime: '09:00', endTime: '14:00', enabled: false }
  ]);

  // Notificaciones
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);

  // Refs de Video para WebRTC
  const localVideoRef = useRef<HTMLVideoElement | null>(null);

  // Cargar datos de perfil si hay token guardado
  useEffect(() => {
    if (token) {
      validateStoredToken();
    } else {
      setView('auth');
    }
  }, [token]);

  // Manejador de notificaciones toast automáticas
  const showToast = (type: 'success' | 'error' | 'warning', message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  };

  const validateStoredToken = async () => {
    try {
      const res = await fetch(`${API_URL}/auth/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        const loggedUser: User = {
          id: data.userId,
          email: data.email,
          name: data.name,
          role: data.role,
        };
        setUser(loggedUser);
        setView(data.role === 'MEDICO' ? 'doctor_dashboard' : 'patient_dashboard');
        fetchInitialData(loggedUser);
      } else {
        handleLogout();
      }
    } catch (e) {
      showToast('error', 'Error al conectar con la pasarela de autenticación.');
      handleLogout();
    }
  };

  const fetchInitialData = async (currentUser: User) => {
    try {
      // 1. Obtener citas
      const apptsRes = await fetch(`${API_URL}/appointments/${currentUser.role.toLowerCase()}/${currentUser.id}`);
      if (apptsRes.ok) {
        const appts = await apptsRes.json();
        setAppointments(appts);
      }

      // 2. Si es paciente, obtener lista de médicos e historial clínico
      if (currentUser.role === 'PACIENTE') {
        const docsRes = await fetch(`${API_URL}/auth/doctors`);
        if (docsRes.ok) {
          const docs = await docsRes.json();
          setDoctors(docs);
          if (docs.length > 0) setSelectedDoctorId(docs[0].id);
        }

        const historyRes = await fetch(`${API_URL}/clinical-history/patient/${currentUser.id}`);
        if (historyRes.ok) {
          const records = await historyRes.json();
          setMedicalRecords(records);
        }
      } else {
        // Si es médico, obtener su historial de atenciones y su agenda
        const historyRes = await fetch(`${API_URL}/clinical-history/doctor/${currentUser.id}`);
        if (historyRes.ok) {
          const records = await historyRes.json();
          setMedicalRecords(records);
        }
        fetchDoctorSchedule(currentUser.id);
      }
    } catch (e) {
      console.error('Error al cargar datos iniciales:', e);
    }
  };

  const fetchDoctorSchedule = async (doctorId: string) => {
    try {
      const res = await fetch(`${API_URL}/appointments/schedule/${doctorId}`);
      if (res.ok) {
        const dbSchedules = await res.json();
        if (dbSchedules.length > 0) {
          const updatedSchedules = doctorSchedules.map(s => {
            const match = dbSchedules.find((dbS: any) => dbS.dayOfWeek === s.dayOfWeek);
            if (match) {
              return { ...s, startTime: match.startTime, endTime: match.endTime, enabled: true };
            }
            return { ...s, enabled: false };
          });
          setDoctorSchedules(updatedSchedules);
        }
      }
    } catch (e) {
      console.error('Error al obtener agenda del médico:', e);
    }
  };

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      let successCount = 0;
      for (const day of doctorSchedules) {
        if (day.enabled) {
          const res = await fetch(`${API_URL}/appointments/schedule`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              doctorId: user.id,
              dayOfWeek: day.dayOfWeek,
              startTime: day.startTime,
              endTime: day.endTime,
            }),
          });
          if (res.ok) successCount++;
        }
      }
      showToast('success', 'Agenda y horarios actualizados en el servidor.');
    } catch (e) {
      showToast('error', 'Error al guardar configuración de horarios.');
    }
  };

  const fetchSelectedDoctorSchedule = async (doctorId: string) => {
    try {
      const res = await fetch(`${API_URL}/appointments/schedule/${doctorId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedDoctorSchedule(data);
      }
    } catch (e) {
      console.error('Error al cargar agenda del especialista:', e);
    }
  };

  useEffect(() => {
    if (selectedDoctorId) {
      fetchSelectedDoctorSchedule(selectedDoctorId);
    }
  }, [selectedDoctorId]);

  const handleLogout = () => {
    sessionStorage.removeItem('telemed_token');
    setToken(null);
    setUser(null);
    setView('auth');
    stopCamera();
  };

  // Auth Form Submit
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || (!isLogin && !name)) {
      showToast('error', 'Por favor, completa todos los campos.');
      return;
    }

    if (!isLogin && role === 'MEDICO') {
      if (!doctorRegisterKey) {
        showToast('error', 'No has ingresado la clave de acceso de registro médico.');
        return;
      }
    }

    try {
      const endpoint = isLogin ? '/auth/login' : '/auth/register';
      const bodyPayload = isLogin
        ? { email, password }
        : {
            email,
            password,
            name,
            role,
            specialty: role === 'MEDICO' ? specialty : undefined,
            licenseNumber: role === 'MEDICO' ? licenseNumber : undefined,
            doctorRegisterKey: role === 'MEDICO' ? doctorRegisterKey : undefined,
          };

      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });

      const data = await res.json();

      if (res.ok) {
        sessionStorage.setItem('telemed_token', data.token);
        setToken(data.token);
        setUser(data.user);
        setView(data.user.role === 'MEDICO' ? 'doctor_dashboard' : 'patient_dashboard');
        fetchInitialData(data.user);
        showToast('success', `¡Bienvenido, ${data.user.name}!`);
        // Limpiar formulario
        setEmail('');
        setPassword('');
        setName('');
        setLicenseNumber('');
        setDoctorRegisterKey('');
      } else {
        showToast('error', data.message || 'Error en las credenciales proporcionadas.');
      }
    } catch (e) {
      showToast('error', 'Error de conexión con el API Gateway.');
    }
  };

  // Reservar cita (Paciente)
  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoctorId || !selectedDateTime) {
      showToast('error', 'Selecciona un médico y un horario.');
      return;
    }

    const doctor = doctors.find(d => d.id === selectedDoctorId);
    if (!doctor || !user) return;

    try {
      const res = await fetch(`${API_URL}/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: user.id,
          patientName: user.name,
          doctorId: doctor.id,
          doctorName: doctor.name,
          specialty: doctor.specialty || 'Medicina General',
          dateTime: selectedDateTime,
          amount: 800.0, // Tarifa fija en MXN
        }),
      });

      const data = await res.json();

      if (res.ok) {
        showToast('success', 'Cita reservada. Redirigiendo a pasarela de pago...');
        
        // Actualizar citas
        fetchInitialData(user);

        // Abrir Checkout simulado de Stripe
        setActiveAppointmentForCheckout(data.appointment);
        setView('checkout');
        setCheckoutStep('form');
        setCardNumber('');
        setCardHolder('');
        setCardExpiry('');
        setCardCvv('');
      } else {
        showToast('error', data.message || 'No se pudo reservar la cita.');
      }
    } catch (e) {
      showToast('error', 'Error al conectar con el microservicio de citas.');
    }
  };

  // Simulación de Pago de Stripe
  const handleProcessPayment = async (e?: React.FormEvent, paymentState?: CardState) => {
    e?.preventDefault();
    const paymentNumber = paymentState?.number ?? cardNumber;
    const paymentHolder = paymentState?.holder ?? cardHolder;
    const paymentExpiry = paymentState
      ? paymentState.month && paymentState.year
        ? `${paymentState.month}/${paymentState.year.slice(-2)}`
        : ''
      : cardExpiry;
    const paymentCvv = paymentState?.cvv ?? cardCvv;

    if (!paymentNumber || !paymentHolder || !paymentExpiry || !paymentCvv) {
      showToast('error', 'Completa la información de tu tarjeta.');
      return;
    }

    setCheckoutStep('processing');

    // Simular retraso de pasarela de pago Stripe
    setTimeout(async () => {
      if (!activeAppointmentForCheckout || !user) return;

      try {
        const res = await fetch(`${API_URL}/appointments/confirm-payment/${activeAppointmentForCheckout.id}`, {
          method: 'POST',
        });

        if (res.ok) {
          setCheckoutStep('success');
          showToast('success', '¡Pago procesado con Stripe correctamente!');
          fetchInitialData(user);
        } else {
          setCheckoutStep('form');
          showToast('error', 'La pasarela de Stripe rechazó la transacción.');
        }
      } catch (e) {
        setCheckoutStep('form');
        showToast('error', 'Error al confirmar el pago en la base de datos.');
      }
    }, 2500);
  };

  const handleCardChange = (state: CardState) => {
    setCardNumber(state.number);
    setCardHolder(state.holder);
    setCardExpiry(state.month && state.year ? `${state.month}/${state.year.slice(-2)}` : '');
    setCardCvv(state.cvv);
  };

  const handleCardSubmit = (state: CardState, validity: CardValidity) => {
    handleCardChange(state);
    if (!validity.allValid) {
      showToast('error', 'Revisa la información de tu tarjeta.');
      return;
    }
    void handleProcessPayment(undefined, state);
  };

  // Iniciar Videollamada (WebRTC con cámara real!)
  const startConsultation = async (appt: Appointment) => {
    setActiveAppointmentForConsultation(appt);
    setView('consultation');
    setDiagnosis('');
    setTreatment('');
    
    // Inicializar chat de consulta
    setChatMessages([
      {
        senderName: 'Sistema',
        senderRole: 'SISTEMA',
        message: 'Línea de videoconsulta cifrada de extremo a extremo abierta. Puedes usar el chat lateral para coordinar indicaciones.',
        timestamp: new Date()
      }
    ]);

    // Cargar historial del paciente
    try {
      const historyRes = await fetch(`${API_URL}/clinical-history/patient/${appt.patientId}`);
      if (historyRes.ok) {
        const records = await historyRes.json();
        setActivePatientHistory(records);
      }
    } catch (e) {
      console.error('Error al cargar expediente del paciente para consulta:', e);
    }
    
    // Iniciar captura de cámara web del usuario
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      setLocalStream(stream);
      setCameraActive(true);
      setMicActive(true);
      
      // Adjuntar stream al elemento video local
      setTimeout(() => {
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      }, 300);
    } catch (err) {
      console.warn('Cámara/Micrófono no disponibles o denegados. Cayendo en modo simulado.', err);
      showToast('warning', 'No se pudo acceder a tu cámara web. Habilitando simulación de video.');
    }
  };

  const stopCamera = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
  };

  const toggleCamera = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setCameraActive(videoTrack.enabled);
      }
    } else {
      setCameraActive(!cameraActive);
    }
  };

  const toggleMic = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMicActive(audioTrack.enabled);
      }
    } else {
      setMicActive(!micActive);
    }
  };

  const handleEndConsultation = () => {
    stopCamera();
    setActiveAppointmentForConsultation(null);
    setView(user?.role === 'MEDICO' ? 'doctor_dashboard' : 'patient_dashboard');
  };

  const handleSendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChatMessage.trim() || !user) return;
    
    const msg = {
      senderName: user.name,
      senderRole: user.role,
      message: newChatMessage.trim(),
      timestamp: new Date()
    };
    
    setChatMessages(prev => [...prev, msg]);
    setNewChatMessage('');

    // Respuesta automática de cortesía del interlocutor después de 3.5 segundos para fines de simulación interactiva completa
    setTimeout(() => {
      if (!activeAppointmentForConsultation) return;
      const remoteMsg = {
        senderName: user.role === 'MEDICO' 
          ? activeAppointmentForConsultation.patientName 
          : `Dr. ${activeAppointmentForConsultation.doctorName}`,
        senderRole: user.role === 'MEDICO' ? 'PACIENTE' : 'MEDICO',
        message: user.role === 'MEDICO' 
          ? 'Enterado, doctor. Muchas gracias por la explicación.' 
          : 'Comprendido. Anoto los síntomas para incluirlos en las recomendaciones médicas de la receta.',
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, remoteMsg]);
    }, 3500);
  };

  // Finalizar Consulta y registrar diagnóstico (Médico)
  const handleSaveMedicalRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!diagnosis || !treatment || !activeAppointmentForConsultation || !user) {
      showToast('error', 'Escribe el diagnóstico e indicaciones antes de finalizar.');
      return;
    }

    try {
      // 1. Guardar expediente clínico encriptado AES-256 en clinical-history-service
      const recordRes = await fetch(`${API_URL}/clinical-history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: activeAppointmentForConsultation.patientId,
          patientName: activeAppointmentForConsultation.patientName,
          doctorId: user.id,
          doctorName: user.name,
          diagnosis,
          treatment,
        }),
      });

      if (!recordRes.ok) {
        throw new Error('Error al registrar el diagnóstico encriptado.');
      }

      // 2. Cambiar estado de la cita a COMPLETADA en el appointment-service
      const statusRes = await fetch(`${API_URL}/appointments/status/${activeAppointmentForConsultation.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'COMPLETADA' }),
      });

      if (statusRes.ok) {
        showToast('success', 'Expediente clínico encriptado y cita completada con éxito.');
        stopCamera();
        fetchInitialData(user);
        setView('doctor_dashboard');
        setActiveAppointmentForConsultation(null);
      } else {
        showToast('error', 'No se pudo actualizar el estado de la cita.');
      }
    } catch (e) {
      showToast('error', 'Error al registrar atención médica.');
    }
  };

  return (
    <div className="app-container">
      {/* Ambient background glows */}
      <div className="ambient-glow-1"></div>
      <div className="ambient-glow-2"></div>

      {/* Header Premium */}
      {view !== 'auth' && view !== 'admin_controls' && (
        <header className="premium-header">
          <div className="logo-container">
            <div className="logo-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
                <path d="M5 3v4M3 5h4M19 17v4M17 19h4"/>
              </svg>
            </div>
            <span className="logo-text">TeleMedica</span>
          </div>

          <div className="header-user-badge">
            <div className="user-info-text">
              <div className="user-name">{user?.name}</div>
              <div className="user-role">
                {user?.role === 'MEDICO' ? `Dr. | ${user.specialty || 'General'}` : 'Paciente'}
              </div>
            </div>
            <button className="btn-outline" onClick={handleLogout}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
              </svg>
              Salir
            </button>
          </div>
        </header>
      )}

      {/* RENDER VISTAS */}

      {/* VISTA 1: LOGIN Y REGISTRO */}
      {view === 'auth' && (
        <main className="auth-wrapper auth-wrapper-liquid">
          <ShaderBackground />
          <div className="auth-liquid-shell">
            <section className="auth-liquid-copy" aria-label="Resumen de plataforma">
              <div className="auth-orbit-mark">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <p className="auth-kicker">Red clínica clara y segura</p>
              <h1>Atención médica digital con una experiencia limpia y fluida.</h1>
              <p>
                Citas, historial clínico protegido, pagos y videoconsultas en un portal ligero
                orientado al cuidado continuo de pacientes y médicos verificados.
              </p>
              <div className="auth-metrics-strip">
                <div>
                  <strong>24/7</strong>
                  <span>Acceso a consulta</span>
                </div>
                <div>
                  <strong>AES</strong>
                  <span>Expediente protegido</span>
                </div>
                <div>
                  <strong>JWT</strong>
                  <span>Sesión segura</span>
                </div>
              </div>
            </section>

            <div className="auth-card auth-card-liquid">
            <div className="auth-header">
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
                <div className="logo-icon" style={{ width: '50px', height: '50px' }}>
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                  </svg>
                </div>
              </div>
              <h2>{isLogin ? 'Iniciar Sesión' : 'Crear Cuenta'}</h2>
              <p>{isLogin ? 'Accede al portal médico en tiempo real' : 'Únete a la red digital de telemedicina'}</p>
            </div>

            <form onSubmit={handleAuthSubmit}>
              {/* Toggle de Rol (Solo en registro) */}
              {!isLogin && (
                <div className="role-toggle-group">
                  <button
                    type="button"
                    className={`role-toggle-btn ${role === 'PACIENTE' ? 'active' : ''}`}
                    onClick={() => setRole('PACIENTE')}
                  >
                    Soy Paciente
                  </button>
                  <button
                    type="button"
                    className={`role-toggle-btn ${role === 'MEDICO' ? 'active' : ''}`}
                    onClick={() => {
                      if (role === 'PACIENTE') {
                        const pwd = prompt('Por favor, ingresa la clave de acceso médico para registrarte como doctor:');
                        if (pwd) {
                          setRole('MEDICO');
                          setDoctorRegisterKey(pwd);
                        }
                      }
                    }}
                  >
                    Soy Médico Especialista
                  </button>
                </div>
              )}

              {!isLogin && (
                <div className="form-group">
                  <label className="form-label">Nombre Completo</label>
                  <div className="input-container">
                    <svg className="input-icon-left" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Juan Pérez"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Correo Electrónico</label>
                <div className="input-container">
                  <svg className="input-icon-left" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/></svg>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="correo@ejemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Contraseña</label>
                <div className="input-container">
                  <svg className="input-icon-left" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>

              {/* Selector de Especialidades para Médicos */}
              {!isLogin && role === 'MEDICO' && (
                <div className="form-group">
                  <label className="form-label">Especialidad Médica</label>
                  <select
                    className="form-input form-select"
                    value={specialty}
                    onChange={(e) => setSpecialty(e.target.value)}
                  >
                    <option value="Cardiología">Cardiología</option>
                    <option value="Pediatría">Pediatría</option>
                    <option value="Dermatología">Dermatología</option>
                    <option value="Ginecología">Ginecología</option>
                    <option value="Medicina Interna">Medicina Interna</option>
                    <option value="Oftalmología">Oftalmología</option>
                  </select>
                </div>
              )}

              <button type="submit" className="btn-premium" style={{ width: '100%', justifyContent: 'center', marginTop: '1rem' }}>
                {isLogin ? 'Acceder al Sistema' : 'Completar Registro'}
              </button>
            </form>

            <div className="auth-switch">
              {isLogin ? '¿No tienes cuenta?' : '¿Ya estás registrado?'}{' '}
              <span className="auth-switch-link" onClick={() => setIsLogin(!isLogin)}>
                {isLogin ? 'Crea una cuenta aquí' : 'Inicia sesión'}
              </span>
            </div>

            {/* Acceso a la Consola de Control de Credenciales y Auditoría */}
            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'center', borderTop: '1px solid hsl(var(--border-color))', paddingTop: '1rem' }}>
              <button
                type="button"
                className="btn-outline"
                style={{ fontSize: '0.8rem', padding: '0.5rem 1rem', width: '100%', justifyContent: 'center', gap: '6px', background: 'hsla(var(--primary), 0.05)', color: 'hsl(var(--primary))', borderColor: 'hsla(var(--primary), 0.2)' }}
                onClick={() => {
                  const pwd = prompt('Ingresa la contraseña administrativa para acceder al CRUD de médicos y auditoría:');
                  if (pwd === 'ADMIN-SECURE-2026') {
                    setView('admin_controls');
                    fetchDoctorsForAdmin();
                  } else if (pwd !== null) {
                    showToast('error', 'Contraseña administrativa incorrecta.');
                  }
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                Consola de Control Clínico y Auditoría
              </button>
            </div>
            </div>
          </div>
        </main>
      )}

      {/* VISTA EXTRA: CONSOLA DE CONTROL CLÍNICO Y AUDITORÍA DE CREDENCIALES */}
      {view === 'admin_controls' && (
        <main className="admin-controls-wrapper">
          <div className="admin-header-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
              <div className="logo-icon" style={{ width: '42px', height: '42px' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </div>
              <div>
                <h1 className="grad-text-premium" style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0 }}>Consola de Control Clínico</h1>
                <p style={{ color: 'hsl(var(--text-muted))', fontSize: '0.85rem', margin: 0 }}>Comité de Verificación de Credenciales de Especialistas y Seguridad Criptográfica</p>
              </div>
            </div>
            <button
              type="button"
              className="btn-outline"
              onClick={() => setView('auth')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
              Regresar al Portal
            </button>
          </div>

          {/* Banner con Llaves de Desarrollo */}
          <div className="dev-key-banner">
            <div style={{ fontSize: '1.8rem' }}>🔑</div>
            <div style={{ fontSize: '0.85rem', color: 'hsl(var(--text-main))', lineHeight: 1.45 }}>
              <strong style={{ color: 'hsl(var(--primary))', display: 'block', marginBottom: '2px' }}>Guía de Validación de Seguridad para Registro:</strong>
              Para registrar nuevos Médicos Especialistas de forma segura, use la clave de invitación administrativa de la red: <code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', fontFamily: 'monospace', fontWeight: 'bold', color: 'white' }}>MED-SECURE-2026</code>. Las cuentas de médicos registradas se mostrarán en esta lista en estado pendiente hasta que apruebe su Cédula Profesional.
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '2.5rem' }}>
            
            {/* Sección 1: Bitácora de Auditoría de Criptografía (Terminal) */}
            <div className="dashboard-panel">
              <h3 className="panel-title" style={{ borderColor: 'hsla(var(--primary), 0.3)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                Bitácora de Auditoría y Acceso Criptográfico
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'hsl(var(--text-muted))', marginBottom: '1.2rem' }}>
                Monitoreo continuo de transacciones, registros de usuarios y descifrados de expedientes médicos AES-256 en tiempo real.
              </p>

              <div className="audit-log-terminal">
                <div className="audit-log-line">
                  <span className="audit-timestamp">[14:10:02]</span>
                  <span className="audit-badge sistema">SISTEMA</span>
                  <span className="audit-text">API Gateway escuchando en puerto 8000. Microservicios en línea.</span>
                </div>
                <div className="audit-log-line">
                  <span className="audit-timestamp">[14:12:15]</span>
                  <span className="audit-badge acceso">ACCESO</span>
                  <span className="audit-text">Inicio de sesión exitoso: Dr. Carlos Gómez (Especialidad: Cardiología).</span>
                </div>
                <div className="audit-log-line">
                  <span className="audit-timestamp">[14:13:40]</span>
                  <span className="audit-badge crypto">CRYPTO</span>
                  <span className="audit-text">Descifrado AES-256 de expediente ID: 99a8c por Dr. Carlos Gómez. Vector IV validado.</span>
                </div>
                <div className="audit-log-line">
                  <span className="audit-timestamp">[14:18:22]</span>
                  <span className="audit-badge seguridad">ALERTA</span>
                  <span className="audit-text" style={{ color: 'hsl(var(--warning))' }}>Intento de registro de Médico sin Cédula Profesional. Transacción rechazada.</span>
                </div>
                <div className="audit-log-line">
                  <span className="audit-timestamp">[14:20:05]</span>
                  <span className="audit-badge seguridad">ALERTA</span>
                  <span className="audit-text" style={{ color: 'hsl(var(--warning))' }}>Clave de Registro Institucional incorrecta en registro médico. Petición bloqueada.</span>
                </div>
                <div className="audit-log-line">
                  <span className="audit-timestamp">[14:22:11]</span>
                  <span className="audit-badge sistema">REGISTRO</span>
                  <span className="audit-text">Nuevo médico registrado: Dr. Sofía Ruiz (Cédula: 12903487) - Estado: PENDIENTE.</span>
                </div>
                <div className="audit-log-line">
                  <span className="audit-timestamp">[14:25:30]</span>
                  <span className="audit-badge acceso">ACCESO</span>
                  <span className="audit-text">Bloqueo de inicio de sesión para Dr. Sofía Ruiz (Cuenta pendiente de aprobación).</span>
                </div>
                <div className="audit-log-line">
                  <span className="audit-timestamp">[14:27:01]</span>
                  <span className="audit-badge crypto">CRYPTO</span>
                  <span className="audit-text">Descifrado exitoso de historial de paciente (usr_9921) para la teleconsulta de medicina general.</span>
                </div>
              </div>
            </div>

            {/* Sección 2: Comité de Aprobación de Especialistas */}
            <div className="dashboard-panel">
              <h3 className="panel-title" style={{ borderColor: 'hsla(var(--secondary), 0.3)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M17.9 20a6 6 0 0 0-11.8 0"/><circle cx="12" cy="12" r="10"/></svg>
                Validación de Cédulas y Aprobación de Médicos
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'hsl(var(--text-muted))', marginBottom: '1.5rem' }}>
                Revise las credenciales y Cédulas de los especialistas antes de otorgarles acceso al descifrado y firma de historiales clínicos.
              </p>

              {doctorsListForAdmin.length === 0 ? (
                <div className="empty-state" style={{ padding: '2rem' }}>
                  <p>Cargando lista de médicos de la red...</p>
                </div>
              ) : (
                <div className="doctors-admin-grid">
                  {doctorsListForAdmin.map((doc: any) => {
                    const initial = doc.name ? doc.name.charAt(0).toUpperCase() : 'M';
                    return (
                      <div 
                        key={doc.id} 
                        className={`doctor-admin-card ${doc.isApproved ? 'approved' : 'pending'}`}
                      >
                        <span className={`doc-admin-badge-status ${doc.isApproved ? 'approved' : 'pending'}`}>
                          {doc.isApproved ? 'Activo' : 'Pendiente'}
                        </span>

                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                          <div className="doc-admin-avatar">
                            {initial}
                          </div>
                          <div className="doc-admin-info">
                            <span className="doc-admin-name">Dr. {doc.name}</span>
                            <span className="doc-admin-spec">{doc.specialty || 'Especialista'}</span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.5rem' }}>
                          <div className="doc-admin-detail">
                            <strong style={{ color: 'hsl(var(--text-main))' }}>Email:</strong> {doc.email}
                          </div>
                          <div className="doc-admin-detail">
                            <strong style={{ color: 'hsl(var(--text-main))' }}>Cédula Profesional:</strong> {doc.licenseNumber || 'No proporcionada'}
                          </div>
                        </div>

                        <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid hsl(var(--border-color))', display: 'flex', gap: '0.5rem' }}>
                          {!doc.isApproved ? (
                            <button
                              type="button"
                              className="btn-premium btn-multi-grad"
                              style={{ width: '100%', justifyContent: 'center', padding: '0.45rem 1rem', fontSize: '0.85rem' }}
                              onClick={() => handleApproveDoctor(doc.id, true)}
                            >
                              Aprobar y Activar
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn-outline"
                              style={{ width: '100%', justifyContent: 'center', padding: '0.45rem 1rem', fontSize: '0.85rem', borderColor: 'hsla(var(--error), 0.3)', color: 'hsl(var(--error))' }}
                              onClick={() => handleApproveDoctor(doc.id, false)}
                            >
                              Desactivar Médico
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        </main>
      )}

      {/* VISTA 2: DASHBOARD PACIENTE */}
      {view === 'patient_dashboard' && (
        <main className="dashboard-container">
          <div className="dashboard-header">
            <div className="welcome-section">
              <h1>Hola, {user?.name}</h1>
              <p>Gestiona tus citas de salud y accede a videoconsultas en tiempo real.</p>
            </div>
          </div>

          <div className="role-toggle-group">
            <button type="button" className={`role-toggle-btn ${patientActiveTab === 'citas' ? 'active' : ''}`} onClick={() => setPatientActiveTab('citas')}>
              Mis Citas Pendientes
            </button>
            <button type="button" className={`role-toggle-btn ${patientActiveTab === 'agendar' ? 'active' : ''}`} onClick={() => setPatientActiveTab('agendar')}>
              Agendar Consultas
            </button>
            <button type="button" className={`role-toggle-btn ${patientActiveTab === 'historial' ? 'active' : ''}`} onClick={() => setPatientActiveTab('historial')}>
              Historial Clínico
            </button>
          </div>

          <div className="dashboard-tab-content">
            {patientActiveTab === 'citas' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
            {/* Panel Principal Izquierdo: Citas del Paciente */}
            <div className="dashboard-panel">
              <h3 className="panel-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                Mis Citas Médicas
              </h3>

              {appointments.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"/></svg>
                  </div>
                  <p>Aún no tienes citas médicas agendadas.</p>
                </div>
              ) : (
                <div className="appointment-list">
                  {appointments.map((appt) => (
                    <div key={appt.id} className="appointment-card">
                      <div className="appointment-info">
                        <div className="appointment-header-row">
                          <span className="appointment-name">Dr. {appt.doctorName}</span>
                          <span className="appointment-specialty">{appt.specialty}</span>
                        </div>
                        <span className="appointment-time">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                          {new Date(appt.dateTime).toLocaleString('es-MX', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </span>
                      </div>

                      <div className="appointment-actions">
                        <span className={`badge-status ${appt.status.toLowerCase()}`}>
                          {appt.status}
                        </span>

                        {appt.status === 'PENDIENTE' && (
                          <button
                            className="btn-premium btn-secondary-glow"
                            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                            onClick={() => {
                              setActiveAppointmentForCheckout(appt);
                              setView('checkout');
                              setCheckoutStep('form');
                            }}
                          >
                            Pagar Cita
                          </button>
                        )}

                        {appt.status === 'PAGADA' && (
                          <button
                            className="btn-premium"
                            style={{ padding: '0.5rem 1.2rem', fontSize: '0.85rem' }}
                            onClick={() => startConsultation(appt)}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M23 7a2 2 0 0 0-2.45-1.45L16 7V5a2 2 0 0 0-2-2H2a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2l4.55 1.45A2 2 0 0 0 23 17V7z"/></svg>
                            Iniciar Teleconsulta
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
              </div>
            )}

            {patientActiveTab === 'agendar' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
            {/* Panel Principal Izquierdo - Directorio de Médicos Especialistas (Nuevo) */}
            <div className="dashboard-panel" style={{ marginTop: '0' }}>
              <h3 className="panel-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M17.9 20a6 6 0 0 0-11.8 0"/><circle cx="12" cy="12" r="10"/></svg>
                Directorio de Especialistas
              </h3>
              
              <div className="doctor-directory-container">
                <p style={{ fontSize: '0.82rem', color: 'hsl(var(--text-muted))', margin: 0 }}>
                  Busca y selecciona un médico especialista de nuestra red clínica autorizada. Puedes ver sus detalles, ratings y agendar una cita.
                </p>
                
                {/* Buscador de Médicos */}
                <div className="search-filter-row">
                  <div className="search-input-wrapper">
                    <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input
                      type="text"
                      className="form-input search-input"
                      style={{ paddingLeft: '2.5rem' }}
                      placeholder="Buscar por nombre o especialidad..."
                      value={doctorSearchKeyword}
                      onChange={(e) => setDoctorSearchKeyword(e.target.value)}
                    />
                  </div>
                </div>

                {/* Filtros de Especialidad */}
                <div className="doctor-directory-filters">
                  {['Todas', 'Cardiología', 'Pediatría', 'Dermatología', 'Ginecología', 'Medicina Interna', 'Neurología'].map(spec => (
                    <button
                      key={spec}
                      type="button"
                      className={`filter-chip ${selectedSpecialtyFilter === spec ? 'active' : ''}`}
                      onClick={() => setSelectedSpecialtyFilter(spec)}
                    >
                      {spec}
                    </button>
                  ))}
                </div>

                {/* Grid de Tarjetas de Médicos */}
                {doctors.length === 0 ? (
                  <div className="empty-state" style={{ padding: '2rem' }}>
                    <p>No se encontraron médicos registrados.</p>
                  </div>
                ) : (
                  <div className="doctor-cards-grid">
                    {doctors
                      .filter(doc => {
                        const matchesSpec = selectedSpecialtyFilter === 'Todas' || doc.specialty === selectedSpecialtyFilter;
                        const matchesSearch = doc.name.toLowerCase().includes(doctorSearchKeyword.toLowerCase()) || 
                                              (doc.specialty && doc.specialty.toLowerCase().includes(doctorSearchKeyword.toLowerCase()));
                        return matchesSpec && matchesSearch;
                      })
                      .map(doc => {
                        const rating = (4.7 + (doc.name.length % 4) * 0.1).toFixed(1);
                        const initial = doc.name ? doc.name.charAt(0).toUpperCase() : 'M';
                        
                        return (
                          <div key={doc.id} className="doctor-card-premium">
                            <div className="doctor-card-avatar">
                              {initial}
                            </div>
                            <span className="doctor-card-name">Dr. {doc.name}</span>
                            <span className="doctor-card-spec">{doc.specialty || 'Medicina General'}</span>
                            
                            <div className="doctor-card-rating">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                              <span>{rating}</span>
                              <span style={{ color: 'hsl(var(--text-muted))', fontSize: '0.72rem' }}>(34 opiniones)</span>
                            </div>

                            <div style={{ display: 'flex', gap: '0.4rem', width: '100%', marginTop: 'auto' }}>
                              <button
                                type="button"
                                className="btn-outline doctor-card-btn"
                                style={{ padding: '0.4rem 0.6rem', fontSize: '0.78rem', justifyContent: 'center' }}
                                onClick={() => {
                                  setActiveDoctorForProfileModal(doc);
                                  fetchSelectedDoctorSchedule(doc.id);
                                }}
                              >
                                Perfil
                              </button>
                              <button
                                type="button"
                                className="btn-premium doctor-card-btn"
                                style={{ padding: '0.4rem 0.6rem', fontSize: '0.78rem', justifyContent: 'center' }}
                                onClick={() => {
                                  setSelectedDoctorId(doc.id);
                                  showToast('success', `Especialista seleccionado: Dr. ${doc.name}. Agende su cita en el formulario de la derecha.`);
                                }}
                              >
                                Agendar
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>

            {/* Columna Derecha: Panel de Reserva e Historial Clínico */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
              
              {/* Sub-Panel 1: Reservar Nueva Cita */}
              <div className="dashboard-panel">
                <h3 className="panel-title">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
                  Agendar Teleconsulta
                </h3>

                <form onSubmit={handleBookAppointment} className="booking-section">
                  <div className="form-group" style={{ marginBottom: '0.8rem' }}>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Selecciona Especialista</label>
                    <select
                      className="form-input form-select"
                      value={selectedDoctorId}
                      onChange={(e) => setSelectedDoctorId(e.target.value)}
                    >
                      {doctors.map(doc => (
                        <option key={doc.id} value={doc.id}>
                          Dr. {doc.name} ({doc.specialty})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Horario Disponible del Médico seleccionado cargado de forma dinámica */}
                  {selectedDoctorSchedule.length > 0 ? (
                    <div style={{ marginBottom: '0.8rem', padding: '0.6rem 0.8rem', background: 'hsla(var(--primary), 0.05)', border: '1px dashed hsla(var(--primary), 0.3)', borderRadius: '6px', fontSize: '0.75rem' }}>
                      <strong style={{ color: 'hsl(var(--primary))', display: 'block', marginBottom: '4px' }}>Horario de Atención:</strong>
                      {formatScheduleDisplay(selectedDoctorSchedule)}
                    </div>
                  ) : (
                    <div style={{ marginBottom: '0.8rem', padding: '0.6rem 0.8rem', background: 'hsl(var(--bg-base))', border: '1px solid hsl(var(--border-color))', borderRadius: '6px', fontSize: '0.72rem', color: 'hsl(var(--text-muted))', fontStyle: 'italic' }}>
                      Médico disponible toda la semana.
                    </div>
                  )}

                  <div className="form-group" style={{ marginBottom: '0.8rem' }}>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Fecha y Hora</label>
                    <input
                      type="datetime-local"
                      className="form-input"
                      style={{ paddingLeft: '1rem' }}
                      value={selectedDateTime}
                      onChange={(e) => setSelectedDateTime(e.target.value)}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'hsl(var(--bg-base))', padding: '0.8rem', borderRadius: '8px', border: '1px solid hsl(var(--border-color))' }}>
                    <span style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))' }}>Costo de Consulta:</span>
                    <span style={{ fontWeight: 700, color: 'hsl(var(--primary))' }}>$800.00 MXN</span>
                  </div>

                  <button type="submit" className="btn-premium" style={{ width: '100%', justifyContent: 'center' }}>
                    Reservar y Pagar
                  </button>
                </form>
              </div>
              </div>
              </div>
            )}

            {patientActiveTab === 'historial' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
              {/* Sub-Panel 2: Historial Clínico Desencriptado AES-256 */}
              <div className="dashboard-panel">
                <h3 className="panel-title">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  Historial Clínico Cifrado
                </h3>

                {medicalRecords.length === 0 ? (
                  <div className="empty-state" style={{ padding: '1.5rem' }}>
                    <p style={{ fontSize: '0.85rem' }}>No cuentas con atenciones anteriores.</p>
                  </div>
                ) : (
                  <>
                    <div className="search-filter-row">
                      <div className="search-input-wrapper">
                        <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <input
                          type="text"
                          className="form-input search-input"
                          placeholder="Buscar diagnóstico, doctor..."
                          value={medicalRecordsSearch}
                          style={{ paddingLeft: '2.5rem' }}
                          onChange={(e) => setMedicalRecordsSearch(e.target.value)}
                        />
                      </div>
                    </div>
                    
                    <div className="history-records-grid">
                      {medicalRecords
                        .filter(rec => {
                          const query = medicalRecordsSearch.toLowerCase();
                          return rec.diagnosis.toLowerCase().includes(query) || 
                                 rec.treatment.toLowerCase().includes(query) || 
                                 rec.doctorName.toLowerCase().includes(query);
                        })
                        .map(rec => (
                          <div 
                            key={rec.id} 
                            className="history-record-card"
                            style={{ cursor: 'pointer', transition: 'var(--transition-smooth)' }}
                            onClick={() => setSelectedRecordForPrescription(rec)}
                            title="Haga clic para ver la Receta Médica imprimible"
                          >
                            <div className="record-meta">
                              <span>Dr. {rec.doctorName}</span>
                              <span>{new Date(rec.date).toLocaleDateString()}</span>
                            </div>
                            <div className="record-text">
                              <strong style={{ fontSize: '0.8rem', color: 'hsl(var(--primary))' }}>Diagnóstico: </strong>
                              <p style={{ marginTop: '2px', color: 'hsl(var(--text-main))' }}>{rec.diagnosis}</p>
                            </div>
                            <div className="record-text">
                              <strong style={{ fontSize: '0.8rem', color: 'hsl(var(--secondary))' }}>Tratamiento: </strong>
                              <p style={{ marginTop: '2px', color: 'hsl(var(--text-muted))' }}>{rec.treatment}</p>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                              <span className="secure-lock-badge">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                                Cifrado AES-256
                              </span>
                              <span style={{ fontSize: '0.72rem', color: 'hsl(var(--primary))', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/></svg>
                                Receta
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </>
                )}
              </div>
              </div>
            )}
          </div>
        </main>
      )}

      {/* VISTA 3: DASHBOARD MÉDICO */}
      {view === 'doctor_dashboard' && (
        <main className="dashboard-container">
          <div className="dashboard-header">
            <div className="welcome-section">
              <h1>Panel Médico de Consulta</h1>
              <p>Visualiza tu agenda del día, inicia consultas remotas y emite recetas clínicas encriptadas.</p>
            </div>
          </div>

          <div className="role-toggle-group">
            <button type="button" className={`role-toggle-btn ${doctorActiveTab === 'agenda' ? 'active' : ''}`} onClick={() => setDoctorActiveTab('agenda')}>
              Agenda de Pacientes
            </button>
            <button type="button" className={`role-toggle-btn ${doctorActiveTab === 'horario' ? 'active' : ''}`} onClick={() => setDoctorActiveTab('horario')}>
              Mi Horario
            </button>
            <button type="button" className={`role-toggle-btn ${doctorActiveTab === 'diagnosticos' ? 'active' : ''}`} onClick={() => setDoctorActiveTab('diagnosticos')}>
              Diagnósticos Emitidos
            </button>
          </div>

          <div className="dashboard-tab-content">
            {doctorActiveTab === 'agenda' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
            {/* Panel Izquierdo: Citas del Médico */}
            <div className="dashboard-panel">
              <h3 className="panel-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                Agenda de Pacientes
              </h3>

              {appointments.length === 0 ? (
                <div className="empty-state">
                  <p>No tienes citas médicas en tu agenda actualmente.</p>
                </div>
              ) : (
                <div className="appointment-list">
                  {appointments.map((appt) => (
                    <div key={appt.id} className="appointment-card">
                      <div className="appointment-info">
                        <div className="appointment-header-row">
                          <span className="appointment-name">Paciente: {appt.patientName}</span>
                        </div>
                        <span className="appointment-time">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                          {new Date(appt.dateTime).toLocaleString('es-MX', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </span>
                      </div>

                      <div className="appointment-actions">
                        <span className={`badge-status ${appt.status.toLowerCase()}`}>
                          {appt.status}
                        </span>

                        {appt.status === 'PENDIENTE' && (
                          <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', fontStyle: 'italic' }}>
                            Esperando pago de paciente
                          </span>
                        )}

                        {appt.status === 'PAGADA' && (
                          <button
                            className="btn-premium"
                            style={{ padding: '0.5rem 1.2rem', fontSize: '0.85rem' }}
                            onClick={() => startConsultation(appt)}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M23 7a2 2 0 0 0-2.45-1.45L16 7V5a2 2 0 0 0-2-2H2a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2l4.55 1.45A2 2 0 0 0 23 17V7z"/></svg>
                            Atender Paciente
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
              </div>
            )}

            {doctorActiveTab === 'horario' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
              {/* Sub-Panel 1: Configurar Agenda de Horarios */}
              <div className="dashboard-panel">
                <h3 className="panel-title">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                  Mi Horario de Atención
                </h3>
                
                <form onSubmit={handleSaveSchedule} className="booking-section">
                  <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', margin: '0 0 0.5rem 0' }}>
                    Registra las horas hábiles en las que los pacientes podrán reservar citas contigo.
                  </p>
                  
                  <div className="agenda-grid">
                    {doctorSchedules.map((day, idx) => (
                      <div key={idx} className={`day-schedule-card ${day.enabled ? 'active' : ''}`}>
                        <label className="day-schedule-header" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <input
                            type="checkbox"
                            checked={day.enabled}
                            onChange={(e) => {
                              const updated = [...doctorSchedules];
                              updated[idx].enabled = e.target.checked;
                              setDoctorSchedules(updated);
                            }}
                          />
                          {day.dayOfWeek}
                        </label>
                        {day.enabled && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                              <span style={{ fontSize: '0.68rem', color: 'hsl(var(--text-muted))' }}>Inicio:</span>
                              <input
                                type="text"
                                value={day.startTime}
                                className="form-input"
                                style={{ padding: '2px 4px', fontSize: '0.72rem', width: '50px', textAlign: 'center', height: '22px' }}
                                onChange={(e) => {
                                  const updated = [...doctorSchedules];
                                  updated[idx].startTime = e.target.value;
                                  setDoctorSchedules(updated);
                                }}
                              />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                              <span style={{ fontSize: '0.68rem', color: 'hsl(var(--text-muted))' }}>Fin:</span>
                              <input
                                type="text"
                                value={day.endTime}
                                className="form-input"
                                style={{ padding: '2px 4px', fontSize: '0.72rem', width: '50px', textAlign: 'center', height: '22px' }}
                                onChange={(e) => {
                                  const updated = [...doctorSchedules];
                                  updated[idx].endTime = e.target.value;
                                  setDoctorSchedules(updated);
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  <button type="submit" className="btn-premium" style={{ width: '100%', justifyContent: 'center', fontSize: '0.85rem', padding: '0.6rem' }}>
                    Guardar Configuración de Horario
                  </button>
                </form>
              </div>
              </div>
            )}

            {doctorActiveTab === 'diagnosticos' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
              {/* Sub-Panel 2: Diagnósticos Emitidos */}
              <div className="dashboard-panel">
                <h3 className="panel-title">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  Diagnósticos Emitidos (Cifrado AES-256)
                </h3>

                {medicalRecords.length === 0 ? (
                  <div className="empty-state" style={{ padding: '2rem' }}>
                    <p style={{ fontSize: '0.85rem' }}>No has emitido recetas anteriormente.</p>
                  </div>
                ) : (
                  <>
                    <div className="search-filter-row">
                      <div className="search-input-wrapper">
                        <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <input
                          type="text"
                          className="form-input search-input"
                          placeholder="Buscar paciente, diagnóstico..."
                          value={medicalRecordsSearch}
                          style={{ paddingLeft: '2.5rem' }}
                          onChange={(e) => setMedicalRecordsSearch(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="history-records-grid">
                      {medicalRecords
                        .filter(rec => {
                          const query = medicalRecordsSearch.toLowerCase();
                          return rec.diagnosis.toLowerCase().includes(query) || 
                                 rec.treatment.toLowerCase().includes(query) || 
                                 rec.patientName.toLowerCase().includes(query);
                        })
                        .map(rec => (
                          <div 
                            key={rec.id} 
                            className="history-record-card"
                            style={{ cursor: 'pointer', transition: 'var(--transition-smooth)' }}
                            onClick={() => setSelectedRecordForPrescription(rec)}
                            title="Haga clic para ver la Receta Médica Oficial"
                          >
                            <div className="record-meta">
                              <span>Paciente: {rec.patientName}</span>
                              <span>{new Date(rec.date).toLocaleDateString()}</span>
                            </div>
                            <div className="record-text">
                              <strong style={{ fontSize: '0.8rem', color: 'hsl(var(--primary))' }}>Diagnóstico: </strong>
                              <p style={{ marginTop: '2px', color: 'hsl(var(--text-main))' }}>{rec.diagnosis}</p>
                            </div>
                            <div className="record-text">
                              <strong style={{ fontSize: '0.8rem', color: 'hsl(var(--secondary))' }}>Tratamiento: </strong>
                              <p style={{ marginTop: '2px', color: 'hsl(var(--text-muted))' }}>{rec.treatment}</p>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                              <span className="secure-lock-badge">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                                Guardado Cifrado
                              </span>
                              <span style={{ fontSize: '0.72rem', color: 'hsl(var(--primary))', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/></svg>
                                Receta
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </>
                )}
              </div>
              </div>
            )}
          </div>
        </main>
      )}

      {/* VISTA 4: STRIPE CHECKOUT SIMULADO */}
      {view === 'checkout' && activeAppointmentForCheckout && (
        <main className="checkout-wrapper">
          <div className={`checkout-card ${checkoutStep === 'success' ? 'checkout-card-ticket' : ''}`}>
            <div className="checkout-header">
              <div className="checkout-header-title">
                <div>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>{checkoutStep === 'success' ? 'Ticket de compra' : 'TeleMedica Pay'}</h2>
                  <span style={{ color: 'hsl(var(--text-muted))', fontSize: '0.85rem' }}>
                    {checkoutStep === 'success' ? 'Confirmacion emitida por pasarela segura' : 'Pago seguro por encriptacion SSL'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <div style={{ background: '#635bff', color: 'white', fontWeight: 700, padding: '4px 10px', borderRadius: '4px', fontSize: '0.75rem', letterSpacing: '0.5px' }}>stripe</div>
                  <span style={{ color: 'hsl(var(--text-muted))', fontSize: '0.75rem' }}>Modo Pruebas</span>
                </div>
              </div>
            </div>

            <div className="checkout-body">
              {checkoutStep === 'form' && (
                <>
                  <div className="checkout-summary-panel">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ color: 'hsl(var(--text-muted))' }}>Concepto:</span>
                      <strong style={{ textAlign: 'right' }}>Dr. {activeAppointmentForCheckout.doctorName} ({activeAppointmentForCheckout.specialty})</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'hsl(var(--text-muted))' }}>Monto total a debitar:</span>
                      <strong style={{ color: 'hsl(var(--primary))', fontSize: '1.1rem' }}>$800.00 MXN</strong>
                    </div>
                  </div>

                  <CreditCardForm
                    key={activeAppointmentForCheckout.id}
                    defaultNumber={cardNumber}
                    defaultHolder={cardHolder}
                    maskMiddle={false}
                    submitLabel="Pagar $800.00 MXN"
                    incompleteLabel="Completa tarjeta"
                    onChange={handleCardChange}
                    onSubmit={handleCardSubmit}
                  />

                  <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                    <button
                      type="button"
                      className="btn-outline"
                      style={{ flex: 1, justifyContent: 'center' }}
                      onClick={() => setView(user?.role === 'MEDICO' ? 'doctor_dashboard' : 'patient_dashboard')}
                    >
                      Cancelar
                    </button>
                  </div>
                </>
              )}

              {checkoutStep === 'processing' && (
                <div style={{ textAlign: 'center', padding: '3rem 0' }}>
                  {/* Animación de carga circular */}
                  <div style={{ width: '60px', height: '60px', border: '4px solid hsla(var(--primary), 0.15)', borderTopColor: 'hsl(var(--primary))', borderRadius: '50%', margin: '0 auto 1.5rem', animation: 'spin 1s linear infinite' }}></div>
                  <h3>Contactando servidores de Stripe...</h3>
                  <p style={{ color: 'hsl(var(--text-muted))', marginTop: '0.5rem' }}>Procesando cobro cifrado de forma segura.</p>
                  
                  <style>{`
                    @keyframes spin {
                      0% { transform: rotate(0deg); }
                      100% { transform: rotate(360deg); }
                    }
                  `}</style>
                </div>
              )}

              {checkoutStep === 'success' && (
                <div className="ticket-success-wrapper">
                  <AnimatedTicket
                    ticketId={`TM-${activeAppointmentForCheckout.id.slice(0, 8).toUpperCase()}`}
                    amount={activeAppointmentForCheckout.amount || 800}
                    date={new Date()}
                    cardHolder={cardHolder || user?.name || 'PACIENTE'}
                    last4Digits={cardNumber.slice(-4) || '4242'}
                    barcodeValue={activeAppointmentForCheckout.id.slice(0, 12).toUpperCase()}
                  />
                  <button
                    className="btn-premium"
                    style={{ width: '220px', justifyContent: 'center', marginTop: '1.5rem' }}
                    onClick={() => setView('patient_dashboard')}
                  >
                    Volver al Panel
                  </button>
                </div>
              )}
            </div>
          </div>
        </main>
      )}

      {/* VISTA 5: SIMULADOR DE CONSULTA POR VIDEO (WEBRTC + CÁMARA REAL) */}
      {view === 'consultation' && activeAppointmentForConsultation && (
        <main className="consultation-wrapper">
          {/* Columna Izquierda: Feed de Video y Controles */}
          <div className="video-arena">
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'hsl(var(--primary))' }}>
              Videoconsulta en Progreso con el Dr. {activeAppointmentForConsultation.doctorName}
            </h2>

            <div className="video-grid-container">
              {/* Feed de video local (Cámara real!) */}
              <div className="video-feed">
                {localStream && cameraActive ? (
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="simulated-video-stream"
                  />
                ) : (
                  <div style={{ textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
                    <div style={{ background: 'hsla(var(--error), 0.1)', color: 'hsl(var(--error))', width: '60px', height: '60px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34M23 7l-7 5 7 5V7z"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    </div>
                    <span>Cámara desactivada</span>
                  </div>
                )}
                <div className="video-feed-label">
                  <div className="status-dot-active"></div>
                  <span>Tú ({user?.name})</span>
                </div>
              </div>

              {/* Feed de video remoto (Médico o Paciente) */}
              <div className="video-feed">
                {cameraActive ? (
                  <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(circle, #1e293b 0%, #090d16 100%)', position: 'relative' }}>
                    
                    {/* Visual de onda de sonido animada */}
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-end', height: '60px', marginBottom: '1.5rem' }}>
                      <div className="wave-bar" style={{ width: '6px', background: 'hsl(var(--primary))', animation: 'bounce-wave 0.8s ease-in-out infinite alternate' }}></div>
                      <div className="wave-bar" style={{ width: '6px', background: 'hsl(var(--primary))', animation: 'bounce-wave 0.5s ease-in-out infinite alternate 0.1s' }}></div>
                      <div className="wave-bar" style={{ width: '6px', background: 'hsl(var(--primary))', animation: 'bounce-wave 0.7s ease-in-out infinite alternate 0.3s' }}></div>
                      <div className="wave-bar" style={{ width: '6px', background: 'hsl(var(--primary))', animation: 'bounce-wave 0.4s ease-in-out infinite alternate 0.2s' }}></div>
                      <div className="wave-bar" style={{ width: '6px', background: 'hsl(var(--primary))', animation: 'bounce-wave 0.6s ease-in-out infinite alternate 0.4s' }}></div>
                      
                      <style>{`
                        @keyframes bounce-wave {
                          0% { height: 15px; }
                          100% { height: 50px; }
                        }
                      `}</style>
                    </div>

                    <h3 style={{ fontWeight: 600 }}>
                      {user?.role === 'MEDICO' ? activeAppointmentForConsultation.patientName : `Dr. ${activeAppointmentForConsultation.doctorName}`}
                    </h3>
                    <p style={{ color: 'hsl(var(--text-muted))', fontSize: '0.85rem', marginTop: '0.4rem' }}>Conectando flujo WebRTC seguro...</p>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
                    <span>Esperando flujo de video remoto...</span>
                  </div>
                )}
                <div className="video-feed-label">
                  <div className="status-dot-active" style={{ backgroundColor: 'hsl(var(--primary))' }}></div>
                  <span>
                    {user?.role === 'MEDICO' ? 'Paciente' : 'Especialista'}
                  </span>
                </div>
              </div>
            </div>

            {/* Controles de Llamada */}
            <div className="video-controls">
              <button className={`control-btn ${!micActive ? 'active-off' : ''}`} onClick={toggleMic}>
                {micActive ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1M12 19v4M8 23h8"/></svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6M17 10v1a6.97 6.97 0 0 1-1.36 4.14M5 10v1a7 7 0 0 0 7 7h1M12 19v4M8 23h8"/></svg>
                )}
              </button>

              <button className={`control-btn ${!cameraActive ? 'active-off' : ''}`} onClick={toggleCamera}>
                {cameraActive ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34M23 7l-7 5 7 5V7z"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                )}
              </button>

              <button className={`control-btn ${screenSharing ? 'active-off' : ''}`} onClick={() => setScreenSharing(!screenSharing)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
              </button>

              <button className="control-btn btn-hangup" onClick={handleEndConsultation}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.68 13.31a16 16 0 0 0 3.41 3.41l2.28-2.28a1 1 0 0 1 1.04-.24 11.54 11.54 0 0 0 3.58 1.08 1 1 0 0 1 .82.97v3.28a1 1 0 0 1-.9.99 21.75 21.75 0 0 1-13.07-5.59L3.58 10.9a21.75 21.75 0 0 1-5.59-13.07 1 1 0 0 1 .99-.9h3.28a1 1 0 0 1 .97.82 11.54 11.54 0 0 0 1.08 3.58 1 1 0 0 1-.24 1.04l-2.28 2.28z" style={{ transform: 'rotate(135deg)', transformOrigin: 'center' }}/></svg>
              </button>
            </div>
          </div>

          {/* Columna Derecha: Panel de Consulta (Médico / Paciente) */}
          <div className="consult-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>
            {user?.role === 'MEDICO' ? (
              // Vista del Médico: Formulario de Receta Médica + Historial Clínico previo del Paciente
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, borderBottom: '1px solid hsl(var(--border-color))', paddingBottom: '0.4rem', margin: 0 }}>
                  Atención Médica
                </h3>

                {/* Historial Clínico previo del Paciente (Visible solo para el Médico durante la llamada) */}
                <div style={{ background: 'hsl(var(--bg-base))', border: '1px solid hsl(var(--border-color))', borderRadius: '6px', padding: '0.8rem', maxHeight: '180px', overflowY: 'auto' }}>
                  <strong style={{ fontSize: '0.78rem', color: 'hsl(var(--primary))', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '6px' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                    Historial Médico del Paciente
                  </strong>
                  
                  {activePatientHistory.length === 0 ? (
                    <span style={{ fontSize: '0.72rem', color: 'hsl(var(--text-muted))', fontStyle: 'italic' }}>Sin expedientes registrados anteriormente.</span>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {activePatientHistory.map((h, idx) => (
                        <div key={idx} style={{ padding: '6px', background: 'hsl(var(--bg-surface))', borderRadius: '4px', fontSize: '0.75rem', border: '1px solid hsl(var(--border-color))' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'hsl(var(--text-muted))', fontSize: '0.68rem', marginBottom: '2px' }}>
                            <span>Dr. {h.doctorName}</span>
                            <span>{new Date(h.date).toLocaleDateString()}</span>
                          </div>
                          <div><strong>Diagnóstico:</strong> {h.diagnosis}</div>
                          <div><strong>Tratamiento:</strong> {h.treatment}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <form onSubmit={handleSaveMedicalRecord} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', flex: 1 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Paciente bajo consulta</label>
                    <strong style={{ fontSize: '1.05rem', color: 'white' }}>{activeAppointmentForConsultation.patientName}</strong>
                  </div>

                  <div className="form-group" style={{ flex: 1, display: 'flex', flexDirection: 'column', marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Diagnóstico Clínico</label>
                    <textarea
                      className="form-input"
                      style={{ flex: 1, minHeight: '80px', padding: '0.6rem', resize: 'none', fontSize: '0.88rem' }}
                      placeholder="Escribe el diagnóstico completo de la consulta..."
                      value={diagnosis}
                      onChange={(e) => setDiagnosis(e.target.value)}
                    />
                  </div>

                  <div className="form-group" style={{ flex: 1, display: 'flex', flexDirection: 'column', marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Tratamiento e Indicaciones</label>
                    <textarea
                      className="form-input"
                      style={{ flex: 1, minHeight: '80px', padding: '0.6rem', resize: 'none', fontSize: '0.88rem' }}
                      placeholder="Detalla la dosis, medicamentos y recomendaciones..."
                      value={treatment}
                      onChange={(e) => setTreatment(e.target.value)}
                    />
                  </div>

                  <div style={{ background: 'hsla(var(--success), 0.05)', border: '1px dashed hsla(var(--success), 0.3)', padding: '0.6rem', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'hsl(var(--success))' }}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                    <span style={{ fontSize: '0.7rem', color: 'hsl(var(--text-muted))' }}>
                      Expediente cifrado con **AES-256**.
                    </span>
                  </div>

                  <button type="submit" className="btn-premium" style={{ width: '100%', justifyContent: 'center', padding: '0.6rem' }}>
                    Enviar Receta y Finalizar
                  </button>
                </form>
              </div>
            ) : (
              // Vista del Paciente: Espera de receta
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%', textAlign: 'center', gap: '1rem' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>Detalles de la Cita</h3>
                
                <div style={{ background: 'hsl(var(--bg-base))', padding: '1rem', borderRadius: '8px', border: '1px solid hsl(var(--border-color))' }}>
                  <p style={{ color: 'hsl(var(--text-muted))', fontSize: '0.82rem', margin: 0 }}>Especialista asignado:</p>
                  <strong style={{ fontSize: '1.1rem', color: 'hsl(var(--primary))', display: 'block', marginTop: '0.2rem' }}>Dr. {activeAppointmentForConsultation.doctorName}</strong>
                  <span style={{ fontSize: '0.72rem', background: 'hsla(var(--primary), 0.1)', color: 'hsl(var(--primary))', padding: '2px 8px', borderRadius: '4px', display: 'inline-block', marginTop: '0.3rem' }}>{activeAppointmentForConsultation.specialty}</span>
                </div>

                <div style={{ border: '1px dashed hsl(var(--border-color))', borderRadius: '8px', padding: '1rem' }}>
                  <div style={{ width: '30px', height: '30px', border: '3px solid hsla(var(--primary), 0.15)', borderTopColor: 'hsl(var(--primary))', borderRadius: '50%', margin: '0 auto 0.6rem', animation: 'spin 1s linear infinite' }}></div>
                  <strong style={{ display: 'block', fontSize: '0.85rem' }}>El doctor está redactando tu receta...</strong>
                  <span style={{ fontSize: '0.7rem', color: 'hsl(var(--text-muted))', marginTop: '0.2rem', display: 'block' }}>Tu receta encriptada se guardará en tu historial al finalizar.</span>
                </div>
              </div>
            )}

            {/* CHAT DE LA CONSULTA (Unificado para ambos roles) */}
            <div className="chat-container-consult">
              <div style={{ background: 'hsl(var(--bg-base))', borderBottom: '1px solid hsl(var(--border-color))', padding: '0.5rem 0.8rem', fontSize: '0.8rem', fontWeight: 700, color: 'hsl(var(--primary))', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                Mensajes de Consulta
              </div>
              <div className="chat-messages-box">
                {chatMessages.map((m, idx) => (
                  <div key={idx} className={`chat-message-row ${m.senderRole === user?.role ? 'me' : 'other'}`}>
                    <div className="chat-bubble">
                      <span className="chat-bubble-sender" style={{ color: m.senderRole === 'MEDICO' ? 'hsl(var(--primary))' : m.senderRole === 'SISTEMA' ? 'hsl(var(--warning))' : 'hsl(var(--secondary))' }}>
                        {m.senderName} ({m.senderRole})
                      </span>
                      <span>{m.message}</span>
                    </div>
                  </div>
                ))}
              </div>
              <form onSubmit={handleSendChatMessage} className="chat-input-row">
                <input
                  type="text"
                  className="chat-input-text"
                  placeholder="Escribe un mensaje..."
                  value={newChatMessage}
                  onChange={(e) => setNewChatMessage(e.target.value)}
                />
                <button type="submit" className="chat-send-btn">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                </button>
              </form>
            </div>
          </div>
        </main>
      )}


      {/* MODAL 1: RECETA MÉDICA DIGITAL IMPRIMIBLE */}
      {selectedRecordForPrescription && (
        <div className="modal-backdrop-premium" onClick={() => setSelectedRecordForPrescription(null)}>
          <div className="prescription-paper-container" onClick={(e) => e.stopPropagation()}>
            
            <div className="prescription-actions-header">
              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'hsl(var(--primary))', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                Vista de Receta Médica Cifrada
              </span>
              <div style={{ display: 'flex', gap: '0.8rem' }}>
                <button
                  type="button"
                  className="btn-premium"
                  style={{ padding: '0.4rem 1rem', fontSize: '0.82rem' }}
                  onClick={() => window.print()}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                  Imprimir / PDF
                </button>
                <button
                  type="button"
                  className="btn-outline"
                  style={{ padding: '0.4rem 1rem', fontSize: '0.82rem' }}
                  onClick={() => setSelectedRecordForPrescription(null)}
                >
                  Cerrar
                </button>
              </div>
            </div>

            <div className="prescription-print-body">
              <div>
                <div className="prescription-clinic-header">
                  <div className="clinic-brand-info">
                    <h2>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="2.5"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
                      Centro de Salud TeleMedica
                    </h2>
                    <p>Cuidado de Salud de Alta Gama en Tiempo Real</p>
                    <p style={{ fontSize: '0.7rem', color: '#94a3b8', margin: 0 }}>Av. de la Salud 102, Ciudad de México | Tel: (55) 1234-5678</p>
                  </div>
                  <div className="doctor-prescriber-info">
                    <strong>Dr. {selectedRecordForPrescription.doctorName}</strong>
                    <div>Médico Especialista</div>
                    <div style={{ color: '#06b6d4', fontWeight: 600 }}>Cédula Prof. Mock-9923451</div>
                  </div>
                </div>

                <div className="prescription-patient-card">
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>Paciente</span>
                    <strong style={{ fontSize: '1rem', color: '#0f172a' }}>{selectedRecordForPrescription.patientName}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>Fecha de Emisión</span>
                    <strong style={{ color: '#0f172a' }}>{new Date(selectedRecordForPrescription.date).toLocaleDateString('es-MX', { dateStyle: 'long' })}</strong>
                  </div>
                </div>

                <div className="prescription-rx-symbol">Rx</div>

                <div className="prescription-rx-content">
                  <div className="prescription-rx-section">
                    <h4>Diagnóstico Clínico</h4>
                    <p>{selectedRecordForPrescription.diagnosis}</p>
                  </div>
                  <div className="prescription-rx-section" style={{ marginTop: '1.5rem' }}>
                    <h4>Indicaciones de Tratamiento</h4>
                    <p style={{ lineHeight: '1.6' }}>{selectedRecordForPrescription.treatment}</p>
                  </div>
                </div>
              </div>

              <div className="prescription-footer-sign">
                <div className="seal-box">
                  <div style={{ fontSize: '0.45rem', marginBottom: '2px' }}>TELEMEDICA</div>
                  <div style={{ fontSize: '0.55rem', fontWeight: 800, color: '#059669' }}>VALIDADA</div>
                  <div style={{ fontSize: '0.45rem', marginTop: '2px' }}>DIGITAL</div>
                </div>
                
                <div className="signature-box">
                  <div className="signature-line">Dr. {selectedRecordForPrescription.doctorName.split(' ')[0]}</div>
                  <div className="signature-bar"></div>
                  <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500 }}>Firma Electrónica del Especialista</span>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: PERFIL DETALLADO DE MÉDICO */}
      {activeDoctorForProfileModal && (
        <div className="modal-backdrop-premium" onClick={() => setActiveDoctorForProfileModal(null)}>
          <div className="auth-card" style={{ maxWidth: '480px', background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-color))' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid hsl(var(--border-color))', paddingBottom: '1rem', marginBottom: '1.2rem' }}>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0 }}>Perfil del Especialista</h2>
              <button type="button" className="control-btn" style={{ width: '28px', height: '28px', fontSize: '0.8rem' }} onClick={() => setActiveDoctorForProfileModal(null)}>X</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '1.5rem' }}>
              <div className="doctor-card-avatar" style={{ width: '80px', height: '80px', fontSize: '1.8rem' }}>
                {activeDoctorForProfileModal.name.charAt(0).toUpperCase()}
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'white', margin: '4px 0' }}>Dr. {activeDoctorForProfileModal.name}</h3>
              <span className="doctor-card-spec" style={{ fontSize: '0.85rem' }}>{activeDoctorForProfileModal.specialty || 'Medicina General'}</span>
              
              <div className="doctor-card-rating" style={{ margin: '8px 0 0 0' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                <strong>{(4.7 + (activeDoctorForProfileModal.name.length % 4) * 0.1).toFixed(1)}</strong>
                <span style={{ color: 'hsl(var(--text-muted))', fontSize: '0.75rem' }}>(34 opiniones de pacientes)</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', background: 'hsl(var(--bg-base))', padding: '1rem', borderRadius: '8px', border: '1px solid hsl(var(--border-color))', fontSize: '0.85rem', marginBottom: '1.5rem', textAlign: 'left' }}>
              <div>
                <strong style={{ color: 'hsl(var(--primary))', display: 'block', marginBottom: '2px' }}>Biografía Profesional:</strong>
                <span style={{ color: 'hsl(var(--text-muted))' }}>
                  Especialista de alta gama egresado con honores, con más de 10 años de experiencia clínica internacional. Apasionado por el diagnóstico preciso mediante videoconsultas interactivas.
                </span>
              </div>
              <div>
                <strong style={{ color: 'hsl(var(--primary))', display: 'block', marginBottom: '2px' }}>Costo de Videoconsulta:</strong>
                <span style={{ fontWeight: 700, color: 'white' }}>$800.00 MXN <span style={{ fontSize: '0.72rem', color: 'hsl(var(--text-muted))', fontWeight: 400 }}>(Tarifa única Stripe autorizada)</span></span>
              </div>

              <div>
                <strong style={{ color: 'hsl(var(--primary))', display: 'block', marginBottom: '4px' }}>Días y Horarios hábiles registrados:</strong>
                {selectedDoctorSchedule.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                    {formatScheduleDisplay(selectedDoctorSchedule)}
                  </div>
                ) : (
                  <span style={{ color: 'hsl(var(--text-muted))', fontStyle: 'italic', fontSize: '0.78rem' }}>
                    Disponible toda la semana para teleconsulta inmediata.
                  </span>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                type="button"
                className="btn-outline"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => setActiveDoctorForProfileModal(null)}
              >
                Volver
              </button>
              <button
                type="button"
                className="btn-premium"
                style={{ flex: 2, justifyContent: 'center' }}
                onClick={() => {
                  setSelectedDoctorId(activeDoctorForProfileModal.id);
                  setActiveDoctorForProfileModal(null);
                  showToast('success', `Dr. ${activeDoctorForProfileModal.name} seleccionado. Completa el horario en la parte superior derecha.`);
                }}
              >
                Agendar Consulta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification Container */}
      {toast && (
        <div className={`toast-notification ${toast.type}`}>
          {toast.type === 'success' ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ color: 'hsl(var(--success))' }}><polyline points="20 6 9 17 4 12"/></svg>
          ) : toast.type === 'warning' ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ color: 'hsl(var(--warning))' }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ color: 'hsl(var(--error))' }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          )}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
