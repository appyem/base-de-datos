// ARCHIVO: src/App.jsx (CON FILTROS AVANZADOS + ELIMINAR ELECTOREROS)
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, useParams, useNavigate } from 'react-router-dom';
import { db } from './firebase';
import { collection, addDoc, onSnapshot, query, where, orderBy, deleteDoc, doc, getDocs } from 'firebase/firestore';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from 'recharts';
import { 
  Users, Calendar, Download, Plus, Activity, FileSpreadsheet, 
  ArrowLeft, Trash2, Link as LinkIcon, AlertCircle,
  BarChart3, Copy, Share2, ExternalLink, CheckCircle, MapPin, BadgeCheck, UserCheck, Building2, RefreshCw, Filter, Search, X
} from 'lucide-react';
import * as XLSX from 'xlsx';

// ============================================
// CONFIGURACIÓN
// ============================================

const MAX_ELECTOREROS = 1000;

// ============================================
// COMPONENTES UI
// ============================================

const Header = ({ title, onBack }) => (
  <div className="bg-white shadow-sm sticky top-0 z-50">
    <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-4">
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
    <p className="text-gray-500 font-medium">Cargando Bases De Datos...</p>
  </div>
);

const SuccessMessage = ({ message }) => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <CheckCircle size={32} className="text-green-600" />
      </div>
      <h3 className="text-xl font-bold text-gray-800 mb-2">¡Éxito!</h3>
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
        await navigator.share({ title: 'Bases De Datos - Registro', text: label, url });
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
// DASHBOARD (CON FILTROS AVANZADOS + ELIMINAR)
// ============================================

