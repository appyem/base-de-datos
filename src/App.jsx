// ARCHIVO: src/App.jsx (CORREGIDO - Foto solo para electoreros)
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, useParams, useNavigate } from 'react-router-dom';
import { db, storage } from './firebase';
import { collection, addDoc, getDocs, query, where, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { 
  Users, Calendar, Download, Plus, Activity, FileSpreadsheet, 
  ArrowLeft, Trash2, Link as LinkIcon, AlertCircle,
  BarChart3, Copy, Share2, ExternalLink, CheckCircle, Camera, MapPin, BadgeCheck
} from 'lucide-react';
import * as XLSX from 'xlsx';

// ============================================
// COMPONENTES UI REUTILIZABLES
// ============================================

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
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
    <p className="text-gray-500 font-medium">Cargando CivisCore...</p>
  </div>
);

const SuccessMessage = ({ message }) => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <CheckCircle size={32} className="text-green-600" />
      </div>
      <h3 className="text-xl font-bold text-gray-800 mb-2">¡Registrado!</h3>
      <p className="text-gray-600 mb-6">{message}</p>
      <button onClick={() => window.location.reload()} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg">
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
      <button onClick={onClose} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg">
        Entendido
      </button>
    </div>
  </div>
);

const LinkCopier = ({ url, label }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
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
        await navigator.share({ title: 'CivisCore - Registro', text: label, url });
      } catch (err) {
        handleCopy();
      }
    } else {
      handleCopy();
    }
  };

  return (
    <div className="flex gap-2">
      <button onClick={handleCopy} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2">
        {copied ? <CheckCircle size={16} className="text-green-600" /> : <Copy size={16} />}
        {copied ? '¡Copiado!' : 'Copiar'}
      </button>
      <button onClick={handleShare} className="flex-1 bg-blue-100 hover:bg-blue-200 text-blue-700 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2">
        <Share2 size={16} /> Compartir
      </button>
      <a href={url} target="_blank" rel="noopener noreferrer" className="flex-1 bg-green-100 hover:bg-green-200 text-green-700 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2">
        <ExternalLink size={16} /> Abrir
      </a>
    </div>
  );
};

// ============================================
// PÁGINA: DASHBOARD
// ============================================

