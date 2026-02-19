// ARCHIVO: src/App.jsx (CORREGIDO - LINKS FUNCIONALES)
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useParams, useNavigate } from 'react-router-dom';
import { db, storage } from './firebase';
import { collection, addDoc, getDocs, query, where, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';
import { 
  Users, Calendar, Download, Plus, Activity, FileSpreadsheet, 
  ChevronLeft, CheckCircle, Camera, MapPin, BadgeCheck, 
  ArrowLeft, Trash2, Link as LinkIcon, AlertCircle,
  BarChart3, Copy, Share2, ExternalLink
} from 'lucide-react';
import * as XLSX from 'xlsx';

// --- COMPONENTES UI ---

const Header = ({ title, onBack }) => (
  <div className="bg-white shadow-sm sticky top-0 z-50">
    <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
      {onBack && (
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full">
          <ArrowLeft size={24} className="text-gray-600" />
        </button>
      )}
      <h1 className="text-xl font-bold text-gray-800 truncate">{title}</h1>
    </div>
  </div>
);

const Loading = () => (
  <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
    <p className="text-gray-500 font-medium">Cargando CivisCore...</p>
  </div>
);

const SuccessMessage = ({ message, onContinue }) => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <CheckCircle size={32} className="text-green-600" />
      </div>
      <h3 className="text-xl font-bold text-gray-800 mb-2">¡Registrado!</h3>
      <p className="text-gray-600 mb-6">{message}</p>
      <button onClick={onContinue || (() => window.location.reload())} className="btn-primary">
        Continuar
      </button>
    </div>
  </div>
);

const ErrorMessage = ({ message, onClose }) => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <AlertCircle size={32} className="text-red-600" />
      </div>
      <h3 className="text-xl font-bold text-gray-800 mb-2">Atención</h3>
      <p className="text-gray-600 mb-6">{message}</p>
      <button onClick={onClose} className="btn-primary bg-red-600 hover:bg-red-700">
        Entendido
      </button>
    </div>
  </div>
);

// Componente para copiar link
const LinkCopier = ({ url, label }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Fallback para navegadores que no soportan clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'CivisCore - Registro',
          text: label,
          url: url
        });
      } catch (err) {
        console.log('Share canceled');
      }
    } else {
      handleCopy();
    }
  };

  return (
    <div className="flex gap-2">
      <button 
        onClick={handleCopy}
        className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
      >
        {copied ? <CheckCircle size={16} className="text-green-600" /> : <Copy size={16} />}
        {copied ? '¡Copiado!' : 'Copiar Link'}
      </button>
      <button 
        onClick={handleShare}
        className="flex-1 bg-primary/10 hover:bg-primary/20 text-primary py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
      >
        <Share2 size={16} /> Compartir
      </button>
      <a 
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
      >
        <ExternalLink size={16} /> Abrir
      </a>
    </div>
  );
};

// --- DASHBOARD ---

