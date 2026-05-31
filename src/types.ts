export type UserProfile = {
  id: string;
  email: string;
  name: string;
  photoURL: string;
};

export type PropertyStatus = 'disponible' | 'reservada' | 'vendida' | 'alquilada';
export type PropertyType = 'casa' | 'departamento' | 'terreno' | 'local' | 'oficina';

export type Property = {
  id: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  address: string;
  lat: number;
  lng: number;
  status: PropertyStatus;
  type: PropertyType;
  agentId: string;
  bedrooms: number;
  bathrooms: number;
  areaSqM: number;
  images: string[];
  createdAt: number;
  updatedAt: number;
};

export type ClientType = 'lead' | 'cliente';
export type ClientStatus = 'nuevo' | 'contactado' | 'negociacion' | 'convertido' | 'perdido';

export type Client = {
  id: string;
  name: string;
  email: string;
  phone: string;
  type: ClientType;
  status: ClientStatus;
  agentId: string;
  notes: string;
  createdAt: number;
};

export type AppointmentStatus = 'pendiente' | 'completada' | 'cancelada';

export type Appointment = {
  id: string;
  clientId: string;
  clientName?: string;
  propertyId: string;
  propertyTitle?: string;
  agentId: string;
  date: number;
  status: AppointmentStatus;
  notes: string;
};

export type DocumentTemplate = {
  id: string;
  agentId: string;
  name: string;
  content: string; // Markdown or simple HTML text
  createdAt: number;
};