const Dashboard = () => {
  const [events, setEvents] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [eventToDelete, setEventToDelete] = useState(null);
  const [showLinks, setShowLinks] = useState(null);
  const [newEvent, setNewEvent] = useState({ title: '', date: '', time: '', location: '', leader: '', type: 'Reunión' });
  const navigate = useNavigate();

  const getBaseUrl = () => {
    return window.location.origin + window.location.pathname;
  };

  const fetchData = async () => {
    try {
      const eventsSnap = await getDocs(query(collection(db, "events"), orderBy("createdAt", "desc")));
      const workersSnap = await getDocs(query(collection(db, "electoral_workers")));
      setEvents(eventsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setWorkers(workersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
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
        createdAt: new Date().toISOString()
      });
      setShowModal(false);
      setNewEvent({ title: '', date: '', time: '', location: '', leader: '', type: 'Reunión' });
      fetchData();
      setShowLinks(docRef.id);
    } catch (error) {
      console.error("Error:", error);
      alert("Error creando evento");
    }
  };

  const handleDeleteEvent = async (eventId) => {
    if (confirm('¿Eliminar evento?')) {
      try {
        await deleteDoc(doc(db, "events", eventId));
        fetchData();
        setEventToDelete(null);
      } catch (error) {
        alert("Error eliminando");
      }
    }
  };

  const exportToExcel = (data, fileName) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Datos");
    XLSX.writeFile(wb, `${fileName}.xlsx`);
  };

  if (loading) return <Loading />;

  return (
    <div className="min-h-screen pb-20 bg-gray-50">
      <Header title="CivisCore Dashboard" />
      <div className="max-w-4xl mx-auto p-4 space-y-6">
        
        {/* Tarjetas resumen */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-blue-600 text-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-2"><Calendar size={20} /><span className="text-sm">Eventos</span></div>
            <p className="text-3xl font-bold">{events.length}</p>
          </div>
          <div className="bg-green-600 text-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-2"><Users size={20} /><span className="text-sm">Electoreros</span></div>
            <p className="text-3xl font-bold">{workers.length}</p>
          </div>
        </div>

        {/* Botón crear evento */}
        <button onClick={() => setShowModal(true)} className="w-full py-4 bg-white border-2 border-dashed border-gray-300 rounded-xl text-gray-500 font-semibold hover:border-blue-600 hover:text-blue-600 flex items-center justify-center gap-2 transition-colors">
          <Plus size={20} /> Crear Evento
        </button>

        {/* Lista eventos */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-gray-700 flex items-center gap-2">
            <Activity size={20} /> Eventos Activos
          </h2>
          {events.map(event => (
            <div key={event.id} className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="font-bold text-lg text-gray-800">{event.title}</h3>
                  <p className="text-sm text-gray-500 flex items-center gap-1">
                    <MapPin size={14} /> {event.location} • {event.date} {event.time}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Líder: {event.leader}</p>
                </div>
                <button onClick={() => setEventToDelete(event.id)} className="text-red-500 hover:text-red-700 p-1">
                  <Trash2 size={18} />
                </button>
              </div>
              <div className="flex flex-col gap-3 mt-4">
                <button onClick={() => setShowLinks(showLinks === event.id ? null : event.id)} className="w-full bg-blue-100 hover:bg-blue-200 text-blue-700 py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors">
                  <LinkIcon size={16} /> {showLinks === event.id ? 'Ocultar Links' : 'Generar Links de Registro'}
                </button>
                {showLinks === event.id && (
                  <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                    <p className="text-sm font-medium text-gray-700">Link para tomar asistencia:</p>
                    <LinkCopier url={`${getBaseUrl()}#/form/event/${event.id}`} label={event.title} />
                  </div>
                )}
                <button onClick={() => navigate(`/stats/${event.id}`)} className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors">
                  <BarChart3 size={16} /> Ver Estadísticas y Datos
                </button>
              </div>
            </div>
          ))}
          {events.length === 0 && (
            <div className="bg-white rounded-xl p-8 text-center text-gray-400">
              <Calendar size={48} className="mx-auto mb-3 opacity-50" />
              <p>No hay eventos creados aún</p>
            </div>
          )}
        </div>

        {/* Electoreros */}
        <div className="pt-6 border-t border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-gray-700 flex items-center gap-2">
              <Users size={20} /> Electoreros
            </h2>
            <button onClick={() => exportToExcel(workers, "Electoreros")} className="text-green-600 text-sm flex items-center gap-1 hover:underline">
              <Download size={16} /> Descargar Excel
            </button>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
            <p className="text-sm font-medium text-green-800 mb-2">Link registro de electoreros:</p>
            <LinkCopier url={`${getBaseUrl()}#/form/worker`} label="Registro Electoreros" />
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

      {/* Modal crear evento */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">Nuevo Evento</h2>
            <form onSubmit={handleCreateEvent} className="space-y-4">
              <input required placeholder="Nombre del Evento" className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-600 outline-none" value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})} />
              <input required placeholder="Líder que convoca" className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-600 outline-none" value={newEvent.leader} onChange={e => setNewEvent({...newEvent, leader: e.target.value})} />
              <div className="grid grid-cols-2 gap-3">
                <input required type="date" className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-600 outline-none" value={newEvent.date} onChange={e => setNewEvent({...newEvent, date: e.target.value})} />
                <input required type="time" className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-600 outline-none" value={newEvent.time} onChange={e => setNewEvent({...newEvent, time: e.target.value})} />
              </div>
              <input required placeholder="Lugar / Dirección" className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-600 outline-none" value={newEvent.location} onChange={e => setNewEvent({...newEvent, location: e.target.value})} />
              <select className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-600 outline-none bg-white" value={newEvent.type} onChange={e => setNewEvent({...newEvent, type: e.target.value})}>
                <option>Reunión</option>
                <option>Volanteo</option>
                <option>Casa por Casa</option>
                <option>Mitin</option>
              </select>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 text-gray-600 font-medium border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
                <button type="submit" className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg">Crear Evento</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal eliminar */}
      {eventToDelete && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4 text-red-600">Eliminar Evento</h2>
            <p className="text-gray-600 mb-6">¿Estás seguro? Se perderán todos los datos de asistencia.</p>
            <div className="flex gap-3">
              <button onClick={() => setEventToDelete(null)} className="flex-1 py-3 text-gray-600 font-medium border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
              <button onClick={() => handleDeleteEvent(eventToDelete)} className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// PÁGINA: FORMULARIO PÚBLICO (CORREGIDO)
// ============================================

const PublicForm = ({ type }) => {
  const { id } = useParams();
  const [formData, setFormData] = useState({ name: '', idNumber: '', phone: '', sector: '', photo: null });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const sectors = ["Zona Urbana", "Filadelfia", "Samaria", "San Luis", "Morritos", "La Paila", "El Pintado", "El Verso", "La Soledad"];

  // Solo electoreros necesitan foto
  const requiresPhoto = type === 'worker';

  const checkDuplicate = async (cedula) => {
    const collectionName = type === 'event' ? 'event_attendees' : 'electoral_workers';
    let q;
    if (type === 'event' && id) {
      q = query(collection(db, collectionName), where("idNumber", "==", cedula), where("eventId", "==", id));
    } else {
      q = query(collection(db, collectionName), where("idNumber", "==", cedula));
    }
    const snapshot = await getDocs(q);
    return !snapshot.empty;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const isDuplicate = await checkDuplicate(formData.idNumber);
      if (isDuplicate) {
        setError('Esta cédula ya está registrada. No se permiten duplicados.');
        setLoading(false);
        return;
      }

      let photoURL = '';
      // Solo subir foto si es electorero
      if (requiresPhoto && formData.photo) {
        const storageRef = ref(storage, `ids/${type}_${Date.now()}_${formData.idNumber}`);
        const snapshot = await uploadBytes(storageRef, formData.photo);
        photoURL = await getDownloadURL(snapshot.ref);
      }

      await addDoc(collection(db, type === 'event' ? 'event_attendees' : 'electoral_workers'), {
        ...formData,
        photoURL: requiresPhoto ? photoURL : null,
        registeredAt: new Date().toISOString(),
        eventId: type === 'event' ? id : null
      });
      setSuccess(true);
    } catch (err) {
      console.error("Error:", err);
      setError('Error al guardar. Verifica tu conexión.');
    } finally {
      setLoading(false);
    }
  };

  if (success) return <SuccessMessage message={type === 'event' ? "Asistencia registrada" : "Registro completado"} />;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header title={type === 'event' ? "Registro de Asistencia" : "Registro Electoreros"} />
      <div className="flex-1 max-w-md mx-auto w-full p-4 flex flex-col justify-center">
        <div className="bg-white rounded-xl p-6 mb-6 text-center shadow-sm">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
            {type === 'event' ? <Users className="text-blue-600" size={32} /> : <BadgeCheck className="text-green-600" size={32} />}
          </div>
          <h2 className="text-xl font-bold text-gray-800">{type === 'event' ? "Registro de Asistencia" : "Registro de Electoreros"}</h2>
          <p className="text-gray-500 text-sm mt-1">Completa tus datos para continuar</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Completo</label>
            <input required className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-600 outline-none" placeholder="Ej: Juan Pérez" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cédula</label>
              <input required type="number" className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-600 outline-none" placeholder="Sin puntos" value={formData.idNumber} onChange={e => setFormData({...formData, idNumber: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Celular</label>
              <input required type="tel" className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-600 outline-none" placeholder="Ej: 3001234567" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sector / Zona</label>
            <select required className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-600 outline-none bg-white" value={formData.sector} onChange={e => setFormData({...formData, sector: e.target.value})}>
              <option value="">Seleccione...</option>
              {sectors.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* CAMBIO: Foto solo para electoreros */}
          {requiresPhoto && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Foto de Cédula <span className="text-red-500">*</span>
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:bg-gray-50 transition-colors">
                <input type="file" accept="image/*" capture="environment" className="w-full" onChange={e => setFormData({...formData, photo: e.target.files[0]})} />
                <Camera className="mx-auto text-gray-400 mb-2" size={24} />
                <p className="text-sm text-gray-500">{formData.photo ? formData.photo.name : "Toca para subir foto"}</p>
              </div>
            </div>
          )}

          <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-colors">
            {loading ? 'Guardando...' : 'Enviar Registro'}
          </button>
        </form>
        <p className="text-center text-xs text-gray-400 mt-8">Tus datos están protegidos.</p>
      </div>
      {error && <ErrorMessage message={error} onClose={() => setError('')} />}
    </div>
  );
};

// ============================================
// PÁGINA: ESTADÍSTICAS
// ============================================

const EventStats = () => {
  const { id } = useParams();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetch = async () => {
      try {
        const q = query(collection(db, "event_attendees"), where("eventId", "==", id));
        const snapshot = await getDocs(q);
        setData(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        console.error("Error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
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
      <Header title="Estadísticas" onBack={() => navigate('/')} />
      <div className="max-w-4xl mx-auto p-4 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl p-6 text-center shadow-sm">
            <p className="text-gray-500 text-sm">Asistentes</p>
            <p className="text-4xl font-bold text-blue-600">{data.length}</p>
          </div>
          <div className="bg-white rounded-xl p-6 text-center shadow-sm">
            <p className="text-gray-500 text-sm">Sectores</p>
            <p className="text-4xl font-bold text-green-600">{chartData.length}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="font-bold text-gray-700 mb-4">Por Sector</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} dataKey="value">
                  {chartData.map((entry, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-gray-700">Base de Datos</h3>
            <button onClick={() => {
              const ws = XLSX.utils.json_to_sheet(data);
              const wb = XLSX.utils.book_new();
              XLSX.utils.book_append_sheet(wb, ws, "Datos");
              XLSX.writeFile(wb, "Asistentes.xlsx");
            }} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2">
              <Download size={16} /> Excel
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-100 text-gray-600">
                <tr><th className="p-3">Nombre</th><th className="p-3">Cédula</th><th className="p-3">Celular</th><th className="p-3">Sector</th></tr>
              </thead>
              <tbody className="divide-y">
                {data.map(p => (
                  <tr key={p.id}>
                    <td className="p-3">{p.name}</td>
                    <td className="p-3">{p.idNumber}</td>
                    <td className="p-3">{p.phone}</td>
                    <td className="p-3"><span className="bg-gray-100 px-2 py-1 rounded text-xs">{p.sector}</span></td>
                  </tr>
                ))}
                {data.length === 0 && (
                  <tr><td colSpan="4" className="p-8 text-center text-gray-400">Sin registros</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// APP PRINCIPAL
// ============================================

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/form/event/:id" element={<PublicForm type="event" />} />
        <Route path="/form/worker" element={<PublicForm type="worker" />} />
        <Route path="/stats/:id" element={<EventStats />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