const Dashboard = () => {
  const [events, setEvents] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: '', date: '', time: '', location: '', leader: '', type: 'Reunión' });
  const [eventToDelete, setEventToDelete] = useState(null);
  const [showLinks, setShowLinks] = useState(null);
  const navigate = useNavigate();

  // Obtener URL base correcta para producción y desarrollo
  const getBaseUrl = () => {
    const protocol = window.location.protocol;
    const host = window.location.host;
    const pathname = window.location.pathname;
    // Remover trailing slash si existe
    const cleanPathname = pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
    return `${protocol}//${host}${cleanPathname}`;
  };

  const fetchData = async () => {
    try {
      const eventsQuery = query(collection(db, "events"), orderBy("createdAt", "desc"));
      const eventsSnap = await getDocs(eventsQuery);
      const eventsData = eventsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const workersQuery = query(collection(db, "electoral_workers"));
      const workersSnap = await getDocs(workersQuery);
      const workersData = workersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      setEvents(eventsData);
      setWorkers(workersData);
    } catch (error) {
      console.error("Error fetching:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateEvent = async (e) => {
    e.preventDefault();
    try {
      const docRef = await addDoc(collection(db, "events"), {
        ...newEvent,
        createdAt: new Date().toISOString(),
        attendees: 0
      });
      setShowModal(false);
      setNewEvent({ title: '', date: '', time: '', location: '', leader: '', type: 'Reunión' });
      fetchData();
      // Mostrar links automáticamente después de crear
      setShowLinks(docRef.id);
    } catch (error) {
      console.error("Error creating event:", error);
      alert("Error creando evento");
    }
  };

  const handleDeleteEvent = async (eventId) => {
    if (confirm('¿Estás seguro de eliminar este evento? Se perderán todos los datos de asistencia.')) {
      try {
        await deleteDoc(doc(db, "events", eventId));
        fetchData();
        setEventToDelete(null);
      } catch (error) {
        console.error("Error deleting:", error);
        alert("Error eliminando evento");
      }
    }
  };

  const exportToExcel = (data, fileName) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Datos");
    XLSX.writeFile(wb, `${fileName}_CivisCore.xlsx`);
  };

  const getEventLink = (eventId) => {
    return `${getBaseUrl()}#/form/event/${eventId}`;
  };

  const getWorkerLink = () => {
    return `${getBaseUrl()}#/form/worker`;
  };

  if (loading) return <Loading />;

  return (
    <div className="min-h-screen pb-20">
      <Header title="CivisCore Dashboard" />
      
      <div className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Resumen */}
        <div className="grid grid-cols-2 gap-4">
          <div className="card bg-gradient-to-br from-blue-500 to-blue-600 text-white border-none">
            <div className="flex items-center gap-3 mb-2">
              <Calendar className="opacity-80" />
              <span className="text-sm font-medium opacity-90">Eventos</span>
            </div>
            <p className="text-3xl font-bold">{events.length}</p>
          </div>
          <div className="card bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-none">
            <div className="flex items-center gap-3 mb-2">
              <Users className="opacity-80" />
              <span className="text-sm font-medium opacity-90">Electoreros</span>
            </div>
            <p className="text-3xl font-bold">{workers.length}</p>
          </div>
        </div>

        {/* Botón Crear */}
        <button 
          onClick={() => setShowModal(true)}
          className="w-full py-4 bg-white border-2 border-dashed border-gray-300 rounded-xl text-gray-500 font-semibold hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2"
        >
          <Plus size={20} /> Crear Nuevo Evento
        </button>

        {/* Lista de Eventos */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-gray-700 flex items-center gap-2">
            <Activity size={20} /> Eventos Activos
          </h2>
          {events.map(event => (
            <div key={event.id} className="card hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <h3 className="font-bold text-lg text-gray-800">{event.title}</h3>
                  <p className="text-sm text-gray-500 flex items-center gap-1">
                    <MapPin size={14} /> {event.location} • {event.date} {event.time}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Líder: {event.leader}</p>
                </div>
                <div className="flex flex-col gap-2">
                  <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded self-end">
                    {event.type}
                  </span>
                  <button 
                    onClick={() => setEventToDelete(event.id)}
                    className="text-red-500 hover:text-red-700 p-1"
                    title="Eliminar evento"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
              
              {/* Botones de acción */}
              <div className="flex flex-col gap-3 mt-4">
                <button 
                  onClick={() => setShowLinks(showLinks === event.id ? null : event.id)}
                  className="w-full bg-primary/10 hover:bg-primary/20 text-primary py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                >
                  <LinkIcon size={16} /> {showLinks === event.id ? 'Ocultar Links' : 'Generar Links de Registro'}
                </button>
                
                {showLinks === event.id && (
                  <div className="bg-gray-50 rounded-lg p-4 space-y-3 animate-in fade-in slide-in-from-top-2">
                    <p className="text-sm font-medium text-gray-700">Link para tomar asistencia:</p>
                    <LinkCopier 
                      url={getEventLink(event.id)} 
                      label={`Registro para evento: ${event.title}`}
                    />
                  </div>
                )}

                <button 
                  onClick={() => navigate(`/stats/${event.id}`)}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                >
                  <BarChart3 size={16} /> Ver Estadísticas y Datos
                </button>
              </div>
            </div>
          ))}
          {events.length === 0 && (
            <div className="card text-center py-8 text-gray-400">
              <Calendar size={48} className="mx-auto mb-3 opacity-50" />
              <p>No hay eventos creados aún</p>
              <p className="text-sm mt-2">Crea tu primer evento para comenzar</p>
            </div>
          )}
        </div>

        {/* Sección Electoreros */}
        <div className="space-y-4 pt-6 border-t border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-gray-700 flex items-center gap-2">
              <Users size={20} /> Base de Datos Electoreros
            </h2>
            <button 
              onClick={() => exportToExcel(workers, "Electoreros")}
              className="text-sm text-green-600 font-medium flex items-center gap-1 hover:underline"
            >
              <FileSpreadsheet size={16} /> Descargar Excel
            </button>
          </div>
          
          <div className="card bg-emerald-50 border-emerald-200">
            <p className="text-sm font-medium text-emerald-800 mb-3">Link para registro de electoreros:</p>
            <LinkCopier 
              url={getWorkerLink()} 
              label="Registro de Electoreros - CivisCore"
            />
          </div>

          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Sector</th>
                  <th className="px-4 py-3">Cédula</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {workers.slice(0, 5).map(w => (
                  <tr key={w.id}>
                    <td className="px-4 py-3 font-medium">{w.name}</td>
                    <td className="px-4 py-3">{w.sector}</td>
                    <td className="px-4 py-3 text-gray-500">{w.idNumber}</td>
                  </tr>
                ))}
                {workers.length === 0 && (
                  <tr><td colSpan="3" className="px-4 py-8 text-center text-gray-400">Sin registros</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Crear Evento */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">Nuevo Evento</h2>
            <form onSubmit={handleCreateEvent} className="space-y-4">
              <input required placeholder="Nombre del Evento" className="input-field"
                value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})} />
              <input required placeholder="Líder que convoca" className="input-field"
                value={newEvent.leader} onChange={e => setNewEvent({...newEvent, leader: e.target.value})} />
              <div className="grid grid-cols-2 gap-3">
                <input required type="date" className="input-field"
                  value={newEvent.date} onChange={e => setNewEvent({...newEvent, date: e.target.value})} />
                <input required type="time" className="input-field"
                  value={newEvent.time} onChange={e => setNewEvent({...newEvent, time: e.target.value})} />
              </div>
              <input required placeholder="Lugar / Dirección" className="input-field"
                value={newEvent.location} onChange={e => setNewEvent({...newEvent, location: e.target.value})} />
              <select className="input-field"
                value={newEvent.type} onChange={e => setNewEvent({...newEvent, type: e.target.value})}>
                <option>Reunión</option>
                <option>Volanteo</option>
                <option>Casa por Casa</option>
                <option>Mitin</option>
              </select>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 text-gray-600 font-medium border rounded-lg">Cancelar</button>
                <button type="submit" className="flex-1 btn-primary">Crear Evento</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirmar Eliminación */}
      {eventToDelete && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4 text-red-600">Eliminar Evento</h2>
            <p className="text-gray-600 mb-6">¿Estás seguro? Esta acción no se puede deshacer y se perderán todos los datos de asistencia.</p>
            <div className="flex gap-3">
              <button onClick={() => setEventToDelete(null)} className="flex-1 py-3 text-gray-600 font-medium border rounded-lg">Cancelar</button>
              <button onClick={() => handleDeleteEvent(eventToDelete)} className="flex-1 btn-primary bg-red-600 hover:bg-red-700">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- FORMULARIO PÚBLICO ---

const PublicForm = ({ type }) => {
  const { id } = useParams();
  const [formData, setFormData] = useState({ name: '', idNumber: '', phone: '', sector: '', photo: null });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [eventName, setEventName] = useState('');

  const sectors = ["Zona Urbana", "Filadelfia", "Samaria", "San Luis", "Morritos", "La Paila", "El Pintado", "El Verso", "La Soledad"];

  useEffect(() => {
    if (type === 'event' && id) {
      const getEventName = async () => {
        try {
          const q = query(collection(db, "events"), where("__name__", "==", id));
          const snapshot = await getDocs(q);
          if (!snapshot.empty) {
            setEventName(snapshot.docs[0].data().title);
          }
        } catch (err) {
          console.error("Error getting event:", err);
        }
      };
      getEventName();
    }
  }, [type, id]);

  const checkDuplicateCedula = async (cedula, collectionName, eventId = null) => {
    try {
      let q;
      if (collectionName === 'event_attendees' && eventId) {
        q = query(collection(db, collectionName), where("idNumber", "==", cedula), where("eventId", "==", eventId));
      } else {
        q = query(collection(db, collectionName), where("idNumber", "==", cedula));
      }
      const snapshot = await getDocs(q);
      return !snapshot.empty;
    } catch (error) {
      console.error("Error checking duplicate:", error);
      return false;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const collectionName = type === 'event' ? 'event_attendees' : 'electoral_workers';
      const isDuplicate = await checkDuplicateCedula(formData.idNumber, collectionName, type === 'event' ? id : null);
      
      if (isDuplicate) {
        setError('Esta cédula ya está registrada. No se permiten duplicados.');
        setLoading(false);
        return;
      }

      let photoURL = '';
      if (formData.photo) {
        const storageRef = ref(storage, `ids/${type}_${id || 'worker'}_${Date.now()}_${formData.idNumber}`);
        const snapshot = await uploadBytes(storageRef, formData.photo);
        photoURL = await getDownloadURL(snapshot.ref);
      }

      const record = { 
        ...formData, 
        photoURL, 
        registeredAt: new Date().toISOString(), 
        eventId: type === 'event' ? id : null 
      };
      
      await addDoc(collection(db, collectionName), record);
      setSuccess(true);
    } catch (error) {
      console.error("Error saving:", error);
      setError('Error al guardar. Verifica tu conexión e intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  if (success) return <SuccessMessage message={type === 'event' ? "Tu asistencia ha sido registrada exitosamente." : "Te has registrado como electorero exitosamente."} />;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header title={type === 'event' ? "Registro de Asistencia" : "Registro Electoreros"} />
      <div className="flex-1 max-w-md mx-auto w-full p-4 flex flex-col justify-center">
        <div className="card mb-6 text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
            {type === 'event' ? <Users className="text-primary" /> : <BadgeCheck className="text-emerald-600" />}
          </div>
          <h2 className="text-xl font-bold text-gray-800">
            {type === 'event' ? (eventName || "Evento") : "Únete al Equipo"}
          </h2>
          <p className="text-gray-500 text-sm mt-1">Completa tus datos para continuar</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Completo</label>
            <input required className="input-field" placeholder="Ej: Juan Pérez"
              value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cédula</label>
              <input required type="number" className="input-field" placeholder="Sin puntos"
                value={formData.idNumber} onChange={e => setFormData({...formData, idNumber: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Celular</label>
              <input required type="tel" className="input-field" placeholder="Ej: 3001234567"
                value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sector / Zona</label>
            <select required className="input-field bg-white"
              value={formData.sector} onChange={e => setFormData({...formData, sector: e.target.value})}>
              <option value="">Seleccione...</option>
              {sectors.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Foto de Cédula <span className="text-red-500">*</span>
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center relative hover:bg-gray-50 transition-colors">
              <input type="file" accept="image/*" capture="environment"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={e => setFormData({...formData, photo: e.target.files[0]})} />
              <Camera className="mx-auto text-gray-400 mb-2" />
              <p className="text-sm text-gray-500">
                {formData.photo ? formData.photo.name : "Toca para subir foto"}
              </p>
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-primary mt-4">
            {loading ? 'Guardando...' : 'Enviar Registro'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-8">
          Tus datos están protegidos y solo serán usados con fines políticos internos.
        </p>
      </div>

      {error && <ErrorMessage message={error} onClose={() => setError('')} />}
    </div>
  );
};

// --- ESTADÍSTICAS ---

const EventStats = () => {
  const { id } = useParams();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [eventName, setEventName] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const eventSnap = await getDocs(query(collection(db, "events"), where("__name__", "==", id)));
        if (!eventSnap.empty) {
          setEventName(eventSnap.docs[0].data().title);
        }

        const q = query(collection(db, "event_attendees"), where("eventId", "==", id));
        const snapshot = await getDocs(q);
        setData(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error("Error:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [id]);

  if (loading) return <Loading />;

  const sectorData = data.reduce((acc, curr) => {
    acc[curr.sector] = (acc[curr.sector] || 0) + 1;
    return acc;
  }, {});

  const chartData = Object.keys(sectorData).map(key => ({ name: key, value: sectorData[key] }));
  const COLORS = ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Header title={eventName || "Estadísticas"} onBack={() => navigate('/')} />
      <div className="max-w-4xl mx-auto p-4 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="card text-center">
            <p className="text-gray-500 text-sm">Total Asistentes</p>
            <p className="text-4xl font-bold text-primary">{data.length}</p>
          </div>
          <div className="card text-center">
            <p className="text-gray-500 text-sm">Sectores</p>
            <p className="text-4xl font-bold text-emerald-600">{chartData.length}</p>
          </div>
        </div>

        <div className="card">
          <h3 className="font-bold text-gray-700 mb-4">Distribución por Sector</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {chartData.map((entry, index) => (<Cell key={index} fill={COLORS[index % COLORS.length]} />))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            {chartData.map((entry, index) => (
              <div key={index} className="flex items-center gap-1 text-xs text-gray-600">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                {entry.name}
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-gray-700">Base de Datos Detallada</h3>
            <button onClick={() => {
              const ws = XLSX.utils.json_to_sheet(data);
              const wb = XLSX.utils.book_new();
              XLSX.utils.book_append_sheet(wb, ws, "Asistentes");
              XLSX.writeFile(wb, `Asistentes_${eventName || id}.xlsx`);
            }} className="text-sm bg-green-600 text-white px-3 py-1 rounded flex items-center gap-1 hover:bg-green-700">
              <Download size={14} /> Excel
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-100 text-gray-600">
                <tr>
                  <th className="p-3">Nombre</th>
                  <th className="p-3">Cédula</th>
                  <th className="p-3">Celular</th>
                  <th className="p-3">Sector</th>
                  <th className="p-3">Foto</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.map(p => (
                  <tr key={p.id}>
                    <td className="p-3 font-medium">{p.name}</td>
                    <td className="p-3">{p.idNumber}</td>
                    <td className="p-3">{p.phone}</td>
                    <td className="p-3"><span className="bg-gray-100 px-2 py-1 rounded text-xs">{p.sector}</span></td>
                    <td className="p-3">
                      {p.photoURL ? (
                        <a href={p.photoURL} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Ver</a>
                      ) : 'No'}
                    </td>
                  </tr>
                ))}
                {data.length === 0 && (
                  <tr><td colSpan="5" className="p-8 text-center text-gray-400">Sin asistentes registrados</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- APP PRINCIPAL ---

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/form/event/:id" element={<PublicForm type="event" />} />
        <Route path="/form/worker" element={<PublicForm type="worker" />} />
        <Route path="/stats/:id" element={<EventStats />} />
      </Routes>
    </Router>
  );
}

export default App;
