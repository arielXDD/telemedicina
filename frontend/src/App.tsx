import React, { useState, useEffect, useRef } from 'react';

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

export default function App() {
  // Estados de Autenticación
  const [token, setToken] = useState<string | null>(localStorage.getItem('telemed_token'));
  const [user, setUser] = useState<User | null>(null);
  const [isLogin, setIsLogin] = useState(true);
  
  // Inputs de Auth Form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'PACIENTE' | 'MEDICO'>('PACIENTE');
  const [specialty, setSpecialty] = useState('Medicina General');

  // Estados de Negocio
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<User[]>([]);
  const [medicalRecords, setMedicalRecords] = useState<MedicalRecord[]>([]);

  // Navegación
  const [view, setView] = useState<'auth' | 'patient_dashboard' | 'doctor_dashboard' | 'checkout' | 'consultation'>('auth');

  // Estados de Reserva
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [selectedDateTime, setSelectedDateTime] = useState('');

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

  // Notificaciones
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

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
  const showToast = (type: 'success' | 'error', message: string) => {
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
        // Si es médico, obtener su historial de atenciones
        const historyRes = await fetch(`${API_URL}/clinical-history/doctor/${currentUser.id}`);
        if (historyRes.ok) {
          const records = await historyRes.json();
          setMedicalRecords(records);
        }
      }
    } catch (e) {
      console.error('Error al cargar datos iniciales:', e);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('telemed_token');
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

    try {
      const endpoint = isLogin ? '/auth/login' : '/auth/register';
      const bodyPayload = isLogin
        ? { email, password }
        : { email, password, name, role, specialty: role === 'MEDICO' ? specialty : undefined };

      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });

      const data = await res.json();

      if (res.ok) {
        localStorage.setItem('telemed_token', data.token);
        setToken(data.token);
        setUser(data.user);
        setView(data.user.role === 'MEDICO' ? 'doctor_dashboard' : 'patient_dashboard');
        fetchInitialData(data.user);
        showToast('success', `¡Bienvenido de vuelta, ${data.user.name}!`);
        // Limpiar formulario
        setEmail('');
        setPassword('');
        setName('');
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
  const handleProcessPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardNumber || !cardHolder || !cardExpiry || !cardCvv) {
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

  // Iniciar Videollamada (WebRTC con cámara real!)
  const startConsultation = async (appt: Appointment) => {
    setActiveAppointmentForConsultation(appt);
    setView('consultation');
    setDiagnosis('');
    setTreatment('');
    
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
      {view !== 'auth' && (
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
        <main className="auth-wrapper">
          <div className="auth-card">
            <div className="auth-header">
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
                <div className="logo-icon" style={{ width: '50px', height: '50px' }}>
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
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
                    onClick={() => setRole('MEDICO')}
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
                    <option value="Neurología">Neurología</option>
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

          <div className="dashboard-grid">
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
                  <div className="history-records-grid">
                    {medicalRecords.map(rec => (
                      <div key={rec.id} className="history-record-card">
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
                        <span className="secure-lock-badge">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                          Protegido con AES-256
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
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

          <div className="dashboard-grid">
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

            {/* Panel Derecho: Historial de recetas emitidas encriptadas */}
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
                <div className="history-records-grid">
                  {medicalRecords.map(rec => (
                    <div key={rec.id} className="history-record-card">
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
                      <span className="secure-lock-badge">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                        Guardado Cifrado
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </main>
      )}

      {/* VISTA 4: STRIPE CHECKOUT SIMULADO */}
      {view === 'checkout' && activeAppointmentForCheckout && (
        <main className="checkout-wrapper">
          <div className="checkout-card">
            <div className="checkout-header">
              <div className="checkout-header-title">
                <div>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Stripe Checkout</h2>
                  <span style={{ color: 'hsl(var(--text-muted))', fontSize: '0.85rem' }}>Pago Seguro por Encriptación SSL</span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <div style={{ background: '#635bff', color: 'white', fontWeight: 700, padding: '4px 10px', borderRadius: '4px', fontSize: '0.75rem', letterSpacing: '0.5px' }}>stripe</div>
                  <span style={{ color: 'hsl(var(--text-muted))', fontSize: '0.75rem' }}>Modo Pruebas</span>
                </div>
              </div>
            </div>

            <div className="checkout-body">
              {checkoutStep === 'form' && (
                <form onSubmit={handleProcessPayment}>
                  {/* Tarjeta de Crédito Visual */}
                  <div className="visual-credit-card">
                    <div className="card-top">
                      <div className="card-chip"></div>
                      <div className="card-brand">{cardNumber.startsWith('4') ? 'Visa' : 'Mastercard'}</div>
                    </div>
                    <div className="card-number">
                      {cardNumber ? cardNumber.replace(/(\d{4})/g, '$1 ').trim() : '•••• •••• •••• ••••'}
                    </div>
                    <div className="card-bottom">
                      <div>
                        <div style={{ fontSize: '0.6rem', opacity: 0.7 }}>Titular</div>
                        <div>{cardHolder || 'NOMBRE DEL TITULAR'}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.6rem', opacity: 0.7 }}>Expira</div>
                        <div>{cardExpiry || 'MM/AA'}</div>
                      </div>
                    </div>
                  </div>

                  {/* Resumen de cita */}
                  <div style={{ background: 'hsl(var(--bg-base))', padding: '1.2rem', borderRadius: '8px', border: '1px solid hsl(var(--border-color))', marginBottom: '1.8rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ color: 'hsl(var(--text-muted))' }}>Concepto:</span>
                      <strong style={{ textAlign: 'right' }}>Dr. {activeAppointmentForCheckout.doctorName} ({activeAppointmentForCheckout.specialty})</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'hsl(var(--text-muted))' }}>Monto total a debitar:</span>
                      <strong style={{ color: 'hsl(var(--primary))', fontSize: '1.1rem' }}>$800.00 MXN</strong>
                    </div>
                  </div>

                  {/* Formulario Inputs */}
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Número de Tarjeta (Usa 4242 para Stripe de Prueba)</label>
                    <input
                      type="text"
                      maxLength={16}
                      className="form-input"
                      style={{ paddingLeft: '1rem' }}
                      placeholder="4242 4242 4242 4242"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, ''))}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Titular de la Tarjeta</label>
                    <input
                      type="text"
                      className="form-input"
                      style={{ paddingLeft: '1rem' }}
                      placeholder="JUAN PEREZ"
                      value={cardHolder}
                      onChange={(e) => setCardHolder(e.target.value.toUpperCase())}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '1.5rem' }}>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>Vencimiento</label>
                      <input
                        type="text"
                        maxLength={5}
                        className="form-input"
                        style={{ paddingLeft: '1rem' }}
                        placeholder="MM/AA"
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value)}
                      />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>CVC / CVV</label>
                      <input
                        type="password"
                        maxLength={3}
                        className="form-input"
                        style={{ paddingLeft: '1rem' }}
                        placeholder="123"
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, ''))}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                    <button
                      type="button"
                      className="btn-outline"
                      style={{ flex: 1, justifyContent: 'center' }}
                      onClick={() => setView(user?.role === 'MEDICO' ? 'doctor_dashboard' : 'patient_dashboard')}
                    >
                      Cancelar
                    </button>
                    <button type="submit" className="btn-premium btn-secondary-glow" style={{ flex: 2, justifyContent: 'center' }}>
                      Pagar $800.00 MXN
                    </button>
                  </div>
                </form>
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
                <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                  <div style={{ width: '70px', height: '70px', background: 'hsla(var(--success), 0.12)', border: '2px solid hsl(var(--success))', color: 'hsl(var(--success))', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'hsl(var(--success))' }}>¡Pago Completado!</h2>
                  <p style={{ color: 'hsl(var(--text-muted))', margin: '0.8rem 0 2rem' }}>Tu cita ha sido confirmada en el sistema. Stripe ha enviado tu recibo electrónico.</p>
                  
                  <button
                    className="btn-premium"
                    style={{ width: '200px', justifyContent: 'center' }}
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
          <div className="consult-sidebar">
            {user?.role === 'MEDICO' ? (
              // Vista del Médico: Formulario de Receta Médica
              <form onSubmit={handleSaveMedicalRecord} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', height: '100%' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, borderBottom: '1px solid hsl(var(--border-color))', paddingBottom: '0.6rem' }}>
                  Atención Médica
                </h3>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Paciente</label>
                  <strong style={{ fontSize: '1.1rem' }}>{activeAppointmentForConsultation.patientName}</strong>
                </div>

                <div className="form-group" style={{ flex: 1, display: 'flex', flexDirection: 'column', marginBottom: 0 }}>
                  <label className="form-label">Diagnóstico Clínico</label>
                  <textarea
                    className="form-input"
                    style={{ flex: 1, minHeight: '120px', padding: '0.8rem', resize: 'none' }}
                    placeholder="Escribe el diagnóstico completo de la consulta..."
                    value={diagnosis}
                    onChange={(e) => setDiagnosis(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ flex: 1, display: 'flex', flexDirection: 'column', marginBottom: 0 }}>
                  <label className="form-label">Tratamiento e Indicaciones</label>
                  <textarea
                    className="form-input"
                    style={{ flex: 1, minHeight: '120px', padding: '0.8rem', resize: 'none' }}
                    placeholder="Detalla la dosis, medicamentos y recomendaciones..."
                    value={treatment}
                    onChange={(e) => setTreatment(e.target.value)}
                  />
                </div>

                <div style={{ background: 'hsla(var(--success), 0.05)', border: '1px dashed hsla(var(--success), 0.3)', padding: '0.8rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'hsl(var(--success))' }}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>
                    Al enviar, estos datos se encriptarán con **AES-256** antes de almacenarse en la base de datos de salud.
                  </span>
                </div>

                <button type="submit" className="btn-premium" style={{ width: '100%', justifyContent: 'center' }}>
                  Enviar Receta y Finalizar
                </button>
              </form>
            ) : (
              // Vista del Paciente: Espera de receta
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%', textAlign: 'center', gap: '1.5rem' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Detalles de la Videoconsulta</h3>
                
                <div style={{ background: 'hsl(var(--bg-base))', padding: '1.5rem', borderRadius: '12px', border: '1px solid hsl(var(--border-color))' }}>
                  <p style={{ color: 'hsl(var(--text-muted))', fontSize: '0.9rem' }}>Especialista:</p>
                  <strong style={{ fontSize: '1.2rem', color: 'hsl(var(--primary))', display: 'block', marginTop: '0.3rem' }}>Dr. {activeAppointmentForConsultation.doctorName}</strong>
                  <span style={{ fontSize: '0.8rem', background: 'hsla(var(--primary), 0.1)', color: 'hsl(var(--primary))', padding: '2px 8px', borderRadius: '4px', display: 'inline-block', marginTop: '0.5rem' }}>{activeAppointmentForConsultation.specialty}</span>
                </div>

                <div style={{ border: '1px dashed hsl(var(--border-color))', borderRadius: '8px', padding: '1.2rem' }}>
                  <div style={{ width: '40px', height: '40px', border: '3px solid hsla(var(--primary), 0.15)', borderTopColor: 'hsl(var(--primary))', borderRadius: '50%', margin: '0 auto 0.8rem', animation: 'spin 1s linear infinite' }}></div>
                  <strong style={{ display: 'block', fontSize: '0.9rem' }}>El doctor está redactando tu expediente...</strong>
                  <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', marginTop: '0.3rem', display: 'block' }}>Tu receta encriptada se sincronizará automáticamente aquí.</span>
                </div>
              </div>
            )}
          </div>
        </main>
      )}

      {/* Toast Notification Container */}
      {toast && (
        <div className={`toast-notification ${toast.type}`}>
          {toast.type === 'success' ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ color: 'hsl(var(--success))' }}><polyline points="20 6 9 17 4 12"/></svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ color: 'hsl(var(--error))' }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          )}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