const Dashboard = () => {
  const [events, setEvents] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [eventToDelete, setEventToDelete] = useState(null);
  const [showLinks, setShowLinks] = useState(null);
  const [newEvent, setNewEvent] = useState({ title: '', date: '', time: '', location: '', leader: '', type: 'Reunión' });
  const [selectedMunicipality, setSelectedMunicipality] = useState('Todos');
  const [selectedLeader, setSelectedLeader] = useState('Todos');
  const [searchCedula, setSearchCedula] = useState('');
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [workerToDelete, setWorkerToDelete] = useState(null);
  const [showSuccess, setShowSuccess] = useState('');
  const navigate = useNavigate();

  const municipalities = [
    "Todos", "Aguadas", "Anserma", "Aranzazu", "Belalcázar", "Chinchiná", "Filadelfia",
    "La Dorada", "La Merced", "Manizales (Capital)", "Manzanares", "Marmato",
    "Marquetalia", "Marulanda", "Neira", "Norcasia", "Pácora", "Palestina",
    "Pensilvania", "Riosucio", "Risaralda", "Salamina", "Samaná", "San José",
    "Supía", "Victoria", "Villamaría", "Viterbo"
  ];

  const getBaseUrl = () => window.location.origin + window.location.pathname;

  // Obtener líderes únicos para el filtro
  const uniqueLeaders = ['Todos', ...new Set(workers.map(w => w.leaderRef).filter(Boolean))].sort();

  // TIEMPO REAL CON onSnapshot
  useEffect(() => {
    const eventsQuery = query(collection(db, "events"), orderBy("createdAt", "desc"));
    const unsubscribeEvents = onSnapshot(eventsQuery, (snapshot) => {
      const eventsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setEvents(eventsData);
      setLastUpdate(new Date());
    });

    const workersQuery = query(collection(db, "electoral_workers"));
    const unsubscribeWorkers = onSnapshot(workersQuery, (snapshot) => {
      const workersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setWorkers(workersData);
      setLastUpdate(new Date());
    });

    setLoading(false);

    return () => {
      unsubscribeEvents();
      unsubscribeWorkers();
    };
  }, []);

  // FILTROS COMBINADOS (Municipio + Líder + Cédula)
  const filteredWorkers = workers.filter(w => {
    const matchMunicipality = selectedMunicipality === 'Todos' || w.sector === selectedMunicipality;
    const matchLeader = selectedLeader === 'Todos' || w.leaderRef === selectedLeader;
    const matchCedula = searchCedula === '' || w.idNumber.includes(searchCedula);
    return matchMunicipality && matchLeader && matchCedula;
  });

  const workersByMunicipality = municipalities.filter(m => m !== 'Todos').map(municipality => ({
    name: municipality,
    count: workers.filter(w => w.sector === municipality).length
  })).filter(m => m.count > 0).sort((a, b) => b.count - a.count);

  // Calcular progreso del límite
  const progressPercentage = (workers.length / MAX_ELECTOREROS) * 100;
  const remainingSpots = MAX_ELECTOREROS - workers.length;
  const isNearLimit = workers.length >= MAX_ELECTOREROS * 0.9;
  const isAtLimit = workers.length >= MAX_ELECTOREROS;

  const handleCreateEvent = async (e) => {
    e.preventDefault();
    try {
      const docRef = await addDoc(collection(db, "events"), { ...newEvent, createdAt: new Date().toISOString() });
      setShowModal(false);
      setNewEvent({ title: '', date: '', time: '', location: '', leader: '', type: 'Reunión' });
      setShowLinks(docRef.id);
    } catch (error) {
      alert("Error creando evento");
    }
  };

  const handleDeleteEvent = async (eventId) => {
    if (confirm('¿Eliminar evento?')) {
      try {
        await deleteDoc(doc(db, "events", eventId));
        setEventToDelete(null);
      } catch (error) {
        alert("Error eliminando");
      }
    }
  };

  // ELIMINAR ELECTORER
  const handleDeleteWorker = async (workerId, workerName) => {
    if (confirm(`¿Estás seguro de eliminar a ${workerName}? Esta acción no se puede deshacer.`)) {
      try {
        await deleteDoc(doc(db, "electoral_workers", workerId));
        setWorkerToDelete(null);
        setShowSuccess('Electorero eliminado correctamente');
        setTimeout(() => setShowSuccess(''), 3000);
      } catch (error) {
        console.error("Error deleting worker:", error);
        alert("Error eliminando electorero");
      }
    }
  };

  const exportToExcel = (data, fileName) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Datos");
    XLSX.writeFile(wb, `${fileName}.xlsx`);
  };

  const exportFilteredExcel = () => {
    const dataToExport = filteredWorkers.map(w => ({
      Nombre: w.name,
      Cédula: w.idNumber,
      Celular: w.phone,
      Municipio: w.sector,
      Líder: w.leaderRef || '',
      Puesto: w.votingStation || ''
    }));
    exportToExcel(dataToExport, `Electoreros_Filtrado_${selectedMunicipality}`);
  };

  const clearAllFilters = () => {
    setSelectedMunicipality('Todos');
    setSelectedLeader('Todos');
    setSearchCedula('');
  };

  const hasActiveFilters = selectedMunicipality !== 'Todos' || selectedLeader !== 'Todos' || searchCedula !== '';

  if (loading) return <Loading />;

  return (
    <div className="min-h-screen pb-20 bg-gray-50">
      <Header title="Bases De Datos Dashboard" />
      <div className="max-w-6xl mx-auto p-4 space-y-6">
        
        {/* Notificación de éxito */}
        {showSuccess && (
          <div className="fixed top-20 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
            <CheckCircle size={20} />
            {showSuccess}
          </div>
        )}

        {/* Indicador de tiempo real */}
        <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-green-700 font-medium">Actualización en tiempo real</span>
          </div>
          <span className="text-xs text-gray-500">
            Última: {lastUpdate.toLocaleTimeString()}
          </span>
        </div>

        {/* Barra de progreso del límite */}
        <div className={`rounded-xl p-6 shadow-sm ${isAtLimit ? 'bg-red-50 border-2 border-red-300' : isNearLimit ? 'bg-orange-50 border-2 border-orange-300' : 'bg-blue-50 border-2 border-blue-200'}`}>
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <Users size={24} className={isAtLimit ? 'text-red-600' : isNearLimit ? 'text-orange-600' : 'text-blue-600'} />
              <div>
                <h3 className="font-bold text-lg">Límite de Electoreros</h3>
                <p className="text-sm text-gray-600">
                  {isAtLimit ? '⚠️ ¡LÍMITE ALCANZADO!' : isNearLimit ? '⚠️ ¡Casi llegamos al límite!' : '📊 Progreso de inscripciones'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold">{workers.length}</p>
              <p className="text-sm text-gray-600">de {MAX_ELECTOREROS}</p>
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4 mb-3">
            <div 
              className={`h-4 rounded-full transition-all duration-500 ${isAtLimit ? 'bg-red-600' : isNearLimit ? 'bg-orange-500' : 'bg-blue-600'}`}
              style={{ width: `${Math.min(progressPercentage, 100)}%` }}
            ></div>
          </div>
          <div className="flex justify-between text-sm">
            <span className={isAtLimit ? 'text-red-600 font-bold' : isNearLimit ? 'text-orange-600 font-bold' : 'text-gray-600'}>
              {remainingSpots} cupos {isAtLimit ? 'DISPONIBLES' : 'restantes'}
            </span>
            <span className="text-gray-600">{progressPercentage.toFixed(1)}% completado</span>
          </div>
        </div>

        {/* Tarjetas resumen */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-600 text-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-2"><Calendar size={20} /><span className="text-sm">Eventos</span></div>
            <p className="text-3xl font-bold">{events.length}</p>
          </div>
          <div className={`rounded-xl p-6 shadow-sm ${isAtLimit ? 'bg-red-600' : 'bg-green-600'} text-white`}>
            <div className="flex items-center gap-2 mb-2"><Users size={20} /><span className="text-sm">Electoreros</span></div>
            <p className="text-3xl font-bold">{filteredWorkers.length}</p>
          </div>
          <div className="bg-purple-600 text-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-2"><UserCheck size={20} /><span className="text-sm">Líderes</span></div>
            <p className="text-3xl font-bold">{new Set(filteredWorkers.map(w => w.leaderRef).filter(Boolean)).size}</p>
          </div>
          <div className="bg-orange-600 text-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-2"><Building2 size={20} /><span className="text-sm">Puestos</span></div>
            <p className="text-3xl font-bold">{new Set(filteredWorkers.map(w => w.votingStation).filter(Boolean)).size}</p>
          </div>
        </div>

        {/* Gráfico por Municipio */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
            <BarChart3 size={20} /> Inscritos por Municipio
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={workersByMunicipality} layout="vertical">
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={120} tick={{fontSize: 11}} />
                <Tooltip />
                <Bar dataKey="count" fill="#2563EB" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* FILTROS AVANZADOS */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-gray-700 flex items-center gap-2">
              <Filter size={20} /> Filtros de Búsqueda
            </h3>
            {hasActiveFilters && (
              <button 
                onClick={clearAllFilters}
                className="text-sm text-red-600 hover:text-red-800 flex items-center gap-1"
              >
                <X size={16} /> Limpiar todos
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Filtro por Municipio */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Municipio</label>
              <select 
                value={selectedMunicipality} 
                onChange={(e) => setSelectedMunicipality(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-600 outline-none bg-white"
              >
                {municipalities.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            {/* Filtro por Líder */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Líder que lo Remite</label>
              <select 
                value={selectedLeader} 
                onChange={(e) => setSelectedLeader(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-600 outline-none bg-white"
              >
                {uniqueLeaders.map(leader => (
                  <option key={leader} value={leader}>{leader}</option>
                ))}
              </select>
            </div>

            {/* Búsqueda por Cédula */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Buscar por Cédula</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input 
                  type="text" 
                  placeholder="Ej: 123456789"
                  value={searchCedula}
                  onChange={(e) => setSearchCedula(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-600 outline-none"
                />
              </div>
            </div>
          </div>
          {hasActiveFilters && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg flex items-center gap-2 text-sm text-blue-700">
              <CheckCircle size={16} />
              Mostrando {filteredWorkers.length} de {workers.length} registros filtrados
            </div>
          )}
        </div>

        <button onClick={() => setShowModal(true)} className="w-full py-4 bg-white border-2 border-dashed border-gray-300 rounded-xl text-gray-500 font-semibold hover:border-blue-600 hover:text-blue-600 flex items-center justify-center gap-2">
          <Plus size={20} /> Crear Evento
        </button>

        {/* Lista eventos */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-gray-700 flex items-center gap-2"><Activity size={20} /> Eventos Activos</h2>
          {events.map(event => (
            <div key={event.id} className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="font-bold text-lg text-gray-800">{event.title}</h3>
                  <p className="text-sm text-gray-500 flex items-center gap-1"><MapPin size={14} /> {event.location} • {event.date} {event.time}</p>
                  <p className="text-xs text-gray-400 mt-1">Líder: {event.leader}</p>
                </div>
                <button onClick={() => setEventToDelete(event.id)} className="text-red-500 hover:text-red-700 p-1"><Trash2 size={18} /></button>
              </div>
              <div className="flex flex-col gap-3 mt-4">
                <button onClick={() => setShowLinks(showLinks === event.id ? null : event.id)} className="w-full bg-blue-100 hover:bg-blue-200 text-blue-700 py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2">
                  <LinkIcon size={16} /> {showLinks === event.id ? 'Ocultar Links' : 'Generar Links de Registro'}
                </button>
                {showLinks === event.id && (
                  <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                    <p className="text-sm font-medium text-gray-700">Link para tomar asistencia:</p>
                    <LinkCopier url={`${getBaseUrl()}#/form/event/${event.id}`} label={event.title} />
                  </div>
                )}
                <button onClick={() => navigate(`/stats/${event.id}`)} className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2">
                  <BarChart3 size={16} /> Ver Estadísticas
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

        {/* Electoreros - TABLA CON ELIMINAR */}
        <div className="pt-6 border-t border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-gray-700 flex items-center gap-2">
              <Users size={20} /> {selectedMunicipality === 'Todos' && selectedLeader === 'Todos' && searchCedula === '' ? 'Base de Datos Electoreros' : 'Resultados Filtrados'}
            </h2>
            <button onClick={exportFilteredExcel} className="text-green-600 text-sm flex items-center gap-1 hover:underline">
              <Download size={16} /> Descargar Excel
            </button>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
            <p className="text-sm font-medium text-green-800 mb-2">Link registro de electoreros:</p>
            <LinkCopier url={`${getBaseUrl()}#/form/worker`} label="Registro Electoreros" />
          </div>
          <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Nombre</th>
                  <th className="px-4 py-3 text-left">Cédula</th>
                  <th className="px-4 py-3 text-left">Celular</th>
                  <th className="px-4 py-3 text-left">Municipio</th>
                  <th className="px-4 py-3 text-left">Líder</th>
                  <th className="px-4 py-3 text-left">Puesto</th>
                  <th className="px-4 py-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredWorkers.slice(0, 50).map(w => (
                  <tr key={w.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{w.name}</td>
                    <td className="px-4 py-3 text-gray-600">{w.idNumber}</td>
                    <td className="px-4 py-3 text-gray-600">{w.phone}</td>
                    <td className="px-4 py-3"><span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">{w.sector}</span></td>
                    <td className="px-4 py-3 text-gray-600">{w.leaderRef || '-'}</td>
                    <td className="px-4 py-3 text-gray-600">{w.votingStation || '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <button 
                        onClick={() => setWorkerToDelete(w)}
                        className="text-red-600 hover:text-red-800 hover:bg-red-50 px-3 py-1 rounded transition-colors flex items-center gap-1 mx-auto"
                        title="Eliminar electorero"
                      >
                        <Trash2 size={16} /> Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredWorkers.length === 0 && (
                  <tr><td colSpan="7" className="px-4 py-8 text-center text-gray-400">No se encontraron registros con los filtros actuales</td></tr>
                )}
              </tbody>
            </table>
            {filteredWorkers.length > 50 && (
              <div className="p-3 text-center text-xs text-gray-400 border-t bg-gray-50">
                Mostrando 50 de {filteredWorkers.length} registros. Descarga Excel para ver todos.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal eliminar electorero */}
      {workerToDelete && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 size={32} className="text-red-600" />
            </div>
            <h2 className="text-xl font-bold mb-2 text-center">Eliminar Electorero</h2>
            <p className="text-gray-600 mb-6 text-center">
              ¿Estás seguro de eliminar a <strong>{workerToDelete.name}</strong> con cédula <strong>{workerToDelete.idNumber}</strong>?<br/><br/>
              Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setWorkerToDelete(null)} className="flex-1 py-3 text-gray-600 font-medium border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
              <button onClick={() => handleDeleteWorker(workerToDelete.id, workerToDelete.name)} className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg">Eliminar</button>
            </div>
          </div>
        </div>
      )}

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
// FORMULARIO PÚBLICO
// ============================================

const PublicForm = ({ type }) => {
  const { id } = useParams();
  const [formData, setFormData] = useState({ 
    name: '', idNumber: '', phone: '', sector: '', leaderRef: '', votingStation: '' 
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [totalWorkers, setTotalWorkers] = useState(0);

  const municipalities = [
    "Aguadas", "Anserma", "Aranzazu", "Belalcázar", "Chinchiná", "Filadelfia",
    "La Dorada", "La Merced", "Manizales (Capital)", "Manzanares", "Marmato",
    "Marquetalia", "Marulanda", "Neira", "Norcasia", "Pácora", "Palestina",
    "Pensilvania", "Riosucio", "Risaralda", "Salamina", "Samaná", "San José",
    "Supía", "Victoria", "Villamaría", "Viterbo"
  ];

  const requiresExtraFields = type === 'worker';

  useEffect(() => {
    if (type === 'worker') {
      const workersQuery = query(collection(db, "electoral_workers"));
      const unsubscribe = onSnapshot(workersQuery, (snapshot) => {
        setTotalWorkers(snapshot.size);
      });
      return () => unsubscribe();
    }
  }, [type]);

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
      if (type === 'worker' && totalWorkers >= MAX_ELECTOREROS) {
        setError(`Lo sentimos, se ha alcanzado el límite máximo de ${MAX_ELECTOREROS} electoreros.`);
        setLoading(false);
        return;
      }

      const isDuplicate = await checkDuplicate(formData.idNumber);
      if (isDuplicate) {
        setError('Esta cédula ya está registrada. No se permiten duplicados.');
        setLoading(false);
        return;
      }

      await addDoc(collection(db, type === 'event' ? 'event_attendees' : 'electoral_workers'), {
        name: formData.name,
        idNumber: formData.idNumber,
        phone: formData.phone,
        sector: formData.sector,
        leaderRef: requiresExtraFields ? formData.leaderRef : null,
        votingStation: requiresExtraFields ? formData.votingStation : null,
        registeredAt: new Date().toISOString(),
        eventId: type === 'event' ? id : null
      });
      
      setSuccess(true);
    } catch (err) {
      console.error("Error:", err);
      setError('Error al guardar: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleNameChange = (e) => {
    setFormData({...formData, name: e.target.value.toUpperCase()});
  };

  const remainingSpots = MAX_ELECTOREROS - totalWorkers;
  const isAtLimit = totalWorkers >= MAX_ELECTOREROS;
  const isNearLimit = totalWorkers >= MAX_ELECTOREROS * 0.9;

  if (success) return <SuccessMessage message={type === 'event' ? "Asistencia registrada" : "Registro completado"} />;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header title={type === 'event' ? "Registro de Asistencia" : "Registro Electoreros"} />
      <div className="flex-1 max-w-md mx-auto w-full p-4 flex flex-col justify-center">
        
        {type === 'worker' && (
          <div className={`rounded-xl p-4 mb-6 shadow-sm ${isAtLimit ? 'bg-red-50 border-2 border-red-300' : isNearLimit ? 'bg-orange-50 border-2 border-orange-300' : 'bg-blue-50 border-2 border-blue-200'}`}>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">Cupos disponibles</span>
              <span className={`text-lg font-bold ${isAtLimit ? 'text-red-600' : isNearLimit ? 'text-orange-600' : 'text-blue-600'}`}>
                {remainingSpots} de {MAX_ELECTOREROS}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div 
                className={`h-3 rounded-full transition-all ${isAtLimit ? 'bg-red-600' : isNearLimit ? 'bg-orange-500' : 'bg-blue-600'}`}
                style={{ width: `${Math.min((totalWorkers / MAX_ELECTOREROS) * 100, 100)}%` }}
              ></div>
            </div>
            {isNearLimit && !isAtLimit && (
              <p className="text-xs text-orange-600 mt-2">⚠️ ¡Quedan pocos cupos!</p>
            )}
            {isAtLimit && (
              <p className="text-xs text-red-600 mt-2">❌ No hay cupos disponibles.</p>
            )}
          </div>
        )}

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
            <input required className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-600 outline-none uppercase" placeholder="Ej: JUAN PÉREZ" value={formData.name} onChange={handleNameChange} style={{ textTransform: 'uppercase' }} disabled={isAtLimit && type === 'worker'} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cédula</label>
              <input required type="number" className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-600 outline-none" placeholder="Sin puntos" value={formData.idNumber} onChange={e => setFormData({...formData, idNumber: e.target.value})} disabled={isAtLimit && type === 'worker'} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Celular</label>
              <input required type="tel" className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-600 outline-none" placeholder="Ej: 3001234567" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} disabled={isAtLimit && type === 'worker'} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Municipio</label>
            <select required className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-600 outline-none bg-white" value={formData.sector} onChange={e => setFormData({...formData, sector: e.target.value})} disabled={isAtLimit && type === 'worker'}>
              <option value="">Seleccione Municipio...</option>
              {municipalities.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          {requiresExtraFields && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Líder que lo Remite</label>
                <input required className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-600 outline-none uppercase" placeholder="Ej: CARLOS RAMÍREZ" value={formData.leaderRef} onChange={e => setFormData({...formData, leaderRef: e.target.value.toUpperCase()})} style={{ textTransform: 'uppercase' }} disabled={isAtLimit && type === 'worker'} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Puesto de Votación</label>
                <input required className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-600 outline-none uppercase" placeholder="Ej: ESCUELA CENTRAL" value={formData.votingStation} onChange={e => setFormData({...formData, votingStation: e.target.value.toUpperCase()})} style={{ textTransform: 'uppercase' }} disabled={isAtLimit && type === 'worker'} />
              </div>
            </>
          )}

          <button type="submit" disabled={loading || (isAtLimit && type === 'worker')} className={`w-full font-bold py-3 rounded-lg transition-colors ${isAtLimit && type === 'worker' ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>
            {isAtLimit && type === 'worker' ? 'LÍMITE ALCANZADO' : loading ? 'Guardando...' : 'Enviar Registro'}
          </button>
        </form>
        <p className="text-center text-xs text-gray-400 mt-8">Tus datos están protegidos.</p>
      </div>
      {error && <ErrorMessage message={error} onClose={() => setError('')} />}
    </div>
  );
};

// ============================================
// ESTADÍSTICAS
// ============================================

const EventStats = () => {
  const { id } = useParams();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const q = query(collection(db, "event_attendees"), where("eventId", "==", id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setData(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsubscribe();
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
      <div className="max-w-6xl mx-auto p-4 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl p-6 text-center shadow-sm">
            <p className="text-gray-500 text-sm">Asistentes</p>
            <p className="text-4xl font-bold text-blue-600">{data.length}</p>
          </div>
          <div className="bg-white rounded-xl p-6 text-center shadow-sm">
            <p className="text-gray-500 text-sm">Municipios</p>
            <p className="text-4xl font-bold text-green-600">{chartData.length}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="font-bold text-gray-700 mb-4">Por Municipio</h3>
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
            <table className="w-full text-sm">
              <thead className="bg-gray-100 text-gray-600">
                <tr><th className="p-3 text-left">Nombre</th><th className="p-3 text-left">Cédula</th><th className="p-3 text-left">Celular</th><th className="p-3 text-left">Municipio</th></tr>
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
